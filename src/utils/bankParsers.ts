import { PaymentMethod, Transaction, TransactionType } from '@/types/finance';

export function autoCategorize(descricao: string, tipo: TransactionType): string {
  const lower = descricao.toLowerCase();
  if (tipo === 'Entrada') {
    if (lower.includes('salário') || lower.includes('salario') || lower.includes('pagamento')) {
      return 'Salário';
    }
    if (lower.includes('venda') || lower.includes('cliente') || lower.includes('serviço')) {
      return 'Vendas / Serviços';
    }
    return 'Renda Extra';
  }

  if (
    lower.includes('ifood') ||
    lower.includes('mercado') ||
    lower.includes('supermercado') ||
    lower.includes('padaria') ||
    lower.includes('restaurante') ||
    lower.includes('lanche') ||
    lower.includes('assai') ||
    lower.includes('atacad') ||
    lower.includes('carrefour')
  ) {
    return 'Alimentação';
  }
  if (
    lower.includes('uber') ||
    lower.includes('99') ||
    lower.includes('posto') ||
    lower.includes('combustivel') ||
    lower.includes('gasolina') ||
    lower.includes('estacionamento') ||
    lower.includes('pedagio')
  ) {
    return 'Transporte';
  }
  if (
    lower.includes('energia') ||
    lower.includes('luz') ||
    lower.includes('agua') ||
    lower.includes('saneamento') ||
    lower.includes('internet') ||
    lower.includes('vivo') ||
    lower.includes('claro') ||
    lower.includes('tim')
  ) {
    return 'Contas (Luz/Água/Internet)';
  }
  if (
    lower.includes('aluguel') ||
    lower.includes('condominio') ||
    lower.includes('iptu')
  ) {
    return 'Moradia';
  }
  if (
    lower.includes('farmacia') ||
    lower.includes('drogaria') ||
    lower.includes('droga') ||
    lower.includes('medico') ||
    lower.includes('hospital') ||
    lower.includes('exame')
  ) {
    return 'Saúde';
  }
  if (
    lower.includes('netflix') ||
    lower.includes('spotify') ||
    lower.includes('cinema') ||
    lower.includes('bar') ||
    lower.includes('ingresso')
  ) {
    return 'Lazer';
  }
  if (lower.includes('fatura') || lower.includes('parcela') || lower.includes('cartao')) {
    return 'Cartão / Parcelas';
  }
  return 'Outros';
}

function normalizeDateString(raw: string): string {
  const trimmed = raw.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  // DD/MM/YYYY
  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }
  // OFX YYYYMMDD
  const ofxMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})/);
  if (ofxMatch) {
    return `${ofxMatch[1]}-${ofxMatch[2]}-${ofxMatch[3]}`;
  }
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

function parseAmountNumber(raw: string): number {
  let cleaned = raw.replace(/[R$\s"]/g, '').trim();
  // If format is 1.234,56 -> convert to 1234.56
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }
  return parseFloat(cleaned);
}

export function parseBankFile(content: string, fileName: string): Transaction[] {
  const isOfx =
    fileName.toLowerCase().endsWith('.ofx') || content.includes('<STMTTRN>');
  if (isOfx) {
    return parseOfxContent(content);
  }
  return parseCsvContent(content);
}

function parseOfxContent(content: string): Transaction[] {
  const blocks = content.split(/<STMTTRN>/i).slice(1);
  const results: Transaction[] = [];

  blocks.forEach((block, idx) => {
    const trnAmtMatch = block.match(/<TRNAMT>([^<\r\n]+)/i);
    const dtPostedMatch = block.match(/<DTPOSTED>([^<\r\n]+)/i);
    const memoMatch =
      block.match(/<MEMO>([^<\r\n]+)/i) || block.match(/<NAME>([^<\r\n]+)/i);
    const fitIdMatch = block.match(/<FITID>([^<\r\n]+)/i);

    if (!trnAmtMatch) return;
    const rawVal = parseAmountNumber(trnAmtMatch[1]);
    if (Number.isNaN(rawVal) || rawVal === 0) return;

    const tipo: TransactionType = rawVal > 0 ? 'Entrada' : 'Saída';
    const valor = Math.abs(rawVal);
    const data = dtPostedMatch ? normalizeDateString(dtPostedMatch[1]) : new Date().toISOString().slice(0, 10);
    const descricao = memoMatch ? memoMatch[1].trim() : 'Lançamento Bancário';
    const id = fitIdMatch
      ? `OFX-${fitIdMatch[1].trim().slice(-10)}`
      : `OFX-${Date.now()}-${idx}`;

    results.push({
      id,
      data,
      mesAno: data.slice(0, 7),
      descricao,
      tipo,
      categoria: autoCategorize(descricao, tipo),
      valor,
      status: 'Pago',
      vencimento: data,
      recorrencia: 'Única',
      parcela: '1/1',
      formaPagamento: descricao.toLowerCase().includes('pix') ? 'PIX' : 'Débito',
      observacoes: 'Importado via OFX (Nubank/PicPay)',
      criadoEm: new Date().toISOString(),
    });
  });

  return results;
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const res: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      res.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  res.push(current.trim());
  return res;
}

function parseCsvContent(content: string): Transaction[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = parseCsvLine(lines[0], delimiter).map((h) =>
    h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  );

  // Detect columns for Nubank Conta (Data, Valor, Identificador, Descrição),
  // Nubank Cartão (date, title, amount) or PicPay
  const dateIdx = headers.findIndex(
    (h) => h.includes('data') || h.includes('date') || h.includes('dia')
  );
  const valIdx = headers.findIndex(
    (h) => h.includes('valor') || h.includes('amount') || h.includes('quantia')
  );
  const descIdx = headers.findIndex(
    (h) =>
      h.includes('descri') ||
      h.includes('title') ||
      h.includes('historico') ||
      h.includes('estabelecimento') ||
      h.includes('nome')
  );
  const idIdx = headers.findIndex((h) => h.includes('identificador') || h === 'id');
  const isCreditCardBill =
    headers.includes('title') && headers.includes('amount') && headers.includes('date');

  const results: Transaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delimiter);
    if (cols.length < 2) continue;

    const rawDate = cols[dateIdx >= 0 ? dateIdx : 0] || '';
    const rawValStr = cols[valIdx >= 0 ? valIdx : 1] || '';
    const rawDesc =
      cols[descIdx >= 0 ? descIdx : cols.length - 1] || 'Lançamento Importado';

    const numVal = parseAmountNumber(rawValStr);
    if (Number.isNaN(numVal) || numVal === 0) continue;

    // In Nubank Credit Card CSV (date,title,amount), positive amounts are expenses (Saída)
    let tipo: TransactionType = 'Saída';
    if (isCreditCardBill) {
      tipo = numVal < 0 ? 'Entrada' : 'Saída';
    } else {
      tipo = numVal > 0 ? 'Entrada' : 'Saída';
    }

    const valor = Math.abs(numVal);
    const data = normalizeDateString(rawDate);
    const descricao = rawDesc.replace(/^"|"$/g, '').trim();
    const id =
      idIdx >= 0 && cols[idIdx]
        ? `IMP-${cols[idIdx].slice(-8)}`
        : `IMP-${Date.now()}-${i}`;

    const formaPagamento: PaymentMethod = isCreditCardBill
      ? 'Cartão de Crédito'
      : descricao.toLowerCase().includes('pix')
      ? 'PIX'
      : 'Débito';

    results.push({
      id,
      data,
      mesAno: data.slice(0, 7),
      descricao,
      tipo,
      categoria: autoCategorize(descricao, tipo),
      valor,
      status: 'Pago',
      vencimento: data,
      recorrencia: 'Única',
      parcela: '1/1',
      formaPagamento,
      observacoes: 'Importado de extrato Nubank/PicPay',
      criadoEm: new Date().toISOString(),
    });
  }

  return results;
}

export function parseBankNotificationText(
  texto: string,
  banco: string = 'Nubank/PicPay'
): Transaction | null {
  const clean = texto.replace(/\s+/g, ' ').trim();
  if (!clean) return null;

  // Match Brazilian currency e.g. R$ 1.250,90 or R$ 45,00 or 45,90
  const moneyMatch =
    clean.match(/R\$\s*([\d.]+,\d{2})/i) || clean.match(/([\d.]+,\d{2})/);
  if (!moneyMatch) return null;

  const valor = parseAmountNumber(moneyMatch[1]);
  if (Number.isNaN(valor) || valor <= 0) return null;

  const lower = clean.toLowerCase();
  const isEntrada =
    lower.includes('receb') ||
    lower.includes('transferência recebida') ||
    lower.includes('pix recebido') ||
    lower.includes('você recebeu') ||
    lower.includes('reembolso') ||
    lower.includes('deposit') ||
    lower.includes('caiu na conta');

  const tipo: TransactionType = isEntrada ? 'Entrada' : 'Saída';

  // Extract merchant / counterparty if possible
  let descricao = clean;
  const emMatch = clean.match(/\bem\s+([A-Za-zÀ-ÿ0-9\s*._-]+?)(?:\s+no\s+valor|\s+aprovad|\.|$)/i);
  const deMatch = clean.match(/\bde\s+([A-Za-zÀ-ÿ0-9\s*._-]+?)(?:\s+no\s+valor|\.|$)/i);
  const paraMatch = clean.match(/\bpara\s+([A-Za-zÀ-ÿ0-9\s*._-]+?)(?:\s+no\s+valor|\.|$)/i);

  if (!isEntrada && emMatch && emMatch[1].trim().length > 2) {
    descricao = `${emMatch[1].trim()} (${banco})`;
  } else if (isEntrada && deMatch && deMatch[1].trim().length > 2 && !deMatch[1].includes('R$')) {
    descricao = `Recebido de ${deMatch[1].trim()} (${banco})`;
  } else if (!isEntrada && paraMatch && paraMatch[1].trim().length > 2 && !paraMatch[1].includes('R$')) {
    descricao = `Enviado para ${paraMatch[1].trim()} (${banco})`;
  } else {
    descricao = `${clean.slice(0, 55)} (${banco})`;
  }

  const today = new Date().toISOString().slice(0, 10);
  const formaPagamento: PaymentMethod = lower.includes('crédito')
    ? 'Cartão de Crédito'
    : lower.includes('débito')
    ? 'Débito'
    : 'PIX';

  return {
    id: `AUTO-${Date.now().toString().slice(-6)}`,
    data: today,
    mesAno: today.slice(0, 7),
    descricao,
    tipo,
    categoria: autoCategorize(clean, tipo),
    valor,
    status: 'Pago',
    vencimento: today,
    recorrencia: 'Única',
    parcela: '1/1',
    formaPagamento,
    observacoes: clean,
    criadoEm: new Date().toISOString(),
  };
}
