import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma, AppointmentStatus, ConversationStatus, UrgencyLevel } from '@odonto-ai/database';
import { whatsAppProvider } from '../modules/whatsapp/index.js';

export async function dashboardRoutes(app: FastifyInstance) {
  /**
   * Autenticação da Clínica (Login de Recepcionista / Dentista / Admin)
   */
  app.post('/api/auth/login', async (request, reply) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(3),
    });

    const { email } = schema.parse(request.body);
    const clinic = await prisma.clinic.findFirst({
      include: {
        dentists: { where: { isActive: true } },
        procedures: true,
      },
    });

    if (!clinic) {
      return reply.status(404).send({ error: 'Clínica não encontrada.' });
    }

    return {
      user: {
        name: email.split('@')[0],
        email,
        role: 'ADMIN',
      },
      clinic,
    };
  });

  /**
   * Gera ou consulta o QR Code do WhatsApp da Clínica para leitura no Painel
   */
  app.get<{ Params: { clinicId: string } }>(
    '/api/clinics/:clinicId/whatsapp/qrcode',
    async (request, reply) => {
      const { clinicId } = request.params;
      const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });

      if (!clinic) {
        return reply.status(404).send({ error: 'Clínica não encontrada.' });
      }

      const instanceId = clinic.whatsappInstanceId || `clinica-${clinic.slug}`;
      return whatsAppProvider.getInstanceQrCode(instanceId);
    }
  );
  /**
   * Retorna a clínica ativa atual (com dentistas e procedimentos) para inicializar o Painel Web
   */
  app.get('/api/clinics/current', async (_request, reply) => {
    const clinic = await prisma.clinic.findFirst({
      include: {
        dentists: {
          where: { isActive: true },
          include: { workingHours: true },
          orderBy: { name: 'asc' },
        },
        procedures: {
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!clinic) {
      return reply.status(404).send({
        error: 'Nenhuma clínica cadastrada. Execute o seed do banco de dados.',
      });
    }

    return clinic;
  });

  /**
   * Métricas Executivas e Operacionais para o topo do Painel (Foco em ROI e Atenção Humana)
   */
  app.get<{ Params: { clinicId: string } }>(
    '/api/clinics/:clinicId/dashboard',
    async (request) => {
      const { clinicId } = request.params;

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const [
        todayAppointments,
        allAiAppointments,
        waitingHumanConversations,
        activeAiConversationsCount,
      ] = await Promise.all([
        prisma.appointment.findMany({
          where: {
            clinicId,
            startTime: { gte: startOfToday, lte: endOfToday },
            status: { not: AppointmentStatus.CANCELLED },
          },
          include: { procedure: true, patient: true, dentist: true },
          orderBy: { startTime: 'asc' },
        }),
        prisma.appointment.findMany({
          where: {
            clinicId,
            bookedByAi: true,
            status: { not: AppointmentStatus.CANCELLED },
          },
          include: { procedure: true },
        }),
        prisma.conversation.findMany({
          where: {
            clinicId,
            status: ConversationStatus.WAITING_HUMAN,
          },
          include: { patient: true },
          orderBy: { lastMessageAt: 'desc' },
        }),
        prisma.conversation.count({
          where: {
            clinicId,
            status: ConversationStatus.AI_HANDLING,
          },
        }),
      ]);

      // Calcula a receita estimada gerada pelos agendamentos feitos pela IA
      const estimatedAiRevenue = allAiAppointments.reduce((acc, appt) => {
        const price = appt.procedure.price ? Number(appt.procedure.price) : 0;
        return acc + price;
      }, 0);

      const confirmedToday = todayAppointments.filter(
        (a) => a.status === AppointmentStatus.CONFIRMED || a.status === AppointmentStatus.COMPLETED
      ).length;

      const highUrgencyCount = waitingHumanConversations.filter(
        (c) => c.urgency === UrgencyLevel.HIGH
      ).length;

      return {
        metrics: {
          todayAppointmentsCount: todayAppointments.length,
          confirmedTodayCount: confirmedToday,
          bookedByAiTotalCount: allAiAppointments.length,
          estimatedAiRevenue,
          waitingHumanCount: waitingHumanConversations.length,
          highUrgencyCount,
          activeAiConversationsCount,
        },
        todaySchedule: todayAppointments,
        urgentAlerts: waitingHumanConversations,
      };
    }
  );

  /**
   * Atualiza configurações da Clínica e da Recepcionista IA (Chave Geral Liga/Desliga, Regras, Convênios)
   */
  app.patch<{ Params: { clinicId: string } }>(
    '/api/clinics/:clinicId/settings',
    async (request) => {
      const { clinicId } = request.params;
      const bodySchema = z.object({
        name: z.string().optional(),
        logoUrl: z.string().nullable().optional(),
        brandColor: z.string().optional(),
        aiAssistantName: z.string().optional(),
        aiCustomRules: z.string().optional(),
        isBotActive: z.boolean().optional(),
        acceptedInsurances: z.array(z.string()).optional(),
        address: z.string().optional(),
      });

      const data = bodySchema.parse(request.body);

      return prisma.clinic.update({
        where: { id: clinicId },
        data,
      });
    }
  );
}
