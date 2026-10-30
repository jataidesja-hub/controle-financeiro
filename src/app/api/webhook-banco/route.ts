import { NextRequest, NextResponse } from 'next/server';
import { parseBankNotificationText } from '@/utils/bankParsers';
import { getCloudState, saveCloudState } from '@/utils/cloudStore';

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

  // Persist immediately in shared Cloud State so both Computador and Celular see it
  // and the bank balance in "Meus Bancos" automatically adds/subtracts the amount!
  const state = await getCloudState();
  state.transactions = [
    tx,
    ...state.transactions.filter((t) => t.id !== tx.id),
  ];

  if (
    tx.banco &&
    !state.banks.some(
      (b) => b.nome.toLowerCase() === tx.banco!.toLowerCase()
    )
  ) {
    state.banks.push({
      id: `bank-${Date.now().toString().slice(-4)}`,
      nome: tx.banco,
      cor: '#3b82f6',
      saldoInicial: 0,
    });
  }

  const saved = await saveCloudState(state);

  const targetScriptUrl =
    params.scriptUrl ||
    saved.appsScriptUrl ||
    process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
  let syncedToSheet = false;

  if (targetScriptUrl) {
    try {
      const res = await fetch(targetScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'syncAll',
          transactions: saved.transactions,
        }),
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
    totalTransactions: saved.transactions.length,
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const texto = searchParams.get('texto') || searchParams.get('text') || '';
  const banco = searchParams.get('banco') || searchParams.get('app') || 'Nubank';
  const scriptUrl = searchParams.get('scriptUrl') || undefined;

  if (!texto) {
    const state = await getCloudState();
    return NextResponse.json({
      ok: true,
      recent: state.transactions,
      banks: state.banks,
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
