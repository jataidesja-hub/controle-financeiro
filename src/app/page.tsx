'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import {
  APPS_SCRIPT_SNIPPET,
  DEFAULT_SPREADSHEET_ID,
  DEFAULT_SPREADSHEET_URL,
  INITIAL_CATEGORIES,
} from '@/data/initialData';
import {
  PaymentMethod,
  SyncSettings,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '@/types/finance';

const STORAGE_KEYS = {
  TRANSACTIONS: 'fincontrol_real_transactions_v2',
  SETTINGS: 'fincontrol_sync_settings_v2',
};

const MONTH_NAMES: Record<string, string> = {
  '01': 'Janeiro',
  '02': 'Fevereiro',
  '03': 'Março',
  '04': 'Abril',
  '05': 'Maio',
  '06': 'Junho',
  '07': 'Julho',
  '08': 'Agosto',
  '09': 'Setembro',
  '10': 'Outubro',
  '11': 'Novembro',
  '12': 'Dezembro',
};

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0);
}

function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatMonthLabel(mesAno: string): string {
  if (mesAno === 'ALL') return 'Todos os Meses';
  const [year, month] = mesAno.split('-');
  if (!year || !month) return mesAno;
  return `${MONTH_NAMES[month] || month} ${year}`;
}

function shiftMonth(mesAno: string, delta: number): string {
  const [y, m] = mesAno.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  const ny = date.getFullYear();
  const nm = String(date.getMonth() + 1).padStart(2, '0');
  return `${ny}-${nm}`;
}

function normalizeRemoteTransaction(raw: Record<string, unknown>, idx: number): Transaction {
  const dataRaw = String(raw.Data || raw.data || getTodayISO()).slice(0, 10);
  const mesAnoRaw = String(raw.MesAno || raw.mesAno || dataRaw.slice(0, 7));
  const valorNum = Number(
    String(raw.Valor ?? raw.valor ?? 0)
      .replace('R$', '')
      .replace(/\s/g, '')
      .replace(',', '.')
  );
  return {
    id: String(raw.ID || raw.id || `TX-${idx + 1}`),
    data: dataRaw,
    mesAno: mesAnoRaw,
    descricao: String(raw.Descricao || raw.descricao || ''),
    tipo: (String(raw.Tipo || raw.tipo) === 'Entrada' ? 'Entrada' : 'Saída') as TransactionType,
    categoria: String(raw.Categoria || raw.categoria || 'Outros'),
    valor: Number.isFinite(valorNum) ? valorNum : 0,
    status: (String(raw.Status || raw.status) === 'Pendente'
      ? 'Pendente'
      : 'Pago') as TransactionStatus,
    vencimento: String(raw.Vencimento || raw.vencimento || dataRaw).slice(0, 10),
    recorrencia: 'Única',
    parcela: '1/1',
    formaPagamento: (String(raw.FormaPagamento || raw.formaPagamento || 'PIX') as PaymentMethod),
    observacoes: String(raw.Observacoes || raw.observacoes || ''),
    criadoEm: String(raw.CriadoEm || raw.criadoEm || new Date().toISOString()),
  };
}

export default function FinanceiroSimplesApp() {
  const today = getTodayISO();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(today.slice(0, 7));
  const [filterTipo, setFilterTipo] = useState<'TODOS' | 'Entrada' | 'Saída' | 'Pendente'>('TODOS');

  // Form states (inline & direct)
  const [tipo, setTipo] = useState<TransactionType>('Saída');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState('Alimentação');
  const [data, setData] = useState(today);
  const [status, setStatus] = useState<TransactionStatus>('Pago');

  // Google Sheets Sync
  const [syncSettings, setSyncSettings] = useState<SyncSettings>({
    spreadsheetId: DEFAULT_SPREADSHEET_ID,
    spreadsheetUrl: DEFAULT_SPREADSHEET_URL,
    appsScriptUrl: process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '',
    autoSync: true,
    lastSyncAt: null,
  });
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // Load saved real data from localStorage
  useEffect(() => {
    try {
      // Clear legacy example key if present
      localStorage.removeItem('fincontrol_transactions_v1');

      const saved = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setTransactions(parsed);
      }
      const savedSet = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (savedSet) {
        setSyncSettings((prev) => ({ ...prev, ...JSON.parse(savedSet) }));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    } catch (e) {
      console.error(e);
    }
  }, [transactions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(syncSettings));
    } catch (e) {
      console.error(e);
    }
  }, [syncSettings]);

  async function pushToSheets(payload: Record<string, unknown>) {
    if (!syncSettings.appsScriptUrl) return false;
    try {
      setIsSyncing(true);
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptUrl: syncSettings.appsScriptUrl,
          ...payload,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setSyncSettings((prev) => ({ ...prev, lastSyncAt: new Date().toISOString() }));
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setIsSyncing(false);
    }
  }

  async function pullFromSheets() {
    if (!syncSettings.appsScriptUrl) {
      setIsSyncModalOpen(true);
      return;
    }
    try {
      setIsSyncing(true);
      setSyncMsg('Carregando da planilha...');
      const res = await fetch(
        `/api/sheets?scriptUrl=${encodeURIComponent(syncSettings.appsScriptUrl)}`
      );
      const json = await res.json();
      if (json.ok && Array.isArray(json.transactions)) {
        const list = json.transactions.map((item: Record<string, unknown>, idx: number) =>
          normalizeRemoteTransaction(item, idx)
        );
        setTransactions(list);
        setSyncSettings((prev) => ({ ...prev, lastSyncAt: new Date().toISOString() }));
        setSyncMsg(`Pronto! ${list.length} lançamentos carregados.`);
      } else {
        setSyncMsg(json.error || 'Erro ao ler planilha.');
      }
    } catch (err) {
      setSyncMsg(`Erro: ${String(err)}`);
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault();
    const numericVal = parseFloat(valor.replace(',', '.'));
    if (!descricao.trim() || Number.isNaN(numericVal) || numericVal <= 0) return;

    const newTx: Transaction = {
      id: `TX-${Date.now().toString().slice(-6)}`,
      data,
      mesAno: data.slice(0, 7),
      descricao: descricao.trim(),
      tipo,
      categoria,
      valor: numericVal,
      status,
      vencimento: data,
      recorrencia: 'Única',
      parcela: '1/1',
      formaPagamento: 'PIX',
      observacoes: '',
      criadoEm: new Date().toISOString(),
    };

    setTransactions((prev) => [newTx, ...prev]);
    setSelectedMonth(newTx.mesAno);
    setDescricao('');
    setValor('');

    if (syncSettings.appsScriptUrl) {
      await pushToSheets({ action: 'add', transaction: newTx });
    }
  }

  async function handleToggleStatus(tx: Transaction) {
    const updated: Transaction = {
      ...tx,
      status: tx.status === 'Pago' ? 'Pendente' : 'Pago',
    };
    setTransactions((prev) => prev.map((t) => (t.id === tx.id ? updated : t)));
    if (syncSettings.appsScriptUrl) {
      await pushToSheets({ action: 'update', transaction: updated });
    }
  }

  async function handleDelete(id: string) {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    if (syncSettings.appsScriptUrl) {
      await pushToSheets({ action: 'delete', id });
    }
  }

  const monthTransactions = useMemo(() => {
    if (selectedMonth === 'ALL') return transactions;
    return transactions.filter((t) => t.mesAno === selectedMonth);
  }, [transactions, selectedMonth]);

  const filteredList = useMemo(() => {
    return monthTransactions
      .filter((t) => {
        if (filterTipo === 'Entrada') return t.tipo === 'Entrada';
        if (filterTipo === 'Saída') return t.tipo === 'Saída';
        if (filterTipo === 'Pendente') return t.status === 'Pendente';
        return true;
      })
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [monthTransactions, filterTipo]);

  const totals = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    for (const t of monthTransactions) {
      if (t.tipo === 'Entrada') entradas += t.valor;
      else saidas += t.valor;
    }
    return {
      entradas,
      saidas,
      saldo: entradas - saidas,
    };
  }, [monthTransactions]);

  const categoriesForType = useMemo(() => {
    return INITIAL_CATEGORIES.filter((c) => c.tipo === tipo).map((c) => c.categoria);
  }, [tipo]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header simples */}
      <header className="border-b border-slate-800 bg-slate-900/80">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 font-bold">
              <Wallet className="w-5 h-5" />
            </div>
            <h1 className="font-bold text-base sm:text-lg text-white">
              Controle Financeiro
            </h1>
          </div>

          {/* Seletor de Mês */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1">
            <button
              type="button"
              onClick={() =>
                setSelectedMonth((p) => (p === 'ALL' ? today.slice(0, 7) : shiftMonth(p, -1)))
              }
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 px-2.5 text-xs sm:text-sm font-semibold min-w-[125px] justify-center">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>{formatMonthLabel(selectedMonth)}</span>
            </div>
            <button
              type="button"
              onClick={() =>
                setSelectedMonth((p) => (p === 'ALL' ? today.slice(0, 7) : shiftMonth(p, 1)))
              }
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setSelectedMonth((p) => (p === 'ALL' ? today.slice(0, 7) : 'ALL'))
              }
              className={`px-2 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                selectedMonth === 'ALL'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos
            </button>
          </div>

          {/* Botões Planilha */}
          <div className="flex items-center gap-2">
            <a
              href={syncSettings.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Planilha</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
            <button
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sincronizar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 3 Cards Diretos: Entradas, Saídas e Saldo */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>ENTRADAS</span>
              <ArrowUpCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              {formatCurrency(totals.entradas)}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>SAÍDAS (GASTOS)</span>
              <ArrowDownCircle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-400">
              {formatCurrency(totals.saidas)}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>SALDO DO MÊS</span>
              <Wallet className="w-4 h-4 text-sky-400" />
            </div>
            <div
              className={`text-2xl font-bold ${
                totals.saldo >= 0 ? 'text-white' : 'text-rose-400'
              }`}
            >
              {formatCurrency(totals.saldo)}
            </div>
          </div>
        </section>

        {/* Formulário Direto na Tela para Lançar Entrada ou Saída */}
        <section className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
          <form onSubmit={handleAddTransaction} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                Novo Lançamento
              </h2>

              {/* Seletor Entrada / Saída */}
              <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 w-full sm:w-64">
                <button
                  type="button"
                  onClick={() => {
                    setTipo('Entrada');
                    setCategoria('Salário');
                  }}
                  className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    tipo === 'Entrada'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  + Entrada
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTipo('Saída');
                    setCategoria('Alimentação');
                  }}
                  className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    tipo === 'Saída'
                      ? 'bg-rose-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  - Saída
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4">
                <label className="block text-xs text-slate-400 mb-1">Descrição</label>
                <input
                  type="text"
                  required
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder={
                    tipo === 'Entrada' ? 'Ex: Salário, Venda...' : 'Ex: Mercado, Luz, Aluguel...'
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs text-slate-400 mb-1">Categoria</label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  {categoriesForType.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs text-slate-400 mb-1">Data</label>
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Situação:</span>
                <button
                  type="button"
                  onClick={() => setStatus('Pago')}
                  className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer ${
                    status === 'Pago'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-950 text-slate-400 border border-slate-800'
                  }`}
                >
                  Pago / Recebido
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('Pendente')}
                  className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer ${
                    status === 'Pendente'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-slate-950 text-slate-400 border border-slate-800'
                  }`}
                >
                  Pendente
                </button>
              </div>

              <button
                type="submit"
                className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer ${
                  tipo === 'Entrada'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    : 'bg-rose-500 hover:bg-rose-400 text-white'
                }`}
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Adicionar {tipo}</span>
              </button>
            </div>
          </form>
        </section>

        {/* Lista de Lançamentos */}
        <section className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              Lançamentos ({filteredList.length})
            </h2>

            <div className="flex items-center gap-1.5 text-xs">
              {(['TODOS', 'Entrada', 'Saída', 'Pendente'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilterTipo(f)}
                  className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition ${
                    filterTipo === f
                      ? 'bg-slate-200 text-slate-950 font-bold'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {f === 'TODOS'
                    ? 'Todos'
                    : f === 'Entrada'
                    ? 'Entradas'
                    : f === 'Saída'
                    ? 'Saídas'
                    : 'Pendentes'}
                </button>
              ))}
            </div>
          </div>

          {filteredList.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm border border-dashed border-slate-800 rounded-xl">
              Nenhum lançamento cadastrado neste período. Use o formulário acima para adicionar seus dados reais.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {filteredList.map((tx) => (
                <div
                  key={tx.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        tx.tipo === 'Entrada'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-rose-500/15 text-rose-400'
                      }`}
                    >
                      {tx.tipo === 'Entrada' ? (
                        <ArrowUpCircle className="w-4 h-4" />
                      ) : (
                        <ArrowDownCircle className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {tx.descricao}
                      </p>
                      <p className="text-xs text-slate-400">
                        {tx.data.split('-').reverse().join('/')} • {tx.categoria}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(tx)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium cursor-pointer ${
                        tx.status === 'Pago'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-amber-500/15 text-amber-400'
                      }`}
                      title="Clique para alternar Pago / Pendente"
                    >
                      {tx.status === 'Pago' ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      {tx.status}
                    </button>

                    <span
                      className={`text-sm font-bold min-w-[95px] text-right ${
                        tx.tipo === 'Entrada' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {tx.tipo === 'Entrada' ? '+' : '-'} {formatCurrency(tx.valor)}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDelete(tx.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Modal Simples de Sincronização com a Planilha */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base">
                Sincronizar com Google Sheets
              </h3>
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {syncMsg && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-emerald-300">
                {syncMsg}
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                URL do App da Web (Google Apps Script)
              </label>
              <input
                type="url"
                value={syncSettings.appsScriptUrl}
                onChange={(e) =>
                  setSyncSettings((prev) => ({
                    ...prev,
                    appsScriptUrl: e.target.value.trim(),
                  }))
                }
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={pullFromSheets}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-slate-950 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Carregar da Planilha
              </button>
              <button
                type="button"
                onClick={async () => {
                  setSyncMsg('Enviando para a planilha...');
                  const ok = await pushToSheets({ action: 'syncAll', transactions });
                  setSyncMsg(ok ? 'Planilha atualizada com sucesso!' : 'Configure a URL acima primeiro.');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" /> Salvar Tudo na Planilha
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(APPS_SCRIPT_SNIPPET);
                  setCopiedScript(true);
                  setTimeout(() => setCopiedScript(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 text-emerald-300 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedScript ? 'Script Copiado!' : 'Copiar Script da Planilha'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
