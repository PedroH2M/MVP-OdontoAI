import { prisma, ConversationStatus, SenderType } from '@odonto-ai/database';
import { whatsAppProvider } from './whatsapp.provider.js';
import { audioTranscriptionService } from './audio-transcription.service.js';
import { messageBufferService } from './message-buffer.service.js';

/**
 * Formato normalizado de payload vindo da Evolution API (ou Simulador do Painel)
 */
export interface IncomingWhatsAppWebhookPayload {
  instanceId: string;
  remoteJid: string;        // Ex: "5511988881111@s.whatsapp.net"
  fromMe: boolean;          // true se foi enviado pelo celular da clínica
  pushName?: string;        // Nome no perfil do WhatsApp
  messageId: string;
  messageType: 'text' | 'audio' | 'image' | 'other';
  textContent?: string;
  audioBase64?: string;
  sentByAiDispatcher?: boolean; // Flag interna para diferenciar IA da secretária humana
  customDebounceMs?: number;
}

export class WhatsAppWebhookHandler {
  /**
   * Processa qualquer evento de mensagem recebido no WhatsApp da clínica
   */
  async handleIncomingWebhook(payload: IncomingWhatsAppWebhookPayload) {
    // 1. Ignora grupos e status do WhatsApp
    if (
      payload.remoteJid.includes('@g.us') ||
      payload.remoteJid.includes('status@broadcast')
    ) {
      return { ignored: true, reason: 'group_or_broadcast' };
    }

    const cleanPhone = payload.remoteJid.replace(/@.*$/, '').replace(/\D/g, '');

    // 2. Localiza a clínica dona desta instância de WhatsApp
    const clinic = await prisma.clinic.findFirst({
      where: { whatsappInstanceId: payload.instanceId },
    });

    if (!clinic) {
      return { ignored: true, reason: 'clinic_not_found' };
    }

    // 3. Garante que o Paciente e a Conversa existam no banco
    const patient = await prisma.patient.upsert({
      where: {
        clinicId_phone: {
          clinicId: clinic.id,
          phone: cleanPhone,
        },
      },
      update: {},
      create: {
        clinicId: clinic.id,
        name: payload.pushName || `Paciente (${cleanPhone.slice(-4)})`,
        phone: cleanPhone,
      },
    });

    const conversation = await prisma.conversation.upsert({
      where: {
        clinicId_patientId: {
          clinicId: clinic.id,
          patientId: patient.id,
        },
      },
      update: {
        lastMessageAt: new Date(),
      },
      create: {
        clinicId: clinic.id,
        patientId: patient.id,
        status: ConversationStatus.AI_HANDLING,
      },
    });

    // 4. DETECÇÃO AUTOMÁTICA DE HUMANO:
    // Se a secretária pegou o celular da clínica e respondeu manualmente (fromMe = true e não veio da IA),
    // pausamos o robô automaticamente para ela conversar em paz!
    if (payload.fromMe) {
      if (!payload.sentByAiDispatcher) {
        const pauseUntil = new Date(Date.now() + 4 * 60 * 60 * 1000); // Pausa automática de 4h
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            status: ConversationStatus.HUMAN_HANDLING,
            botPausedUntil: pauseUntil,
          },
        });

        if (payload.textContent) {
          await prisma.message.create({
            data: {
              conversationId: conversation.id,
              sender: SenderType.HUMAN_STAFF,
              content: payload.textContent,
              mediaType: 'text',
            },
          });
        }
      }
      return { handled: true, mode: 'human_staff_message_recorded' };
    }

    // 5. Se for Áudio do paciente, baixa e transcreve via Whisper
    let finalContent = payload.textContent?.trim() || '';
    if (payload.messageType === 'audio') {
      const base64 =
        payload.audioBase64 ||
        (await whatsAppProvider.downloadMediaBase64(payload.instanceId, payload.messageId));

      if (base64) {
        finalContent = await audioTranscriptionService.transcribeBase64Audio(base64);
      } else {
        finalContent = '[Paciente enviou um áudio]';
      }
    }

    if (!finalContent) {
      return { ignored: true, reason: 'empty_message' };
    }

    // 6. Salva a mensagem do paciente no histórico do Postgres (aparece na hora no Painel Web)
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: SenderType.PATIENT,
        content: finalContent,
        mediaType: payload.messageType,
      },
    });

    // 7. Verifica se o Bot está ativo na clínica e se a conversa não está com a secretária humana
    if (!clinic.isBotActive) {
      return { handled: true, mode: 'clinic_bot_disabled' };
    }

    const isPausedForHuman =
      conversation.status === ConversationStatus.WAITING_HUMAN ||
      (conversation.status === ConversationStatus.HUMAN_HANDLING &&
        (!conversation.botPausedUntil || conversation.botPausedUntil > new Date()));

    if (isPausedForHuman) {
      return { handled: true, mode: 'waiting_or_handled_by_human' };
    }

    // Se a pausa temporária já expirou, reativa o status para AI_HANDLING
    if (conversation.status === ConversationStatus.HUMAN_HANDLING) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: ConversationStatus.AI_HANDLING, botPausedUntil: null },
      });
    }

    // 8. Enfileira no Buffer com Debounce de 6 segundos antes de acionar o Agente de IA
    await messageBufferService.enqueuePatientMessage(
      {
        clinicId: clinic.id,
        conversationId: conversation.id,
        patientId: patient.id,
        patientPhone: cleanPhone,
      },
      finalContent,
      payload.customDebounceMs
    );

    return {
      handled: true,
      mode: 'queued_for_ai_debounce',
      conversationId: conversation.id,
    };
  }
}

export const whatsAppWebhookHandler = new WhatsAppWebhookHandler();
