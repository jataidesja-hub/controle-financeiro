import { NextResponse } from 'next/server';
import { getCloudState } from '@/utils/cloudStore';

function escapeCsvCell(val: unknown): string {
  const str = String(val ?? '').replace(/\r?\n/g, ' ').trim();
  if (str.includes(',') || str.includes('"') || str.includes(';')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  const state = await getCloudState();
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
    'Banco',
    'Observacoes',
    'CriadoEm',
  ];

  const rows = [headers.join(',')];
  for (const tx of state.transactions) {
    rows.push(
      [
        escapeCsvCell(tx.id),
        escapeCsvCell(tx.data),
        escapeCsvCell(tx.mesAno),
        escapeCsvCell(tx.descricao),
        escapeCsvCell(tx.tipo),
        escapeCsvCell(tx.categoria),
        Number(tx.valor || 0),
        escapeCsvCell(tx.status),
        escapeCsvCell(tx.vencimento || tx.data),
        escapeCsvCell(tx.recorrencia || 'Única'),
        escapeCsvCell(tx.parcela || '1/1'),
        escapeCsvCell(tx.formaPagamento || 'PIX'),
        escapeCsvCell(tx.banco || ''),
        escapeCsvCell(tx.observacoes || ''),
        escapeCsvCell(tx.criadoEm || ''),
      ].join(',')
    );
  }

  return new NextResponse(rows.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
