import { NextRequest, NextResponse } from 'next/server';
import { parseBankNotificationText } from '@/utils/bankParsers';
import { Transaction } from '@/types/finance';

// Recent webhook transactions buffer (for quick pull in browser session)
const recentWebhookTransactions: Transaction[] = [];

async function processNotification(params: {
  texto: string;
  banco: string;
  scriptUrl?: string;
}) {
  const tx = parseBankNotificationText(params.texto, params.banco);
  if (!tx) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Não foi encontrado um valor em Reais (ex: R$ 45,90) no texto da notificação.',
      },
      { status: 400 }
    );
  }

  recentWebhookTransactions.unshift(tx);
  if (recentWebhookTransactions.length > 50) {
    recentWebhookTransactions.pop();
  }

  const targetScriptUrl =
    params.scriptUrl || process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
  let syncedToSheet = false;

  if (targetScriptUrl) {
    try {
      const res = await fetch(targetScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'add', transaction: tx }),
        redirect: 'follow',
      });
      syncedToSheet = res.ok;
    } catch {
      syncedToSheet = false;
    }
  }

  return NextResponse.json({
    ok: true,
    syncedToSheet,
    transaction: tx,
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const texto = searchParams.get('texto') || searchParams.get('text') || '';
  const banco = searchParams.get('banco') || searchParams.get('app') || 'Nubank';
  const scriptUrl = searchParams.get('scriptUrl') || undefined;

  if (!texto) {
    return NextResponse.json({
      ok: true,
      recent: recentWebhookTransactions,
    });
  }

  return processNotification({ texto, banco, scriptUrl });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const texto = String(
      body.texto || body.text || body.notificacao || body.message || ''
    );
    const banco = String(body.banco || body.app || 'Nubank');
    const scriptUrl = body.scriptUrl ? String(body.scriptUrl) : undefined;

    return processNotification({ texto, banco, scriptUrl });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: `Erro ao processar webhook: ${String(error)}` },
      { status: 500 }
    );
  }
}
