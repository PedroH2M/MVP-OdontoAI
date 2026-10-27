import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  WASocket,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import path from 'path';
import fs from 'fs';

export interface LiveWhatsAppMessage {
  id: string;
  sender: 'PATIENT' | 'AI' | 'HUMAN_STAFF';
  content: string;
  mediaType: string;
  createdAt: string;
}

export interface LiveWhatsAppConversation {
  id: string;
  remoteJid: string;
  status: 'AI_HANDLING' | 'WAITING_HUMAN' | 'HUMAN_HANDLING';
  urgency: 'NORMAL' | 'HIGH';
  handoffReason: string | null;
  lastMessageAt: string;
  patient: {
    id: string;
    name: string;
    phone: string;
    insuranceName: string;
  };
  messages: LiveWhatsAppMessage[];
}

export interface LiveWhatsAppAppointment {
  id: string;
  startTime: string;
  endTime: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  bookedByAi: boolean;
  reminderSent: boolean;
  patient: {
    id: string;
    name: string;
    phone: string;
    insuranceName: string;
  };
  dentistName: string;
  procedureName: string;
}

type AiReplyGenerator = (input: {
  patientName: string;
  patientPhone: string;
  messageHistory: { sender: 'PATIENT' | 'AI' | 'HUMAN_STAFF'; content: string }[];
  newMessage: string;
}) => Promise<{
  bubbles: string[];
  bookedAction: {
    time: string;
    dentistName: string;
    procedureName: string;
    contactPhone: string;
  } | null;
  cancelledAction: {
    reason: string;
    contactPhone: string;
  } | null;
  handoffAction: {
    reason: string;
    urgency: 'HIGH' | 'NORMAL';
  } | null;
}>;

class BaileysSessionService {
  private sock: WASocket | null = null;
  private status: 'DISCONNECTED' | 'CONNECTING' | 'QRCODE' | 'CONNECTED' = 'DISCONNECTED';
  private qrCodeDataUrl: string | null = null;
  private connectedPhone: string | null = null;
  private isInitializing = false;
  private aiGenerator: AiReplyGenerator | null = null;

  // Guarda conversas e agendamentos reais vindos do WhatsApp conectado
  public liveConversations = new Map<string, LiveWhatsAppConversation>();
  public liveAppointments: LiveWhatsAppAppointment[] = [];
  private activeTestJids = new Set<string>();
  private sentMessageIds = new Set<string>();

  constructor() {
    // Se já houver sessão salva em baileys_auth_info, reconecta automaticamente ao iniciar o servidor
    const credsFile = path.resolve(process.cwd(), 'baileys_auth_info', 'creds.json');
    if (fs.existsSync(credsFile)) {
      setTimeout(() => {
        this.startSession().catch(() => {});
      }, 800);
    }
  }

  registerAiGenerator(fn: AiReplyGenerator) {
    this.aiGenerator = fn;
  }

  getState() {
    return {
      status: this.status,
      qrCodeDataUrl: this.qrCodeDataUrl,
      connectedPhone: this.connectedPhone,
      conversations: Array.from(this.liveConversations.values()),
      appointments: this.liveAppointments,
    };
  }

  async startSession(): Promise<{
    status: string;
    qrCodeDataUrl: string | null;
    connectedPhone: string | null;
  }> {
    if (this.status === 'CONNECTED' || this.isInitializing) {
      return {
        status: this.status,
        qrCodeDataUrl: this.qrCodeDataUrl,
        connectedPhone: this.connectedPhone,
      };
    }

    this.isInitializing = true;
    this.status = 'CONNECTING';

    try {
      const authFolder = path.resolve(process.cwd(), 'baileys_auth_info');
      const { state, saveCreds } = await useMultiFileAuthState(authFolder);
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }) as any,
        printQRInTerminal: false,
        browser: ['OdontoAI Painel', 'Chrome', '1.0.0'],
      });

      this.sock = sock;

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.status = 'QRCODE';
          this.qrCodeDataUrl = await QRCode.toDataURL(qr, {
            width: 280,
            margin: 1,
          });
        }

        if (connection === 'open') {
          this.status = 'CONNECTED';
          this.qrCodeDataUrl = null;
          this.connectedPhone = sock.user?.id?.split(':')[0] || 'Conectado';
          console.log(`✅ [WhatsApp Real] Conectado com sucesso no número: ${this.connectedPhone}`);
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          this.status = 'DISCONNECTED';
          this.qrCodeDataUrl = null;
          this.sock = null;

          if (shouldReconnect) {
            setTimeout(() => this.startSession(), 3000);
          } else {
            // Limpa pasta de sessão caso tenha desconectado pelo celular
            const authPath = path.resolve(process.cwd(), 'baileys_auth_info');
            if (fs.existsSync(authPath)) {
              fs.rmSync(authPath, { recursive: true, force: true });
            }
          }
        }
      });

      // Escuta mensagens reais do WhatsApp!
      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
          if (!msg.key?.remoteJid || !msg.message) continue;

          const remoteJid = msg.key.remoteJid;
          const msgId = msg.key.id || '';

          // 1. Ignora Grupos, Status e mensagens que o próprio Bot acabou de enviar
          if (
            remoteJid.endsWith('@g.us') ||
            remoteJid.includes('broadcast') ||
            remoteJid.includes('@newsletter') ||
            this.sentMessageIds.has(msgId)
          ) {
            continue;
          }

          // Extrai texto mesmo se o WhatsApp do cliente estiver com "Mensagens Temporárias" (ephemeralMessage) ativo
          const innerMsg =
            msg.message.ephemeralMessage?.message ||
            msg.message.viewOnceMessage?.message ||
            msg.message.documentWithCaptionMessage?.message ||
            msg.message;

          const text =
            innerMsg?.conversation ||
            innerMsg?.extendedTextMessage?.text ||
            innerMsg?.imageMessage?.caption ||
            '';

          if (!text.trim()) continue;

          const cleanPhone = remoteJid.replace(/@.*$/, '');
          const ownPhone = this.connectedPhone || '';
          const ownLid = (sock.user as any)?.lid?.split(':')[0] || '';

          const isSelfChat =
            (ownPhone && remoteJid.includes(ownPhone)) ||
            (ownLid && remoteJid.includes(ownLid));

          const lower = text.toLowerCase();
          const hasExplicitTrigger =
            lower.includes('sofia') ||
            lower.includes('consulta') ||
            lower.includes('dentista') ||
            lower.includes('limpeza') ||
            lower.includes('horário') ||
            lower.includes('horario') ||
            lower.includes('agendar') ||
            lower.includes('marcar') ||
            lower.includes('cancelar') ||
            lower.includes('dente') ||
            lower.includes('dor') ||
            lower.includes('clínica') ||
            lower.includes('clinica') ||
            lower.includes('avaliação');

          console.log(
            `📩 [WhatsApp Real] De: ${remoteJid} | fromMe: ${msg.key.fromMe} | Texto: "${text}"`
          );

          // Se a mensagem partiu do próprio aparelho conectado (fromMe = true),
          // só aciona a IA se for conversa consigo mesmo (Self-Chat) ou tiver palavra-chave de teste
          if (msg.key.fromMe && !isSelfChat && !hasExplicitTrigger) {
            continue;
          }

          this.activeTestJids.add(remoteJid);

          const patientName = msg.pushName || `Cliente (${cleanPhone.slice(-4)})`;
          await this.handleRealIncomingMessage(remoteJid, cleanPhone, patientName, text.trim());
        }
      });
    } catch (err) {
      console.error('[Baileys] Erro ao iniciar sessão:', (err as Error).message);
      this.status = 'DISCONNECTED';
    } finally {
      this.isInitializing = false;
    }

    return {
      status: this.status,
      qrCodeDataUrl: this.qrCodeDataUrl,
      connectedPhone: this.connectedPhone,
    };
  }

  async disconnectSession() {
    try {
      if (this.sock) {
        await this.sock.logout();
      }
    } catch {
      // ignora
    }
    this.sock = null;
    this.status = 'DISCONNECTED';
    this.qrCodeDataUrl = null;
    this.connectedPhone = null;

    const authPath = path.resolve(process.cwd(), 'baileys_auth_info');
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
    }

    return { status: 'DISCONNECTED' };
  }

  /**
   * Permite à Recepcionista Humana enviar mensagem real pelo Painel Web para o celular do paciente
   */
  async sendManualStaffMessage(remoteJid: string, text: string) {
    const conv = this.liveConversations.get(remoteJid);
    if (conv) {
      conv.status = 'HUMAN_HANDLING';
      conv.lastMessageAt = new Date().toISOString();
      conv.messages.push({
        id: `staff-${Date.now()}`,
        sender: 'HUMAN_STAFF',
        content: text,
        mediaType: 'text',
        createdAt: new Date().toISOString(),
      });
    }

    if (this.sock && this.status === 'CONNECTED' && !remoteJid.endsWith('@simulator.local')) {
      const sent = await this.sock.sendMessage(remoteJid, { text });
      if (sent?.key?.id) {
        this.sentMessageIds.add(sent.key.id);
      }
    }
  }

  /**
   * Simulador Standalone (Painel de Teste sem WhatsApp):
   * Processa a mensagem com a IA real, atualiza a agenda e sincroniza com o Painel Principal sem precisar de celular conectado.
   */
  async simulateIncomingMessage(input: {
    phone: string;
    patientName: string;
    insuranceName?: string;
    text: string;
  }) {
    const cleanPhone = input.phone.replace(/\D/g, '') || '11999998888';
    const remoteJid = `sim-${cleanPhone}@simulator.local`;

    let conv = this.liveConversations.get(remoteJid);
    if (!conv) {
      conv = {
        id: `wa-sim-${cleanPhone}`,
        remoteJid,
        status: 'AI_HANDLING',
        urgency: 'NORMAL',
        handoffReason: null,
        lastMessageAt: new Date().toISOString(),
        patient: {
          id: `pat-sim-${cleanPhone}`,
          name: input.patientName || 'Paciente Teste',
          phone: input.phone || '11 99999-8888',
          insuranceName: input.insuranceName || 'Bradesco Dental',
        },
        messages: [],
      };
      this.liveConversations.set(remoteJid, conv);
    } else {
      conv.patient.name = input.patientName || conv.patient.name;
      conv.patient.phone = input.phone || conv.patient.phone;
      if (input.insuranceName) conv.patient.insuranceName = input.insuranceName;
    }

    const historyForAi = conv.messages.map((m) => ({
      sender: m.sender,
      content: m.content,
    }));

    conv.messages.push({
      id: `pat-${Date.now()}`,
      sender: 'PATIENT',
      content: input.text,
      mediaType: 'text',
      createdAt: new Date().toISOString(),
    });
    conv.lastMessageAt = new Date().toISOString();

    if (conv.status !== 'AI_HANDLING' || !this.aiGenerator) {
      return {
        conversation: conv,
        appointments: this.liveAppointments,
        aiResult: null,
      };
    }

    const aiResult = await this.aiGenerator({
      patientName: conv.patient.name,
      patientPhone: conv.patient.phone,
      messageHistory: historyForAi,
      newMessage: input.text,
    });

    if (aiResult.handoffAction) {
      conv.status = 'WAITING_HUMAN';
      conv.urgency = 'HIGH';
      conv.handoffReason = aiResult.handoffAction.reason;
    }

    if (aiResult.cancelledAction) {
      this.liveAppointments = this.liveAppointments.map((a) =>
        a.patient.id === conv!.patient.id || a.patient.phone === conv!.patient.phone
          ? { ...a, status: 'CANCELLED' }
          : a
      );
    }

    if (aiResult.bookedAction) {
      const [hh, mm] = (aiResult.bookedAction.time || '11:00').split(':').map(Number);
      const start = new Date();
      start.setHours(isNaN(hh) ? 11 : hh, isNaN(mm) ? 0 : mm, 0, 0);
      const end = new Date(start.getTime() + 30 * 60000);

      this.liveAppointments.push({
        id: `wa-appt-${Date.now()}`,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        status: 'CONFIRMED',
        bookedByAi: true,
        reminderSent: false,
        patient: {
          ...conv.patient,
          phone: aiResult.bookedAction.contactPhone || conv.patient.phone,
        },
        dentistName: aiResult.bookedAction.dentistName,
        procedureName: aiResult.bookedAction.procedureName,
      });
    }

    for (const bubble of aiResult.bubbles) {
      conv.messages.push({
        id: `ai-${Date.now()}-${Math.random()}`,
        sender: 'AI',
        content: bubble,
        mediaType: 'text',
        createdAt: new Date().toISOString(),
      });
    }

    return {
      conversation: conv,
      appointments: this.liveAppointments,
      aiResult,
    };
  }

  resetSimulation(phone?: string) {
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      const remoteJid = `sim-${cleanPhone}@simulator.local`;
      this.liveConversations.delete(remoteJid);
      this.liveAppointments = this.liveAppointments.filter(
        (a) => !a.patient.id.includes(cleanPhone)
      );
    } else {
      for (const key of Array.from(this.liveConversations.keys())) {
        if (key.endsWith('@simulator.local')) {
          this.liveConversations.delete(key);
        }
      }
      this.liveAppointments = this.liveAppointments.filter(
        (a) => !a.patient.id.startsWith('pat-sim-')
      );
    }
    return this.getState();
  }

  reactivateAiForConversation(remoteJid: string) {
    const conv = this.liveConversations.get(remoteJid);
    if (conv) {
      conv.status = 'AI_HANDLING';
      conv.urgency = 'NORMAL';
      conv.handoffReason = null;
    }
    return conv;
  }

  private async handleRealIncomingMessage(
    remoteJid: string,
    phone: string,
    patientName: string,
    text: string
  ) {
    let conv = this.liveConversations.get(remoteJid);
    if (!conv) {
      conv = {
        id: `wa-${phone}`,
        remoteJid,
        status: 'AI_HANDLING',
        urgency: 'NORMAL',
        handoffReason: null,
        lastMessageAt: new Date().toISOString(),
        patient: {
          id: `pat-${phone}`,
          name: patientName,
          phone,
          insuranceName: 'WhatsApp Real',
        },
        messages: [],
      };
      this.liveConversations.set(remoteJid, conv);
    }

    const historyForAi = conv.messages.map((m) => ({
      sender: m.sender,
      content: m.content,
    }));

    conv.messages.push({
      id: `pat-${Date.now()}`,
      sender: 'PATIENT',
      content: text,
      mediaType: 'text',
      createdAt: new Date().toISOString(),
    });
    conv.lastMessageAt = new Date().toISOString();

    // Se a conversa estiver pausada para humano, não responde com IA
    if (conv.status !== 'AI_HANDLING' || !this.aiGenerator) {
      return;
    }

    try {
      // Simula "digitando..." no WhatsApp real do paciente
      if (this.sock) {
        await this.sock.sendPresenceUpdate('composing', remoteJid);
      }

      const aiResult = await this.aiGenerator({
        patientName: conv.patient.name,
        patientPhone: conv.patient.phone,
        messageHistory: historyForAi,
        newMessage: text,
      });

      if (aiResult.handoffAction) {
        conv.status = 'WAITING_HUMAN';
        conv.urgency = 'HIGH';
        conv.handoffReason = aiResult.handoffAction.reason;
      }

      if (aiResult.cancelledAction) {
        this.liveAppointments = this.liveAppointments.map((a) =>
          a.patient.phone === phone ? { ...a, status: 'CANCELLED' } : a
        );
      }

      if (aiResult.bookedAction) {
        const [hh, mm] = (aiResult.bookedAction.time || '11:00').split(':').map(Number);
        const start = new Date();
        start.setHours(isNaN(hh) ? 11 : hh, isNaN(mm) ? 0 : mm, 0, 0);
        const end = new Date(start.getTime() + 30 * 60000);

        this.liveAppointments.push({
          id: `wa-appt-${Date.now()}`,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          status: 'CONFIRMED',
          bookedByAi: true,
          reminderSent: false,
          patient: {
            ...conv.patient,
            phone: aiResult.bookedAction.contactPhone || phone,
          },
          dentistName: aiResult.bookedAction.dentistName,
          procedureName: aiResult.bookedAction.procedureName,
        });
      }

      // Envia cada balão curto no WhatsApp real com pausa humana
      for (const bubble of aiResult.bubbles) {
        if (this.sock && this.status === 'CONNECTED') {
          const sent = await this.sock.sendMessage(remoteJid, { text: bubble });
          if (sent?.key?.id) {
            this.sentMessageIds.add(sent.key.id);
          }
          console.log(`📤 [WhatsApp Real Enviado -> ${remoteJid}]: "${bubble}"`);
          await new Promise((r) => setTimeout(r, 700));
        }

        conv.messages.push({
          id: `ai-${Date.now()}-${Math.random()}`,
          sender: 'AI',
          content: bubble,
          mediaType: 'text',
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('[Baileys AI] Erro ao responder:', (err as Error).message);
    }
  }
}

export const baileysSessionService = new BaileysSessionService();
