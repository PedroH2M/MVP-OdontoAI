import { generateText, CoreMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import {
  prisma,
  SenderType,
  ConversationStatus,
  UrgencyLevel,
} from '@odonto-ai/database';
import { env } from '../../config/env.js';
import { buildDentalReceptionistSystemPrompt, PromptContext } from './prompt-builder.js';
import { createDentalAgentTools } from './agent-tools.js';
import { slotCalculatorService, appointmentBookingService } from '../scheduling/index.js';
import { whatsAppProvider, DebouncedConversationJob } from '../whatsapp/index.js';

export class DentalAgentService {
  /**
   * Processa a mensagem consolidada do paciente (após o Debounce de 6s),
   * executa Tools de agenda ou Handoff e envia a resposta no WhatsApp.
   */
  async processConsolidatedMessage(
    payload: DebouncedConversationJob & { consolidatedMessage: string }
  ): Promise<string> {
    const { clinicId, conversationId, patientId, patientPhone, consolidatedMessage } = payload;

    // 1. Hidratação paralela de contexto (Clínica, Dentistas, Procedimentos, Paciente, Consultas, Histórico)
    const [clinic, dentists, procedures, patient, upcomingAppointments, recentMessages] =
      await Promise.all([
        prisma.clinic.findUniqueOrThrow({ where: { id: clinicId } }),
        prisma.dentist.findMany({ where: { clinicId, isActive: true } }),
        prisma.procedure.findMany({ where: { clinicId, allowAiBooking: true } }),
        prisma.patient.findUniqueOrThrow({ where: { id: patientId } }),
        appointmentBookingService.getUpcomingPatientAppointments(clinicId, patientPhone),
        prisma.message.findMany({
          where: { conversationId },
          orderBy: { createdAt: 'desc' },
          take: 16,
        }),
      ]);

    const promptContext: PromptContext = {
      clinic,
      dentists,
      procedures,
      patient,
      upcomingAppointments,
    };

    let aiReplyText: string;

    // 2. Verifica se há chave Gratuita da Groq (gsk_...) ou da OpenAI (sk-...)
    const hasGroqKey =
      Boolean(env.GROQ_API_KEY) &&
      env.GROQ_API_KEY !== 'gsk_...' &&
      env.GROQ_API_KEY!.startsWith('gsk_');

    const hasOpenAiKey =
      Boolean(env.OPENAI_API_KEY) &&
      env.OPENAI_API_KEY !== 'sk-...' &&
      env.OPENAI_API_KEY!.startsWith('sk-');

    if (hasGroqKey || hasOpenAiKey) {
      aiReplyText = await this.runCloudLlmAgent(
        promptContext,
        { clinicId, conversationId, patientId, patientPhone },
        recentMessages.reverse(),
        hasGroqKey ? 'groq' : 'openai'
      );
    } else {
      aiReplyText = await this.runZeroCostLocalFallbackAgent(
        promptContext,
        conversationId,
        consolidatedMessage
      );
    }

    // 3. Salva a resposta da IA no histórico do banco
    await prisma.message.create({
      data: {
        conversationId,
        sender: SenderType.AI,
        content: aiReplyText,
        mediaType: 'text',
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    // 4. Dispara no WhatsApp (com simulação de "digitando...")
    if (clinic.whatsappInstanceId) {
      await whatsAppProvider.sendTextMessage({
        instanceId: clinic.whatsappInstanceId,
        phone: patientPhone,
        text: aiReplyText,
        simulateTyping: true,
      });
    }

    return aiReplyText;
  }

  /**
   * Executa o Agente Oficial usando:
   * - Groq Cloud Gratuito (llama-3.3-70b-versatile) OU
   * - OpenAI (gpt-4o-mini)
   */
  private async runCloudLlmAgent(
    promptContext: PromptContext,
    toolCtx: {
      clinicId: string;
      conversationId: string;
      patientId: string;
      patientPhone: string;
    },
    chronologicalMessages: { sender: SenderType; content: string }[],
    providerType: 'groq' | 'openai'
  ): Promise<string> {
    const systemPrompt = buildDentalReceptionistSystemPrompt(promptContext);
    const tools = createDentalAgentTools(toolCtx);

    const messages: CoreMessage[] = chronologicalMessages.map((m) => ({
      role: m.sender === SenderType.PATIENT ? 'user' : 'assistant',
      content: m.content,
    }));

    const aiProvider =
      providerType === 'groq'
        ? createOpenAI({
            baseURL: 'https://api.groq.com/openai/v1',
            apiKey: env.GROQ_API_KEY,
          })
        : createOpenAI({
            apiKey: env.OPENAI_API_KEY,
          });

    const modelId =
      providerType === 'groq' ? 'openai/gpt-oss-120b' : 'gpt-4o-mini';

    const result = await generateText({
      model: aiProvider(modelId),
      system: systemPrompt,
      messages,
      tools,
      maxSteps: 5,
      temperature: 0.3,
    });

    return (
      result.text?.trim() ||
      'Perfeito! Atualizei seu atendimento aqui no sistema. Posso ajudar em algo mais?'
    );
  }

  /**
   * Motor Determinístico Local (Custo Zero Offline)
   */
  private async runZeroCostLocalFallbackAgent(
    ctx: PromptContext,
    conversationId: string,
    userText: string
  ): Promise<string> {
    const lower = userText.toLowerCase();

    if (
      lower.includes('dor') ||
      lower.includes('doendo') ||
      lower.includes('sangr') ||
      lower.includes('inchad') ||
      lower.includes('urgente') ||
      lower.includes('quebr') ||
      lower.includes('atendente') ||
      lower.includes('humano')
    ) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          status: ConversationStatus.WAITING_HUMAN,
          urgency: UrgencyLevel.HIGH,
          handoffReason: `Alerta automático: Paciente relatou "${userText.slice(0, 120)}"`,
        },
      });

      return `Sinto muito por isso, ${ctx.patient.name.split(' ')[0]}! 🚨 Como você relatou um caso prioritário, já transferi sua conversa com urgência máxima para nossa recepção humana. Nossa atendente vai assumir daqui em instantes para te encaixar!`;
    }

    const timeMatch = lower.match(/\b([01]?\d|2[0-3])(?::([0-5]\d)|h([0-5]\d)?)\b/);
    if (
      timeMatch &&
      (lower.includes('agendar') ||
        lower.includes('marcar') ||
        lower.includes('pode ser') ||
        lower.includes('quero') ||
        lower.includes('horário') ||
        timeMatch[0])
    ) {
      const hour = timeMatch[1].padStart(2, '0');
      const minute = (timeMatch[2] || timeMatch[3] || '00').padStart(2, '0');
      const requestedTime = `${hour}:${minute}`;

      const targetDate = this.getNextBusinessDayString();
      const defaultProcedure = ctx.procedures[0];
      const defaultDentist = ctx.dentists[0];

      if (defaultProcedure && defaultDentist) {
        try {
          const appt = await appointmentBookingService.bookAppointment({
            clinicId: ctx.clinic.id,
            patientName: ctx.patient.name,
            patientPhone: ctx.patient.phone,
            dentistId: defaultDentist.id,
            procedureId: defaultProcedure.id,
            date: targetDate,
            startTime: requestedTime,
            bookedByAi: true,
            notes: 'Agendado pelo Motor Inteligente no WhatsApp',
          });

          const formattedDate = appt.startTime.toLocaleDateString('pt-BR');
          return `Prontinho, ${ctx.patient.name.split(' ')[0]}! ✅ Sua consulta para *${appt.procedure.name}* com *${appt.dentist.name}* foi agendada com sucesso para o dia *${formattedDate} às ${requestedTime}*.\n\nEstamos localizados em: ${ctx.clinic.address}. Enviaremos um lembrete 24h antes!`;
        } catch {
          // Segue para sugestão de horários livres
        }
      }
    }

    const targetDate = this.getNextBusinessDayString();
    const defaultProcedure = ctx.procedures[0];

    if (defaultProcedure) {
      const slots = await slotCalculatorService.getAvailableSlots({
        clinicId: ctx.clinic.id,
        date: targetDate,
        procedureId: defaultProcedure.id,
      });

      const sampleSlots = slots.slice(0, 4).map((s) => `${s.startTime} (${s.dentistName})`);
      const [yyyy, mm, dd] = targetDate.split('-');

      return `Olá, ${ctx.patient.name.split(' ')[0]}! 😊 Aqui é a ${ctx.clinic.aiAssistantName}, assistente virtual da *${ctx.clinic.name}*.\n\nNós atendemos os convênios: *${ctx.clinic.acceptedInsurances.join(', ')}*. Consultei nossa agenda em tempo real para *${dd}/${mm}/${yyyy}* e temos estes horários livres:\n• ${sampleSlots.join('\n• ')}\n\nQual horário fica melhor para você? (Basta responder com o horário, ex: "Pode ser às 09:00")`;
    }

    return `Olá! Aqui é a ${ctx.clinic.aiAssistantName} da ${ctx.clinic.name}. Como posso ajudar com seu sorriso hoje?`;
  }

  private getNextBusinessDayString(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    if (d.getDay() === 6) d.setDate(d.getDate() + 2);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}

export const dentalAgentService = new DentalAgentService();
