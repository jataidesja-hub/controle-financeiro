'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  FileUp,
  Plus,
  RefreshCw,
  Repeat,
  Smartphone,
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
import {
  parseBankFile,
  parseBankNotificationText,
} from '@/utils/bankParsers';

const STORAGE_KEYS = {
  TRANSACTIONS: 'fincontrol_real_transactions_v2',
  DELETED_IDS: 'fincontrol_deleted_ids_v2',
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

function addMonthsToDate(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const targetMonthDate = new Date(y, m - 1 + delta, 1);
  const ny = targetMonthDate.getFullYear();
  const nm = targetMonthDate.getMonth();
  const maxDayInMonth = new Date(ny, nm + 1, 0).getDate();
  const safeDay = Math.min(d || 1, maxDayInMonth);
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(safeDay).padStart(
    2,
    '0'
  )}`;
}

function mergeTransactionsClient(
  localList: Transaction[],
  remoteList: Transaction[],
  deletedIds: string[]
): Transaction[] {
  const delSet = new Set(deletedIds);
  const map = new Map<string, Transaction>();
  for (const t of remoteList) {
    if (t && t.id && !delSet.has(t.id)) map.set(t.id, t);
  }
  for (const t of localList) {
    if (t && t.id && !delSet.has(t.id)) map.set(t.id, t);
  }
  return Array.from(map.values()).sort((a, b) => b.data.localeCompare(a.data));
}

function normalizeRemoteTransaction(
  raw: Record<string, unknown>,
  idx: number
): Transaction {
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
    tipo: (String(raw.Tipo || raw.tipo) === 'Entrada'
      ? 'Entrada'
      : 'Saída') as TransactionType,
    categoria: String(raw.Categoria || raw.categoria || 'Outros'),
    valor: Number.isFinite(valorNum) ? valorNum : 0,
    status: (String(raw.Status || raw.status) === 'Pendente'
      ? 'Pendente'
      : 'Pago') as TransactionStatus,
    vencimento: String(raw.Vencimento || raw.vencimento || dataRaw).slice(
      0,
      10
    ),
    recorrencia: (String(raw.Recorrencia || raw.recorrencia || 'Única') as
      | 'Única'
      | 'Fixa Mensal'
      | 'Parcelada'),
    parcela: String(raw.Parcela || raw.parcela || '1/1'),
    formaPagamento: String(
      raw.FormaPagamento || raw.formaPagamento || 'PIX'
    ) as PaymentMethod,
    observacoes: String(raw.Observacoes || raw.observacoes || ''),
    criadoEm: String(raw.CriadoEm || raw.criadoEm || new Date().toISOString()),
  };
}

export default function FinanceiroSimplesApp() {
  const today = getTodayISO();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(today.slice(0, 7));
  const [filterTipo, setFilterTipo] = useState<
    'TODOS' | 'Entrada' | 'Saída' | 'Pendente'
  >('TODOS');

  // Form states (inline & direct)
  const [tipo, setTipo] = useState<TransactionType>('Saída');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState('Alimentação');
  const [data, setData] = useState(today);
  const [status, setStatus] = useState<TransactionStatus>('Pago');
  const [repetirMeses, setRepetirMeses] = useState<number>(1);

  // Google Sheets Sync & Bank Automation
  const [syncSettings, setSyncSettings] = useState<SyncSettings>({
    spreadsheetId: DEFAULT_SPREADSHEET_ID,
    spreadsheetUrl: DEFAULT_SPREADSHEET_URL,
    appsScriptUrl: process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '',
    autoSync: true,
    lastSyncAt: null,
  });
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Notification simulator / quick paste
  const [notifBanco, setNotifBanco] = useState<'Nubank' | 'PicPay'>('Nubank');
  const [notifTexto, setNotifTexto] = useState('');

  // Change selected month AND keep the form date aligned with that month so entries never vanish
  function handleSelectMonth(nextMonth: string) {
    setSelectedMonth(nextMonth);
    if (nextMonth !== 'ALL') {
      const currentDay = data.slice(8, 10) || '01';
      const [y, m] = nextMonth.split('-').map(Number);
      const maxDay = new Date(y, m, 0).getDate();
      const safeDay = String(Math.min(Number(currentDay) || 1, maxDay)).padStart(
        2,
        '0'
      );
      setData(`${nextMonth}-${safeDay}`);
    }
  }

  // Load saved real data from localStorage AND merge with shared Cloud Store
  useEffect(() => {
    let localList: Transaction[] = [];
    let localDeleted: string[] = [];
    try {
      localStorage.removeItem('fincontrol_transactions_v1');

      const saved = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          localList = parsed;
          setTransactions(parsed);
        }
      }
      const savedDel = localStorage.getItem(STORAGE_KEYS.DELETED_IDS);
      if (savedDel) {
        const parsedDel = JSON.parse(savedDel);
        if (Array.isArray(parsedDel)) {
          localDeleted = parsedDel;
          setDeletedIds(parsedDel);
        }
      }
      const savedSet = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (savedSet) {
        setSyncSettings((prev) => ({ ...prev, ...JSON.parse(savedSet) }));
      }
    } catch (e) {
      console.error(e);
    }

    async function syncWithCloudOnStart() {
      try {
        setIsSyncing(true);
        const res = await fetch('/api/sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'merge',
            transactions: localList,
            clientTransactions: localList,
          }),
        });
        const json = await res.json();
        if (json.ok && Array.isArray(json.transactions)) {
          const allDeleted = Array.from(
            new Set([...localDeleted, ...(json.deletedIds || [])])
          );
          setDeletedIds(allDeleted);
          setTransactions((prev) =>
            mergeTransactionsClient(prev, json.transactions, allDeleted)
          );
          if (json.appsScriptUrl) {
            setSyncSettings((prev) => ({
              ...prev,
              appsScriptUrl: json.appsScriptUrl,
              lastSyncAt: json.updatedAt || new Date().toISOString(),
            }));
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsSyncing(false);
      }
    }

    syncWithCloudOnStart();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.TRANSACTIONS,
        JSON.stringify(transactions)
      );
    } catch (e) {
      console.error(e);
    }
  }, [transactions]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.DELETED_IDS,
        JSON.stringify(deletedIds)
      );
    } catch (e) {
      console.error(e);
    }
  }, [deletedIds]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(syncSettings));
    } catch (e) {
      console.error(e);
    }
  }, [syncSettings]);

  async function pushToSheets(
    payload: Record<string, unknown>,
    currentList: Transaction[]
  ) {
    try {
      setIsSyncing(true);
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptUrl: syncSettings.appsScriptUrl,
          clientTransactions: currentList,
          ...payload,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        if (Array.isArray(json.transactions)) {
          const allDeleted = Array.from(
            new Set([...deletedIds, ...(json.deletedIds || [])])
          );
          setTransactions((prev) =>
            mergeTransactionsClient(prev, json.transactions, allDeleted)
          );
        }
        setSyncSettings((prev) => ({
          ...prev,
          lastSyncAt: new Date().toISOString(),
        }));
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
    try {
      setIsSyncing(true);
      setSyncMsg('Sincronizando dados na nuvem...');
      const url = syncSettings.appsScriptUrl
        ? `/api/sheets?fromSheet=1&scriptUrl=${encodeURIComponent(
            syncSettings.appsScriptUrl
          )}`
        : '/api/sheets';
      const res = await fetch(url);
      const json = await res.json();
      if (json.ok && Array.isArray(json.transactions)) {
        const list = json.transactions.map(
          (item: Record<string, unknown>, idx: number) =>
            normalizeRemoteTransaction(item, idx)
        );
        const allDeleted = Array.from(
          new Set([...deletedIds, ...(json.deletedIds || [])])
        );
        setDeletedIds(allDeleted);
        setTransactions((prev) =>
          mergeTransactionsClient(prev, list, allDeleted)
        );
        setSyncSettings((prev) => ({
          ...prev,
          lastSyncAt: new Date().toISOString(),
        }));
        setSyncMsg(`Pronto! Dados sincronizados com sucesso.`);
      } else {
        setSyncMsg(json.error || 'Erro ao sincronizar.');
      }
    } catch (err) {
      setSyncMsg(`Erro: ${String(err)}`);
    } finally {
      setIsSyncing(false);
    }
  }

  // Option 1: Import CSV / OFX from Nubank or PicPay
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const imported = parseBankFile(text, file.name);
    e.target.value = '';

    if (imported.length === 0) {
      setBannerNotice(
        'Não foi possível encontrar lançamentos válidos neste arquivo CSV/OFX.'
      );
      return;
    }

    const existingIds = new Set(transactions.map((t) => t.id));
    const uniqueNew = imported.filter((t) => !existingIds.has(t.id));
    const updatedList = [...uniqueNew, ...transactions];

    setTransactions(updatedList);
    if (uniqueNew[0]?.mesAno) {
      handleSelectMonth(uniqueNew[0].mesAno);
    }
    setBannerNotice(
      `${uniqueNew.length} lançamentos importados do extrato (${file.name})!`
    );
    setTimeout(() => setBannerNotice(null), 5000);

    if (uniqueNew.length > 0) {
      await pushToSheets(
        {
          action: 'addBatch',
          transactions: uniqueNew,
        },
        updatedList
      );
    }
  }

  // Option 3: Parse bank notification text directly
  async function handleProcessNotificationText(e: React.FormEvent) {
    e.preventDefault();
    const tx = parseBankNotificationText(notifTexto, notifBanco);
    if (!tx) {
      setBannerNotice(
        'Digite ou cole um texto que contenha um valor em R$ (ex: Compra de R$ 35,90 aprovada em Padaria).'
      );
      return;
    }
    const updatedList = [tx, ...transactions];
    setTransactions(updatedList);
    handleSelectMonth(tx.mesAno);
    setNotifTexto('');
    setIsBankModalOpen(false);
    setBannerNotice(
      `Lançamento automático criado: ${tx.descricao} (${formatCurrency(
        tx.valor
      )})`
    );
    setTimeout(() => setBannerNotice(null), 5000);

    await pushToSheets({ action: 'add', transaction: tx }, updatedList);
  }

  async function pullRecentWebhookNotifications() {
    try {
      const res = await fetch('/api/sheets');
      const json = await res.json();
      if (json.ok && Array.isArray(json.transactions)) {
        const allDeleted = Array.from(
          new Set([...deletedIds, ...(json.deletedIds || [])])
        );
        setDeletedIds(allDeleted);
        setTransactions((prev) =>
          mergeTransactionsClient(prev, json.transactions, allDeleted)
        );
        setBannerNotice('Dados sincronizados entre computador, celular e planilha!');
        setTimeout(() => setBannerNotice(null), 4000);
      }
    } catch {
      // ignore
    }
  }

  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault();
    const numericVal = parseFloat(valor.replace(',', '.'));
    if (!descricao.trim() || Number.isNaN(numericVal) || numericVal <= 0)
      return;

    const count = Math.max(1, Math.min(24, repetirMeses));
    const baseTime = Date.now();
    const createdBatch: Transaction[] = [];

    for (let i = 0; i < count; i++) {
      const targetDate = i === 0 ? data : addMonthsToDate(data, i);
      createdBatch.push({
        id:
          count === 1
            ? `TX-${baseTime.toString().slice(-6)}`
            : `TX-${baseTime.toString().slice(-5)}-${i + 1}`,
        data: targetDate,
        mesAno: targetDate.slice(0, 7),
        descricao:
          count > 1
            ? `${descricao.trim()} (${i + 1}/${count})`
            : descricao.trim(),
        tipo,
        categoria,
        valor: numericVal,
        status: i === 0 ? status : 'Pendente',
        vencimento: targetDate,
        recorrencia: count > 1 ? 'Parcelada' : 'Única',
        parcela: `${i + 1}/${count}`,
        formaPagamento: 'PIX',
        observacoes: count > 1 ? `Lançado para ${count} meses` : '',
        criadoEm: new Date().toISOString(),
      });
    }

    const updatedList = [...createdBatch, ...transactions];
    setTransactions(updatedList);
    setSelectedMonth(createdBatch[0].mesAno);
    setDescricao('');
    setValor('');

    if (createdBatch.length === 1) {
      setBannerNotice(
        `${tipo} "${createdBatch[0].descricao}" (${formatCurrency(
          numericVal
        )}) salva em ${formatMonthLabel(createdBatch[0].mesAno)}!`
      );
      setTimeout(() => setBannerNotice(null), 4000);
      await pushToSheets(
        { action: 'add', transaction: createdBatch[0] },
        updatedList
      );
    } else {
      setBannerNotice(
        `${createdBatch.length} lançamentos criados para os próximos meses!`
      );
      setTimeout(() => setBannerNotice(null), 4000);
      await pushToSheets(
        { action: 'addBatch', transactions: createdBatch },
        updatedList
      );
    }
  }

  async function handleToggleStatus(tx: Transaction) {
    const updated: Transaction = {
      ...tx,
      status: tx.status === 'Pago' ? 'Pendente' : 'Pago',
    };
    const updatedList = transactions.map((t) =>
      t.id === tx.id ? updated : t
    );
    setTransactions(updatedList);
    await pushToSheets({ action: 'update', transaction: updated }, updatedList);
  }

  async function handleDelete(id: string) {
    const updatedList = transactions.filter((t) => t.id !== id);
    const nextDeleted = [...deletedIds, id];
    setTransactions(updatedList);
    setDeletedIds(nextDeleted);
    await pushToSheets({ action: 'delete', id }, updatedList);
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
    return INITIAL_CATEGORIES.filter((c) => c.tipo === tipo).map(
      (c) => c.categoria
    );
  }, [tipo]);

  const webhookEndpointUrl = useMemo(() => {
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://controle-financeiro-nine-pi.vercel.app';
    const scriptParam = syncSettings.appsScriptUrl
      ? `&scriptUrl=${encodeURIComponent(syncSettings.appsScriptUrl)}`
      : '';
    return `${origin}/api/webhook-banco?banco=Nubank&texto={notificacao}${scriptParam}`;
  }, [syncSettings.appsScriptUrl]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Hidden input for CSV / OFX import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.ofx"
        onChange={handleFileUpload}
        className="hidden"
      />

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
                handleSelectMonth(
                  selectedMonth === 'ALL'
                    ? today.slice(0, 7)
                    : shiftMonth(selectedMonth, -1)
                )
              }
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 px-2.5 text-xs sm:text-sm font-semibold min-w-[130px] justify-center">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>{formatMonthLabel(selectedMonth)}</span>
            </div>
            <button
              type="button"
              onClick={() =>
                handleSelectMonth(
                  selectedMonth === 'ALL'
                    ? today.slice(0, 7)
                    : shiftMonth(selectedMonth, 1)
                )
              }
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                handleSelectMonth(
                  selectedMonth === 'ALL' ? today.slice(0, 7) : 'ALL'
                )
              }
              className={`px-2 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                selectedMonth === 'ALL'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos ({transactions.length})
            </button>
          </div>

          {/* Ações rápidas: Nubank/PicPay + Planilha */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 transition cursor-pointer"
              title="Importar extrato CSV ou OFX do Nubank ou PicPay"
            >
              <FileUp className="w-3.5 h-3.5" />
              <span>Importar CSV/OFX</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBankModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition cursor-pointer"
              title="Automação Nubank / PicPay pelo Celular"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Nubank / PicPay</span>
            </button>

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
              onClick={pullFromSheets}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
              title="Atualizar dados entre Computador, Celular e Planilha"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-emerald-400 ${
                  isSyncing ? 'animate-spin' : ''
                }`}
              />
              <span>Atualizar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {bannerNotice && (
          <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs sm:text-sm text-emerald-300 flex items-center justify-between">
            <span>{bannerNotice}</span>
            <button
              type="button"
              onClick={() => setBannerNotice(null)}
              className="text-emerald-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 3 Cards Diretos: Entradas, Saídas e Saldo */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>ENTRADAS ({formatMonthLabel(selectedMonth)})</span>
              <ArrowUpCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              {formatCurrency(totals.entradas)}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>SAÍDAS ({formatMonthLabel(selectedMonth)})</span>
              <ArrowDownCircle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-400">
              {formatCurrency(totals.saidas)}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>SALDO ({formatMonthLabel(selectedMonth)})</span>
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
                Novo Lançamento em {formatMonthLabel(data.slice(0, 7))}
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
                <label className="block text-xs text-slate-400 mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  required
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder={
                    tipo === 'Entrada'
                      ? 'Ex: Salário, PIX recebido...'
                      : 'Ex: Mercado, Luz, Aluguel...'
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">
                  Valor (R$)
                </label>
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
                <label className="block text-xs text-slate-400 mb-1">
                  Categoria
                </label>
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
                  onChange={(e) => {
                    const nextDate = e.target.value;
                    setData(nextDate);
                    if (nextDate && nextDate.length >= 7) {
                      setSelectedMonth(nextDate.slice(0, 7));
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
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

                {/* Repetir nos próximos meses */}
                <div className="flex items-center gap-1.5">
                  <Repeat className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={repetirMeses}
                    onChange={(e) => setRepetirMeses(Number(e.target.value))}
                    className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value={1}>Apenas neste mês (1x)</option>
                    <option value={2}>Repetir por 2 meses</option>
                    <option value={3}>Repetir por 3 meses</option>
                    <option value={6}>Repetir por 6 meses</option>
                    <option value={12}>Repetir por 12 meses (1 ano)</option>
                  </select>
                </div>
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
              Lançamentos de {formatMonthLabel(selectedMonth)} ({filteredList.length})
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
            <div className="py-10 text-center text-slate-400 text-sm border border-dashed border-slate-800 rounded-xl space-y-3">
              <p>
                Nenhum lançamento cadastrado em{' '}
                <strong className="text-slate-200">
                  {formatMonthLabel(selectedMonth)}
                </strong>
                .
              </p>
              {transactions.length > 0 && selectedMonth !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => handleSelectMonth('ALL')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 cursor-pointer"
                >
                  Ver todos os {transactions.length} lançamentos de outros meses
                </button>
              )}
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
                        tx.tipo === 'Entrada'
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {tx.tipo === 'Entrada' ? '+' : '-'}{' '}
                      {formatCurrency(tx.valor)}
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

      {/* MODAL: AUTOMAÇÃO NUBANK & PICPAY */}
      {isBankModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-5 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">
                  Integração Gratuita • Nubank & PicPay
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBankModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                  1. Importar Extrato ou Fatura (CSV / OFX)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsBankModalOpen(false);
                    fileInputRef.current?.click();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-500 hover:bg-purple-400 text-slate-950 cursor-pointer"
                >
                  <FileUp className="w-3.5 h-3.5" /> Escolher Arquivo CSV / OFX
                </button>
              </div>
              <p className="text-xs text-slate-400">
                No app do <strong>Nubank</strong> ou <strong>PicPay</strong>,
                exporte o extrato do mês em CSV ou OFX e selecione acima.
              </p>
            </div>

            <form
              onSubmit={handleProcessNotificationText}
              className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  2. Colar Notificação do Banco / Testar Leitura
                </span>
                <div className="flex gap-1">
                  {(['Nubank', 'PicPay'] as const).map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setNotifBanco(b)}
                      className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer ${
                        notifBanco === b
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="text"
                value={notifTexto}
                onChange={(e) => setNotifTexto(e.target.value)}
                placeholder="Ex: Compra de R$ 48,90 aprovada em SUPERMERCADO ou Pix recebido de R$ 250,00"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={pullRecentWebhookNotifications}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                >
                  Sincronizar Nuvem Agora
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer"
                >
                  Lançar Automaticamente
                </button>
              </div>
            </form>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-300">
                  3. Automação no Celular (MacroDroid / Atalhos iOS)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(webhookEndpointUrl);
                    setCopiedWebhook(true);
                    setTimeout(() => setCopiedWebhook(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-500/20 text-sky-300 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  {copiedWebhook ? 'Link Copiado!' : 'Copiar URL do Webhook'}
                </button>
              </div>
              <code className="block p-2 rounded bg-slate-900 text-[11px] text-slate-300 break-all border border-slate-800">
                {webhookEndpointUrl}
              </code>
            </div>
          </div>
        </div>
      )}

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
                <Download className="w-3.5 h-3.5" /> Sincronizar Agora
              </button>
              <button
                type="button"
                onClick={async () => {
                  setSyncMsg('Enviando para a planilha...');
                  const ok = await pushToSheets(
                    {
                      action: 'syncAll',
                      transactions,
                    },
                    transactions
                  );
                  setSyncMsg(
                    ok
                      ? 'Dados salvos na nuvem e sincronizados!'
                      : 'Erro ao salvar.'
                  );
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" /> Salvar Tudo
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
                {copiedScript
                  ? 'Script Copiado!'
                  : 'Copiar Script da Planilha'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
