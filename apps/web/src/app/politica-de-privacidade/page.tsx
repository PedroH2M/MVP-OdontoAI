import React from 'react';
import Link from 'next/link';
import { ShieldCheck, ArrowLeft, Lock, FileText, CheckCircle2, Mail, MapPin } from 'lucide-react';

export const metadata = {
  title: 'Política de Privacidade e Proteção de Dados (LGPD) — OdontoAI',
  description:
    'Conheça nossa Política de Privacidade em total conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD).',
};

export default function PoliticaDePrivacidadePage() {
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
              Conformidade LGPD Ativa
            </span>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 flex-1">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10">
          <div className="border-b border-slate-200 pb-6 mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 mb-3">
              <ShieldCheck className="w-4 h-4 text-sky-700" aria-hidden="true" />
              Documento Jurídico Oficial • Lei nº 13.709/2018
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Política de Privacidade e Proteção de Dados Pessoais
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-600">
              Última atualização e revisão jurídica em: <strong>{lastUpdated}</strong>.
            </p>
          </div>

          <div className="space-y-8 text-sm sm:text-base text-slate-700 leading-relaxed">
            {/* Seção 1 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center">
                  1
                </span>
                Identificação do Controlador e Objeto
              </h2>
              <p>
                A <strong>OdontoAI Tecnologia & Gestão Odontológica Ltda.</strong> (doravante
                denominada &quot;OdontoAI&quot;, &quot;nós&quot; ou &quot;plataforma&quot;), inscrita no CNPJ sob o nº
                52.184.903/0001-44, com sede em São Paulo/SP, preza pela transparência, privacidade e
                segurança dos dados de clínicas odontológicas, cirurgiões-dentistas e de seus
                respectivos pacientes.
              </p>
              <p>
                Esta Política de Privacidade estabelece as diretrizes de tratamento, coleta,
                armazenamento e proteção de dados pessoais realizados por nossa aplicação e por
                nossos assistentes automatizados via WhatsApp, em rigorosa conformidade com a{' '}
                <strong>Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD)</strong>,
                o <strong>Marco Civil da Internet (Lei nº 12.965/2014)</strong> e o{' '}
                <strong>Código de Ética Odontológica (Resolução CFO-118/2012)</strong>.
              </p>
            </section>

            {/* Seção 2 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center">
                  2
                </span>
                Princípio da Minimização: Quais Dados Coletamos
              </h2>
              <p>
                Em observância ao <strong>Artigo 6º, inciso III da LGPD (Princípio da Necessidade)</strong>,
                coletamos única e exclusivamente os dados estritamente necessários para a
                identificação do paciente e a efetivação do agendamento da consulta odontológica:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
                <li>
                  <strong>Dados Cadastrais Básicos:</strong> Nome completo e número de telefone /
                  WhatsApp para contato e envio de lembretes da consulta.
                </li>
                <li>
                  <strong>Dados de Agendamento:</strong> Data e horário pretendidos, tipo de
                  atendimento (ex: Consulta Inicial, Limpeza preventiva, Urgência) e modalidade de
                  pagamento/cobertura (Particular ou nome do Convênio Odontológico).
                </li>
                <li>
                  <strong>Dados de Acesso dos Usuários da Clínica:</strong> E-mail corporativo e senha
                  criptografada para autenticação dos operadores no painel web.
                </li>
              </ul>
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm">
                <strong>Ressalva sobre Dados Sensíveis de Saúde (Art. 11 da LGPD):</strong> O assistente
                virtual da OdontoAI NÃO solicita, não armazena fotos diagnósticas e não coleta dados
                de prontuário clínico detalhado. Informações clínicas e anamnese médica são
                colhidas presencialmente pelo cirurgião-dentista em consultório, sob estrito sigilo
                profissional e tutela da saúde (Art. 11, II, f da LGPD).
              </div>
            </section>

            {/* Seção 3 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center">
                  3
                </span>
                Finalidades e Bases Legais do Tratamento
              </h2>
              <p>Os dados tratados pela plataforma possuem finalidades legítimas e transparentes:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="font-semibold text-slate-900 text-xs sm:text-sm">
                    1. Execução de Contrato / Pré-Contrato (Art. 7º, V)
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Permitir que o paciente agende, remarque ou confirme sua consulta odontológica a
                    seu próprio pedido via WhatsApp.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="font-semibold text-slate-900 text-xs sm:text-sm">
                    2. Tutela da Saúde (Art. 11, II, f)
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Priorizar atendimentos com queixa de dor aguda, sangramento ou inchaço,
                    encaminhando imediatamente para a equipe clínica humana.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="font-semibold text-slate-900 text-xs sm:text-sm">
                    3. Legítimo Interesse (Art. 7º, IX)
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Envio de lembretes automáticos de consulta no dia anterior para evitar faltas
                    (no-show) e otimizar a agenda da clínica.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="font-semibold text-slate-900 text-xs sm:text-sm">
                    4. Cumprimento de Obrigação Legal (Art. 7º, II)
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Guarda de registros de conexão e logs de autenticação conforme determina o Art. 15
                    do Marco Civil da Internet.
                  </p>
                </div>
              </div>
            </section>

            {/* Seção 4 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center">
                  4
                </span>
                Compartilhamento com Terceiros
              </h2>
              <p>
                A OdontoAI <strong>não vende, não aluga e não comercializa</strong> dados pessoais
                sob hipótese alguma. O compartilhamento ocorre unicamente com prestadores de
                tecnologia estritamente indispensáveis:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li>
                  <strong>Provedores de Nuvem e Servidores Seguros:</strong> Hospedagem em data centers
                  com certificados SOC2 e criptografia de dados em trânsito e em repouso.
                </li>
                <li>
                  <strong>Gateways de Mensageria (WhatsApp / Meta):</strong> Apenas o texto necessário
                  para trafegar a conversa entre o paciente e a clínica.
                </li>
                <li>
                  <strong>Autoridades Judiciais ou Administrativas:</strong> Somente quando exigido
                  por ordem judicial competente.
                </li>
              </ul>
            </section>

            {/* Seção 5 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center">
                  5
                </span>
                Direitos do Titular de Dados (Art. 18 da LGPD)
              </h2>
              <p>
                A qualquer momento, o titular dos dados pessoais (paciente ou usuário) pode exercer
                gratuitamente os seguintes direitos:
              </p>
              <div className="space-y-2">
                {[
                  'Confirmação da existência de tratamento e acesso aos dados pessoais.',
                  'Correção de dados incompletos, inexatos ou desatualizados.',
                  'Anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos.',
                  'Portabilidade dos dados a outro fornecedor de serviço, mediante requisição expressa.',
                  'Eliminação dos dados pessoais tratados mediante consentimento, ressalvadas as hipóteses de guarda obrigatória.',
                  'Revogação do consentimento para recebimento de comunicações e lembretes.',
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Seção 6 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center">
                  6
                </span>
                Segurança da Informação e Criptografia
              </h2>
              <p>
                Adotamos medidas técnicas e administrativas aptas a proteger os dados pessoais de
                acessos não autorizados e de situações acidentais ou ilícitas de destruição, perda,
                alteração, comunicação ou difusão:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li>Comunicação segura via protocolo HTTPS com criptografia TLS 1.3 de ponta a ponta.</li>
                <li>Senhas de acesso com hash criptográfico irreversível (Argon2 / BCrypt).</li>
                <li>Isolamento de sessões com tokenização JWT e expiração programada.</li>
                <li>Ambiente com backups redundantes e testes periódicos de vulnerabilidade.</li>
              </ul>
            </section>

            {/* Seção 7 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center">
                  7
                </span>
                Canal de Contato do Encarregado de Dados (DPO)
              </h2>
              <p>
                Para exercer qualquer um dos seus direitos, tirar dúvidas sobre o tratamento de seus
                dados pessoais ou encaminhar solicitações ao nosso Encarregado pelo Tratamento de
                Dados Pessoais (Data Protection Officer - DPO), entre em contato:
              </p>
              <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-slate-800 space-y-1 text-xs sm:text-sm">
                <p>
                  <strong>Encarregado (DPO):</strong> Setor de Privacidade & Governança OdontoAI
                </p>
                <p>
                  <strong>E-mail direto do DPO:</strong>{' '}
                  <a
                    href="mailto:dpo@odontoai.com.br"
                    className="text-sky-700 font-semibold underline hover:text-sky-900 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded"
                  >
                    dpo@odontoai.com.br
                  </a>
                </p>
                <p>
                  <strong>Tempo médio de resposta:</strong> Até 2 (dois) dias úteis para confirmações
                  iniciais, e até 15 (quinze) dias para declarações completas (conforme Art. 19 da LGPD).
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>

      <footer className="mt-12 py-8 border-t border-slate-200 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} OdontoAI Tecnologia & Gestão Odontológica Ltda. CNPJ 52.184.903/0001-44</p>
        <p className="mt-1">Av. Paulista, 1000 - Sala 402, São Paulo - SP • suporte@odontoai.com.br • dpo@odontoai.com.br</p>
      </footer>
    </div>
  );
}
