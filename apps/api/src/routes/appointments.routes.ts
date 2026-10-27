import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma, AppointmentStatus } from '@odonto-ai/database';
import {
  slotCalculatorService,
  appointmentBookingService,
} from '../modules/scheduling/index.js';
import { appointmentReminderService } from '../modules/ai/index.js';

export async function appointmentsRoutes(app: FastifyInstance) {
  /**
   * Lista agendamentos da clínica por data (YYYY-MM-DD) ou todos os próximos
   */
  app.get<{
    Params: { clinicId: string };
    Querystring: { date?: string; dentistId?: string };
  }>('/api/clinics/:clinicId/appointments', async (request) => {
    const { clinicId } = request.params;
    const { date, dentistId } = request.query;

    let dateFilter = {};
    if (date) {
      const [year, month, day] = date.split('-').map(Number);
      const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
      const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
      dateFilter = {
        startTime: { gte: startOfDay, lte: endOfDay },
      };
    }

    return prisma.appointment.findMany({
      where: {
        clinicId,
        ...(dentistId ? { dentistId } : {}),
        ...dateFilter,
      },
      include: {
        patient: true,
        dentist: true,
        procedure: true,
      },
      orderBy: { startTime: 'asc' },
    });
  });

  /**
   * Consulta horários disponíveis reais usando o Motor Determinístico (Bloco 2)
   */
  app.get<{
    Params: { clinicId: string };
    Querystring: { date: string; procedureId: string; dentistId?: string };
  }>('/api/clinics/:clinicId/slots', async (request, reply) => {
    const { clinicId } = request.params;
    const { date, procedureId, dentistId } = request.query;

    if (!date || !procedureId) {
      return reply
        .status(400)
        .send({ error: 'Os parâmetros date (YYYY-MM-DD) e procedureId são obrigatórios.' });
    }

    const slots = await slotCalculatorService.getAvailableSlots({
      clinicId,
      date,
      procedureId,
      dentistId,
    });

    return {
      date,
      procedureId,
      totalAvailable: slots.length,
      slots,
    };
  });

  /**
   * Cria um novo agendamento pelo Painel da Recepcionista (usando o mesmo Lock Anti-Conflito)
   */
  app.post<{ Params: { clinicId: string } }>(
    '/api/clinics/:clinicId/appointments',
    async (request, reply) => {
      const { clinicId } = request.params;
      const schema = z.object({
        patientName: z.string().min(2),
        patientPhone: z.string().min(8),
        insuranceName: z.string().optional(),
        dentistId: z.string(),
        procedureId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        notes: z.string().optional(),
      });

      try {
        const body = schema.parse(request.body);
        const appointment = await appointmentBookingService.bookAppointment({
          clinicId,
          ...body,
          bookedByAi: false, // Criado manualmente pela secretária no painel
        });
        return reply.status(201).send(appointment);
      } catch (err) {
        return reply.status(400).send({ error: (err as Error).message });
      }
    }
  );

  /**
   * Atualiza o status de uma consulta (Confirmar, Cancelar, Concluir, Falta)
   */
  app.patch<{ Params: { clinicId: string; appointmentId: string } }>(
    '/api/clinics/:clinicId/appointments/:appointmentId/status',
    async (request, reply) => {
      const { clinicId, appointmentId } = request.params;
      const schema = z.object({
        status: z.nativeEnum(AppointmentStatus),
        notes: z.string().optional(),
      });

      try {
        const { status, notes } = schema.parse(request.body);
        const updated = await appointmentBookingService.updateAppointmentStatus(
          clinicId,
          appointmentId,
          status,
          notes
        );
        return updated;
      } catch (err) {
        return reply.status(400).send({ error: (err as Error).message });
      }
    }
  );

  /**
   * Dispara os lembretes ativos de 24h (Anti-No-Show)
   */
  app.post('/api/clinics/:clinicId/reminders/dispatch', async () => {
    return appointmentReminderService.dispatchPendingReminders();
  });
}
