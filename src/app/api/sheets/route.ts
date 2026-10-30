import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scriptUrl = searchParams.get('scriptUrl') || process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;

  if (!scriptUrl) {
    return NextResponse.json(
      { ok: false, error: 'URL do Google Apps Script não configurada.' },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(scriptUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: `Falha ao ler a planilha: ${String(error)}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const scriptUrl = body.scriptUrl || process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;

    if (!scriptUrl) {
      return NextResponse.json(
        { ok: false, error: 'URL do Google Apps Script não configurada.' },
        { status: 400 }
      );
    }

    const res = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
    });

    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch {
      return NextResponse.json({ ok: res.ok, raw: text });
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: `Erro ao sincronizar com a planilha: ${String(error)}` },
      { status: 500 }
    );
  }
}
