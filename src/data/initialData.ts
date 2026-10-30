import { CategoryBudget, Transaction } from '@/types/finance';

export const DEFAULT_SPREADSHEET_ID = '1f6IEJX59z5a5RXQ9npojHFEJjhIYmtyHv2f70olqoJU';
export const DEFAULT_SPREADSHEET_URL =
  'https://docs.google.com/spreadsheets/d/1f6IEJX59z5a5RXQ9npojHFEJjhIYmtyHv2f70olqoJU/edit?gid=0#gid=0';

export const INITIAL_CATEGORIES: CategoryBudget[] = [
  { categoria: 'Salário', tipo: 'Entrada', orcamentoMensal: 7500, corHex: '#10b981' },
  { categoria: 'Renda Extra', tipo: 'Entrada', orcamentoMensal: 2000, corHex: '#34d399' },
  { categoria: 'Investimentos', tipo: 'Entrada', orcamentoMensal: 1000, corHex: '#059669' },
  { categoria: 'Moradia', tipo: 'Saída', orcamentoMensal: 2500, corHex: '#6366f1' },
  { categoria: 'Alimentação', tipo: 'Saída', orcamentoMensal: 1500, corHex: '#f59e0b' },
  { categoria: 'Transporte', tipo: 'Saída', orcamentoMensal: 900, corHex: '#3b82f6' },
  { categoria: 'Saúde', tipo: 'Saída', orcamentoMensal: 700, corHex: '#ec4899' },
  { categoria: 'Educação', tipo: 'Saída', orcamentoMensal: 400, corHex: '#8b5cf6' },
  { categoria: 'Contas e Serviços', tipo: 'Saída', orcamentoMensal: 500, corHex: '#06b6d4' },
  { categoria: 'Equipamentos', tipo: 'Saída', orcamentoMensal: 600, corHex: '#f97316' },
  { categoria: 'Lazer', tipo: 'Saída', orcamentoMensal: 500, corHex: '#14b8a6' },
  { categoria: 'Outros', tipo: 'Saída', orcamentoMensal: 400, corHex: '#64748b' },
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'TX-1001',
    data: '2026-10-05',
    mesAno: '2026-10',
    descricao: 'Salário Mensal',
    tipo: 'Entrada',
    categoria: 'Salário',
    valor: 7500,
    status: 'Pago',
    vencimento: '2026-10-05',
    recorrencia: 'Fixa Mensal',
    parcela: '1/1',
    formaPagamento: 'PIX',
    observacoes: 'Pagamento mensal empresa',
    criadoEm: '2026-10-05T08:00:00Z',
  },
  {
    id: 'TX-1002',
    data: '2026-10-15',
    mesAno: '2026-10',
    descricao: 'Projeto Freelance Consultoria',
    tipo: 'Entrada',
    categoria: 'Renda Extra',
    valor: 2200,
    status: 'Pago',
    vencimento: '2026-10-15',
    recorrencia: 'Única',
    parcela: '1/1',
    formaPagamento: 'PIX',
    observacoes: 'Entrega etapa 1',
    criadoEm: '2026-10-15T14:00:00Z',
  },
  {
    id: 'TX-1003',
    data: '2026-10-28',
    mesAno: '2026-10',
    descricao: 'Reembolso Despesas',
    tipo: 'Entrada',
    categoria: 'Outros',
    valor: 450,
    status: 'Pendente',
    vencimento: '2026-10-31',
    recorrencia: 'Única',
    parcela: '1/1',
    formaPagamento: 'Transferência',
    observacoes: 'Aguardando depósito',
    criadoEm: '2026-10-28T10:00:00Z',
  },
  {
    id: 'TX-1004',
    data: '2026-10-05',
    mesAno: '2026-10',
    descricao: 'Aluguel + Condomínio',
    tipo: 'Saída',
    categoria: 'Moradia',
    valor: 2400,
    status: 'Pago',
    vencimento: '2026-10-05',
    recorrencia: 'Fixa Mensal',
    parcela: '1/1',
    formaPagamento: 'Boleto',
    observacoes: 'Despesa fixa mensal',
    criadoEm: '2026-10-05T09:00:00Z',
  },
  {
    id: 'TX-1005',
    data: '2026-10-10',
    mesAno: '2026-10',
    descricao: 'Energia Elétrica e Internet Fibra',
    tipo: 'Saída',
    categoria: 'Contas e Serviços',
    valor: 380,
    status: 'Pago',
    vencimento: '2026-10-10',
    recorrencia: 'Fixa Mensal',
    parcela: '1/1',
    formaPagamento: 'Débito',
    observacoes: 'Luz + Fibra 600mb',
    criadoEm: '2026-10-10T11:00:00Z',
  },
  {
    id: 'TX-1006',
    data: '2026-10-12',
    mesAno: '2026-10',
    descricao: 'Supermercado Mensal',
    tipo: 'Saída',
    categoria: 'Alimentação',
    valor: 1250,
    status: 'Pago',
    vencimento: '2026-10-12',
    recorrencia: 'Única',
    parcela: '1/1',
    formaPagamento: 'Cartão de Crédito',
    observacoes: 'Compras do mês',
    criadoEm: '2026-10-12T16:30:00Z',
  },
  {
    id: 'TX-1007',
    data: '2026-10-18',
    mesAno: '2026-10',
    descricao: 'Notebook Dell Inspiron',
    tipo: 'Saída',
    categoria: 'Equipamentos',
    valor: 420,
    status: 'Pago',
    vencimento: '2026-10-18',
    recorrencia: 'Parcelada',
    parcela: '3/10',
    formaPagamento: 'Cartão de Crédito',
    observacoes: 'Parcela 3 de 10',
    criadoEm: '2026-10-18T12:00:00Z',
  },
  {
    id: 'TX-1008',
    data: '2026-10-20',
    mesAno: '2026-10',
    descricao: 'Plano de Saúde + Academia',
    tipo: 'Saída',
    categoria: 'Saúde',
    valor: 620,
    status: 'Pago',
    vencimento: '2026-10-20',
    recorrencia: 'Fixa Mensal',
    parcela: '1/1',
    formaPagamento: 'Cartão de Crédito',
    observacoes: 'Mensalidade recorrente',
    criadoEm: '2026-10-20T09:15:00Z',
  },
  {
    id: 'TX-1009',
    data: '2026-10-25',
    mesAno: '2026-10',
    descricao: 'Combustível e Manutenção',
    tipo: 'Saída',
    categoria: 'Transporte',
    valor: 480,
    status: 'Pago',
    vencimento: '2026-10-25',
    recorrencia: 'Única',
    parcela: '1/1',
    formaPagamento: 'PIX',
    observacoes: 'Abastecimento quinzenal',
    criadoEm: '2026-10-25T18:00:00Z',
  },
  {
    id: 'TX-1010',
    data: '2026-10-30',
    mesAno: '2026-10',
    descricao: 'Seguro Auto Anual',
    tipo: 'Saída',
    categoria: 'Transporte',
    valor: 310,
    status: 'Pendente',
    vencimento: '2026-10-31',
    recorrencia: 'Parcelada',
    parcela: '4/12',
    formaPagamento: 'Boleto',
    observacoes: 'Vence no fim do mês',
    criadoEm: '2026-10-26T10:00:00Z',
  },
  {
    id: 'TX-1011',
    data: '2026-10-29',
    mesAno: '2026-10',
    descricao: 'Curso Especialização Tech',
    tipo: 'Saída',
    categoria: 'Educação',
    valor: 290,
    status: 'Pendente',
    vencimento: '2026-10-30',
    recorrencia: 'Fixa Mensal',
    parcela: '1/1',
    formaPagamento: 'Boleto',
    observacoes: 'Mensalidade out/2026',
    criadoEm: '2026-10-27T11:00:00Z',
  },
  {
    id: 'TX-0901',
    data: '2026-09-05',
    mesAno: '2026-09',
    descricao: 'Salário Mensal',
    tipo: 'Entrada',
    categoria: 'Salário',
    valor: 7500,
    status: 'Pago',
    vencimento: '2026-09-05',
    recorrencia: 'Fixa Mensal',
    parcela: '1/1',
    formaPagamento: 'PIX',
    observacoes: 'Pagamento setembro',
    criadoEm: '2026-09-05T08:00:00Z',
  },
  {
    id: 'TX-0902',
    data: '2026-09-05',
    mesAno: '2026-09',
    descricao: 'Aluguel + Condomínio',
    tipo: 'Saída',
    categoria: 'Moradia',
    valor: 2400,
    status: 'Pago',
    vencimento: '2026-09-05',
    recorrencia: 'Fixa Mensal',
    parcela: '1/1',
    formaPagamento: 'Boleto',
    observacoes: 'Despesa fixa mensal',
    criadoEm: '2026-09-05T09:00:00Z',
  },
  {
    id: 'TX-0903',
    data: '2026-09-14',
    mesAno: '2026-09',
    descricao: 'Supermercado e Feira',
    tipo: 'Saída',
    categoria: 'Alimentação',
    valor: 1180,
    status: 'Pago',
    vencimento: '2026-09-14',
    recorrencia: 'Única',
    parcela: '1/1',
    formaPagamento: 'Cartão de Crédito',
    observacoes: 'Compras setembro',
    criadoEm: '2026-09-14T15:00:00Z',
  },
];

export const APPS_SCRIPT_SNIPPET = `const SPREADSHEET_ID = '${DEFAULT_SPREADSHEET_ID}';
const SHEET_LANCAMENTOS = 'Lancamentos';
const SHEET_CATEGORIAS = 'Categorias';

function getSpreadsheet() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (e) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

function doGet() {
  const ss = getSpreadsheet();
  const transactions = readSheetAsObjects(ss.getSheetByName(SHEET_LANCAMENTOS));
  const categories = readSheetAsObjects(ss.getSheetByName(SHEET_CATEGORIAS));
  return jsonResponse({ ok: true, transactions, categories, updatedAt: new Date().toISOString() });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_LANCAMENTOS);
    if (payload.action === 'add') {
      sheet.appendRow(transactionToRow(payload.transaction));
      return jsonResponse({ ok: true });
    }
    if (payload.action === 'addBatch') {
      (payload.transactions || []).forEach(tx => sheet.appendRow(transactionToRow(tx)));
      return jsonResponse({ ok: true });
    }
    if (payload.action === 'update') {
      const updated = updateRowById(sheet, payload.transaction.id, transactionToRow(payload.transaction));
      if (!updated) sheet.appendRow(transactionToRow(payload.transaction));
      return jsonResponse({ ok: true });
    }
    if (payload.action === 'delete') {
      deleteRowById(sheet, payload.id);
      return jsonResponse({ ok: true });
    }
    if (payload.action === 'syncAll') {
      const headers = ['ID','Data','MesAno','Descricao','Tipo','Categoria','Valor','Status','Vencimento','Recorrencia','Parcela','FormaPagamento','Observacoes','CriadoEm'];
      sheet.clearContents();
      const rows = [headers, ...(payload.transactions || []).map(transactionToRow)];
      sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
      return jsonResponse({ ok: true, count: rows.length - 1 });
    }
    return jsonResponse({ ok: false, error: 'Ação inválida' });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function transactionToRow(tx) {
  return [
    tx.id || '', tx.data || '', tx.mesAno || '', tx.descricao || '',
    tx.tipo || 'Saída', tx.categoria || 'Outros', Number(tx.valor || 0),
    tx.status || 'Pago', tx.vencimento || tx.data || '', tx.recorrencia || 'Única',
    tx.parcela || '1/1', tx.formaPagamento || 'PIX', tx.observacoes || '', tx.criadoEm || new Date().toISOString()
  ];
}

function readSheetAsObjects(sheet) {
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0].map(h => String(h).trim());
  return values.slice(1).filter(r => r[0] || r[3]).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function updateRowById(sheet, id, newRow) {
  const values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      sheet.getRange(i + 1, 1, 1, newRow.length).setValues([newRow]);
      return true;
    }
  }
  return false;
}

function deleteRowById(sheet, id) {
  const values = sheet.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    if (String(values[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}`;
