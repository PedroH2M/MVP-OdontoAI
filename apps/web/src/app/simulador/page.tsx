'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Bot,
  Send,
  RotateCcw,
  Sparkles,
  Calendar,
  AlertCircle,
  CheckCircle2,
  User,
  Phone,
  ShieldCheck,
  ArrowLeft,
  Terminal,
  MessageSquare,
  Zap,
  Clock,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

interface SimMessage {
  id: string;
  sender: 'PATIENT' | 'AI' | 'HUMAN_STAFF';
  content: string;
  createdAt: string;
}

interface SimAppointment {
  id: string;
  startTime: string;
  endTime: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  patient: {
    id: string;
    name: string;
    phone: string;
    insuranceName: string;
  };
  dentistName: string;
  procedureName: string;
}

interface AiActionLog {
  id: string;
  type: 'BOOKED' | 'CANCELLED' | 'HANDOFF';
  title: string;
  details: string;
  timestamp: string;
}

const QUICK_SCENARIOS = [
  {
    label: '👋 Saudação + Convênio',
    text: 'Oi, bom dia! Vocês aceitam o convênio Bradesco Dental para limpeza?',
  },
  {
    label: '📅 Confirmar Horário (Agendar)',
    text: 'Quero agendar minha limpeza para hoje às 11:00 com a Dra. Juliana, por favor.',
  },
  {
    label: '📍 Endereço e Estacionamento',
    text: 'Qual é o endereço da clínica? Tem estacionamento no local?',
  },
  {
    label: '❌ Testar Cancelamento',
    text: 'Oi, surgiu um imprevisto no trabalho e preciso cancelar minha consulta de hoje.',
  },
  {
    label: '🚨 Urgência / Dor Pós-Extração',
    text: 'Oi, fiz uma extração ontem e está doendo bastante, consigo falar com o Dr. Carlos?',
  },
];

export default function ChatbotSimulatorPage() {
  const [patientName, setPatientName] = useState('Lucas Martins');
  const [patientPhone, setPatientPhone] = useState('11 99999-8888');
  const [insuranceName, setInsuranceName] = useState('Bradesco Dental');

  const [messages, setMessages] = useState<SimMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'AI',
      content:
        'Olá! Bem-vindo ao Simulador do OdontoAI. Mande uma mensagem abaixo como se fosse um paciente no WhatsApp para testar a recepcionista Sofia em tempo real! 😊',
      createdAt: new Date().toISOString(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [conversationStatus, setConversationStatus] = useState<
    'AI_HANDLING' | 'WAITING_HUMAN' | 'HUMAN_HANDLING'
  >('AI_HANDLING');
  const [handoffReason, setHandoffReason] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<SimAppointment[]>([]);
  const [actionLogs, setActionLogs] = useState<AiActionLog[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  };

  // Sincroniza a cada 2s com o backend (caso a recepcionista responda lá pelo Painel Principal)
  const syncFromBackend = useCallback(async () => {
    if ( isAiTyping ) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/whatsapp-real/status`);
      if (!res.ok) return;
      const data = await res.json();

      const cleanPhone = patientPhone.replace(/\D/g, '') || '11999998888';
      const targetJid = `sim-${cleanPhone}@simulator.local`;

      if (Array.isArray(data.conversations)) {
        const found = data.conversations.find((c: any) => c.remoteJid === targetJid);
        if (found && Array.isArray(found.messages) && found.messages.length > 0) {
          setMessages(found.messages);
          setConversationStatus(found.status);
          setHandoffReason(found.handoffReason || null);
        }
      }

      if (Array.isArray(data.appointments)) {
        setAppointments(data.appointments);
      }
    } catch {
      // Ignora erro de rede
    }
  }, [patientPhone, isAiTyping]);

  useEffect(() => {
    syncFromBackend();
    const timer = setInterval(syncFromBackend, 2000);
    return () => clearInterval(timer);
  }, [syncFromBackend]);

  const handleSendPatientMessage = async (customText?: string) => {
    const textToSend = (customText ?? inputText).trim();
    if (!textToSend || isAiTyping) return;

    if (!customText) setInputText('');

    const optimisticPatientMsg: SimMessage = {
      id: `local-pat-${Date.now()}`,
      sender: 'PATIENT',
      content: textToSend,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [
      ...prev.filter((m) => m.id !== 'welcome-msg'),
      optimisticPatientMsg,
    ]);
    setIsAiTyping(true);
    scrollToBottom();

    try {
      const res = await fetch(`${API_BASE_URL}/api/whatsapp-real/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: patientPhone,
          patientName,
          insuranceName,
          text: textToSend,
        }),
      });

      if (!res.ok) {
        throw new Error('Falha ao comunicar com o motor de IA');
      }

      const data = await res.json();

      if (data.aiResult) {
        const { bookedAction, cancelledAction, handoffAction } = data.aiResult;
        const nowStr = new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        if (bookedAction) {
          setActionLogs((prev) => [
            {
              id: `log-${Date.now()}`,
              type: 'BOOKED',
              title: 'Consulta Agendada (bookAppointment)',
              details: `${bookedAction.procedureName} com ${bookedAction.dentistName} às ${bookedAction.time} • Tel: ${bookedAction.contactPhone}`,
              timestamp: nowStr,
            },
            ...prev,
          ]);
          showToast(`✅ IA agendou horário às ${bookedAction.time}!`);
        }

        if (cancelledAction) {
          setActionLogs((prev) => [
            {
              id: `log-${Date.now()}`,
              type: 'CANCELLED',
              title: 'Consulta Cancelada (cancelAppointment)',
              details: `Motivo: ${cancelledAction.reason} • Contato salvo: ${cancelledAction.contactPhone}`,
              timestamp: nowStr,
            },
            ...prev,
          ]);
          showToast('🗑️ IA cancelou o agendamento e salvou o contato!');
        }

        if (handoffAction) {
          setActionLogs((prev) => [
            {
              id: `log-${Date.now()}`,
              type: 'HANDOFF',
              title: 'Transbordo Humano Acionado (requestHumanHandoff)',
              details: `Urgência: ${handoffAction.urgency} • Motivo: ${handoffAction.reason}`,
              timestamp: nowStr,
            },
            ...prev,
          ]);
          showToast('🚨 IA pausou e transferiu para a recepcionista!');
        }
      }

      if (data.conversation) {
        setMessages(data.conversation.messages);
        setConversationStatus(data.conversation.status);
        setHandoffReason(data.conversation.handoffReason || null);
      }

      if (Array.isArray(data.appointments)) {
        setAppointments(data.appointments);
      }
    } catch {
      showToast('⚠️ Erro ao processar resposta da IA. Verifique se a API está ativa.');
    } finally {
      setIsAiTyping(false);
      scrollToBottom();
    }
  };

  const handleResetSimulation = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/whatsapp-real/reset-simulator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: patientPhone }),
      });
      setMessages([
        {
          id: 'welcome-msg',
          sender: 'AI',
          content:
            'Simulação reiniciada! Envie uma mensagem abaixo para testar um novo fluxo do zero. 😊',
          createdAt: new Date().toISOString(),
        },
      ]);
      setConversationStatus('AI_HANDLING');
      setHandoffReason(null);
      setAppointments([]);
      setActionLogs([]);
      showToast('🔄 Conversa e agendamentos de teste reiniciados!');
    } catch {
      showToast('Erro ao limpar simulação.');
    }
  };

  const handleReactivateAi = async () => {
    const cleanPhone = patientPhone.replace(/\D/g, '') || '11999998888';
    const remoteJid = `sim-${cleanPhone}@simulator.local`;
    await fetch(`${API_BASE_URL}/api/whatsapp-real/reactivate-ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remoteJid }),
    });
    setConversationStatus('AI_HANDLING');
    setHandoffReason(null);
    showToast('🤖 Recepcionista IA reativada para esta conversa!');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Notificação Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 border border-sky-500/40 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold">
          <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header Superior */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Painel da Clínica
          </Link>
          <div className="h-5 w-px bg-slate-800" />
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white flex items-center gap-2">
                Simulador Standalone do Chatbot
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Sem precisar de WhatsApp
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">
                Teste agendamentos, cancelamentos e transbordo de urgência sincronizados com o painel principal
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Motor IA: <strong className="text-white">Groq AI (Ativo)</strong>
          </div>
          <button
            onClick={handleResetSimulation}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Limpar e Reiniciar Teste
          </button>
        </div>
      </header>

      {/* Conteúdo Principal em 3 Colunas */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 max-w-[1600px] w-full mx-auto overflow-hidden">
        {/* COLUNA 1: Perfil do Paciente & Cenários de 1 Clique (3 colunas) */}
        <div className="lg:col-span-3 flex flex-col gap-5 overflow-y-auto">
          {/* Card Dados do Paciente Simulado */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-sky-400" />
                Perfil do Paciente de Teste
              </h2>
              <span className="text-[10px] text-sky-400 font-semibold">Editável</span>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Nome do Paciente
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  WhatsApp / Telefone de Contato
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Convênio do Paciente
                </label>
                <div className="relative">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <select
                    value={insuranceName}
                    onChange={(e) => setInsuranceName(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:border-sky-500 focus:outline-none"
                  >
                    <option value="Bradesco Dental">Bradesco Dental</option>
                    <option value="Amil Dental">Amil Dental</option>
                    <option value="SulAmérica">SulAmérica</option>
                    <option value="Particular">Particular</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Card Cenários Rápidos */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 flex-1">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Cenários Rápidos (1 Clique)
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Clique em qualquer frase abaixo para enviá-la imediatamente ao chatbot:
              </p>
            </div>

            <div className="space-y-2">
              {QUICK_SCENARIOS.map((sc, idx) => (
                <button
                  key={idx}
                  disabled={isAiTyping}
                  onClick={() => handleSendPatientMessage(sc.text)}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-950/90 hover:bg-slate-800/90 border border-slate-800 hover:border-sky-500/40 transition group disabled:opacity-50"
                >
                  <div className="text-xs font-semibold text-sky-300 group-hover:text-sky-200 flex items-center justify-between">
                    <span>{sc.label}</span>
                    <Send className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">&ldquo;{sc.text}&rdquo;</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* COLUNA 2: Celular Virtual WhatsApp do Paciente (5 colunas) */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="w-full max-w-md h-[680px] bg-[#0b141a] rounded-[28px] border-[6px] border-slate-800 shadow-2xl flex flex-col overflow-hidden">
            {/* Topo estilo WhatsApp */}
            <div className="bg-[#202c33] px-4 py-3 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-sky-600 flex items-center justify-center text-white font-bold text-sm shadow">
                  SP
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    Clínica Sorriso Perfeito
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <p className="text-[11px] text-emerald-400">
                    {isAiTyping
                      ? 'Sofia está digitando...'
                      : conversationStatus === 'AI_HANDLING'
                      ? 'Sofia (Recepcionista IA) • online'
                      : 'Atendimento Humano • Recepção'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                Visão do Paciente
              </span>
            </div>

            {/* Banner se estiver pausado para humano */}
            {conversationStatus !== 'AI_HANDLING' && (
              <div className="bg-amber-500/20 border-b border-amber-500/30 px-3 py-2 flex items-center justify-between">
                <span className="text-[11px] text-amber-200 font-medium">
                  ⚠️ IA pausada (aguardando recepcionista humana)
                </span>
                <button
                  onClick={handleReactivateAi}
                  className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-bold text-[10px] hover:bg-amber-300 transition"
                >
                  Reativar IA
                </button>
              </div>
            )}

            {/* Lista de Mensagens estilo WhatsApp */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-[#0b141a]">
              {messages.map((msg) => {
                const isPatient = msg.sender === 'PATIENT';
                const isStaff = msg.sender === 'HUMAN_STAFF';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isPatient ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow ${
                        isPatient
                          ? 'bg-[#005c4b] text-white rounded-tr-none'
                          : isStaff
                          ? 'bg-amber-950/90 border border-amber-600/40 text-amber-100 rounded-tl-none'
                          : 'bg-[#202c33] text-slate-100 rounded-tl-none'
                      }`}
                    >
                      <div className="text-[10px] font-bold mb-0.5 opacity-75">
                        {isPatient
                          ? `${patientName} (Você)`
                          : isStaff
                          ? '👩‍⚕️ Recepcionista Humana'
                          : '🤖 Sofia (IA)'}
                      </div>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <div className="text-[9px] opacity-60 text-right mt-1">
                        {new Date(msg.createdAt).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isAiTyping && (
                <div className="flex items-start">
                  <div className="bg-[#202c33] text-slate-300 rounded-2xl rounded-tl-none px-4 py-2.5 text-xs flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                    Sofia está digitando resposta...
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input Inferior do WhatsApp */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendPatientMessage();
              }}
              className="bg-[#202c33] p-3 flex items-center gap-2 border-t border-slate-800"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Digite uma mensagem como paciente..."
                className="flex-1 bg-[#2a3942] text-white placeholder-slate-400 text-xs rounded-full px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isAiTyping}
                className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#029072] disabled:opacity-40 text-white flex items-center justify-center transition shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* COLUNA 3: Inspector de Ações da IA & Espelho da Agenda (4 colunas) */}
        <div className="lg:col-span-4 flex flex-col gap-5 overflow-y-auto">
          {/* Status da Conversa em Tempo Real */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                Estado do Atendimento
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  conversationStatus === 'AI_HANDLING'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {conversationStatus === 'AI_HANDLING'
                  ? '🤖 IA Atendendo Automaticamente'
                  : '🚨 Transferido para Recepcionista'}
              </span>
            </div>

            {handoffReason && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Motivo do Transbordo:</div>
                  <div className="text-[11px] opacity-90">{handoffReason}</div>
                </div>
              </div>
            )}
          </div>

          {/* Espelho da Agenda em Tempo Real */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                Consultas Geradas no Teste ({appointments.length})
              </h2>
            </div>

            {appointments.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center text-xs text-slate-500">
                Nenhuma consulta agendada ainda nesta sessão de teste. Peça um horário no chat ao lado!
              </div>
            ) : (
              <div className="space-y-2">
                {appointments.map((appt) => {
                  const timeStr = new Date(appt.startTime).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const isCancelled = appt.status === 'CANCELLED';
                  return (
                    <div
                      key={appt.id}
                      className={`p-3 rounded-xl border flex items-center justify-between ${
                        isCancelled
                          ? 'bg-rose-950/20 border-rose-500/30 opacity-75'
                          : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white flex items-center gap-1">
                            <Clock className="w-3 h-3 text-sky-400" />
                            {timeStr}
                          </span>
                          <span className="text-xs font-semibold text-slate-200">
                            {appt.patient.name}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {appt.procedureName} • {appt.dentistName}
                        </p>
                        <p className="text-[10px] text-sky-400 font-medium mt-0.5">
                          📞 Contato salvo: {appt.patient.phone}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isCancelled
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {isCancelled ? 'CANCELADO' : 'CONFIRMADO'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Log de Ferramentas Acionadas pela IA */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 flex-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-purple-400" />
              Log de Ferramentas da IA (Tool Calls)
            </h2>

            {actionLogs.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center text-xs text-slate-500">
                Quando a IA executar uma ação no sistema (agendar, cancelar ou chamar humano), o log técnico aparecerá aqui.
              </div>
            ) : (
              <div className="space-y-2">
                {actionLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-bold flex items-center gap-1 ${
                          log.type === 'BOOKED'
                            ? 'text-emerald-400'
                            : log.type === 'CANCELLED'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {log.type === 'BOOKED' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {log.type === 'CANCELLED' && <XCircle className="w-3.5 h-3.5" />}
                        {log.type === 'HANDOFF' && <AlertCircle className="w-3.5 h-3.5" />}
                        {log.title}
                      </span>
                      <span className="text-[10px] text-slate-500">{log.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-slate-300">{log.details}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
