import { CategoryBudget, Transaction } from '@/types/finance';

export const DEFAULT_SPREADSHEET_ID = '1f6IEJX59z5a5RXQ9npojHFEJjhIYmtyHv2f70olqoJU';
export const DEFAULT_SPREADSHEET_URL =
  'https://docs.google.com/spreadsheets/d/1f6IEJX59z5a5RXQ9npojHFEJjhIYmtyHv2f70olqoJU/edit?gid=0#gid=0';

export const INITIAL_CATEGORIES: CategoryBudget[] = [
  { categoria: 'Salário', tipo: 'Entrada', orcamentoMensal: 0, corHex: '#10b981' },
  { categoria: 'Renda Extra', tipo: 'Entrada', orcamentoMensal: 0, corHex: '#34d399' },
  { categoria: 'Vendas / Serviços', tipo: 'Entrada', orcamentoMensal: 0, corHex: '#059669' },
  { categoria: 'Moradia', tipo: 'Saída', orcamentoMensal: 0, corHex: '#6366f1' },
  { categoria: 'Alimentação', tipo: 'Saída', orcamentoMensal: 0, corHex: '#f59e0b' },
  { categoria: 'Transporte', tipo: 'Saída', orcamentoMensal: 0, corHex: '#3b82f6' },
  { categoria: 'Contas (Luz/Água/Internet)', tipo: 'Saída', orcamentoMensal: 0, corHex: '#06b6d4' },
  { categoria: 'Cartão / Parcelas', tipo: 'Saída', orcamentoMensal: 0, corHex: '#f97316' },
  { categoria: 'Saúde', tipo: 'Saída', orcamentoMensal: 0, corHex: '#ec4899' },
  { categoria: 'Lazer', tipo: 'Saída', orcamentoMensal: 0, corHex: '#14b8a6' },
  { categoria: 'Outros', tipo: 'Saída', orcamentoMensal: 0, corHex: '#64748b' },
];

export const INITIAL_TRANSACTIONS: Transaction[] = [];

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
