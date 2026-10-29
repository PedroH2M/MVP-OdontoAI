import React from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, CheckCircle2, ShieldCheck, HelpCircle, Mail, AlertCircle } from 'lucide-react';
import LegalFooter from '@/components/LegalFooter';

export const metadata = {
  title: 'Política de Cancelamento e Reembolso — OdontoAI',
  description:
    'Conheça nossa Política de Cancelamento e Reembolso transparente para assinaturas do software SaaS e agendamentos odontológicos.',
};

export default function PoliticaDeReembolsoPage() {
  const lastUpdated = '29 de outubro de 2026';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      {/* Header Institucional */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-sky-700 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-lg p-1"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Voltar ao Painel Principal</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Garantia Legal CDC
            </span>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 flex-1">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10">
          <div className="border-b border-slate-200 pb-6 mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 mb-3">
              <RefreshCw className="w-4 h-4 text-emerald-700" aria-hidden="true" />
              Transparência Comercial • Código de Defesa do Consumidor (Art. 49)
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Política de Cancelamento e Reembolso
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-600">
              Diretrizes claras e vigentes atualizadas em: <strong>{lastUpdated}</strong>.
            </p>
          </div>

          <div className="space-y-8 text-sm sm:text-base text-slate-700 leading-relaxed">
            {/* Seção 1 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center">
                  1
                </span>
                Assinaturas do Software OdontoAI (SaaS para Clínicas)
              </h2>
              <p>
                A OdontoAI opera sob o modelo de assinatura mensal ou anual de software para
                consultórios e clínicas odontológicas. Nosso compromisso é com a total satisfação e
                transparência com os profissionais contratantes.
              </p>
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2 font-bold text-emerald-900">
                  <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" aria-hidden="true" />
                  Garantia Incondicional de 7 Dias (Art. 49 do CDC):
                </div>
                <p>
                  Caso a clínica contratante decida, por qualquer motivo, não continuar utilizando a
                  OdontoAI dentro do prazo legal de <strong>7 (sete) dias corridos</strong> a partir
                  da contratação inicial, poderá solicitar o cancelamento com{' '}
                  <strong>reembolso integral de 100% dos valores pagos</strong>, sem taxas, multas ou
                  qualquer burocracia.
                </p>
              </div>
            </section>

            {/* Seção 2 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center">
                  2
                </span>
                Cancelamento de Planos e Ausência de Fidelidade
              </h2>
              <p>
                Após o período inicial de 7 dias, a clínica pode cancelar a renovação de sua assinatura
                a qualquer momento através do painel de controle ou por e-mail de suporte.
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
                <li>
                  <strong>Planos Mensais:</strong> O cancelamento interrompe a cobrança do mês
                  subsequente. A clínica continuará com acesso aos seus dados até o final do ciclo já
                  faturado.
                </li>
                <li>
                  <strong>Sem Multas Rescisórias:</strong> Não exigimos contratos de permanência mínima
                  ou fidelidade compulsória nos planos regulares.
                </li>
                <li>
                  <strong>Portabilidade e Exportação de Dados:</strong> Antes do encerramento da conta, a
                  clínica tem direito de exportar todos os registros de agendamentos e históricos de
                  conversas, em conformidade com a LGPD.
                </li>
              </ul>
            </section>

            {/* Seção 3 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center">
                  3
                </span>
                Formas e Prazos de Estorno do SaaS
              </h2>
              <p>Os reembolsos aprovados são processados pelo mesmo meio de pagamento da compra:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="font-semibold text-slate-900 text-xs sm:text-sm">
                    Pagamento via Pix
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Estorno creditado diretamente na conta bancária de origem em até{' '}
                    <strong>24 horas úteis</strong> após a solicitação.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="font-semibold text-slate-900 text-xs sm:text-sm">
                    Cartão de Crédito
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Solicitação enviada imediatamente à administradora. O crédito é estornado na fatura
                    atual ou subsequente, a depender da data de fechamento do cartão.
                  </p>
                </div>
              </div>
            </section>

            {/* Seção 4: Relação entre Pacientes e Clínicas */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 font-bold text-xs flex items-center justify-center">
                  4
                </span>
                Consultas e Procedimentos Odontológicos dos Pacientes
              </h2>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 space-y-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" aria-hidden="true" />
                  Esclarecimento Importante para Pacientes:
                </div>
                <p>
                  <strong>A OdontoAI NÃO realiza cobrança de consultas ou procedimentos de pacientes.</strong>{' '}
                  Nossa plataforma atua exclusivamente na tecnologia de agendamento e triagem de
                  horários via WhatsApp para a recepção da clínica.
                </p>
                <p>
                  Quaisquer valores relativos a tratamentos, consultas, materiais ou procedimentos
                  são negociados e pagos <strong>diretamente à clínica odontológica presencial</strong>,
                  sob recibo ou nota fiscal de prestação de serviços odontológicos emitida pelo
                  próprio consultório/profissional.
                </p>
                <p>
                  Caso o paciente precise cancelar ou remarcar sua consulta, poderá fazê-lo
                  gratuitamente respondendo à própria conversa no WhatsApp ou entrando em contato com a
                  recepção da clínica, preferencialmente com antecedência mínima de 24 horas.
                </p>
              </div>
            </section>

            {/* Seção 5 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center">
                  5
                </span>
                Como Solicitar Reembolso do Software
              </h2>
              <p>
                Para solicitar o reembolso do software OdontoAI dentro do prazo legal de 7 dias, basta
                enviar uma mensagem com o CNPJ ou e-mail cadastrado da clínica para o nosso canal de
                atendimento:
              </p>
              <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-slate-800 space-y-1 text-xs sm:text-sm">
                <p>
                  <strong>E-mail de Suporte & Faturamento:</strong>{' '}
                  <a
                    href="mailto:suporte@odontoai.com.br"
                    className="text-sky-700 font-semibold underline hover:text-sky-900 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded"
                  >
                    suporte@odontoai.com.br
                  </a>
                </p>
                <p>
                  <strong>Assunto:</strong> Solicitação de Cancelamento / Reembolso - [Nome da Clínica]
                </p>
                <p>
                  Nossa equipe financeira processa as solicitações em até 1 dia útil com confirmação por e-mail.
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}
