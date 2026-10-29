'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShieldCheck, Cookie, X } from 'lucide-react';

const STORAGE_KEY = 'odontoai_cookie_consent_v1';

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem(STORAGE_KEY);
      if (!consent) {
        setIsVisible(true);
      }
    } catch {
      // Caso localStorage esteja bloqueado no navegador
      setIsVisible(true);
    }
  }, []);

  const handleAcceptAll = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          essential: true,
          analytics: false,
          timestamp: new Date().toISOString(),
          status: 'accepted_all',
        })
      );
    } catch {
      // Ignora erro de localStorage
    }
    setIsVisible(false);
  };

  const handleAcceptEssentialOnly = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          essential: true,
          analytics: false,
          timestamp: new Date().toISOString(),
          status: 'essential_only',
        })
      );
    } catch {
      // Ignora erro de localStorage
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <aside
      role="region"
      aria-label="Aviso de Privacidade e Cookies"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-xl z-50 bg-white border border-slate-300 rounded-2xl shadow-2xl p-5 text-slate-800 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
          <Cookie className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="flex-1 text-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900 text-base flex items-center gap-1.5">
              Privacidade & Uso de Cookies
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                LGPD
              </span>
            </h2>
            <button
              type="button"
              onClick={handleAcceptEssentialOnly}
              aria-label="Fechar aviso de cookies e aceitar apenas essenciais"
              className="text-slate-500 hover:text-slate-800 p-1 rounded-lg hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1.5 text-slate-700 leading-relaxed text-xs sm:text-sm">
            Nós valorizamos a sua privacidade. Utilizamos cookies estritamente necessários para
            garantir o funcionamento seguro da plataforma e manter suas preferências de sessão, em
            plena conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018)</strong>.
            Não vendemos nem compartilhamos seus dados para publicidade de terceiros.
          </p>
          <div className="mt-2 text-xs text-slate-600">
            Para saber como seus dados de saúde e atendimento são protegidos, leia nossa{' '}
            <Link
              href="/politica-de-privacidade"
              className="font-medium text-sky-700 underline hover:text-sky-900 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded"
            >
              Política de Privacidade
            </Link>{' '}
            e os{' '}
            <Link
              href="/termos-de-uso"
              className="font-medium text-sky-700 underline hover:text-sky-900 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded"
            >
              Termos de Uso
            </Link>.
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleAcceptAll}
              className="flex-1 sm:flex-none px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white font-medium text-xs rounded-xl shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
            >
              Aceitar Cookies
            </button>
            <button
              type="button"
              onClick={handleAcceptEssentialOnly}
              className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs rounded-xl transition-colors border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            >
              Apenas Essenciais
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
