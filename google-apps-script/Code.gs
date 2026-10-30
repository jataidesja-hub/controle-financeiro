/**
 * SCRIPT DE INTEGRAÇÃO EM TEMPO REAL - CONTROLE FINANCEIRO COMPLETO
 * Planilha vinculada: https://docs.google.com/spreadsheets/d/1f6IEJX59z5a5RXQ9npojHFEJjhIYmtyHv2f70olqoJU/edit
 *
 * COMO INSTALAR (Leva 1 minuto):
 * 1. Na sua Planilha do Google, clique no menu superior em: Extensões > Apps Script
 * 2. Apague qualquer código existente e cole todo este código.
 * 3. Clique em "Implantar" (botão azul no canto superior direito) > "Nova implantação".
 * 4. Em "Selecionar tipo" (ícone de engrenagem), escolha "App da Web".
 * 5. Em "Executar como", deixe "Eu".
 * 6. Em "Quem pode acessar", selecione "Qualquer pessoa".
 * 7. Clique em "Implantar", autorize o acesso na sua conta Google e copie a "URL do App da Web".
 * 8. Cole essa URL no botão "Sincronizar Planilha" dentro do seu sistema na Vercel!
 */

const SPREADSHEET_ID = '1f6IEJX59z5a5RXQ9npojHFEJjhIYmtyHv2f70olqoJU';
const SHEET_LANCAMENTOS = 'Lancamentos';
const SHEET_CATEGORIAS = 'Categorias';

function getSpreadsheet() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (e) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

function doGet(e) {
  const ss = getSpreadsheet();
  const sheetLanc = ss.getSheetByName(SHEET_LANCAMENTOS);
  const sheetCat = ss.getSheetByName(SHEET_CATEGORIAS);

  const transactions = readSheetAsObjects(sheetLanc);
  const categories = readSheetAsObjects(sheetCat);

  const response = {
    ok: true,
    spreadsheetId: SPREADSHEET_ID,
    updatedAt: new Date().toISOString(),
    transactions: transactions,
    categories: categories
  };

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_LANCAMENTOS);

    if (action === 'add') {
      const tx = payload.transaction;
      sheet.appendRow(transactionToRow(tx));
      return jsonResponse({ ok: true, action: 'add', id: tx.id });
    }

    if (action === 'addBatch') {
      const list = payload.transactions || [];
      list.forEach(function(tx) {
        sheet.appendRow(transactionToRow(tx));
      });
      return jsonResponse({ ok: true, action: 'addBatch', count: list.length });
    }

    if (action === 'update') {
      const tx = payload.transaction;
      const updated = updateRowById(sheet, tx.id, transactionToRow(tx));
      if (!updated) {
        sheet.appendRow(transactionToRow(tx));
      }
      return jsonResponse({ ok: true, action: 'update', id: tx.id });
    }

    if (action === 'delete') {
      const id = payload.id;
      const deleted = deleteRowById(sheet, id);
      return jsonResponse({ ok: true, action: 'delete', id: id, deleted: deleted });
    }

    if (action === 'syncAll') {
      const list = payload.transactions || [];
      const headers = [
        'ID', 'Data', 'MesAno', 'Descricao', 'Tipo', 'Categoria',
        'Valor', 'Status', 'Vencimento', 'Recorrencia', 'Parcela',
        'FormaPagamento', 'Observacoes', 'CriadoEm'
      ];
      sheet.clearContents();
      const rows = [headers];
      list.forEach(function(tx) {
        rows.push(transactionToRow(tx));
      });
      sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
      return jsonResponse({ ok: true, action: 'syncAll', count: list.length });
    }

    return jsonResponse({ ok: false, error: 'Ação desconhecida: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function transactionToRow(tx) {
  return [
    tx.id || '',
    tx.data || '',
    tx.mesAno || (tx.data ? String(tx.data).slice(0, 7) : ''),
    tx.descricao || '',
    tx.tipo || 'Saída',
    tx.categoria || 'Outros',
    Number(tx.valor || 0),
    tx.status || 'Pago',
    tx.vencimento || tx.data || '',
    tx.recorrencia || 'Única',
    tx.parcela || '1/1',
    tx.formaPagamento || 'PIX',
    tx.observacoes || '',
    tx.criadoEm || new Date().toISOString()
  ];
}

function readSheetAsObjects(sheet) {
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0].map(function(h) { return String(h).trim(); });
  const result = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row[0] && !row[3]) continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    result.push(obj);
  }
  return result;
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
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
