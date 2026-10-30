import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FinControl Pro | Controle Financeiro Integrado ao Google Sheets',
  description:
    'Sistema completo de controle financeiro mensal com entradas, saídas, contas a pagar/receber, despesas fixas, parcelamentos e sincronização com Google Sheets.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen bg-[#090d16] text-slate-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
        {children}
      </body>
    </html>
  );
}
