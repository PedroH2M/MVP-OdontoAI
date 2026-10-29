import React from 'react';
import Link from 'next/link';
import { FileText, ArrowLeft, Stethoscope, Scale, ShieldAlert, CheckCircle2 } from 'lucide-react';
import LegalFooter from '@/components/LegalFooter';

export const metadata = {
  title: 'Termos de Uso e Serviço — OdontoAI',
  description:
    'Termos de Serviço da plataforma OdontoAI. Condições de uso, responsabilidades éticas, limitação de escopo e conformidade com o CFO/CRO.',
};

export default function TermosDeUsoPage() {
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
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Termos Oficiais de Serviço
            </span>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 flex-1">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10">
          <div className="border-b border-slate-200 pb-6 mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 mb-3">
              <Scale className="w-4 h-4 text-emerald-700" aria-hidden="true" />
              Contrato de Uso de Software (SaaS) • Código de Ética Odontológica
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Termos e Condições de Uso da Plataforma
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-600">
              Vigência e revisão jurídica atualizada em: <strong>{lastUpdated}</strong>.
            </p>
          </div>

          <div className="space-y-8 text-sm sm:text-base text-slate-700 leading-relaxed">
            {/* Seção 1 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center">
                  1
                </span>
                Aceitação dos Termos e Objeto do Serviço
              </h2>
              <p>
                Bem-vindo à <strong>OdontoAI</strong>. Ao acessar o painel de controle, utilizar o
                aplicativo web ou interagir com nosso sistema automatizado de mensageria, você declara
                ter lido, compreendido e concordado integralmente com as disposições destes Termos de
                Uso e com a nossa Política de Privacidade.
              </p>
              <p>
                O objeto deste contrato consiste na disponibilização de licença de uso temporária,
                revogável e não exclusiva de software no modelo SaaS (Software as a Service) voltado à
                gestão de agenda de consultas, suporte na triagem de mensagens de pacientes e
                automação de lembretes pré-consulta via canais digitais.
              </p>
            </section>

            {/* Seção 2: Isenção Médica Obrigatória */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center">
                  2
                </span>
                Limitação de Escopo e Isenção Médica / Odontológica (CFO / CRO)
              </h2>
              <div className="p-5 rounded-2xl bg-red-50 border border-red-200 text-red-950 space-y-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2 font-bold text-red-900 text-sm">
                  <ShieldAlert className="w-5 h-5 text-red-700 shrink-0" aria-hidden="true" />
                  AVISO EXPRESSO SOBRE O PAPEL DA INTELIGÊNCIA ARTIFICIAL:
                </div>
                <p>
                  <strong>A OdontoAI NÃO é profissional de odontologia ou medicina.</strong> O assistente
                  virtual baseado em inteligência artificial tem atribuição estrita e exclusiva de{' '}
                  <strong>apoio administrativo à recepção</strong> (verificação de horários vagos,
                  registro de agendamento e identificação do convênio/procedimento básico).
                </p>
                <ul className="list-disc pl-5 space-y-1 text-red-900 font-medium">
                  <li>É terminantemente vedada a realização de diagnósticos clínicos à distância pela IA.</li>
                  <li>A IA não prescreve, indica ou fornece receitas de medicamentos (analgésicos, antibióticos, etc.).</li>
                  <li>
                    A IA não formula orçamentos fechados de procedimentos odontológicos por mensagem,
                    conforme exigência ética do CFO (Resolução CFO-118/2012).
                  </li>
                  <li>
                    Relatos de dor aguda, sangramento, inchaço ou trauma são classificados como urgência
                    e direcionados imediatamente para acolhimento humano.
                  </li>
                </ul>
                <p className="text-xs text-red-800 pt-1">
                  O diagnóstico, plano de tratamento e indicação terapêutica são prerrogativas
                  exclusivas do cirurgião-dentista presencial devidamente inscrito no CRO competente,
                  nos termos da Lei Federal nº 5.081/1966.
                </p>
              </div>
            </section>

            {/* Seção 3 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center">
                  3
                </span>
                Responsabilidades da Clínica Contratante
              </h2>
              <p>A clínica ou profissional contratante compromete-se a:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
                <li>
                  Cadastrar apenas cirurgiões-dentistas com inscrição ativa e regular perante o
                  respectivo Conselho Regional de Odontologia (CRO).
                </li>
                <li>
                  Manter atualizados os dados de horários de funcionamento, regras de convênios e
                  endereço da unidade física.
                </li>
                <li>
                  Garantir o atendimento presencial adequado e tempestivo dos pacientes que agendarem
                  consultas pelo sistema.
                </li>
                <li>
                  Monitorar o painel de atendimento e assumir prontamente conversas em que o paciente
                  solicitar atendente humano ou relatar urgência médica.
                </li>
                <li>
                  Guardar em sigilo absoluto suas credenciais de login e acesso ao painel de controle.
                </li>
              </ul>
            </section>

            {/* Seção 4 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center">
                  4
                </span>
                Diretrizes de Agendamento, Cancelamento e No-Show
              </h2>
              <p>
                O agendamento realizado via WhatsApp ou pelo painel constitui reserva preliminar de
                horário de atendimento. Recomenda-se aos pacientes que eventuais cancelamentos ou
                pedidos de remarcação sejam comunicados com antecedência mínima de 24 (vinte e quatro)
                horas. A plataforma OdontoAI não efetua cobrança de taxas de agendamento ou multas de
                cancelamento dos pacientes.
              </p>
            </section>

            {/* Seção 5 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center">
                  5
                </span>
                Direito de Arrependimento e Cancelamento do SaaS (Art. 49 do CDC)
              </h2>
              <p>
                Em observância ao Código de Defesa do Consumidor (Art. 49 da Lei nº 8.078/1990), a
                clínica contratante de planos pagos da OdontoAI possui o direito incondicional de
                desistir da contratação no prazo de até 7 (sete) dias corridos a contar da data de
                assinatura, com devolução integral e imediata dos valores eventualmente pagos, sem
                qualquer penalidade.
              </p>
              <p>
                Para mais detalhes, consulte nossa{' '}
                <Link
                  href="/politica-de-reembolso"
                  className="font-semibold text-sky-700 underline hover:text-sky-900 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded"
                >
                  Política de Cancelamento e Reembolso
                </Link>.
              </p>
            </section>

            {/* Seção 6 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center">
                  6
                </span>
                Propriedade Intelectual e Disponibilidade do Sistema
              </h2>
              <p>
                Todos os direitos autorais, marcas, códigos-fonte, algoritmos de inteligência
                artificial, designs de interface e documentações pertencem exclusivamente à OdontoAI.
                Empreendemos os melhores esforços técnicos para garantir 99,5% de disponibilidade do
                sistema, ressalvadas interrupções programadas para manutenção e instabilidades
                decorrentes de redes de telecomunicações ou de APIs de terceiros (como a plataforma
                WhatsApp/Meta).
              </p>
            </section>

            {/* Seção 7 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center">
                  7
                </span>
                Foro de Eleição
              </h2>
              <p>
                Estes Termos de Uso são regidos e interpretados pelas leis vigentes na República
                Federativa do Brasil. Para dirimir quaisquer litígios oriundos deste instrumento, fica
                eleito o Foro da Comarca de São Paulo/SP, com expressa renúncia a qualquer outro, por
                mais privilegiado que seja, ressalvada a competência do domicílio do consumidor nas
                hipóteses legais.
              </p>
            </section>
          </div>
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}
