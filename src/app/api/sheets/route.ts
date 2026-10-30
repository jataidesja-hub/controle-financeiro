import { NextRequest, NextResponse } from 'next/server';
import { getCloudState, saveCloudState } from '@/utils/cloudStore';
import { BankAccount, Transaction } from '@/types/finance';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const state = await getCloudState();
  const scriptUrl =
    searchParams.get('scriptUrl') ||
    state.appsScriptUrl ||
    process.env.NEXT_PUBLIC_APPS_SCRIPT_URL ||
    '';

  const forceSheet = searchParams.get('fromSheet') === '1';

  if (forceSheet && scriptUrl) {
    try {
      const res = await fetch(scriptUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.transactions)) {
        return NextResponse.json({
          ok: true,
          source: 'sheets',
          transactions: data.transactions,
          banks: state.banks,
          deletedIds: state.deletedIds,
          appsScriptUrl: scriptUrl,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      return NextResponse.json(
        { ok: false, error: `Falha ao ler a planilha: ${String(error)}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    source: 'cloud',
    transactions: state.transactions,
    banks: state.banks,
    deletedIds: state.deletedIds,
    appsScriptUrl: state.appsScriptUrl,
    updatedAt: state.updatedAt,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body.action || '');
    const state = await getCloudState();

    const scriptUrl = String(
      body.scriptUrl ||
        state.appsScriptUrl ||
        process.env.NEXT_PUBLIC_APPS_SCRIPT_URL ||
        ''
    ).trim();

    if (scriptUrl && scriptUrl !== state.appsScriptUrl) {
      state.appsScriptUrl = scriptUrl;
    }

    if (Array.isArray(body.banks)) {
      state.banks = body.banks as BankAccount[];
    }

    if (Array.isArray(body.clientTransactions)) {
      const deletedSet = new Set(state.deletedIds);
      const map = new Map<string, Transaction>();
      for (const t of state.transactions) {
        if (t && t.id && !deletedSet.has(t.id)) map.set(t.id, t);
      }
      for (const t of body.clientTransactions as Transaction[]) {
        if (t && t.id && !deletedSet.has(t.id)) map.set(t.id, t);
      }
      state.transactions = Array.from(map.values());
    }

    if (action === 'add' && body.transaction) {
      const tx = body.transaction as Transaction;
      state.deletedIds = state.deletedIds.filter((id) => id !== tx.id);
      state.transactions = [
        tx,
        ...state.transactions.filter((t) => t.id !== tx.id),
      ];
    } else if (action === 'addBatch' && Array.isArray(body.transactions)) {
      const batch = body.transactions as Transaction[];
      const batchIds = new Set(batch.map((b) => b.id));
      state.deletedIds = state.deletedIds.filter((id) => !batchIds.has(id));
      state.transactions = [
        ...batch,
        ...state.transactions.filter((t) => !batchIds.has(t.id)),
      ];
    } else if (action === 'update' && body.transaction) {
      const tx = body.transaction as Transaction;
      const exists = state.transactions.some((t) => t.id === tx.id);
      state.transactions = exists
        ? state.transactions.map((t) => (t.id === tx.id ? tx : t))
        : [tx, ...state.transactions];
    } else if (action === 'delete' && body.id) {
      const delId = String(body.id);
      state.transactions = state.transactions.filter((t) => t.id !== delId);
      if (!state.deletedIds.includes(delId)) {
        state.deletedIds = [...state.deletedIds, delId];
      }
    } else if (action === 'merge' && Array.isArray(body.transactions)) {
      const incoming = body.transactions as Transaction[];
      const deletedSet = new Set(state.deletedIds);
      const map = new Map<string, Transaction>();
      for (const t of state.transactions) {
        if (!deletedSet.has(t.id)) map.set(t.id, t);
      }
      for (const t of incoming) {
        if (t && t.id && !deletedSet.has(t.id) && !map.has(t.id)) {
          map.set(t.id, t);
        }
      }
      state.transactions = Array.from(map.values());
    } else if (action === 'syncAll' && Array.isArray(body.transactions)) {
      state.transactions = body.transactions as Transaction[];
    }

    state.transactions.sort((a, b) => b.data.localeCompare(a.data));
    const saved = await saveCloudState(state);

    let sheetSynced = false;
    if (scriptUrl) {
      try {
        const res = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'syncAll',
            transactions: saved.transactions,
          }),
          redirect: 'follow',
        });
        sheetSynced = res.ok;
      } catch {
        sheetSynced = false;
      }
    }

    return NextResponse.json({
      ok: true,
      sheetSynced,
      transactions: saved.transactions,
      banks: saved.banks,
      deletedIds: saved.deletedIds,
      appsScriptUrl: saved.appsScriptUrl,
      updatedAt: saved.updatedAt,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: `Erro ao sincronizar: ${String(error)}` },
      { status: 500 }
    );
  }
}
