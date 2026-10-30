export type TransactionType = 'Entrada' | 'Saída';

export type TransactionStatus = 'Pago' | 'Pendente' | 'Atrasado';

export type RecurrenceType = 'Única' | 'Fixa Mensal' | 'Parcelada';

export type PaymentMethod =
  | 'PIX'
  | 'Cartão de Crédito'
  | 'Boleto'
  | 'Débito'
  | 'Transferência'
  | 'Dinheiro';

export interface Transaction {
  id: string;
  data: string; // YYYY-MM-DD
  mesAno: string; // YYYY-MM
  descricao: string;
  tipo: TransactionType;
  categoria: string;
  valor: number;
  status: TransactionStatus;
  vencimento: string; // YYYY-MM-DD
  recorrencia: RecurrenceType;
  parcela: string; // e.g., "1/1", "3/10"
  formaPagamento: PaymentMethod;
  observacoes: string;
  criadoEm: string;
}

export interface CategoryBudget {
  categoria: string;
  tipo: TransactionType;
  orcamentoMensal: number;
  corHex: string;
}

export interface SyncSettings {
  spreadsheetId: string;
  spreadsheetUrl: string;
  appsScriptUrl: string;
  autoSync: boolean;
  lastSyncAt: string | null;
}
