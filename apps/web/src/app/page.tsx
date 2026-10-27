'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Calendar,
  MessageSquare,
  Sparkles,
  Check,
  Plus,
  Send,
  X,
  ArrowUpRight,
  Stethoscope,
  Bot,
  UserCheck,
  AlertCircle,
  FlaskConical,
  ShieldCheck,
  Users,
  Palette,
  Upload,
  Trash2,
  QrCode,
  Smartphone,
  LogOut,
  Lock,
  RefreshCw,
  Phone,
} from 'lucide-react';
import {
  API_BASE_URL,
  Clinic,
  AppointmentItem,
  ConversationItem,
} from '@/lib/api';

const BRAND_PRESETS = [
  { name: 'Azul Clínico', color: '#0284c7' },
  { name: 'Verde Odonto', color: '#0d9488' },
  { name: 'Índigo Royal', color: '#4f46e5' },
  { name: 'Esmeralda', color: '#059669' },
  { name: 'Rose Estética', color: '#e11d48' },
  { name: 'Grafite Premium', color: '#0f172a' },
];

const DEMO_CLINIC: Clinic = {
  id: 'demo-clinic-1',
  name: 'Clínica Sorriso Perfeito',
  phone: '5511999990000',
  address: 'Av. Paulista, 1000 - Sala 402, São Paulo',
  logoUrl: null,
  brandColor: '#0284c7',
  acceptedInsurances: ['Particular', 'Amil Dental', 'Bradesco Dental', 'SulAmérica'],
  aiAssistantName: 'Sofia',
  aiCustomRules:
    'Estacionamento conveniado gratuito no prédio. Avaliações iniciais sem custo para implantes e estética.',
  isBotActive: true,
  dentists: [],
  procedures: [
    { id: 'proc-1', name: 'Avaliação Inicial', durationMinutes: 30, price: 150 },
    { id: 'proc-2', name: 'Limpeza (Profilaxia)', durationMinutes: 45, price: 250 },
    { id: 'proc-3', name: 'Consulta de Urgência', durationMinutes: 30, price: 200 },
  ],
};

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

function ToothIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M7.5 3C4.8 3 3 5.2 3 8.2c0 3.2 1.6 5.8 2.6 9.5.6 2.2 1.5 3.3 2.7 3.3 1.2 0 1.6-1.8 2.4-4.4.4-1.4 1-2.1 1.8-2.1s1.4.7 1.8 2.1c.8 2.6 1.2 4.4 2.4 4.4 1.2 0 2.1-1.1 2.7-3.3 1-3.7 2.6-6.3 2.6-9.5C22 5.2 20.2 3 17.5 3c-2 0-3.4 1.1-5 1.1S9.5 3 7.5 3z" />
    </svg>
  );
}

export default function OdontoAiCompleteWorkspace() {
  // Controle de Autenticação (Bloco 8)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [loginEmail, setLoginEmail] = useState<string>('recepcao@sorrisoperfeito.com.br');
  const [loginPassword, setLoginPassword] = useState<string>('123456');

  // Controle de Conexão WhatsApp QR Code Real (Bloco 8 + Baileys)
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState<boolean>(false);
  const [connectedWhatsAppPhone, setConnectedWhatsAppPhone] = useState<string | null>(null);
  const [realQrCodeUrl, setRealQrCodeUrl] = useState<string | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [qrStep, setQrStep] = useState<'QRCODE' | 'CONNECTING' | 'CONNECTED'>('QRCODE');

  const [activeTab, setActiveTab] = useState<'today' | 'inbox' | 'dentists' | 'settings'>('today');
  const [clinic, setClinic] = useState<Clinic>(DEMO_CLINIC);
  const [selectedDentistFilter, setSelectedDentistFilter] = useState<string>('ALL');

  // Estado inicial limpo (sem agendamentos nem conversas fictícias pré-cadastradas)
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);

  const [selectedConversationId, setSelectedConversationId] = useState<string>('');
  const [staffReplyText, setStaffReplyText] = useState<string>('');
  const [chatSenderMode, setChatSenderMode] = useState<'PATIENT' | 'HUMAN_STAFF'>('HUMAN_STAFF');
  const [isAiTypingInChat, setIsAiTypingInChat] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);
  const [isSimulatingAi, setIsSimulatingAi] = useState<boolean>(false);
  const [simPatientName, setSimPatientName] = useState<string>('Lucas Martins');
  const [simMessageText, setSimMessageText] = useState<string>(
    'Olá! Quais horários têm livres amanhã?'
  );

  // Modal de Cadastro de Novo Profissional (Dentista)
  const [isDentistModalOpen, setIsDentistModalOpen] = useState<boolean>(false);
  const [dentistForm, setDentistForm] = useState({
    name: '',
    cro: '',
    specialty: 'Clínica Geral & Avaliação',
    color: '#0284c7',
  });

  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [bookingForm, setBookingForm] = useState({
    patientName: '',
    patientPhone: '',
    insuranceName: 'Particular',
    dentistId: '',
    procedureId: DEMO_CLINIC.procedures[0].id,
    startTime: '10:30',
  });

  const brandColor = clinic.brandColor || '#0284c7';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const syncClinicConfigToBackend = useCallback(async (updatedClinic: Clinic) => {
    try {
      await fetch(`${API_BASE_URL}/api/whatsapp-real/clinic-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicName: updatedClinic.name,
          aiAssistantName: updatedClinic.aiAssistantName,
          address: updatedClinic.address,
          acceptedInsurances: updatedClinic.acceptedInsurances,
          aiCustomRules: updatedClinic.aiCustomRules,
          dentists: updatedClinic.dentists.map((d) => ({
            name: d.name,
            specialty: d.specialty,
            cro: d.cro,
          })),
        }),
      });
    } catch {
      // Ignora erro caso offline
    }
  }, []);

  const syncWithBackend = useCallback(async () => {
    try {
      const savedBranding = localStorage.getItem('odonto_ai_whitelabel');
      if (savedBranding) {
        const parsed = JSON.parse(savedBranding);
        setClinic((prev) => {
          const merged = {
            ...prev,
            ...parsed,
            dentists: Array.isArray(parsed.dentists) ? parsed.dentists : prev.dentists,
          };
          syncClinicConfigToBackend(merged);
          return merged;
        });
      }
    } catch {
      // Estado local
    }
  }, [syncClinicConfigToBackend]);

  useEffect(() => {
    syncWithBackend();
  }, [syncWithBackend]);

  const handleCreateDentist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dentistForm.name.trim()) return;

    const newDentist = {
      id: `dent-${Date.now()}`,
      name: dentistForm.name.trim(),
      cro: dentistForm.cro.trim() || 'CRO Ativo',
      specialty: dentistForm.specialty.trim() || 'Clínica Geral',
      color: dentistForm.color || brandColor,
    };

    setClinic((prev) => {
      const updated = {
        ...prev,
        dentists: [...prev.dentists, newDentist],
      };
      localStorage.setItem('odonto_ai_whitelabel', JSON.stringify(updated));
      syncClinicConfigToBackend(updated);
      return updated;
    });

    setBookingForm((prev) => ({
      ...prev,
      dentistId: prev.dentistId || newDentist.id,
    }));
    setDentistForm({
      name: '',
      cro: '',
      specialty: 'Clínica Geral & Avaliação',
      color: '#0284c7',
    });
    setIsDentistModalOpen(false);
    showToast(`👨‍⚕️ Profissional ${newDentist.name} cadastrado com sucesso!`);
  };

  const handleDeleteDentist = (dentistId: string) => {
    setClinic((prev) => {
      const updated = {
        ...prev,
        dentists: prev.dentists.filter((d) => d.id !== dentistId),
      };
      localStorage.setItem('odonto_ai_whitelabel', JSON.stringify(updated));
      syncClinicConfigToBackend(updated);
      return updated;
    });
    if (selectedDentistFilter === dentistId) {
      setSelectedDentistFilter('ALL');
    }
    showToast('Profissional removido da clínica.');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticated(true);
    showToast(`Bem-vindo(a) ao painel da ${clinic.name}!`);
  };

  const handleOpenQrScanner = async () => {
    setIsQrModalOpen(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/whatsapp-real/connect`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'CONNECTED') {
          setQrStep('CONNECTED');
          setIsWhatsAppConnected(true);
          setConnectedWhatsAppPhone(data.connectedPhone);
        } else {
          setQrStep('QRCODE');
          if (data.qrCodeDataUrl) setRealQrCodeUrl(data.qrCodeDataUrl);
        }
      }
    } catch {
      // Fallback
    }
  };

  // Faz polling do QR Code Real e das mensagens vindas do celular conectado / simulador
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/whatsapp-real/status`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.qrCodeDataUrl) {
          setRealQrCodeUrl(data.qrCodeDataUrl);
          setQrStep('QRCODE');
        }

        if (data.status === 'CONNECTED') {
          if (!isWhatsAppConnected) {
            showToast(`📲 WhatsApp Real conectado (${data.connectedPhone})!`);
          }
          setIsWhatsAppConnected(true);
          setConnectedWhatsAppPhone(data.connectedPhone);
          setQrStep('CONNECTED');
          setRealQrCodeUrl(null);
        } else if (data.status === 'DISCONNECTED') {
          setIsWhatsAppConnected(false);
        }

        // Sincroniza conversas reais do celular ou do simulador dev para a tela do Painel
        if (Array.isArray(data.conversations)) {
          setConversations((prev) => {
            const manualOnly = prev.filter((c) => !c.id.startsWith('wa-'));
            return [...data.conversations, ...manualOnly];
          });
        }

        // Sincroniza agendamentos reais feitos pelo celular ou simulador dev para a Agenda do Dia
        if (Array.isArray(data.appointments)) {
          setAppointments((prev) => {
            const manualOnly = prev.filter((a) => !a.id.startsWith('wa-appt-'));
            const mappedReal: AppointmentItem[] = data.appointments.map((ra: any) => ({
              id: ra.id,
              startTime: ra.startTime,
              endTime: ra.endTime,
              status: ra.status,
              bookedByAi: true,
              reminderSent: false,
              patient: ra.patient,
              dentist:
                clinic.dentists.find((d) =>
                  d.name.toLowerCase().includes((ra.dentistName || '').toLowerCase())
                ) ||
                clinic.dentists[0] || {
                  id: 'dent-default',
                  name: ra.dentistName || 'Profissional da Clínica',
                  cro: 'CRO Ativo',
                  specialty: 'Atendimento Geral',
                  color: brandColor,
                },
              procedure:
                clinic.procedures.find((p) =>
                  p.name.toLowerCase().includes((ra.procedureName || '').toLowerCase())
                ) || clinic.procedures[0],
            }));
            return [...mappedReal, ...manualOnly];
          });
        }
      } catch {
        // Ignora se offline
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isWhatsAppConnected, clinic.dentists, clinic.procedures, brandColor]);

  const handleDisconnectRealWhatsApp = async () => {
    await fetch(`${API_BASE_URL}/api/whatsapp-real/disconnect`, { method: 'POST' });
    setIsWhatsAppConnected(false);
    setConnectedWhatsAppPhone(null);
    setRealQrCodeUrl(null);
    setQrStep('QRCODE');
    await handleOpenQrScanner();
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setClinic((prev) => {
        const updated = { ...prev, logoUrl: base64 };
        localStorage.setItem(
          'odonto_ai_whitelabel',
          JSON.stringify({
            name: updated.name,
            logoUrl: updated.logoUrl,
            brandColor: updated.brandColor,
            aiAssistantName: updated.aiAssistantName,
          })
        );
        return updated;
      });
      showToast('Logo da clínica aplicada em tempo real!');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async () => {
    localStorage.setItem(
      'odonto_ai_whitelabel',
      JSON.stringify({
        name: clinic.name,
        logoUrl: clinic.logoUrl,
        brandColor: clinic.brandColor,
        aiAssistantName: clinic.aiAssistantName,
        address: clinic.address,
        acceptedInsurances: clinic.acceptedInsurances,
        aiCustomRules: clinic.aiCustomRules,
        dentists: clinic.dentists,
      })
    );

    syncClinicConfigToBackend(clinic);

    try {
      await fetch(`${API_BASE_URL}/api/clinics/${clinic.id}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: clinic.name,
          logoUrl: clinic.logoUrl,
          brandColor: clinic.brandColor,
          aiAssistantName: clinic.aiAssistantName,
          address: clinic.address,
          acceptedInsurances: clinic.acceptedInsurances,
          aiCustomRules: clinic.aiCustomRules,
        }),
      });
    } catch {
      // Salvo no storage local
    }

    showToast('Personalização e regras salvas com sucesso!');
  };

  const waitingHumanConvs = conversations.filter((c) => c.status === 'WAITING_HUMAN');
  const selectedConversation =
    conversations.find((c) => c.id === selectedConversationId) || conversations[0];

  // Auto-scroll suave para a última mensagem sempre que o chat atualizar
  useEffect(() => {
    if (activeTab === 'inbox') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedConversation?.messages.length, isAiTypingInChat, activeTab, selectedConversationId]);

  // Atualiza o título da aba mantendo sempre o Favicon de Dente
  useEffect(() => {
    document.title = `${clinic.name} — Painel OdontoAI`;
    const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${brandColor}"/><path d="M22.5 16C17.5 16 14 20 14 25.5C14 31.5 17 36.5 19 43.5C20.2 47.7 21.8 50 24 50C26.2 50 27 46.5 28.5 41.5C29.3 38.8 30.5 37.5 32 37.5C33.5 37.5 34.7 38.8 35.5 41.5C37 46.5 37.8 50 40 50C42.2 50 43.8 47.7 45 43.5C47 36.5 50 31.5 50 25.5C50 20 46.5 16 41.5 16C37.8 16 35.2 18 32 18C28.8 18 26.2 16 22.5 16Z" fill="white"/></svg>`;
    const faviconHref = `data:image/svg+xml,${encodeURIComponent(svgFavicon)}`;

    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = faviconHref;
  }, [clinic.name, brandColor]);

  const activeAppointments = appointments.filter((a) => a.status !== 'CANCELLED');
  const cancelledAppointments = appointments.filter((a) => a.status === 'CANCELLED');
  const filteredAppointments =
    selectedDentistFilter === 'CANCELLED'
      ? cancelledAppointments
      : activeAppointments.filter(
          (a) => selectedDentistFilter === 'ALL' || a.dentist.id === selectedDentistFilter
        );

  const confirmedCount = activeAppointments.filter(
    (a) => a.status === 'CONFIRMED' || a.status === 'COMPLETED'
  ).length;
  const aiBookedCount = activeAppointments.filter((a) => a.bookedByAi).length;
  const aiRevenue = activeAppointments
    .filter((a) => a.bookedByAi)
    .reduce((acc, a) => acc + Number(a.procedure.price || 200), 0);

  const handleToggleMasterBot = () => {
    const nextState = !clinic.isBotActive;
    setClinic((prev) => ({ ...prev, isBotActive: nextState }));
    showToast(
      nextState
        ? `Assistente ${clinic.aiAssistantName} ativada no WhatsApp`
        : 'Assistente IA pausada temporariamente'
    );
  };

  const handleToggleConversationMode = async (conv: ConversationItem) => {
    const nextStatus = conv.status === 'AI_HANDLING' ? 'HUMAN_HANDLING' : 'AI_HANDLING';
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conv.id ? { ...c, status: nextStatus, handoffReason: null } : c
      )
    );

    const anyConv = conv as any;
    if (nextStatus === 'AI_HANDLING' && anyConv.remoteJid) {
      fetch(`${API_BASE_URL}/api/whatsapp-real/reactivate-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remoteJid: anyConv.remoteJid }),
      }).catch(() => {});
    }

    showToast(
      nextStatus === 'HUMAN_HANDLING'
        ? 'Você assumiu o atendimento desta conversa'
        : `Conversa devolvida para a IA ${clinic.aiAssistantName}`
    );
  };

  const handleSendStaffMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffReplyText.trim() || !selectedConversation) return;

    const text = staffReplyText.trim();
    setStaffReplyText('');

    const newMsg = {
      id: `msg-${Date.now()}`,
      sender: 'HUMAN_STAFF' as const,
      content: text,
      mediaType: 'text',
      createdAt: new Date().toISOString(),
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversation.id
          ? {
              ...c,
              status: 'HUMAN_HANDLING',
              lastMessageAt: new Date().toISOString(),
              messages: [...c.messages, newMsg],
            }
          : c
      )
    );

    const anyConv = selectedConversation as any;
    if (anyConv.remoteJid) {
      fetch(`${API_BASE_URL}/api/whatsapp-real/send-staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remoteJid: anyConv.remoteJid,
          text,
        }),
      }).catch(() => {});
    }

    showToast('Mensagem enviada pela recepção (IA pausada nesta conversa)');
  };

  const handleToggleAppointmentConfirm = (
    apptId: string,
    currentStatus: AppointmentItem['status']
  ) => {
    const nextStatus = currentStatus === 'CONFIRMED' ? 'COMPLETED' : 'CONFIRMED';
    setAppointments((prev) =>
      prev.map((a) => (a.id === apptId ? { ...a, status: nextStatus } : a))
    );
    showToast(
      nextStatus === 'CONFIRMED' ? 'Presença confirmada na agenda' : 'Atendimento concluído'
    );
  };

  const handleSimulatePatientWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simMessageText.trim() || isSimulatingAi) return;

    const text = simMessageText.trim();
    const existingConv = conversations.find(
      (c) => c.patient.name.toLowerCase() === simPatientName.trim().toLowerCase()
    );

    setIsSimulatingAi(true);

    try {
      // Chama a API Real (Groq Llama 3.3 70B / OpenAI) usando a chave configurada no .env!
      const response = await fetch(`${API_BASE_URL}/api/ai/live-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicName: clinic.name,
          aiAssistantName: clinic.aiAssistantName,
          address: clinic.address,
          acceptedInsurances: clinic.acceptedInsurances,
          aiCustomRules: clinic.aiCustomRules,
          patientName: simPatientName,
          patientPhone: '11 95555-4444',
          messageHistory: existingConv
            ? existingConv.messages.map((m) => ({
                sender: m.sender,
                content: m.content,
              }))
            : [],
          newMessage: text,
        }),
      });

      if (response.ok) {
        const aiData = await response.json();
        const aiResponse: string = aiData.reply;
        let newStatus: ConversationItem['status'] = 'AI_HANDLING';
        let handoffReason: string | null = null;

        // Se a IA acionou a Tool de Urgência / Transbordo Humano:
        if (aiData.handoffAction) {
          newStatus = 'WAITING_HUMAN';
          handoffReason = aiData.handoffAction.reason;
        }

        // Se a IA acionou a Tool de Cancelamento:
        if (aiData.cancelledAction) {
          setAppointments((prev) =>
            prev.map((a) =>
              a.patient.name.toLowerCase() === simPatientName.trim().toLowerCase() &&
              a.status !== 'CANCELLED'
                ? {
                    ...a,
                    status: 'CANCELLED',
                    patient: {
                      ...a.patient,
                      phone: aiData.cancelledAction.contactPhone || a.patient.phone,
                    },
                  }
                : a
            )
          );
        }

        // Se a IA acionou a Tool de Agendamento na Agenda:
        if (aiData.bookedAction) {
          const [hh, mm] = (aiData.bookedAction.time || '10:30').split(':').map(Number);
          const start = new Date();
          start.setHours(isNaN(hh) ? 10 : hh, isNaN(mm) ? 30 : mm, 0, 0);
          const end = new Date(start.getTime() + 30 * 60000);

          setAppointments((prev) => [
            ...prev,
            {
              id: `appt-${Date.now()}`,
              startTime: start.toISOString(),
              endTime: end.toISOString(),
              status: 'CONFIRMED',
              bookedByAi: true,
              reminderSent: false,
              patient: {
                id: `p-${Date.now()}`,
                name: simPatientName,
                phone: aiData.bookedAction.contactPhone || '11 95555-4444',
                insuranceName: 'Particular',
              },
              dentist: clinic.dentists[0],
              procedure: clinic.procedures[0],
            },
          ]);
        }

        const patMsg = {
          id: `m1-${Date.now()}`,
          sender: 'PATIENT' as const,
          content: text,
          mediaType: 'text',
          createdAt: new Date().toISOString(),
        };
        const botMsg = {
          id: `m2-${Date.now() + 1}`,
          sender: 'AI' as const,
          content: aiResponse,
          mediaType: 'text',
          createdAt: new Date().toISOString(),
        };

        if (existingConv) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === existingConv.id
                ? {
                    ...c,
                    status: newStatus,
                    urgency: newStatus === 'WAITING_HUMAN' ? 'HIGH' : c.urgency,
                    handoffReason: handoffReason || c.handoffReason,
                    lastMessageAt: new Date().toISOString(),
                    messages: [...c.messages, patMsg, botMsg],
                  }
                : c
            )
          );
          setSelectedConversationId(existingConv.id);
        } else {
          const newConvId = `conv-${Date.now()}`;
          setConversations((prev) => [
            {
              id: newConvId,
              status: newStatus,
              urgency: newStatus === 'WAITING_HUMAN' ? 'HIGH' : 'NORMAL',
              handoffReason,
              lastMessageAt: new Date().toISOString(),
              patient: {
                id: `p-${Date.now()}`,
                name: simPatientName,
                phone: '11 95555-4444',
                insuranceName: 'Particular',
              },
              messages: [patMsg, botMsg],
            },
            ...prev,
          ]);
          setSelectedConversationId(newConvId);
        }

        setIsSimulatingAi(false);
        setIsSimulatorOpen(false);
        setActiveTab('inbox');
        showToast(`✨ Respondido pela IA Real: ${aiData.provider}`);
        return;
      }
    } catch {
      // Fallback caso a API não esteja rodando
    } finally {
      setIsSimulatingAi(false);
    }

    const lower = text.toLowerCase();
    const isEmergency =
      lower.includes('dor') || lower.includes('urgente') || lower.includes('quebr');
    const timeMatch = lower.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);

    let aiResponse = '';
    let newStatus: ConversationItem['status'] = 'AI_HANDLING';
    let handoffReason: string | null = null;

    if (isEmergency) {
      newStatus = 'WAITING_HUMAN';
      handoffReason = `Paciente relatou: "${text}"`;
      aiResponse = `Sinto muito por isso, ${simPatientName.split(' ')[0]}. Já avisei nossa recepção com prioridade e a atendente vai falar com você agora mesmo.`;
    } else if (timeMatch) {
      const chosenTime = timeMatch[0];
      const [hh, mm] = chosenTime.split(':').map(Number);
      const start = new Date();
      start.setHours(hh, mm, 0, 0);
      const end = new Date(start.getTime() + 30 * 60000);

      setAppointments((prev) => [
        ...prev,
        {
          id: `appt-${Date.now()}`,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          status: 'CONFIRMED',
          bookedByAi: true,
          reminderSent: false,
          patient: {
            id: `p-${Date.now()}`,
            name: simPatientName,
            phone: '11 95555-4444',
            insuranceName: 'Particular',
          },
          dentist: clinic.dentists[0],
          procedure: clinic.procedures[0],
        },
      ]);
      aiResponse = `Agendado, ${simPatientName.split(' ')[0]}! ✅ Sua consulta com ${clinic.dentists[0].name} está confirmada para às ${chosenTime}.`;
    } else {
      aiResponse = `Olá, ${simPatientName.split(' ')[0]}! 😊 Aqui é a ${clinic.aiAssistantName}. Consultei a agenda e temos horários livres às 10:30, 13:30 e 17:00. Qual fica melhor para você?`;
    }

    const newConvId = `conv-${Date.now()}`;
    setConversations((prev) => [
      {
        id: newConvId,
        status: newStatus,
        urgency: isEmergency ? 'HIGH' : 'NORMAL',
        handoffReason,
        lastMessageAt: new Date().toISOString(),
        patient: {
          id: `p-${Date.now()}`,
          name: simPatientName,
          phone: '11 95555-4444',
          insuranceName: 'Particular',
        },
        messages: [
          {
            id: `m1-${Date.now()}`,
            sender: 'PATIENT',
            content: text,
            mediaType: 'text',
            createdAt: new Date().toISOString(),
          },
          {
            id: `m2-${Date.now()}`,
            sender: 'AI',
            content: aiResponse,
            mediaType: 'text',
            createdAt: new Date().toISOString(),
          },
        ],
      },
      ...prev,
    ]);

    setSelectedConversationId(newConvId);
    setIsSimulatorOpen(false);
    setActiveTab('inbox');
    showToast('Nova interação simulada no WhatsApp');
  };

  const handleCreateManualAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    const dentist =
      clinic.dentists.find((d) => d.id === bookingForm.dentistId) ||
      clinic.dentists[0] || {
        id: 'dent-default',
        name: 'Plantonista da Clínica',
        cro: 'CRO Ativo',
        specialty: 'Atendimento Geral',
        color: brandColor,
      };
    const procedure =
      clinic.procedures.find((p) => p.id === bookingForm.procedureId) || clinic.procedures[0];
    const [hh, mm] = bookingForm.startTime.split(':').map(Number);
    const start = new Date();
    start.setHours(hh, mm, 0, 0);
    const end = new Date(start.getTime() + procedure.durationMinutes * 60000);

    setAppointments((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        status: 'CONFIRMED',
        bookedByAi: false,
        reminderSent: false,
        patient: {
          id: `p-${Date.now()}`,
          name: bookingForm.patientName,
          phone: bookingForm.patientPhone,
          insuranceName: bookingForm.insuranceName,
        },
        dentist,
        procedure,
      },
    ]);
    setIsBookingModalOpen(false);
    setBookingForm((prev) => ({ ...prev, patientName: '', patientPhone: '' }));
    showToast('Consulta adicionada à agenda');
  };

  // =========================================================
  // TELA DE LOGIN WHITE-LABEL (BLOCO 8)
  // =========================================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F4F6F9] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl max-w-md w-full p-8 space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            {clinic.logoUrl ? (
              <img
                src={clinic.logoUrl}
                alt={clinic.name}
                className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-sm"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-md"
                style={{ backgroundColor: brandColor }}
              >
                <ToothIcon className="w-8 h-8" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-slate-900">{clinic.name}</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Acesso ao Painel de Gestão & Recepcionista IA
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                E-mail Corporativo
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Senha
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-slate-400"
              />
            </div>

            <button
              type="submit"
              style={{ backgroundColor: brandColor }}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold shadow-sm hover:opacity-95 transition flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              Entrar no Painel
            </button>
          </form>

          <p className="text-[11px] text-center text-slate-400">
            Ambiente protegido • Recepcionista Virtual {clinic.aiAssistantName} 24/7
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-900 flex">
      {/* Toast Elegante */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-slate-900 text-white text-xs font-medium px-4 py-3 rounded-xl shadow-lg border border-slate-800">
          <Sparkles className="w-4 h-4" style={{ color: brandColor }} />
          {toastMessage}
        </div>
      )}

      {/* =========================================================
          SIDEBAR LATERAL WHITE-LABEL
      ========================================================= */}
      <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between shrink-0 sticky top-0 h-screen">
        <div className="p-5 space-y-6">
          {/* Logo Dinâmica + Nome da Clínica */}
          <div className="flex items-center gap-3 px-1">
            {clinic.logoUrl ? (
              <img
                src={clinic.logoUrl}
                alt={clinic.name}
                className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0 transition-colors"
                style={{ backgroundColor: brandColor }}
              >
                <ToothIcon className="w-5 h-5" />
              </div>
            )}
            <div className="overflow-hidden">
              <h1 className="font-bold text-sm text-slate-900 truncate">
                {clinic.name}
              </h1>
              <p className="text-[11px] text-slate-400">Painel Inteligente</p>
            </div>
          </div>

          {/* Menu Principal Dinâmico */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('today')}
              style={
                activeTab === 'today'
                  ? { backgroundColor: `${brandColor}15`, color: brandColor }
                  : undefined
              }
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                activeTab === 'today'
                  ? 'font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-3">
                <Calendar className="w-4 h-4" />
                Agenda do Dia
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white text-slate-600 shadow-sm">
                {activeAppointments.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('inbox')}
              style={
                activeTab === 'inbox'
                  ? { backgroundColor: `${brandColor}15`, color: brandColor }
                  : undefined
              }
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                activeTab === 'inbox'
                  ? 'font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-3">
                <MessageSquare className="w-4 h-4" />
                WhatsApp
              </span>
              {waitingHumanConvs.length > 0 ? (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white">
                  {waitingHumanConvs.length}
                </span>
              ) : (
                <span className="text-xs text-slate-400">{conversations.length}</span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('dentists')}
              style={
                activeTab === 'dentists'
                  ? { backgroundColor: `${brandColor}15`, color: brandColor }
                  : undefined
              }
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                activeTab === 'dentists'
                  ? 'font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              Profissionais
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              style={
                activeTab === 'settings'
                  ? { backgroundColor: `${brandColor}15`, color: brandColor }
                  : undefined
              }
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                activeTab === 'settings'
                  ? 'font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Palette className="w-4 h-4" />
              Personalizar & IA
            </button>
          </nav>
        </div>

        {/* Rodapé da Sidebar: Status IA + QR Code WhatsApp + Logout */}
        <div className="p-4 space-y-2.5 border-t border-slate-100">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    clinic.isBotActive && isWhatsAppConnected
                      ? 'bg-emerald-500 animate-pulse'
                      : 'bg-amber-500'
                  }`}
                />
                <span className="text-xs font-semibold text-slate-800">
                  IA {clinic.aiAssistantName}
                </span>
              </div>
              <button
                onClick={handleToggleMasterBot}
                style={{ color: brandColor }}
                className="text-[11px] font-semibold hover:opacity-80"
              >
                {clinic.isBotActive ? 'Pausar' : 'Ativar'}
              </button>
            </div>

            <button
              onClick={handleOpenQrScanner}
              className="w-full flex items-center justify-between pt-1.5 border-t border-slate-200/60 text-[11px] text-slate-600 hover:text-slate-900 font-medium"
            >
              <span className="flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-slate-500" />
                {isWhatsAppConnected ? 'WhatsApp Conectado' : 'Conectar QR Code'}
              </span>
              <span className="text-[10px] underline">Configurar</span>
            </button>
          </div>

          <button
            onClick={() => setIsAuthenticated(false)}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-600 hover:text-slate-900 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair da Conta
          </button>
        </div>
      </aside>

      {/* =========================================================
          ÁREA DE CONTEÚDO PRINCIPAL
      ========================================================= */}
      <main className="flex-1 p-8 max-w-6xl mx-auto w-full">
        {/* =========================================================
            VISÃO 1: AGENDA DO DIA + RADAR LATERAL DA IA
        ========================================================= */}
        {activeTab === 'today' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Visão de Hoje</h2>
                <p className="text-xs text-slate-500 mt-0.5 capitalize">
                  {new Date().toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
              </div>

              <button
                onClick={() => setIsBookingModalOpen(true)}
                style={{ backgroundColor: brandColor }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl hover:opacity-95 text-white text-xs font-semibold shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                Novo Agendamento
              </button>
            </div>

            {/* 3 Cards de Resumo Equilibrados */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-400">Pacientes Hoje</span>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {confirmedCount}{' '}
                    <span className="text-sm font-normal text-slate-400">
                      / {activeAppointments.length} confirmados
                    </span>
                  </div>
                </div>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
                >
                  <Calendar className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-400">Agendados pela IA</span>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {aiBookedCount} consultas
                  </div>
                </div>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
                >
                  <Sparkles className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-400">Receita via IA (Hoje)</span>
                  <div className="text-2xl font-bold text-emerald-600 mt-1">
                    R$ {aiRevenue.toLocaleString('pt-BR')}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Grid Principal em 2 Colunas */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold text-sm text-slate-900">
                    Horários Agendados
                  </h3>

                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                    <button
                      onClick={() => setSelectedDentistFilter('ALL')}
                      className={`px-3 py-1 rounded-lg transition ${
                        selectedDentistFilter === 'ALL'
                          ? 'bg-white text-slate-900 font-semibold shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Todos
                    </button>
                    {clinic.dentists.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setSelectedDentistFilter(d.id)}
                        className={`px-3 py-1 rounded-lg transition ${
                          selectedDentistFilter === d.id
                            ? 'bg-white text-slate-900 font-semibold shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {d.name.split(' ').slice(0, 2).join(' ')}
                      </button>
                    ))}
                    {cancelledAppointments.length > 0 && (
                      <button
                        onClick={() => setSelectedDentistFilter('CANCELLED')}
                        className={`px-3 py-1 rounded-lg transition ${
                          selectedDentistFilter === 'CANCELLED'
                            ? 'bg-rose-600 text-white font-semibold shadow-sm'
                            : 'text-rose-600 hover:bg-rose-50'
                        }`}
                      >
                        Cancelados ({cancelledAppointments.length})
                      </button>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {filteredAppointments.length === 0 ? (
                    <div className="p-10 text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          Nenhum agendamento registrado hoje
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Novas consultas marcadas pela IA no WhatsApp ou manualmente aparecerão aqui.
                        </p>
                      </div>
                    </div>
                  ) : (
                    filteredAppointments
                      .sort(
                        (a, b) =>
                          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
                      )
                      .map((appt) => {
                        const timeStart = new Date(appt.startTime).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        const isConfirmed = appt.status === 'CONFIRMED';
                        const isCompleted = appt.status === 'COMPLETED';

                        return (
                          <div
                            key={appt.id}
                            className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition"
                          >
                            <div className="flex items-center gap-4">
                              <div
                                className="w-16 pl-3 border-l-[3px]"
                                style={{ borderColor: appt.dentist.color }}
                              >
                                <div className="text-sm font-bold text-slate-900">
                                  {timeStart}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {appt.procedure.durationMinutes} min
                                </div>
                              </div>

                              <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 font-semibold text-xs flex items-center justify-center shrink-0">
                                {getInitials(appt.patient.name)}
                              </div>

                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-900">
                                    {appt.patient.name}
                                  </span>
                                  {appt.bookedByAi && (
                                    <span
                                      style={{
                                        backgroundColor: `${brandColor}15`,
                                        color: brandColor,
                                      }}
                                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md"
                                    >
                                      <Sparkles className="w-2.5 h-2.5" />
                                      IA
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                                  <span>{appt.procedure.name}</span>
                                  <span>•</span>
                                  <span>{appt.dentist.name}</span>
                                  <span>•</span>
                                  <span className="inline-flex items-center gap-1 font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                                    <Phone className="w-3 h-3 text-slate-500" />
                                    {appt.patient.phone}
                                  </span>
                                  <span>•</span>
                                  <span className="text-slate-400">
                                    {appt.patient.insuranceName || 'Particular'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {appt.status === 'CANCELLED' ? (
                              <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700">
                                Cancelado
                              </span>
                            ) : (
                              <button
                                onClick={() =>
                                  handleToggleAppointmentConfirm(appt.id, appt.status)
                                }
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                                  isCompleted
                                    ? 'bg-slate-100 text-slate-500'
                                    : isConfirmed
                                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                }`}
                              >
                                {isConfirmed && <Check className="w-3.5 h-3.5" />}
                                {isCompleted
                                  ? 'Atendido'
                                  : isConfirmed
                                  ? 'Confirmado'
                                  : 'Confirmar'}
                              </button>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Coluna Direita: Radar do WhatsApp */}
              <div className="lg:col-span-4 space-y-4">
                {waitingHumanConvs.length > 0 && (
                  <div className="bg-white rounded-2xl border border-rose-200 p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600">
                        <AlertCircle className="w-4 h-4" />
                        Atenção da Recepção ({waitingHumanConvs.length})
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-semibold">
                        Urgente
                      </span>
                    </div>

                    {waitingHumanConvs.map((conv) => (
                      <div
                        key={conv.id}
                        className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-100 space-y-2"
                      >
                        <div className="font-semibold text-sm text-slate-900">
                          {conv.patient.name}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {conv.handoffReason}
                        </p>
                        <button
                          onClick={() => {
                            setSelectedConversationId(conv.id);
                            setActiveTab('inbox');
                          }}
                          className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition flex items-center justify-center gap-1"
                        >
                          Assumir no WhatsApp
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-slate-900">
                      Atividade no WhatsApp
                    </h3>
                    <button
                      onClick={() => setActiveTab('inbox')}
                      style={{ color: brandColor }}
                      className="text-xs font-semibold hover:opacity-80"
                    >
                      Ver todas
                    </button>
                  </div>

                  {conversations.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center text-xs text-slate-400">
                      Nenhuma conversa ativa no momento.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {conversations.slice(0, 3).map((conv) => {
                        const lastMsg = conv.messages[conv.messages.length - 1];
                        return (
                          <button
                            key={conv.id}
                            onClick={() => {
                              setSelectedConversationId(conv.id);
                              setActiveTab('inbox');
                            }}
                            className="w-full text-left p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-900">
                                {conv.patient.name}
                              </span>
                              <span
                                style={
                                  conv.status !== 'WAITING_HUMAN'
                                    ? {
                                        backgroundColor: `${brandColor}15`,
                                        color: brandColor,
                                      }
                                    : undefined
                                }
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  conv.status === 'WAITING_HUMAN'
                                    ? 'bg-rose-50 text-rose-600'
                                    : ''
                                }`}
                              >
                                {conv.status === 'WAITING_HUMAN' ? 'Aguardando' : 'IA Ativa'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-1">
                              {lastMsg?.content}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            VISÃO 2: WHATSAPP INBOX COMPLETO (ALTURA FIXA RESPONSIVA)
        ========================================================= */}
        {activeTab === 'inbox' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12 h-[calc(100vh-5rem)] max-h-[720px] min-h-[520px]">
            <div className="md:col-span-4 border-r border-slate-100 flex flex-col h-full min-h-0 overflow-hidden">
              <div className="p-4 border-b border-slate-100 shrink-0">
                <h2 className="font-bold text-sm text-slate-900">Conversas WhatsApp</h2>
                <p className="text-xs text-slate-400">
                  Acompanhe ou assuma o atendimento da IA
                </p>
              </div>

              <div className="divide-y divide-slate-100 overflow-y-auto flex-1 min-h-0">
                {conversations.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Nenhuma conversa recebida ainda.
                  </div>
                ) : (
                  conversations.map((conv) => {
                    const isSelected = conv.id === selectedConversation?.id;
                    const lastMsg = conv.messages[conv.messages.length - 1];

                    return (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConversationId(conv.id)}
                        style={
                          isSelected ? { backgroundColor: `${brandColor}12` } : undefined
                        }
                        className={`w-full text-left p-4 transition flex items-start gap-3 ${
                          !isSelected ? 'hover:bg-slate-50' : ''
                        }`}
                      >
                        <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {getInitials(conv.patient.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-900 truncate">
                              {conv.patient.name}
                            </span>
                            {conv.status === 'WAITING_HUMAN' ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white">
                                Urgente
                              </span>
                            ) : conv.status === 'HUMAN_HANDLING' ? (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                                Manual
                              </span>
                            ) : (
                              <span
                                style={{
                                  backgroundColor: `${brandColor}15`,
                                  color: brandColor,
                                }}
                                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                              >
                                IA
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 truncate mt-1">
                            {lastMsg?.content}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {!selectedConversation ? (
              <div className="md:col-span-8 flex flex-col items-center justify-center p-8 text-center bg-slate-50/40">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-700">
                  Nenhuma conversa selecionada
                </h3>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Assim que um paciente enviar mensagem para o WhatsApp da clínica, o histórico aparecerá aqui em tempo real.
                </p>
              </div>
            ) : (
              <div className="md:col-span-8 flex flex-col h-full min-h-0 overflow-hidden bg-slate-50/40">
                <div className="bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        backgroundColor: `${brandColor}18`,
                        color: brandColor,
                      }}
                      className="w-9 h-9 rounded-full font-semibold text-xs flex items-center justify-center"
                    >
                      {getInitials(selectedConversation.patient.name)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {selectedConversation.patient.name}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {selectedConversation.patient.phone} •{' '}
                        {selectedConversation.patient.insuranceName || 'Particular'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleConversationMode(selectedConversation)}
                    style={
                      selectedConversation.status !== 'AI_HANDLING'
                        ? { backgroundColor: brandColor }
                        : undefined
                    }
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                      selectedConversation.status === 'AI_HANDLING'
                        ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                        : 'text-white hover:opacity-95 shadow-sm'
                    }`}
                  >
                    {selectedConversation.status === 'AI_HANDLING' ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        Assumir Conversa
                      </>
                    ) : (
                      <>
                        <Bot className="w-3.5 h-3.5" />
                        Reativar IA {clinic.aiAssistantName}
                      </>
                    )}
                  </button>
                </div>

                <div className="flex-1 min-h-0 p-6 space-y-4 overflow-y-auto">
                  {selectedConversation.messages.map((msg) => {
                    const isPatient = msg.sender === 'PATIENT';
                    const isAi = msg.sender === 'AI';
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isPatient ? 'items-start' : 'items-end'}`}
                      >
                        <span className="text-[11px] text-slate-400 mb-1 px-1">
                          {isPatient
                            ? selectedConversation.patient.name
                            : isAi
                            ? `IA ${clinic.aiAssistantName}`
                            : 'Recepção'}
                        </span>
                        <div
                          style={isAi ? { backgroundColor: brandColor } : undefined}
                          className={`max-w-md rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                            isPatient
                              ? 'bg-white border border-slate-200/80 text-slate-800'
                              : isAi
                              ? 'text-white'
                              : 'bg-slate-900 text-white'
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}

                  {isAiTypingInChat && (
                    <div className="flex flex-col items-end">
                      <span className="text-[11px] text-slate-400 mb-1 px-1">
                        IA {clinic.aiAssistantName} digitando...
                      </span>
                      <div
                        style={{ backgroundColor: brandColor }}
                        className="rounded-2xl px-4 py-2.5 text-xs text-white/90 animate-pulse"
                      >
                        Escrevendo resposta...
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Barra de Resposta Manual da Recepcionista */}
                <div className="p-3.5 bg-white border-t border-slate-100 shrink-0">
                  <form
                    onSubmit={handleSendStaffMessage}
                    className="flex items-center gap-2.5"
                  >
                    <input
                      type="text"
                      value={staffReplyText}
                      onChange={(e) => setStaffReplyText(e.target.value)}
                      placeholder="Responder paciente manualmente como recepção (pausa a IA automaticamente)..."
                      className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-slate-400"
                    />
                    <button
                      type="submit"
                      style={{ backgroundColor: brandColor }}
                      className="px-4 py-2.5 rounded-xl hover:opacity-95 text-white text-xs font-semibold flex items-center gap-1.5 transition shrink-0 shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Enviar Mensagem
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================
            VISÃO 3: CORPO CLÍNICO (CADASTRO E GESTÃO DE PROFISSIONAIS)
        ========================================================= */}
        {activeTab === 'dentists' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Profissionais da Clínica</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cadastre os dentistas da clínica para sincronizar automaticamente com a agenda e a IA
                </p>
              </div>

              <button
                onClick={() => setIsDentistModalOpen(true)}
                style={{ backgroundColor: brandColor }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-semibold shadow-sm hover:opacity-95 transition"
              >
                <Plus className="w-4 h-4" />
                Cadastrar Profissional
              </button>
            </div>

            {clinic.dentists.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm space-y-4">
                <div
                  style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
                >
                  <Stethoscope className="w-7 h-7" />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h3 className="text-base font-bold text-slate-900">
                    Nenhum profissional cadastrado ainda
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Adicione os dentistas e especialistas da sua clínica para organizar a agenda por profissional e permitir que a IA agende consultas diretamente com eles.
                  </p>
                </div>
                <button
                  onClick={() => setIsDentistModalOpen(true)}
                  style={{ backgroundColor: brandColor }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-semibold shadow-sm hover:opacity-95 transition"
                >
                  <Plus className="w-4 h-4" />
                  Cadastrar Primeiro Dentista
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {clinic.dentists.map((dentist) => {
                  const count = activeAppointments.filter(
                    (a) => a.dentist.id === dentist.id
                  ).length;

                  return (
                    <div
                      key={dentist.id}
                      className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3.5">
                          <div
                            className="w-11 h-11 rounded-xl text-white font-bold text-sm flex items-center justify-center"
                            style={{ backgroundColor: dentist.color }}
                          >
                            {getInitials(dentist.name)}
                          </div>
                          <div>
                            <h3 className="font-bold text-base text-slate-900">
                              {dentist.name}
                            </h3>
                            <p className="text-xs text-slate-500">
                              {dentist.specialty} • CRO {dentist.cro}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                            Agenda Ativa
                          </span>
                          <button
                            onClick={() => handleDeleteDentist(dentist.id)}
                            title="Remover Profissional"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>Horário: Seg a Sex (08:00 às 18:00)</span>
                        <span className="font-semibold text-slate-700">
                          {count} pacientes hoje
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =========================================================
            VISÃO 4: PERSONALIZAÇÃO WHITE-LABEL & REGRAS DA IA
        ========================================================= */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
              <div>
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4" style={{ color: brandColor }} />
                  <h3 className="font-bold text-base text-slate-900">
                    Identidade Visual da Clínica
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Personalize com a logo e a cor oficial da marca do seu cliente.
                </p>
              </div>

              {/* Upload de Logo */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Logotipo da Clínica
                </label>
                <div className="flex items-center gap-4">
                  {clinic.logoUrl ? (
                    <img
                      src={clinic.logoUrl}
                      alt="Logo"
                      className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-xs"
                    />
                  ) : (
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-xs transition-colors"
                      style={{ backgroundColor: brandColor }}
                    >
                      <ToothIcon className="w-7 h-7" />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer transition">
                      <Upload className="w-3.5 h-3.5" />
                      Enviar Logo (PNG/JPG)
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>

                    {clinic.logoUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setClinic((prev) => ({ ...prev, logoUrl: null }))
                        }
                        className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-medium"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover logo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nome da Clínica no Painel
                </label>
                <input
                  type="text"
                  value={clinic.name}
                  onChange={(e) =>
                    setClinic((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5"
                />
              </div>

              <div className="space-y-2.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Cor Principal do Painel (Tema da Marca)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {BRAND_PRESETS.map((preset) => {
                    const isSelected =
                      clinic.brandColor.toLowerCase() === preset.color.toLowerCase();
                    return (
                      <button
                        key={preset.color}
                        type="button"
                        onClick={() =>
                          setClinic((prev) => ({ ...prev, brandColor: preset.color }))
                        }
                        className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-medium transition ${
                          isSelected
                            ? 'border-slate-900 bg-slate-50 font-semibold'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full shrink-0"
                          style={{ backgroundColor: preset.color }}
                        />
                        <span className="truncate">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) =>
                      setClinic((prev) => ({ ...prev, brandColor: e.target.value }))
                    }
                    className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer"
                  />
                  <span className="text-xs text-slate-500">
                    Ou escolha qualquer cor ({brandColor.toUpperCase()})
                  </span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Comportamento da Recepcionista IA ({clinic.aiAssistantName})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Regras comerciais e operacionais que a IA segue no WhatsApp.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nome da Assistente Virtual
                  </label>
                  <input
                    type="text"
                    value={clinic.aiAssistantName}
                    onChange={(e) =>
                      setClinic((prev) => ({ ...prev, aiAssistantName: e.target.value }))
                    }
                    className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Endereço da Clínica
                  </label>
                  <input
                    type="text"
                    value={clinic.address}
                    onChange={(e) =>
                      setClinic((prev) => ({ ...prev, address: e.target.value }))
                    }
                    className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Convênios Odontológicos Aceitos
                </label>
                <input
                  type="text"
                  value={clinic.acceptedInsurances.join(', ')}
                  onChange={(e) =>
                    setClinic((prev) => ({
                      ...prev,
                      acceptedInsurances: e.target.value.split(',').map((s) => s.trim()),
                    }))
                  }
                  className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Instruções Específicas da Clínica (Prompt da IA)
                </label>
                <textarea
                  rows={4}
                  value={clinic.aiCustomRules}
                  onChange={(e) =>
                    setClinic((prev) => ({ ...prev, aiCustomRules: e.target.value }))
                  }
                  className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSaveSettings}
                  style={{ backgroundColor: brandColor }}
                  className="px-6 py-2.5 rounded-xl hover:opacity-95 text-white text-xs font-semibold shadow-sm transition"
                >
                  Salvar Identidade & Configurações
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =========================================================
          MODAL BLOCO 8: CONEXÃO WHATSAPP VIA QR CODE
      ========================================================= */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" style={{ color: brandColor }} />
                <h3 className="font-bold text-base text-slate-900">
                  WhatsApp da Clínica
                </h3>
              </div>
              <button
                onClick={() => setIsQrModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {qrStep === 'CONNECTED' ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-slate-900">
                    WhatsApp Real Conectado!
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Conectado ao número <strong>{connectedWhatsAppPhone || clinic.phone}</strong>. A assistente <strong>{clinic.aiAssistantName}</strong> já está pronta para responder!
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-100 text-left text-xs text-sky-900 space-y-1">
                  <strong>💡 Como testar no seu celular agora:</strong>
                  <p>
                    Envie uma mensagem para <strong>você mesmo</strong> no WhatsApp (ou peça para alguém te mandar) dizendo: <em>&quot;Oi Sofia, queria ver horário de limpeza&quot;</em>!
                  </p>
                </div>
                <div className="pt-2 flex justify-center gap-3">
                  <button
                    onClick={handleDisconnectRealWhatsApp}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    Desconectar / Gerar Novo QR Code
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Abra o WhatsApp no seu celular, vá em <strong>Aparelhos Conectados &gt; Conectar um Aparelho</strong> e aponte a câmera para o QR Code real abaixo:
                </p>

                {/* QR Code Real Gerado pelo Baileys */}
                <div className="flex flex-col items-center justify-center p-5 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <div className="w-56 h-56 bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-center relative">
                    {realQrCodeUrl ? (
                      <img
                        src={realQrCodeUrl}
                        alt="WhatsApp QR Code Real"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 text-center p-4">
                        <RefreshCw
                          className="w-7 h-7 animate-spin"
                          style={{ color: brandColor }}
                        />
                        <span className="text-xs font-semibold text-slate-600">
                          Gerando QR Code Oficial do WhatsApp...
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-emerald-700 mt-2.5">
                    🔒 Filtro de segurança ativo: ignora grupos e conversas pessoais sem palavras odontológicas
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL CADASTRAR NOVO PROFISSIONAL (DENTISTA) */}
      {isDentistModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4" style={{ color: brandColor }} />
                <h3 className="font-bold text-sm text-slate-900">
                  Cadastrar Novo Profissional
                </h3>
              </div>
              <button
                onClick={() => setIsDentistModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDentist} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome do(a) Dentista
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Dr. Carlos Eduardo"
                  value={dentistForm.name}
                  onChange={(e) =>
                    setDentistForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Registro CRO
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: SP-102938"
                  value={dentistForm.cro}
                  onChange={(e) =>
                    setDentistForm((prev) => ({ ...prev, cro: e.target.value }))
                  }
                  className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Especialidade Principal
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Implantodontia, Ortodontia, Clínica Geral"
                  value={dentistForm.specialty}
                  onChange={(e) =>
                    setDentistForm((prev) => ({ ...prev, specialty: e.target.value }))
                  }
                  className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Cor de Identificação na Agenda
                </label>
                <div className="flex items-center gap-2">
                  {BRAND_PRESETS.map((preset) => (
                    <button
                      key={preset.color}
                      type="button"
                      onClick={() =>
                        setDentistForm((prev) => ({ ...prev, color: preset.color }))
                      }
                      className={`w-7 h-7 rounded-full border-2 transition ${
                        dentistForm.color === preset.color
                          ? 'border-slate-900 scale-110'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: preset.color }}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                style={{ backgroundColor: brandColor }}
                className="w-full py-2.5 rounded-xl hover:opacity-95 text-white text-xs font-semibold shadow-sm mt-2"
              >
                Salvar Profissional
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NOVO AGENDAMENTO */}
      {isBookingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Novo Agendamento</h3>
              <button
                onClick={() => setIsBookingModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateManualAppointment} className="space-y-3">
              <input
                type="text"
                required
                placeholder="Nome completo do paciente"
                value={bookingForm.patientName}
                onChange={(e) =>
                  setBookingForm((prev) => ({ ...prev, patientName: e.target.value }))
                }
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2"
              />
              <input
                type="text"
                required
                placeholder="WhatsApp (Ex: 11 99999-9999)"
                value={bookingForm.patientPhone}
                onChange={(e) =>
                  setBookingForm((prev) => ({ ...prev, patientPhone: e.target.value }))
                }
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2"
              />
              <select
                value={bookingForm.dentistId}
                onChange={(e) =>
                  setBookingForm((prev) => ({ ...prev, dentistId: e.target.value }))
                }
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2 bg-white"
              >
                {clinic.dentists.length === 0 ? (
                  <option value="">Plantonista da Clínica (Sem profissional cadastrado)</option>
                ) : (
                  clinic.dentists.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.specialty})
                    </option>
                  ))
                )}
              </select>
              <select
                value={bookingForm.procedureId}
                onChange={(e) =>
                  setBookingForm((prev) => ({ ...prev, procedureId: e.target.value }))
                }
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2 bg-white"
              >
                {clinic.procedures.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.durationMinutes} min)
                  </option>
                ))}
              </select>
              <select
                value={bookingForm.startTime}
                onChange={(e) =>
                  setBookingForm((prev) => ({ ...prev, startTime: e.target.value }))
                }
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2 bg-white"
              >
                {['09:00', '10:30', '13:30', '15:00', '17:00'].map((t) => (
                  <option key={t} value={t}>
                    Horário livre: {t}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                style={{ backgroundColor: brandColor }}
                className="w-full py-2.5 rounded-xl hover:opacity-95 text-white text-xs font-semibold shadow-sm"
              >
                Confirmar Agendamento
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
