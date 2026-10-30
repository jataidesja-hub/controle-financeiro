'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Download,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  Layers,
  LayoutDashboard,
  ListOrdered,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  Settings,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  Wallet,
  AlertTriangle,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  APPS_SCRIPT_SNIPPET,
  DEFAULT_SPREADSHEET_ID,
  DEFAULT_SPREADSHEET_URL,
  INITIAL_CATEGORIES,
  INITIAL_TRANSACTIONS,
} from '@/data/initialData';
import {
  CategoryBudget,
  PaymentMethod,
  RecurrenceType,
  SyncSettings,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '@/types/finance';

const STORAGE_KEYS = {
  TRANSACTIONS: 'fincontrol_transactions_v1',
  CATEGORIES: 'fincontrol_categories_v1',
  SETTINGS: 'fincontrol_sync_settings_v1',
};

const PAYMENT_METHODS: PaymentMethod[] = [
  'PIX',
  'Cartão de Crédito',
  'Boleto',
  'Débito',
  'Transferência',
  'Dinheiro',
];

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
  const target = new Date(y, m - 1 + delta, d || 1);
  const ny = target.getFullYear();
  const nm = String(target.getMonth() + 1).padStart(2, '0');
  const nd = String(target.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

function normalizeRemoteTransaction(raw: Record<string, unknown>, idx: number): Transaction {
  const dataRaw = String(raw.Data || raw.data || '2026-10-01').slice(0, 10);
  const mesAnoRaw = String(raw.MesAno || raw.mesAno || dataRaw.slice(0, 7));
  const valorNum = Number(
    String(raw.Valor ?? raw.valor ?? 0)
      .replace('R$', '')
      .replace(/\s/g, '')
      .replace(',', '.')
  );
  return {
    id: String(raw.ID || raw.id || `TX-REM-${idx + 1}`),
    data: dataRaw,
    mesAno: mesAnoRaw,
    descricao: String(raw.Descricao || raw.descricao || 'Sem descrição'),
    tipo: (String(raw.Tipo || raw.tipo) === 'Entrada' ? 'Entrada' : 'Saída') as TransactionType,
    categoria: String(raw.Categoria || raw.categoria || 'Outros'),
    valor: Number.isFinite(valorNum) ? valorNum : 0,
    status: (['Pago', 'Pendente', 'Atrasado'].includes(String(raw.Status || raw.status))
      ? String(raw.Status || raw.status)
      : 'Pago') as TransactionStatus,
    vencimento: String(raw.Vencimento || raw.vencimento || dataRaw).slice(0, 10),
    recorrencia: (['Única', 'Fixa Mensal', 'Parcelada'].includes(
      String(raw.Recorrencia || raw.recorrencia)
    )
      ? String(raw.Recorrencia || raw.recorrencia)
      : 'Única') as RecurrenceType,
    parcela: String(raw.Parcela || raw.parcela || '1/1'),
    formaPagamento: (PAYMENT_METHODS.includes(
      String(raw.FormaPagamento || raw.formaPagamento) as PaymentMethod
    )
      ? String(raw.FormaPagamento || raw.formaPagamento)
      : 'PIX') as PaymentMethod,
    observacoes: String(raw.Observacoes || raw.observacoes || ''),
    criadoEm: String(raw.CriadoEm || raw.criadoEm || new Date().toISOString()),
  };
}

export default function FinanceiroApp() {
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [categories, setCategories] = useState<CategoryBudget[]>(INITIAL_CATEGORIES);
  const [syncSettings, setSyncSettings] = useState<SyncSettings>({
    spreadsheetId: DEFAULT_SPREADSHEET_ID,
    spreadsheetUrl: DEFAULT_SPREADSHEET_URL,
    appsScriptUrl: process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '',
    autoSync: true,
    lastSyncAt: null,
  });

  const [selectedMonth, setSelectedMonth] = useState<string>('2026-10');
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'lancamentos' | 'vencimentos' | 'fixos' | 'orcamento'
  >('dashboard');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTipo, setFilterTipo] = useState<'TODOS' | TransactionType>('TODOS');
  const [filterStatus, setFilterStatus] = useState<'TODOS' | TransactionStatus>('TODOS');
  const [filterCategoria, setFilterCategoria] = useState<string>('TODAS');
  const [filterRecorrencia, setFilterRecorrencia] = useState<'TODAS' | RecurrenceType>('TODAS');

  // Modals
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{
    type: 'info' | 'success' | 'error';
    text: string;
  } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Form state for New/Edit Transaction
  const [formTipo, setFormTipo] = useState<TransactionType>('Saída');
  const [formDescricao, setFormDescricao] = useState('');
  const [formValor, setFormValor] = useState('');
  const [formCategoria, setFormCategoria] = useState('Alimentação');
  const [formData, setFormData] = useState('2026-10-30');
  const [formVencimento, setFormVencimento] = useState('2026-10-30');
  const [formStatus, setFormStatus] = useState<TransactionStatus>('Pago');
  const [formRecorrencia, setFormRecorrencia] = useState<RecurrenceType>('Única');
  const [formTotalParcelas, setFormTotalParcelas] = useState('1');
  const [formParcelaAtual, setFormParcelaAtual] = useState('1');
  const [formGerarDemaisParcelas, setFormGerarDemaisParcelas] = useState(true);
  const [formFormaPagamento, setFormFormaPagamento] = useState<PaymentMethod>('PIX');
  const [formObservacoes, setFormObservacoes] = useState('');

  // Load persisted data from localStorage on mount
  useEffect(() => {
    try {
      const savedTx = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (savedTx) {
        const parsed = JSON.parse(savedTx);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTransactions(parsed);
        }
      }
      const savedCat = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (savedCat) {
        const parsedCat = JSON.parse(savedCat);
        if (Array.isArray(parsedCat) && parsedCat.length > 0) {
          setCategories(parsedCat);
        }
      }
      const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (savedSettings) {
        const parsedSet = JSON.parse(savedSettings);
        setSyncSettings((prev) => ({ ...prev, ...parsedSet }));
      }
    } catch (e) {
      console.error('Erro ao carregar cache local:', e);
    }
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    } catch (e) {
      console.error('Erro ao salvar transações localmente:', e);
    }
  }, [transactions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    } catch (e) {
      console.error('Erro ao salvar categorias localmente:', e);
    }
  }, [categories]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(syncSettings));
    } catch (e) {
      console.error('Erro ao salvar configurações:', e);
    }
  }, [syncSettings]);

  // Helper to push action to Google Apps Script if configured
  async function pushToGoogleSheets(payload: Record<string, unknown>) {
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
      const data = await res.json();
      if (data.ok) {
        const now = new Date().toISOString();
        setSyncSettings((prev) => ({ ...prev, lastSyncAt: now }));
        return true;
      }
      return false;
    } catch (err) {
      console.error('Falha ao sincronizar com Google Sheets:', err);
      return false;
    } finally {
      setIsSyncing(false);
    }
  }

  async function pullFromGoogleSheets() {
    if (!syncSettings.appsScriptUrl) {
      setIsSyncModalOpen(true);
      return;
    }
    try {
      setIsSyncing(true);
      setSyncStatusMsg({ type: 'info', text: 'Buscando dados da Planilha Google...' });
      const res = await fetch(
        `/api/sheets?scriptUrl=${encodeURIComponent(syncSettings.appsScriptUrl)}`
      );
      const data = await res.json();
      if (data.ok && Array.isArray(data.transactions)) {
        const normalized = data.transactions.map(
          (item: Record<string, unknown>, index: number) =>
            normalizeRemoteTransaction(item, index)
        );
        if (normalized.length > 0) {
          setTransactions(normalized);
        }
        const now = new Date().toISOString();
        setSyncSettings((prev) => ({ ...prev, lastSyncAt: now }));
        setSyncStatusMsg({
          type: 'success',
          text: `Sincronizado com sucesso! ${normalized.length} lançamentos carregados da planilha.`,
        });
      } else {
        setSyncStatusMsg({
          type: 'error',
          text: data.error || 'Não foi possível ler os dados. Verifique a URL do Apps Script.',
        });
      }
    } catch (error) {
      setSyncStatusMsg({
        type: 'error',
        text: `Erro de conexão: ${String(error)}`,
      });
    } finally {
      setIsSyncing(false);
    }
  }

  async function syncAllToGoogleSheets() {
    if (!syncSettings.appsScriptUrl) {
      setIsSyncModalOpen(true);
      return;
    }
    setSyncStatusMsg({
      type: 'info',
      text: 'Enviando todos os lançamentos para a aba Lancamentos da planilha...',
    });
    const ok = await pushToGoogleSheets({
      action: 'syncAll',
      transactions,
    });
    if (ok) {
      setSyncStatusMsg({
        type: 'success',
        text: `Todos os ${transactions.length} lançamentos foram gravados na Planilha Google!`,
      });
    } else {
      setSyncStatusMsg({
        type: 'error',
        text: 'Falha ao gravar na planilha. Verifique se a implantação do Apps Script está como "Qualquer pessoa".',
      });
    }
  }

  // Open modal for new transaction
  function openNewTxModal(defaultType: TransactionType = 'Saída') {
    setEditingTx(null);
    setFormTipo(defaultType);
    setFormDescricao('');
    setFormValor('');
    setFormCategoria(defaultType === 'Entrada' ? 'Salário' : 'Alimentação');
    const defaultDate =
      selectedMonth === 'ALL' ? '2026-10-30' : `${selectedMonth}-${new Date().getDate().toString().padStart(2, '0')}`;
    setFormData(defaultDate);
    setFormVencimento(defaultDate);
    setFormStatus('Pago');
    setFormRecorrencia('Única');
    setFormTotalParcelas('2');
    setFormParcelaAtual('1');
    setFormGerarDemaisParcelas(true);
    setFormFormaPagamento('PIX');
    setFormObservacoes('');
    setIsTxModalOpen(true);
  }

  function openEditTxModal(tx: Transaction) {
    setEditingTx(tx);
    setFormTipo(tx.tipo);
    setFormDescricao(tx.descricao);
    setFormValor(String(tx.valor));
    setFormCategoria(tx.categoria);
    setFormData(tx.data);
    setFormVencimento(tx.vencimento || tx.data);
    setFormStatus(tx.status);
    setFormRecorrencia(tx.recorrencia);
    const [atual, total] = (tx.parcela || '1/1').split('/');
    setFormParcelaAtual(atual || '1');
    setFormTotalParcelas(total || '1');
    setFormGerarDemaisParcelas(false);
    setFormFormaPagamento(tx.formaPagamento);
    setFormObservacoes(tx.observacoes || '');
    setIsTxModalOpen(true);
  }

  async function handleSaveTransaction(e: React.FormEvent) {
    e.preventDefault();
    const numericVal = parseFloat(formValor.replace(',', '.'));
    if (!formDescricao.trim() || Number.isNaN(numericVal) || numericVal <= 0) {
      return;
    }

    const mesAno = formData.slice(0, 7);

    if (editingTx) {
      const updatedTx: Transaction = {
        ...editingTx,
        data: formData,
        mesAno,
        descricao: formDescricao.trim(),
        tipo: formTipo,
        categoria: formCategoria,
        valor: numericVal,
        status: formStatus,
        vencimento: formVencimento || formData,
        recorrencia: formRecorrencia,
        parcela:
          formRecorrencia === 'Parcelada'
            ? `${formParcelaAtual}/${formTotalParcelas}`
            : '1/1',
        formaPagamento: formFormaPagamento,
        observacoes: formObservacoes.trim(),
      };

      setTransactions((prev) => prev.map((t) => (t.id === updatedTx.id ? updatedTx : t)));
      setIsTxModalOpen(false);
      if (syncSettings.autoSync && syncSettings.appsScriptUrl) {
        await pushToGoogleSheets({ action: 'update', transaction: updatedTx });
      }
      return;
    }

    // Creating new transaction(s)
    const totalParc =
      formRecorrencia === 'Parcelada' ? Math.max(1, parseInt(formTotalParcelas, 10) || 1) : 1;
    const startParc =
      formRecorrencia === 'Parcelada' ? Math.max(1, parseInt(formParcelaAtual, 10) || 1) : 1;

    const createdList: Transaction[] = [];
    const baseTime = Date.now();

    if (formRecorrencia === 'Parcelada' && formGerarDemaisParcelas && totalParc > startParc) {
      for (let p = startParc; p <= totalParc; p++) {
        const offset = p - startParc;
        const txDate = addMonthsToDate(formData, offset);
        const txVenc = addMonthsToDate(formVencimento || formData, offset);
        createdList.push({
          id: `TX-${baseTime.toString().slice(-5)}-${p}`,
          data: txDate,
          mesAno: txDate.slice(0, 7),
          descricao: formDescricao.trim(),
          tipo: formTipo,
          categoria: formCategoria,
          valor: numericVal,
          status: offset === 0 ? formStatus : 'Pendente',
          vencimento: txVenc,
          recorrencia: 'Parcelada',
          parcela: `${p}/${totalParc}`,
          formaPagamento: formFormaPagamento,
          observacoes: formObservacoes.trim() || `Parcela ${p} de ${totalParc}`,
          criadoEm: new Date().toISOString(),
        });
      }
    } else {
      createdList.push({
        id: `TX-${baseTime.toString().slice(-6)}`,
        data: formData,
        mesAno,
        descricao: formDescricao.trim(),
        tipo: formTipo,
        categoria: formCategoria,
        valor: numericVal,
        status: formStatus,
        vencimento: formVencimento || formData,
        recorrencia: formRecorrencia,
        parcela:
          formRecorrencia === 'Parcelada' ? `${startParc}/${totalParc}` : '1/1',
        formaPagamento: formFormaPagamento,
        observacoes: formObservacoes.trim(),
        criadoEm: new Date().toISOString(),
      });
    }

    setTransactions((prev) => [...createdList, ...prev]);
    setIsTxModalOpen(false);

    if (syncSettings.autoSync && syncSettings.appsScriptUrl) {
      if (createdList.length === 1) {
        await pushToGoogleSheets({ action: 'add', transaction: createdList[0] });
      } else {
        await pushToGoogleSheets({ action: 'addBatch', transactions: createdList });
      }
    }
  }

  async function handleToggleStatus(tx: Transaction) {
    const nextStatus: TransactionStatus = tx.status === 'Pago' ? 'Pendente' : 'Pago';
    const updated = { ...tx, status: nextStatus };
    setTransactions((prev) => prev.map((t) => (t.id === tx.id ? updated : t)));
    if (syncSettings.autoSync && syncSettings.appsScriptUrl) {
      await pushToGoogleSheets({ action: 'update', transaction: updated });
    }
  }

  async function handleDeleteTransaction(id: string) {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    if (syncSettings.autoSync && syncSettings.appsScriptUrl) {
      await pushToGoogleSheets({ action: 'delete', id });
    }
  }

  // Replicate fixed monthly transactions to next month
  async function handleGenerateFixedForNextMonth() {
    const currentMonth = selectedMonth === 'ALL' ? '2026-10' : selectedMonth;
    const nextMonth = shiftMonth(currentMonth, 1);
    const fixedInCurrent = transactions.filter(
      (t) => t.mesAno === currentMonth && t.recorrencia === 'Fixa Mensal'
    );

    if (fixedInCurrent.length === 0) return;

    const existingNextDescriptions = new Set(
      transactions
        .filter((t) => t.mesAno === nextMonth && t.recorrencia === 'Fixa Mensal')
        .map((t) => t.descricao.toLowerCase())
    );

    const newBatch: Transaction[] = [];
    fixedInCurrent.forEach((tx, idx) => {
      if (!existingNextDescriptions.has(tx.descricao.toLowerCase())) {
        const nextDate = addMonthsToDate(tx.data, 1);
        const nextVenc = addMonthsToDate(tx.vencimento || tx.data, 1);
        newBatch.push({
          ...tx,
          id: `TX-FIX-${Date.now().toString().slice(-4)}-${idx + 1}`,
          data: nextDate,
          mesAno: nextMonth,
          vencimento: nextVenc,
          status: 'Pendente',
          criadoEm: new Date().toISOString(),
        });
      }
    });

    if (newBatch.length > 0) {
      setTransactions((prev) => [...newBatch, ...prev]);
      setSelectedMonth(nextMonth);
      if (syncSettings.autoSync && syncSettings.appsScriptUrl) {
        await pushToGoogleSheets({ action: 'addBatch', transactions: newBatch });
      }
    }
  }

  // Export CSV matching Google Sheets columns
  function handleExportCSV() {
    const headers = [
      'ID',
      'Data',
      'MesAno',
      'Descricao',
      'Tipo',
      'Categoria',
      'Valor',
      'Status',
      'Vencimento',
      'Recorrencia',
      'Parcela',
      'FormaPagamento',
      'Observacoes',
      'CriadoEm',
    ];
    const rows = transactions.map((t) => [
      t.id,
      t.data,
      t.mesAno,
      `"${t.descricao.replace(/"/g, '""')}"`,
      t.tipo,
      t.categoria,
      t.valor,
      t.status,
      t.vencimento,
      t.recorrencia,
      t.parcela,
      t.formaPagamento,
      `"${(t.observacoes || '').replace(/"/g, '""')}"`,
      t.criadoEm,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `controle-financeiro-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Computed transactions for the selected month
  const monthTransactions = useMemo(() => {
    if (selectedMonth === 'ALL') return transactions;
    return transactions.filter((t) => t.mesAno === selectedMonth);
  }, [transactions, selectedMonth]);

  // Filtered transactions for the table
  const filteredTransactions = useMemo(() => {
    return monthTransactions
      .filter((t) => {
        if (filterTipo !== 'TODOS' && t.tipo !== filterTipo) return false;
        if (filterStatus !== 'TODOS' && t.status !== filterStatus) return false;
        if (filterCategoria !== 'TODAS' && t.categoria !== filterCategoria) return false;
        if (filterRecorrencia !== 'TODAS' && t.recorrencia !== filterRecorrencia) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            t.descricao.toLowerCase().includes(q) ||
            t.categoria.toLowerCase().includes(q) ||
            t.formaPagamento.toLowerCase().includes(q) ||
            (t.observacoes || '').toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [
    monthTransactions,
    filterTipo,
    filterStatus,
    filterCategoria,
    filterRecorrencia,
    searchQuery,
  ]);

  // KPI Metrics for the selected period
  const metrics = useMemo(() => {
    let entradasTotal = 0;
    let entradasPagas = 0;
    let entradasPendentes = 0;
    let saidasTotal = 0;
    let saidasPagas = 0;
    let saidasPendentes = 0;
    let gastosFixos = 0;
    let gastosParcelados = 0;
    let gastosUnicos = 0;

    for (const tx of monthTransactions) {
      if (tx.tipo === 'Entrada') {
        entradasTotal += tx.valor;
        if (tx.status === 'Pago') entradasPagas += tx.valor;
        else entradasPendentes += tx.valor;
      } else {
        saidasTotal += tx.valor;
        if (tx.status === 'Pago') saidasPagas += tx.valor;
        else saidasPendentes += tx.valor;

        if (tx.recorrencia === 'Fixa Mensal') gastosFixos += tx.valor;
        else if (tx.recorrencia === 'Parcelada') gastosParcelados += tx.valor;
        else gastosUnicos += tx.valor;
      }
    }

    const saldoPrevisto = entradasTotal - saidasTotal;
    const saldoReal = entradasPagas - saidasPagas;
    const taxaComprometimento =
      entradasTotal > 0 ? Math.min(100, Math.round((saidasTotal / entradasTotal) * 100)) : 0;

    return {
      entradasTotal,
      entradasPagas,
      entradasPendentes,
      saidasTotal,
      saidasPagas,
      saidasPendentes,
      saldoPrevisto,
      saldoReal,
      gastosFixos,
      gastosParcelados,
      gastosUnicos,
      taxaComprometimento,
    };
  }, [monthTransactions]);

  // Category breakdown vs Budget
  const categoryBreakdown = useMemo(() => {
    const expenseCategories = categories.filter((c) => c.tipo === 'Saída');
    return expenseCategories
      .map((cat) => {
        const gasto = monthTransactions
          .filter((t) => t.tipo === 'Saída' && t.categoria === cat.categoria)
          .reduce((acc, cur) => acc + cur.valor, 0);
        const percent =
          cat.orcamentoMensal > 0 ? Math.round((gasto / cat.orcamentoMensal) * 100) : 0;
        return {
          ...cat,
          gasto,
          percent,
          restante: cat.orcamentoMensal - gasto,
        };
      })
      .sort((a, b) => b.gasto - a.gasto);
  }, [categories, monthTransactions]);

  // Monthly evolution data (6-month window around current selection)
  const monthlyEvolution = useMemo(() => {
    const baseMonth = selectedMonth === 'ALL' ? '2026-10' : selectedMonth;
    const months = [
      shiftMonth(baseMonth, -3),
      shiftMonth(baseMonth, -2),
      shiftMonth(baseMonth, -1),
      baseMonth,
      shiftMonth(baseMonth, 1),
      shiftMonth(baseMonth, 2),
    ];

    return months.map((m) => {
      const list = transactions.filter((t) => t.mesAno === m);
      const entradas = list
        .filter((t) => t.tipo === 'Entrada')
        .reduce((acc, c) => acc + c.valor, 0);
      const saidas = list
        .filter((t) => t.tipo === 'Saída')
        .reduce((acc, c) => acc + c.valor, 0);
      const [, mm] = m.split('-');
      return {
        mesAno: m,
        label: `${(MONTH_NAMES[mm] || mm).slice(0, 3)}/${m.slice(2, 4)}`,
        entradas,
        saidas,
        saldo: entradas - saidas,
      };
    });
  }, [transactions, selectedMonth]);

  const maxChartVal = useMemo(() => {
    const max = Math.max(
      1000,
      ...monthlyEvolution.map((m) => Math.max(m.entradas, m.saidas))
    );
    return max;
  }, [monthlyEvolution]);

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#090d16]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg tracking-tight text-white">
                  FinControl Pro
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Sparkles className="w-3 h-3" /> Google Sheets Sync
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Controle Financeiro Mensal • Entradas, Saídas, Fixos e Parcelados
              </p>
            </div>
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-xl p-1">
            <button
              type="button"
              onClick={() =>
                setSelectedMonth((prev) =>
                  prev === 'ALL' ? '2026-09' : shiftMonth(prev, -1)
                )
              }
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
              title="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs sm:text-sm font-semibold text-slate-100 min-w-[130px] justify-center">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>{formatMonthLabel(selectedMonth)}</span>
            </div>
            <button
              type="button"
              onClick={() =>
                setSelectedMonth((prev) =>
                  prev === 'ALL' ? '2026-11' : shiftMonth(prev, 1)
                )
              }
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
              title="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setSelectedMonth((prev) => (prev === 'ALL' ? '2026-10' : 'ALL'))
              }
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                selectedMonth === 'ALL'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Todos
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <a
              href={syncSettings.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition"
              title="Abrir Planilha Google Sheets"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Abrir Planilha</span>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </a>

            <button
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition"
              title="Configurar Sincronização Google Sheets"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sincronizar</span>
            </button>

            <button
              type="button"
              onClick={() => openNewTxModal('Saída')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Novo Lançamento</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Quick Quick-Entry Bar & Sync Status Banner */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5">
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Planilha Conectada
            </span>
            <span className="text-slate-400 truncate max-w-xs sm:max-w-md">
              ID: <code className="text-slate-300">{syncSettings.spreadsheetId.slice(0, 18)}...</code>
              {syncSettings.lastSyncAt && (
                <span className="ml-2 text-emerald-400">
                  • Atualizado às {new Date(syncSettings.lastSyncAt).toLocaleTimeString('pt-BR')}
                </span>
              )}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openNewTxModal('Entrada')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition cursor-pointer"
            >
              <ArrowUpRight className="w-3.5 h-3.5" /> + Nova Entrada
            </button>
            <button
              type="button"
              onClick={() => openNewTxModal('Saída')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition cursor-pointer"
            >
              <ArrowDownRight className="w-3.5 h-3.5" /> + Nova Saída
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Exportar CSV
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Saldo Líquido */}
          <div className="rounded-2xl bg-slate-900/75 border border-slate-800/90 p-5 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Saldo do Período
              </span>
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  metrics.saldoPrevisto >= 0
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-rose-500/15 text-rose-400'
                }`}
              >
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div
              className={`text-2xl sm:text-3xl font-bold tracking-tight ${
                metrics.saldoPrevisto >= 0 ? 'text-white' : 'text-rose-400'
              }`}
            >
              {formatCurrency(metrics.saldoPrevisto)}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">Em caixa (efetivado):</span>
              <span className="font-semibold text-emerald-400">
                {formatCurrency(metrics.saldoReal)}
              </span>
            </div>
          </div>

          {/* Card 2: Entradas */}
          <div className="rounded-2xl bg-slate-900/75 border border-slate-800/90 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Entradas (Receitas)
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-400">
              {formatCurrency(metrics.entradasTotal)}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Recebido: <strong className="text-slate-200">{formatCurrency(metrics.entradasPagas)}</strong>
              </span>
              <span className="text-amber-400">
                A receber: {formatCurrency(metrics.entradasPendentes)}
              </span>
            </div>
          </div>

          {/* Card 3: Saídas */}
          <div className="rounded-2xl bg-slate-900/75 border border-slate-800/90 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Saídas (Gastos Mensais)
              </span>
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-rose-400">
              {formatCurrency(metrics.saidasTotal)}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Pago: <strong className="text-slate-200">{formatCurrency(metrics.saidasPagas)}</strong>
              </span>
              <span className="text-amber-400">
                A pagar: {formatCurrency(metrics.saidasPendentes)}
              </span>
            </div>
          </div>

          {/* Card 4: Comprometimento & Fixos */}
          <div className="rounded-2xl bg-slate-900/75 border border-slate-800/90 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Renda Comprometida
              </span>
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                {metrics.taxaComprometimento}%
              </span>
              <span className="text-xs text-slate-400">das entradas</span>
            </div>
            <div className="mt-2.5 w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  metrics.taxaComprometimento > 85
                    ? 'bg-rose-500'
                    : metrics.taxaComprometimento > 65
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${metrics.taxaComprometimento}%` }}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
              <span>Fixos: {formatCurrency(metrics.gastosFixos)}</span>
              <span>Parcelados: {formatCurrency(metrics.gastosParcelados)}</span>
            </div>
          </div>
        </section>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800">
          {[
            { id: 'dashboard', label: 'Dashboard & Gráficos', icon: LayoutDashboard },
            {
              id: 'lancamentos',
              label: `Lançamentos (${monthTransactions.length})`,
              icon: ListOrdered,
            },
            {
              id: 'vencimentos',
              label: `Contas a Pagar / Receber (${
                monthTransactions.filter((t) => t.status !== 'Pago').length
              })`,
              icon: Clock,
            },
            {
              id: 'fixos',
              label: 'Despesas Fixas & Parcelamentos',
              icon: Repeat,
            },
            {
              id: 'orcamento',
              label: 'Metas por Categoria',
              icon: Filter,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition cursor-pointer ${
                  active
                    ? 'border-emerald-400 text-emerald-400 bg-slate-900/70'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Evolução Mensal Chart */}
              <div className="lg:col-span-7 rounded-2xl bg-slate-900/75 border border-slate-800/90 p-5 flex flex-col justify-between">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
                    <div>
                      <h2 className="text-base font-bold text-white">
                        Fluxo de Caixa Mensal (Entradas vs Saídas)
                      </h2>
                      <p className="text-xs text-slate-400">
                        Comparativo de evolução ao longo dos meses
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="inline-flex items-center gap-1.5 text-slate-300">
                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Entradas
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-slate-300">
                        <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Saídas
                      </span>
                    </div>
                  </div>

                  {/* Bar Chart */}
                  <div className="grid grid-cols-6 gap-3 pt-4 pb-2 items-end h-56 border-b border-slate-800">
                    {monthlyEvolution.map((item) => {
                      const hEnt = Math.max(
                        6,
                        Math.round((item.entradas / maxChartVal) * 170)
                      );
                      const hSai = Math.max(
                        6,
                        Math.round((item.saidas / maxChartVal) * 170)
                      );
                      const isCurrent = item.mesAno === selectedMonth;
                      return (
                        <div
                          key={item.mesAno}
                          onClick={() => setSelectedMonth(item.mesAno)}
                          className={`group flex flex-col items-center cursor-pointer rounded-xl p-2 transition ${
                            isCurrent ? 'bg-slate-800/70 ring-1 ring-emerald-500/40' : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-end gap-1.5 h-44 w-full justify-center">
                            <div
                              className="w-3.5 sm:w-5 rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all group-hover:brightness-110"
                              style={{ height: `${hEnt}px` }}
                              title={`Entradas: ${formatCurrency(item.entradas)}`}
                            />
                            <div
                              className="w-3.5 sm:w-5 rounded-t-md bg-gradient-to-t from-rose-600 to-rose-400 transition-all group-hover:brightness-110"
                              style={{ height: `${hSai}px` }}
                              title={`Saídas: ${formatCurrency(item.saidas)}`}
                            />
                          </div>
                          <span
                            className={`mt-2 text-xs font-medium ${
                              isCurrent ? 'text-emerald-400 font-bold' : 'text-slate-400'
                            }`}
                          >
                            {item.label}
                          </span>
                          <span
                            className={`text-[10px] font-medium ${
                              item.saldo >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80'
                            }`}
                          >
                            {item.saldo >= 0 ? '+' : ''}
                            {Math.round(item.saldo)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Summary Bottom Row */}
                <div className="grid grid-cols-3 gap-3 pt-4 text-center">
                  <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800/60">
                    <span className="text-[11px] text-slate-400 block">Gastos Fixos</span>
                    <span className="text-sm font-bold text-indigo-400">
                      {formatCurrency(metrics.gastosFixos)}
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800/60">
                    <span className="text-[11px] text-slate-400 block">Parcelamentos</span>
                    <span className="text-sm font-bold text-amber-400">
                      {formatCurrency(metrics.gastosParcelados)}
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800/60">
                    <span className="text-[11px] text-slate-400 block">Gastos Variáveis</span>
                    <span className="text-sm font-bold text-teal-400">
                      {formatCurrency(metrics.gastosUnicos)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Despesas por Categoria & Orçamento */}
              <div className="lg:col-span-5 rounded-2xl bg-slate-900/75 border border-slate-800/90 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-white">
                      Gastos por Categoria vs Meta
                    </h2>
                    <p className="text-xs text-slate-400">
                      Acompanhamento do limite mensal definido na planilha
                    </p>
                  </div>
                </div>

                <div className="space-y-3.5 max-h-[340px] overflow-y-auto pr-1">
                  {categoryBreakdown.map((item) => {
                    const overBudget = item.gasto > item.orcamentoMensal;
                    return (
                      <div key={item.categoria} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: item.corHex }}
                            />
                            <span className="font-medium text-slate-200">
                              {item.categoria}
                            </span>
                            {overBudget && (
                              <span className="px-1.5 py-0.5 text-[10px] rounded bg-rose-500/20 text-rose-300 font-semibold">
                                Acima da meta
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-white">
                              {formatCurrency(item.gasto)}
                            </span>
                            <span className="text-slate-500">
                              {' '}
                              / {formatCurrency(item.orcamentoMensal)}
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, item.percent)}%`,
                              backgroundColor: overBudget ? '#f43f5e' : item.corHex,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Próximos Vencimentos + Últimos Lançamentos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Contas Pendentes do Mês */}
              <div className="rounded-2xl bg-slate-900/75 border border-slate-800/90 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <h3 className="text-base font-bold text-white">
                      Contas Pendentes (A Pagar / A Receber)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('vencimentos')}
                    className="text-xs text-emerald-400 hover:underline cursor-pointer"
                  >
                    Ver todas
                  </button>
                </div>

                {monthTransactions.filter((t) => t.status !== 'Pago').length === 0 ? (
                  <div className="py-10 text-center text-slate-400 text-sm">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                    Tudo em dia! Nenhuma conta pendente neste período.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {monthTransactions
                      .filter((t) => t.status !== 'Pago')
                      .map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                tx.tipo === 'Entrada'
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : 'bg-amber-500/15 text-amber-400'
                              }`}
                            >
                              {tx.tipo === 'Entrada' ? (
                                <ArrowUpRight className="w-4 h-4" />
                              ) : (
                                <ArrowDownRight className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {tx.descricao}
                              </p>
                              <p className="text-xs text-slate-400">
                                Vence em {tx.vencimento} • {tx.categoria} ({tx.parcela})
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={`text-sm font-bold ${
                                tx.tipo === 'Entrada' ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {formatCurrency(tx.valor)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(tx)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 transition cursor-pointer"
                              title="Marcar como Pago/Recebido"
                            >
                              Dar Baixa
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Últimos Lançamentos */}
              <div className="rounded-2xl bg-slate-900/75 border border-slate-800/90 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-white">
                    Lançamentos Recentes do Mês
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('lancamentos')}
                    className="text-xs text-emerald-400 hover:underline cursor-pointer"
                  >
                    Gerenciar todos
                  </button>
                </div>
                <div className="space-y-2.5">
                  {monthTransactions.slice(0, 5).map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                            tx.tipo === 'Entrada'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-rose-500/15 text-rose-400'
                          }`}
                        >
                          {tx.tipo === 'Entrada' ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-white">{tx.descricao}</p>
                            {tx.recorrencia !== 'Única' && (
                              <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-800 text-slate-300">
                                {tx.recorrencia === 'Parcelada' ? tx.parcela : 'Fixa'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">
                            {tx.data} • {tx.categoria} • {tx.formaPagamento}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-bold ${
                            tx.tipo === 'Entrada' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {tx.tipo === 'Entrada' ? '+' : '-'} {formatCurrency(tx.valor)}
                        </p>
                        <span
                          className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            tx.status === 'Pago'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-amber-500/15 text-amber-400'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LANÇAMENTOS COMPLETOS */}
        {activeTab === 'lancamentos' && (
          <div className="rounded-2xl bg-slate-900/75 border border-slate-800/90 p-5 space-y-4">
            {/* Filters Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="relative lg:col-span-2">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por descrição, categoria, PIX, cartão..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <select
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value as 'TODOS' | TransactionType)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="TODOS">Tipo: Entradas e Saídas</option>
                <option value="Entrada">Apenas Entradas</option>
                <option value="Saída">Apenas Saídas</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'TODOS' | TransactionStatus)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="TODOS">Status: Todos</option>
                <option value="Pago">Pago / Recebido</option>
                <option value="Pendente">Pendente</option>
                <option value="Atrasado">Atrasado</option>
              </select>

              <select
                value={filterCategoria}
                onChange={(e) => setFilterCategoria(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="TODAS">Categoria: Todas</option>
                {categories.map((c) => (
                  <option key={c.categoria} value={c.categoria}>
                    {c.categoria} ({c.tipo})
                  </option>
                ))}
              </select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-3">Data</th>
                    <th className="py-3 px-3">Descrição</th>
                    <th className="py-3 px-3">Categoria</th>
                    <th className="py-3 px-3">Recorrência</th>
                    <th className="py-3 px-3">Pagamento</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Valor</th>
                    <th className="py-3 px-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs sm:text-sm">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400">
                        Nenhum lançamento encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className="hover:bg-slate-800/40 transition group"
                      >
                        <td className="py-3 px-3 whitespace-nowrap text-slate-300">
                          {tx.data}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-white">{tx.descricao}</div>
                          {tx.observacoes && (
                            <div className="text-xs text-slate-400">{tx.observacoes}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 text-xs">
                            {tx.categoria}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-xs text-slate-300">
                          {tx.recorrencia}{' '}
                          {tx.recorrencia === 'Parcelada' && (
                            <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
                              {tx.parcela}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-xs text-slate-300">
                          {tx.formaPagamento}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(tx)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition ${
                              tx.status === 'Pago'
                                ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                                : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
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
                        </td>
                        <td
                          className={`py-3 px-3 whitespace-nowrap text-right font-bold ${
                            tx.tipo === 'Entrada' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {tx.tipo === 'Entrada' ? '+' : '-'} {formatCurrency(tx.valor)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditTxModal(tx)}
                              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                              title="Editar"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTransaction(tx.id)}
                              className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CONTAS A PAGAR & RECEBER */}
        {activeTab === 'vencimentos' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contas a Pagar */}
            <div className="rounded-2xl bg-slate-900/75 border border-slate-800/90 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Contas a Pagar (Saídas Pendentes)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Total pendente no período: {formatCurrency(metrics.saidasPendentes)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openNewTxModal('Saída')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition cursor-pointer"
                >
                  + Conta a Pagar
                </button>
              </div>
              <div className="space-y-2.5">
                {monthTransactions.filter(
                  (t) => t.tipo === 'Saída' && t.status !== 'Pago'
                ).length === 0 ? (
                  <p className="text-sm text-slate-400 py-8 text-center">
                    Nenhuma saída pendente neste mês!
                  </p>
                ) : (
                  monthTransactions
                    .filter((t) => t.tipo === 'Saída' && t.status !== 'Pago')
                    .map((tx) => (
                      <div
                        key={tx.id}
                        className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-white">
                              {tx.descricao}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300">
                              Vence: {tx.vencimento}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {tx.categoria} • {tx.formaPagamento} • Parcela {tx.parcela}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-rose-400">
                            {formatCurrency(tx.valor)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(tx)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition cursor-pointer"
                          >
                            Marcar Pago
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Contas a Receber */}
            <div className="rounded-2xl bg-slate-900/75 border border-slate-800/90 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Valores a Receber (Entradas Pendentes)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Total a receber no período: {formatCurrency(metrics.entradasPendentes)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openNewTxModal('Entrada')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition cursor-pointer"
                >
                  + Valor a Receber
                </button>
              </div>
              <div className="space-y-2.5">
                {monthTransactions.filter(
                  (t) => t.tipo === 'Entrada' && t.status !== 'Pago'
                ).length === 0 ? (
                  <p className="text-sm text-slate-400 py-8 text-center">
                    Nenhuma entrada pendente neste mês!
                  </p>
                ) : (
                  monthTransactions
                    .filter((t) => t.tipo === 'Entrada' && t.status !== 'Pago')
                    .map((tx) => (
                      <div
                        key={tx.id}
                        className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-white">
                              {tx.descricao}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                              Previsão: {tx.vencimento}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {tx.categoria} • {tx.formaPagamento}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-emerald-400">
                            {formatCurrency(tx.valor)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(tx)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition cursor-pointer"
                          >
                            Confirmar Recebimento
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DESPESAS FIXAS & PARCELAMENTOS */}
        {activeTab === 'fixos' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fixos Mensais */}
            <div className="rounded-2xl bg-slate-900/75 border border-slate-800/90 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Repeat className="w-4 h-4 text-indigo-400" />
                    Compromissos Fixos Mensais
                  </h3>
                  <p className="text-xs text-slate-400">
                    Receitas e despesas que se repetem todo mês
                  </p>
                </div>
                {selectedMonth !== 'ALL' && (
                  <button
                    type="button"
                    onClick={handleGenerateFixedForNextMonth}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 transition cursor-pointer"
                  >
                    Replicar Fixos p/ {formatMonthLabel(shiftMonth(selectedMonth, 1))}
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {monthTransactions
                  .filter((t) => t.recorrencia === 'Fixa Mensal')
                  .map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{tx.descricao}</p>
                        <p className="text-xs text-slate-400">
                          Dia {tx.vencimento.slice(8, 10)} • {tx.categoria} • {tx.formaPagamento}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-bold ${
                            tx.tipo === 'Entrada' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {formatCurrency(tx.valor)}
                        </p>
                        <span className="text-[11px] text-slate-400">{tx.status}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Compras Parceladas */}
            <div className="rounded-2xl bg-slate-900/75 border border-slate-800/90 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-amber-400" />
                    Compras e Contas Parceladas
                  </h3>
                  <p className="text-xs text-slate-400">
                    Controle de evolução de parcelas e saldo restante
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    openNewTxModal('Saída');
                    setFormRecorrencia('Parcelada');
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition cursor-pointer"
                >
                  + Nova Compra Parcelada
                </button>
              </div>

              <div className="space-y-2.5">
                {monthTransactions.filter((t) => t.recorrencia === 'Parcelada').length ===
                0 ? (
                  <p className="text-sm text-slate-400 py-8 text-center">
                    Nenhum parcelamento ativo neste período.
                  </p>
                ) : (
                  monthTransactions
                    .filter((t) => t.recorrencia === 'Parcelada')
                    .map((tx) => {
                      const [cur, tot] = (tx.parcela || '1/1').split('/').map(Number);
                      const pct = tot > 0 ? Math.round((cur / tot) * 100) : 100;
                      const restantes = Math.max(0, (tot || 1) - (cur || 1));
                      return (
                        <div
                          key={tx.id}
                          className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-semibold text-white">
                                {tx.descricao}
                              </span>
                              <span className="ml-2 px-2 py-0.5 text-xs rounded bg-amber-500/20 text-amber-300 font-semibold">
                                Parcela {tx.parcela}
                              </span>
                            </div>
                            <span className="text-sm font-bold text-rose-400">
                              {formatCurrency(tx.valor)}/mês
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-amber-400 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>{tx.formaPagamento}</span>
                            <span>
                              Restam {restantes}x ({formatCurrency(restantes * tx.valor)})
                            </span>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: METAS DE ORÇAMENTO POR CATEGORIA */}
        {activeTab === 'orcamento' && (
          <div className="rounded-2xl bg-slate-900/75 border border-slate-800/90 p-5 space-y-4">
            <div>
              <h3 className="text-base font-bold text-white">
                Metas de Orçamento Mensal por Categoria
              </h3>
              <p className="text-xs text-slate-400">
                Ajuste o teto de gastos de cada categoria (sincronizado com a aba Categorias da sua planilha)
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryBreakdown.map((cat) => (
                <div
                  key={cat.categoria}
                  className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: cat.corHex }}
                      />
                      <span className="font-semibold text-white">{cat.categoria}</span>
                    </div>
                    <span className="text-xs text-slate-400">{cat.percent}% usado</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Gasto no mês:</span>
                    <span className="font-bold text-rose-400">
                      {formatCurrency(cat.gasto)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs gap-2">
                    <label className="text-slate-400">Meta Mensal (R$):</label>
                    <input
                      type="number"
                      value={cat.orcamentoMensal}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setCategories((prev) =>
                          prev.map((c) =>
                            c.categoria === cat.categoria
                              ? { ...c, orcamentoMensal: val }
                              : c
                          )
                        );
                      }}
                      className="w-28 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-right text-white font-semibold"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* MODAL: NOVO / EDITAR LANÇAMENTO */}
      {isTxModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                {editingTx ? 'Editar Lançamento' : 'Novo Lançamento Financeiro'}
              </h2>
              <button
                type="button"
                onClick={() => setIsTxModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="space-y-4">
              {/* Tipo: Entrada vs Saída */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
                {(['Entrada', 'Saída'] as TransactionType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setFormTipo(t);
                      setFormCategoria(t === 'Entrada' ? 'Salário' : 'Alimentação');
                    }}
                    className={`py-2 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer ${
                      formTipo === t
                        ? t === 'Entrada'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-rose-500 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t === 'Entrada' ? 'Entrada (+ Receita)' : 'Saída (- Despesa)'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">
                    Descrição *
                  </label>
                  <input
                    type="text"
                    required
                    value={formDescricao}
                    onChange={(e) => setFormDescricao(e.target.value)}
                    placeholder="Ex: Salário Mensal, Supermercado, Aluguel..."
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Valor (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formValor}
                    onChange={(e) => setFormValor(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Categoria
                  </label>
                  <select
                    value={formCategoria}
                    onChange={(e) => setFormCategoria(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {categories
                      .filter((c) => c.tipo === formTipo)
                      .map((c) => (
                        <option key={c.categoria} value={c.categoria}>
                          {c.categoria}
                        </option>
                      ))}
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Data do Lançamento
                  </label>
                  <input
                    type="date"
                    value={formData}
                    onChange={(e) => {
                      setFormData(e.target.value);
                      setFormVencimento(e.target.value);
                    }}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Data de Vencimento
                  </label>
                  <input
                    type="date"
                    value={formVencimento}
                    onChange={(e) => setFormVencimento(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as TransactionStatus)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Pago">Pago / Recebido</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Atrasado">Atrasado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={formFormaPagamento}
                    onChange={(e) => setFormFormaPagamento(e.target.value as PaymentMethod)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm} value={pm}>
                        {pm}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">
                    Recorrência
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Única', 'Fixa Mensal', 'Parcelada'] as RecurrenceType[]).map(
                      (rec) => (
                        <button
                          key={rec}
                          type="button"
                          onClick={() => setFormRecorrencia(rec)}
                          className={`py-2 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                            formRecorrencia === rec
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {rec}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {formRecorrencia === 'Parcelada' && (
                  <div className="sm:col-span-2 p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Parcela Inicial
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={formParcelaAtual}
                          onChange={(e) => setFormParcelaAtual(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Total de Parcelas
                        </label>
                        <input
                          type="number"
                          min={2}
                          max={60}
                          value={formTotalParcelas}
                          onChange={(e) => setFormTotalParcelas(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
                        />
                      </div>
                    </div>
                    {!editingTx && (
                      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formGerarDemaisParcelas}
                          onChange={(e) => setFormGerarDemaisParcelas(e.target.checked)}
                          className="rounded accent-emerald-500"
                        />
                        <span>
                          Gerar automaticamente as próximas parcelas nos meses seguintes
                        </span>
                      </label>
                    )}
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">
                    Observações (opcional)
                  </label>
                  <input
                    type="text"
                    value={formObservacoes}
                    onChange={(e) => setFormObservacoes(e.target.value)}
                    placeholder="Detalhes adicionais..."
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTxModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer"
                >
                  {editingTx ? 'Salvar Alterações' : 'Adicionar Lançamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SINCRONIZAÇÃO GOOGLE SHEETS */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Sincronização em Tempo Real • Google Sheets
                  </h2>
                  <p className="text-xs text-slate-400">
                    Planilha vinculada: {syncSettings.spreadsheetId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {syncStatusMsg && (
              <div
                className={`p-3.5 rounded-xl text-xs font-medium border ${
                  syncStatusMsg.type === 'success'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : syncStatusMsg.type === 'error'
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                    : 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                }`}
              >
                {syncStatusMsg.text}
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                URL do Web App (Google Apps Script)
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
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
              />
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={pullFromGoogleSheets}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  Puxar Dados da Planilha
                </button>
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={syncAllToGoogleSheets}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 transition cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Enviar Todos os Lançamentos p/ Planilha
                </button>
                <a
                  href={syncSettings.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                >
                  Abrir Planilha <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">
                  Como ativar a gravação automática na sua planilha (1 minuto):
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(APPS_SCRIPT_SNIPPET);
                    setCopiedScript(true);
                    setTimeout(() => setCopiedScript(false), 2500);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
                >
                  {copiedScript ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Código Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copiar Código Apps Script
                    </>
                  )}
                </button>
              </div>
              <ol className="text-xs text-slate-400 space-y-1.5 list-decimal list-inside">
                <li>
                  Na sua planilha Google, clique em{' '}
                  <strong className="text-slate-200">Extensões &gt; Apps Script</strong>.
                </li>
                <li>
                  Cole o código acima, salve e clique em{' '}
                  <strong className="text-slate-200">Implantar &gt; Nova implantação</strong>.
                </li>
                <li>
                  Escolha o tipo <strong className="text-slate-200">App da Web</strong> e em
                  &quot;Quem pode acessar&quot; selecione{' '}
                  <strong className="text-slate-200">Qualquer pessoa</strong>.
                </li>
                <li>
                  Copie a <strong className="text-slate-200">URL do App da Web</strong> gerada e
                  cole no campo acima!
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
