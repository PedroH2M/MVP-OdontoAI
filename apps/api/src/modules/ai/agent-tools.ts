import { tool } from 'ai';
import { z } from 'zod';
import {
   prisma,
  AppointmentStatus,
  ConversationStatus,
  UrgencyLevel,
} from '@odonto-ai/database';
import {
  slotCalculatorService,
  appointmentBookingService,
} from '../scheduling/index.js';

export interface AgentToolExecutionContext {
  clinicId: string;
  conversationId: string;
  patientId: string;
  patientPhone: string;
}

/**
 * Cria o conjunto de ferramentas (Tools) tipadas com Zod para o Agente de IA.
 * Todas as ações passam pelas travas determinísticas do Bloco 2.
 */
export function createDentalAgentTools(ctx: AgentToolExecutionContext) {
  return {
    getAvailableSlots: tool({
      description:
        'Consulta os horários realmente livres na agenda da clínica para uma data (YYYY-MM-DD) e procedimento específico.',
      parameters: z.object({
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe('Data desejada no formato YYYY-MM-DD'),
        procedureId: z.string().describe('ID do procedimento do catálogo da clínica'),
        dentistId: z
          .string()
          .optional()
          .describe('ID opcional do dentista caso o paciente tenha preferência'),
      }),
      execute: async ({ date, procedureId, dentistId }) => {
        try {
          const slots = await slotCalculatorService.getAvailableSlots({
            clinicId: ctx.clinicId,
            date,
            procedureId,
            dentistId,
          });

          return {
            success: true,
            date,
            totalAvailable: slots.length,
            availableSlots: slots.map((s) => ({
              dentistId: s.dentistId,
              dentistName: s.dentistName,
              startTime: s.startTime,
              endTime: s.endTime,
            })),
          };
        } catch (error) {
          return {
            success: false,
            error: (error as Error).message,
          };
        }
      },
    }),

    bookAppointment: tool({
      description:
        'Realiza o agendamento definitivo de uma consulta na agenda da clínica após o paciente escolher data e horário.',
      parameters: z.object({
        patientName: z.string().describe('Nome do paciente'),
        insuranceName: z
          .string()
          .optional()
          .describe('Nome do convênio odontológico ou "Particular"'),
        dentistId: z.string().describe('ID do dentista escolhido'),
        procedureId: z.string().describe('ID do procedimento a ser agendado'),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe('Data da consulta no formato YYYY-MM-DD'),
        startTime: z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .describe('Horário inicial no formato HH:mm (ex: "14:00")'),
        notes: z.string().optional().describe('Observação breve sobre o motivo da consulta'),
      }),
      execute: async (params) => {
        try {
          const appointment = await appointmentBookingService.bookAppointment({
            clinicId: ctx.clinicId,
            patientName: params.patientName,
            patientPhone: ctx.patientPhone,
            insuranceName: params.insuranceName,
            dentistId: params.dentistId,
            procedureId: params.procedureId,
            date: params.date,
            startTime: params.startTime,
            bookedByAi: true,
            notes: params.notes || 'Agendado automaticamente pela IA via WhatsApp.',
          });

          return {
            success: true,
            appointmentId: appointment.id,
            dentistName: appointment.dentist.name,
            procedureName: appointment.procedure.name,
            startTime: appointment.startTime.toISOString(),
            message: 'Agendamento gravado com sucesso na agenda da clínica.',
          };
        } catch (error) {
          return {
            success: false,
            error: (error as Error).message,
          };
        }
      },
    }),

    manageExistingAppointment: tool({
      description:
        'Confirma ou cancela uma consulta futura já existente do paciente (ex: resposta ao lembrete de 24h ou pedido de desmarcação).',
      parameters: z.object({
        appointmentId: z.string().describe('ID do agendamento futuro do paciente'),
        action: z.enum(['CONFIRM', 'CANCEL']).describe('Ação desejada pelo paciente'),
        reason: z.string().optional().describe('Motivo do cancelamento, se aplicável'),
      }),
      execute: async ({ appointmentId, action, reason }) => {
        try {
          const newStatus =
            action === 'CONFIRM' ? AppointmentStatus.CONFIRMED : AppointmentStatus.CANCELLED;

          const updated = await appointmentBookingService.updateAppointmentStatus(
            ctx.clinicId,
            appointmentId,
            newStatus,
            reason
          );

          return {
            success: true,
            appointmentId: updated.id,
            newStatus: updated.status,
          };
        } catch (error) {
          return {
            success: false,
            error: (error as Error).message,
          };
        }
      },
    }),

    requestHumanHandoff: tool({
      description:
        'Pausa o robô de IA e transfere o atendimento imediatamente para a recepcionista humana (usado em casos de dor aguda, pós-operatório, reclamações ou dúvidas complexas).',
      parameters: z.object({
        reason: z
          .string()
          .describe('Resumo claro para a secretária entender por que a IA pediu ajuda'),
        urgency: z
          .enum(['LOW', 'NORMAL', 'HIGH'])
          .describe('HIGH para dor intensa/sangramento/urgência médica, NORMAL para dúvidas comerciais'),
      }),
      execute: async ({ reason, urgency }) => {
        await prisma.conversation.update({
          where: { id: ctx.conversationId },
          data: {
            status: ConversationStatus.WAITING_HUMAN,
            urgency: urgency as UrgencyLevel,
            handoffReason: reason,
          },
        });

        return {
          success: true,
          status: 'WAITING_HUMAN',
          message:
            'A conversa foi destacada no painel da recepcionista humana e o bot foi pausado.',
        };
      },
    }),
  };
}
