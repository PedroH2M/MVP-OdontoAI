import type { Metadata } from 'next';
import './globals.css';
import CookieConsent from '@/components/CookieConsent';

export const metadata: Metadata = {
  title: 'OdontoAI — Recepcionista Inteligente & Gestão de Agenda',
  description: 'Painel de Controle da Clínica Odontológica com IA no WhatsApp',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-50 text-slate-900 selection:bg-sky-100 selection:text-sky-900">
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
