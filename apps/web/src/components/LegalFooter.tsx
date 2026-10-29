import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Lock, Stethoscope, Scale, FileText, HelpCircle, Mail, MapPin } from 'lucide-react';

export function LegalFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      aria-label="Rodapé institucional e legal da OdontoAI"
      className="mt-16 bg-slate-900 text-slate-300 border-t border-slate-800 text-sm"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Coluna 1: Dados da Empresa */}
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-500 text-white flex items-center justify-center font-bold">
                🦷
              </div>
              <span className="font-bold text-white text-base tracking-tight">
                OdontoAI SaaS
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Plataforma tecnológica de gestão inteligente de agenda e triagem de atendimento para
              clínicas e consultórios odontológicos.
            </p>
            <div className="pt-2 text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">
                OdontoAI Tecnologia & Gestão Odontológica Ltda.
              </p>
              <p>CNPJ: 52.184.903/0001-44</p>
              <p className="flex items-start gap-1 pt-0.5">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" aria-hidden="true" />
                <span>Av. Paulista, 1000 - Sala 402, Bela Vista, São Paulo - SP, CEP 01310-100</span>
              </p>
            </div>
          </div>

          {/* Coluna 2: Jurídico & Conformidade */}
          <div className="space-y-3">
            <h3 className="font-semibold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-sky-400" aria-hidden="true" />
              Jurídico & LGPD
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/politica-de-privacidade"
                  className="text-slate-300 hover:text-sky-400 transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400 rounded"
                >
                  Política de Privacidade (LGPD)
                </Link>
              </li>
              <li>
                <Link
                  href="/termos-de-uso"
                  className="text-slate-300 hover:text-sky-400 transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400 rounded"
                >
                  Termos de Uso do Serviço
                </Link>
              </li>
              <li>
                <Link
                  href="/politica-de-reembolso"
                  className="text-slate-300 hover:text-sky-400 transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400 rounded"
                >
                  Política de Cancelamento & Reembolso
                </Link>
              </li>
              <li>
                <a
                  href="mailto:dpo@odontoai.com.br"
                  className="text-slate-300 hover:text-sky-400 transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400 rounded inline-flex items-center gap-1"
                >
                  <Mail className="w-3 h-3 text-sky-400" aria-hidden="true" />
                  Canal do Encarregado (DPO)
                </a>
              </li>
            </ul>
          </div>

          {/* Coluna 3: Ética Odontológica & Diretrizes */}
          <div className="space-y-3">
            <h3 className="font-semibold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Stethoscope className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              Ética Odontológica
            </h3>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Conforme Resolução CFO-118/2012 (Código de Ética Odontológica)</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Sem precificação fechada à distância (avaliação presencial obrigatória)</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Sem promessas de resultado ou diagnósticos não presenciais</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Vedada qualquer prescrição medicamentosa automatizada</span>
              </li>
            </ul>
          </div>

          {/* Coluna 4: Segurança & Selos */}
          <div className="space-y-3">
            <h3 className="font-semibold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-amber-400" aria-hidden="true" />
              Segurança & Governança
            </h3>
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-slate-200">100% Conforme LGPD</p>
                  <p className="text-[11px] text-slate-400">Minimização e tutela da saúde</p>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center gap-2">
                <Lock className="w-5 h-5 text-sky-400 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-slate-200">Criptografia em Trânsito</p>
                  <p className="text-[11px] text-slate-400">TLS 1.3 / HTTPS ponta a ponta</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer Legal Obrigatório de Isenção Médica / Anti-Processos */}
        <div className="pt-6 border-t border-slate-800">
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-400 leading-relaxed">
            <p className="font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
              AVISO LEGAL, ÉTICO E LIMITAÇÃO DE RESPONSABILIDADE:
            </p>
            <p>
              A <strong>OdontoAI</strong> é um software de serviço (SaaS) exclusivamente voltado para
              gestão operacional de agenda e suporte administrativo à recepção de clínicas e
              consultórios odontológicos. O assistente virtual baseado em inteligência artificial não
              é cirurgião-dentista, não realiza anamnese diagnóstica, não formula diagnósticos, não
              prescreve tratamentos ou medicamentos e não substitui a consulta clínica presencial
              realizada por profissional legalmente habilitado e inscrito no Conselho Regional de
              Odontologia (CRO). Orçamentos, planos de tratamento e procedimentos clínicos são de
              competência exclusiva e indelegável do dentista assistente presencial, em estrita
              observância à Lei Federal nº 5.081/1966 e ao Código de Ética Odontológica.
            </p>
          </div>
        </div>

        {/* Linha Final de Copyright */}
        <div className="pt-6 mt-6 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>© {currentYear} OdontoAI Tecnologia & Gestão Odontológica Ltda. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4">
            <Link
              href="/politica-de-privacidade"
              className="hover:text-slate-300 transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400 rounded"
            >
              Privacidade
            </Link>
            <span>•</span>
            <Link
              href="/termos-de-uso"
              className="hover:text-slate-300 transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400 rounded"
            >
              Termos
            </Link>
            <span>•</span>
            <Link
              href="/politica-de-reembolso"
              className="hover:text-slate-300 transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400 rounded"
            >
              Reembolso
            </Link>
            <span>•</span>
            <a
              href="mailto:suporte@odontoai.com.br"
              className="hover:text-slate-300 transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400 rounded"
            >
              Suporte
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default LegalFooter;
