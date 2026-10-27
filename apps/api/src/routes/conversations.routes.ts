import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma, ConversationStatus, SenderType, UrgencyLevel } from '@odonto-ai/database';
import { whatsAppProvider } from '../modules/whatsapp/index.js';

export async function conversationsRoutes(app: FastifyInstance) {
  /**
   * Lista todas as conversas da clínica, priorizando quem precisa de Atenção Humana no topo
   */
  app.get<{ Params: { clinicId: string } }>(
    '/api/clinics/:clinicId/conversations',
    async (request) => {
      const { clinicId } = request.params;

      const conversations = await prisma.conversation.findMany({
        where: { clinicId },
        include: {
          patient: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: [{ lastMessageAt: 'desc' }],
      });

      // Ordena colocando WAITING_HUMAN + HIGH urgency sempre em primeiro lugar para a secretária
      return conversations.sort((a, b) => {
        const aWaiting = a.status === ConversationStatus.WAITING_HUMAN ? 1 : 0;
        const bWaiting = b.status === ConversationStatus.WAITING_HUMAN ? 1 : 0;
        if (aWaiting !== bWaiting) return bWaiting - aWaiting;

        const aHigh = a.urgency === UrgencyLevel.HIGH ? 1 : 0;
        const bHigh = b.urgency === UrgencyLevel.HIGH ? 1 : 0;
        if (aHigh !== bHigh) return bHigh - aHigh;

        return b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
      });
    }
  );

  /**
   * Carrega o histórico completo de mensagens de uma conversa específica
   */
  app.get<{ Params: { clinicId: string; conversationId: string } }>(
    '/api/clinics/:clinicId/conversations/:conversationId/messages',
    async (request, reply) => {
      const { clinicId, conversationId } = request.params;

      const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, clinicId },
        include: {
          patient: {
            include: {
              appointments: {
                include: { dentist: true, procedure: true },
                orderBy: { startTime: 'desc' },
                take: 3,
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!conversation) {
        return reply.status(404).send({ error: 'Conversa não encontrada.' });
      }

      return conversation;
    }
  );

  /**
   * Botão "Assumir Atendimento": Pausa a IA imediatamente e passa o controle para a secretária
   */
  app.post<{ Params: { clinicId: string; conversationId: string } }>(
    '/api/clinics/:clinicId/conversations/:conversationId/takeover',
    async (request) => {
      const { conversationId } = request.params;
      const pauseUntil = new Date(Date.now() + 8 * 60 * 60 * 1000); // Pausa por 8h ou até reativar

      return prisma.conversation.update({
        where: { id: conversationId },
        data: {
          status: ConversationStatus.HUMAN_HANDLING,
          botPausedUntil: pauseUntil,
        },
      });
    }
  );

  /**
   * Botão "Devolver para a IA": Reativa o atendimento automático da Sofia naquela conversa
   */
  app.post<{ Params: { clinicId: string; conversationId: string } }>(
    '/api/clinics/:clinicId/conversations/:conversationId/reactivate-ai',
    async (request) => {
      const { conversationId } = request.params;

      return prisma.conversation.update({
        where: { id: conversationId },
        data: {
          status: ConversationStatus.AI_HANDLING,
          urgency: UrgencyLevel.NORMAL,
          handoffReason: null,
          botPausedUntil: null,
        },
      });
    }
  );

  /**
   * Envio de mensagem pela Secretária Humana direto pelo Painel Web
   */
  app.post<{ Params: { clinicId: string; conversationId: string } }>(
    '/api/clinics/:clinicId/conversations/:conversationId/send',
    async (request, reply) => {
      const { clinicId, conversationId } = request.params;
      const schema = z.object({
        content: z.string().min(1),
      });

      const { content } = schema.parse(request.body);

      const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, clinicId },
        include: { clinic: true, patient: true },
      });

      if (!conversation) {
        return reply.status(404).send({ error: 'Conversa não encontrada.' });
      }

      // Garante que a conversa fique marcada como HUMAN_HANDLING para a IA não interromper
      const pauseUntil = new Date(Date.now() + 4 * 60 * 60 * 1000);
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          status: ConversationStatus.HUMAN_HANDLING,
          botPausedUntil: pauseUntil,
          lastMessageAt: new Date(),
        },
      });

      const message = await prisma.message.create({
        data: {
          conversationId,
          sender: SenderType.HUMAN_STAFF,
          content,
          mediaType: 'text',
        },
      });

      if (conversation.clinic.whatsappInstanceId) {
        await whatsAppProvider.sendTextMessage({
          instanceId: conversation.clinic.whatsappInstanceId,
          phone: conversation.patient.phone,
          text: content,
          simulateTyping: false,
        });
      }

      return message;
    }
  );
}
