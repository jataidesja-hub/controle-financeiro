# FinControl Pro — Sistema de Controle Financeiro Completo

Sistema completo de controle financeiro mensal desenvolvido em **Next.js + Tailwind CSS**, integrado diretamente com **Google Sheets** e publicado na **Vercel**.

- **Repositório GitHub**: [jataidesja-hub/controle-financeiro](https://github.com/jataidesja-hub/controle-financeiro.git)
- **Planilha Google Conectada**: [Controle Financeiro Completo (`1f6IEJX59z5a5RXQ9npojHFEJjhIYmtyHv2f70olqoJU`)](https://docs.google.com/spreadsheets/d/1f6IEJX59z5a5RXQ9npojHFEJjhIYmtyHv2f70olqoJU/edit?gid=0#gid=0)

## Funcionalidades Principais

1. **Dashboard & Gráficos Interativos**
   - Indicadores de **Saldo do Período (Previsto vs Real em Caixa)**, **Entradas (Receitas)**, **Saídas (Gastos Mensais)** e **Taxa de Renda Comprometida**.
   - Gráfico de **Fluxo de Caixa Mensal (Entradas vs Saídas)** ao longo de 6 meses.
   - Acompanhamento de **Gastos por Categoria vs Meta de Orçamento** com alertas visuais de limite.
2. **Gestão de Lançamentos (Entradas e Saídas)**
   - Busca instantânea e filtros combinados por Tipo (`Entrada` / `Saída`), Status (`Pago` / `Pendente` / `Atrasado`) e Categoria.
   - Baixa rápida em 1 clique (`Pago` ↔ `Pendente`).
3. **Contas a Pagar e a Receber (Vencimentos)**
   - Painel dedicado aos compromissos pendentes do mês com confirmação imediata de pagamento/recebimento.
4. **Despesas Fixas/Recorrentes e Compras Parceladas**
   - **Geração automática de parcelas**: ao cadastrar uma compra parcelada (ex: `10x`), o sistema cria automaticamente todas as parcelas nos meses seguintes (`1/10`, `2/10`, ..., `10/10`).
   - **Replicação de Fixos Mensais**: botão para clonar receitas e despesas fixas para o mês seguinte em 1 clique.
5. **Integração Bidirecional com Google Sheets**
   - A planilha já possui 3 abas estruturadas e formatadas:
     - `Lancamentos`: base de dados completa de transações.
     - `Resumo_Mensal`: painel automático com fórmulas `SUMIF` / `SUMIFS` e `COUNTIFS`.
     - `Categorias`: cadastro de categorias e metas de orçamento mensal.
   - Script pronto em [`google-apps-script/Code.gs`](./google-apps-script/Code.gs) para sincronização em tempo real.
