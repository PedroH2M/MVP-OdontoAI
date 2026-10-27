import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  WASocket,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { audioTranscriptionService } from './audio-transcription.service.js';

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

export type AiReplyGenerator = (input: {
  patientName: string;
  patientPhone: string;
  messageHistory: { sender: 'PATIENT' | 'AI' | 'HUMAN_STAFF'; content: string }[];
  newMessage: string;
  occupiedSlots?: { time: string; dentistName: string; patientName: string }[];
  patientActiveAppointment?: { time: string; dentistName: string; procedureName: string } | null;
}) => Promise<{
  provider?: string;
  reply: string;
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

  public liveConversations = new Map<string, LiveWhatsAppConversation>();
  public liveAppointments: LiveWhatsAppAppointment[] = [];
  private activeTestJids = new Set<string>();
  private sentMessageIds = new Set<string>();

  constructor() {
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
    if (
      this.status === 'CONNECTED' ||
      this.status === 'CONNECTING' ||
      this.status === 'QRCODE' ||
      this.isInitializing ||
      this.sock
    ) {
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
        if (this.sock && this.sock !== sock) return;
        const { connection, lastDisconnect, qr } = update;

        if (qr && this.status !== 'CONNECTED') {
          this.status = 'QRCODE';
          this.qrCodeDataUrl = await QRCode.toDataURL(qr, {
            width: 280,
            margin: 1,
          });
        }

        if (connection === 'open') {
          this.sock = sock;
          this.status = 'CONNECTED';
          this.qrCodeDataUrl = null;
          this.connectedPhone = sock.user?.id?.split(':')[0] || 'Conectado';
          console.log(`✅ [WhatsApp Real] Conectado com sucesso no número: ${this.connectedPhone}`);
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const wasAuthenticated = Boolean(this.connectedPhone);
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          this.status = 'DISCONNECTED';
          this.qrCodeDataUrl = null;
          this.sock = null;

          if (shouldReconnect) {
            setTimeout(() => this.startSession(), 3000);
          } else if (wasAuthenticated) {
            this.connectedPhone = null;
            const authPath = path.resolve(process.cwd(), 'baileys_auth_info');
            if (fs.existsSync(authPath)) {
              fs.rmSync(authPath, { recursive: true, force: true });
            }
          }
        }
      });

      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
          if (!msg.key?.remoteJid || !msg.message) continue;

          const remoteJid = msg.key.remoteJid;
          const msgId = msg.key.id || '';

          if (
            remoteJid.endsWith('@g.us') ||
            remoteJid.includes('broadcast') ||
            remoteJid.includes('@newsletter') ||
            this.sentMessageIds.has(msgId)
          ) {
            continue;
          }

          const innerMsg =
            msg.message.ephemeralMessage?.message ||
            msg.message.viewOnceMessage?.message ||
            msg.message.documentWithCaptionMessage?.message ||
            msg.message;

          const audioMsg = innerMsg?.audioMessage;
          let text =
            innerMsg?.conversation ||
            innerMsg?.extendedTextMessage?.text ||
            innerMsg?.imageMessage?.caption ||
            '';
          let mediaType: 'text' | 'audio' = 'text';

          const cleanPhone = remoteJid.replace(/@.*$/, '');
          const ownPhone = this.connectedPhone || '';
          const ownLid = (sock.user as any)?.lid?.split(':')[0] || '';

          const isSelfChat =
            (ownPhone && remoteJid.includes(ownPhone)) ||
            (ownLid && remoteJid.includes(ownLid));

          // Se for mensagem de áudio/voz no WhatsApp Real, baixa o buffer e transcreve via Groq Whisper
          if (audioMsg && !text.trim()) {
            try {
              console.log(`🎤 [WhatsApp Real] Áudio recebido de ${remoteJid}. Baixando e transcrevendo...`);
              const audioBuffer = (await downloadMediaMessage(
                msg,
                'buffer',
                {},
                {
                  logger: pino({ level: 'silent' }) as any,
                  reuploadRequest: sock.updateMediaMessage,
                }
              )) as Buffer;

              const transcription = await audioTranscriptionService.transcribeAudioBuffer(
                audioBuffer,
                audioMsg.mimetype || 'audio/ogg'
              );

              if (transcription.text) {
                text = transcription.text;
                mediaType = 'audio';
                console.log(
                  `✅ [WhatsApp Real - Áudio Transcrito] De: ${remoteJid} | Texto: "${text}"`
                );
              } else {
                console.warn(
                  `⚠️ [WhatsApp Real - Áudio] Não foi possível transcrever (${transcription.error})`
                );
                if (!msg.key.fromMe || isSelfChat || this.activeTestJids.has(remoteJid)) {
                  text = '[Paciente enviou um áudio baixo/inaudível]';
                  mediaType = 'audio';
                }
              }
            } catch (audioErr) {
              console.error(
                '[Baileys Audio] Erro ao baixar/transcrever áudio:',
                (audioErr as Error).message
              );
            }
          }

          if (!text.trim()) continue;

          const lower = text.toLowerCase();
          const hasExplicitTrigger = lower.includes('sofia');

          console.log(
            `📩 [WhatsApp Real] De: ${remoteJid} | fromMe: ${msg.key.fromMe} | Tipo: ${mediaType} | Texto: "${text}"`
          );

          // Se a mensagem foi enviada pelo próprio dono do aparelho (fromMe: true) para outra pessoa,
          // ignora (a menos que seja o chat consigo mesmo "Você mesmo" ou contenha a palavra "sofia")
          if (msg.key.fromMe && !isSelfChat && !hasExplicitTrigger) {
            continue;
          }

          this.activeTestJids.add(remoteJid);

          const patientName = msg.pushName || `Cliente (${cleanPhone.slice(-4)})`;
          await this.handleRealIncomingMessage(
            sock,
            remoteJid,
            cleanPhone,
            patientName,
            text.trim(),
            mediaType
          );
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
   * Aplica travas determinísticas de negócio sobre o resultado da IA:
   * 1. Bloqueio de Duplo Agendamento (Overbooking no mesmo horário/dentista)
   * 2. Bloqueio de Agendamento fora do expediente (08:00 às 18:00)
   * 3. Remarcação inteligente (Substitui consulta ativa anterior do mesmo paciente sem duplicar)
   * 4. Validação de Cancelamento (Só confirma cancelamento se o paciente realmente tinha consulta ativa)
   */
  private applyDeterministicClinicRules(
    conv: LiveWhatsAppConversation,
    aiResult: Awaited<ReturnType<AiReplyGenerator>>
  ) {
    const firstName = conv.patient.name.split(' ')[0];
    const cleanPatientPhone = conv.patient.phone.replace(/\D/g, '');

    if (aiResult.handoffAction) {
      conv.status = 'WAITING_HUMAN';
      conv.urgency = 'HIGH';
      conv.handoffReason = aiResult.handoffAction.reason;
    }

    // Validação Determinística de Cancelamento
    if (aiResult.cancelledAction && !aiResult.bookedAction) {
      const hadActive = this.liveAppointments.some(
        (a) =>
          a.status !== 'CANCELLED' &&
          (a.patient.id === conv.patient.id ||
            a.patient.phone.replace(/\D/g, '') === cleanPatientPhone)
      );

      if (hadActive) {
        this.liveAppointments = this.liveAppointments.map((a) =>
          a.patient.id === conv.patient.id ||
          a.patient.phone.replace(/\D/g, '') === cleanPatientPhone
            ? { ...a, status: 'CANCELLED' }
            : a
        );
      } else {
        // Paciente não tinha consulta ativa! Evita falso positivo
        aiResult.cancelledAction = null;
        const msg1 = `Oi, ${firstName}! Procurei aqui pelo seu número (${conv.patient.phone}) na agenda de hoje e não localizei nenhuma consulta ativa marcada.`;
        const msg2 = `Por acaso você agendou usando outro telefone ou em nome de outra pessoa? Me confirma aqui para eu verificar certinho!`;
        aiResult.bubbles = [msg1, msg2];
        aiResult.reply = `${msg1}\n\n${msg2}`;
      }
    }

    // Validação Determinística de Agendamento / Remarcação
    if (aiResult.bookedAction) {
      const rawTime = aiResult.bookedAction.time || '11:00';
      const [hh, mm] = rawTime.split(':').map(Number);
      const normalizedTime = `${String(isNaN(hh) ? 11 : hh).padStart(2, '0')}:${String(
        isNaN(mm) ? 0 : mm
      ).padStart(2, '0')}`;

      // REGRA 1: Fora do horário de funcionamento (08:00 às 18:00)
      if (isNaN(hh) || hh < 8 || hh >= 18) {
        aiResult.bookedAction = null;
        const msg1 = `Oi, ${firstName}! Nosso horário de atendimento é das 08:00 às 18:00, então às ${rawTime} a clínica está fechada. 😊`;
        const msg2 = `Temos horários disponíveis às 09:00, 10:30, 14:00 ou 16:00. Qual desses fica melhor para você?`;
        aiResult.bubbles = [msg1, msg2];
        aiResult.reply = `${msg1}\n\n${msg2}`;
        return;
      }

      const targetDentist = (aiResult.bookedAction.dentistName || '').trim().toLowerCase();

      // REGRA 2: Verifica se OUTRO paciente já ocupou esse mesmo horário com esse mesmo dentista
      const conflictingAppt = this.liveAppointments.find((a) => {
        if (a.status === 'CANCELLED') return false;
        const isSamePatient =
          a.patient.id === conv.patient.id ||
          a.patient.phone.replace(/\D/g, '') === cleanPatientPhone;
        if (isSamePatient) return false;

        const apptTime = new Date(a.startTime).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const sameTime = apptTime === normalizedTime;
        const sameDentist =
          a.dentistName.toLowerCase().includes(targetDentist) ||
          targetDentist.includes(a.dentistName.toLowerCase());
        return sameTime && sameDentist;
      });

      if (conflictingAppt) {
        const standardSlots = ['09:00', '10:30', '14:00', '16:00'];
        const occupiedForDentist = this.liveAppointments
          .filter(
            (a) =>
              a.status !== 'CANCELLED' &&
              (a.dentistName.toLowerCase().includes(targetDentist) ||
                targetDentist.includes(a.dentistName.toLowerCase()))
          )
          .map((a) =>
            new Date(a.startTime).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })
          );
        const freeSlots = standardSlots.filter((s) => !occupiedForDentist.includes(s));
        const suggestion =
          freeSlots.length > 0 ? freeSlots.slice(0, 2).join(' ou ') : '14:30 ou 16:30';

        const dName = aiResult.bookedAction.dentistName;
        aiResult.bookedAction = null;
        const msg1 = `Ops, ${firstName}! Acabei de checar na agenda e o horário das ${normalizedTime} com ${dName} já foi preenchido hoje. 😅`;
        const msg2 = `Mas ainda tenho vaga livre com ${dName} às ${suggestion}. Algum desses dois horários fica bom para você?`;
        aiResult.bubbles = [msg1, msg2];
        aiResult.reply = `${msg1}\n\n${msg2}`;
        return;
      }

      // REGRA 3: Se o MESMO paciente já tinha um horário ativo hoje, é uma REMARCAÇÃO (cancela o anterior para não duplicar!)
      const previousActiveAppt = this.liveAppointments.find(
        (a) =>
          a.status !== 'CANCELLED' &&
          (a.patient.id === conv.patient.id ||
            a.patient.phone.replace(/\D/g, '') === cleanPatientPhone)
      );

      if (previousActiveAppt) {
        this.liveAppointments = this.liveAppointments.map((a) =>
          a.id === previousActiveAppt.id ? { ...a, status: 'CANCELLED' } : a
        );
      }

      const start = new Date();
      start.setHours(hh, isNaN(mm) ? 0 : mm, 0, 0);
      const end = new Date(start.getTime() + 30 * 60000);
      const savedPhone = aiResult.bookedAction.contactPhone || conv.patient.phone;

      this.liveAppointments.push({
        id: `wa-appt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        status: 'CONFIRMED',
        bookedByAi: true,
        reminderSent: false,
        patient: {
          ...conv.patient,
          phone: savedPhone,
        },
        dentistName: aiResult.bookedAction.dentistName,
        procedureName: aiResult.bookedAction.procedureName,
      });

      // Garante confirmação humanizada em 2 balões + validação do número de contato salvo
      const msg1 = previousActiveAppt
        ? `Prontinho, ${firstName}! Já remarquei sua consulta para hoje às ${normalizedTime} com ${aiResult.bookedAction.dentistName}. ✅`
        : `Prontinho, ${firstName}! Deixei agendada sua consulta (${aiResult.bookedAction.procedureName}) com ${aiResult.bookedAction.dentistName} para hoje às ${normalizedTime}. ✅`;
      const msg2 = `Só para eu deixar salvo certinho na ficha da recepção: seu melhor número para contato é este mesmo (${savedPhone})?`;

      aiResult.bubbles = [msg1, msg2];
      aiResult.reply = `${msg1}\n\n${msg2}`;
    }
  }

  private getSchedulingContextForPatient(conv: LiveWhatsAppConversation) {
    const cleanPhone = conv.patient.phone.replace(/\D/g, '');
    const occupiedSlots = this.liveAppointments
      .filter((a) => a.status !== 'CANCELLED')
      .map((a) => ({
        time: new Date(a.startTime).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        dentistName: a.dentistName,
        patientName: a.patient.name,
      }));

    const existing = this.liveAppointments.find(
      (a) =>
        a.status !== 'CANCELLED' &&
        (a.patient.id === conv.patient.id || a.patient.phone.replace(/\D/g, '') === cleanPhone)
    );

    const patientActiveAppointment = existing
      ? {
          time: new Date(existing.startTime).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          dentistName: existing.dentistName,
          procedureName: existing.procedureName,
        }
      : null;

    return { occupiedSlots, patientActiveAppointment };
  }

  async simulateIncomingMessage(input: {
    phone: string;
    patientName: string;
    insuranceName?: string;
    text?: string;
    mediaType?: 'text' | 'audio';
    audioBase64?: string;
    audioMimeType?: string;
  }) {
    const cleanPhone = input.phone.replace(/\D/g, '') || '11999998888';
    const remoteJid = `sim-${cleanPhone}@simulator.local`;

    let effectiveText = (input.text || '').trim();
    let effectiveMediaType: 'text' | 'audio' = input.mediaType || 'text';

    if (input.audioBase64) {
      effectiveMediaType = 'audio';
      const transcribed = await audioTranscriptionService.transcribeBase64Audio(
        input.audioBase64,
        input.audioMimeType || 'audio/ogg'
      );
      effectiveText = transcribed;
    }

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
      content: m.content.replace(/^🎤 \[Áudio\]: "/, '').replace(/"$/, ''),
    }));

    const displayContent =
      effectiveMediaType === 'audio' ? `🎤 [Áudio]: "${effectiveText}"` : effectiveText;

    conv.messages.push({
      id: `pat-${Date.now()}`,
      sender: 'PATIENT',
      content: displayContent,
      mediaType: effectiveMediaType,
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

    const { occupiedSlots, patientActiveAppointment } = this.getSchedulingContextForPatient(conv);

    const aiResult = await this.aiGenerator({
      patientName: conv.patient.name,
      patientPhone: conv.patient.phone,
      messageHistory: historyForAi,
      newMessage: effectiveText,
      occupiedSlots,
      patientActiveAppointment,
    });

    this.applyDeterministicClinicRules(conv, aiResult);

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
    activeSock: WASocket,
    remoteJid: string,
    phone: string,
    patientName: string,
    text: string,
    mediaType: 'text' | 'audio' = 'text'
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
      content: m.content.replace(/^🎤 \[Áudio\]: "/, '').replace(/"$/, ''),
    }));

    const displayContent = mediaType === 'audio' ? `🎤 [Áudio]: "${text}"` : text;

    conv.messages.push({
      id: `pat-${Date.now()}`,
      sender: 'PATIENT',
      content: displayContent,
      mediaType,
      createdAt: new Date().toISOString(),
    });
    conv.lastMessageAt = new Date().toISOString();

    if (conv.status !== 'AI_HANDLING' || !this.aiGenerator) {
      return;
    }

    const targetSock = activeSock || this.sock;

    try {
      if (targetSock) {
        await targetSock.sendPresenceUpdate('composing', remoteJid);
      }

      const { occupiedSlots, patientActiveAppointment } = this.getSchedulingContextForPatient(conv);

      const aiResult = await this.aiGenerator({
        patientName: conv.patient.name,
        patientPhone: conv.patient.phone,
        messageHistory: historyForAi,
        newMessage: text,
        occupiedSlots,
        patientActiveAppointment,
      });

      this.applyDeterministicClinicRules(conv, aiResult);

      for (const bubble of aiResult.bubbles) {
        if (targetSock) {
          const sent = await targetSock.sendMessage(remoteJid, { text: bubble });
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
