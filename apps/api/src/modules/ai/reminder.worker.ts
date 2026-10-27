import { prisma, AppointmentStatus, SenderType } from '@odonto-ai/database';
import { whatsAppProvider } from '../whatsapp/index.js';

/**
 * Motor Ativo Anti-No-Show (Lembrete Automático de 24h)
 * Varre consultas das próximas 24 horas que ainda não receberam lembrete
 * e envia mensagem ativa no WhatsApp pedindo confirmação.
 */
export class AppointmentReminderService {
  async dispatchPendingReminders() {
    const now = new Date();
    const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const pendingAppointments = await prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.SCHEDULED,
        reminderSent: false,
        startTime: {
          gte: now,
          lte: next24Hours,
        },
      },
      include: {
        clinic: true,
        patient: true,
        dentist: true,
        procedure: true,
      },
    });

    const results = [];

    for (const appt of pendingAppointments) {
      const dateStr = appt.startTime.toLocaleDateString('pt-BR');
      const timeStr = appt.startTime.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const reminderMessage = `Olá, *${appt.patient.name.split(' ')[0]}*! Passando para lembrar da sua consulta na *${appt.clinic.name}*:\n\n🦷 *Procedimento:* ${appt.procedure.name}\n👨‍⚕️ *Profissional:* ${appt.dentist.name}\n📅 *Data:* ${dateStr} às *${timeStr}*\n📍 *Local:* ${appt.clinic.address || 'Nosso consultório'}\n\nVocê confirma sua presença? Responda *SIM* para confirmar ou nos avise caso precise reagendar.`;

      if (appt.clinic.whatsappInstanceId) {
        await whatsAppProvider.sendTextMessage({
          instanceId: appt.clinic.whatsappInstanceId,
          phone: appt.patient.phone,
          text: reminderMessage,
          simulateTyping: false,
        });
      }

      // Registra no histórico da conversa e marca reminderSent = true
      const conversation = await prisma.conversation.upsert({
        where: {
          clinicId_patientId: {
            clinicId: appt.clinicId,
            patientId: appt.patientId,
          },
        },
        update: { lastMessageAt: new Date() },
        create: {
          clinicId: appt.clinicId,
          patientId: appt.patientId,
        },
      });

      await prisma.$transaction([
        prisma.message.create({
          data: {
            conversationId: conversation.id,
            sender: SenderType.AI,
            content: reminderMessage,
            mediaType: 'text',
          },
        }),
        prisma.appointment.update({
          where: { id: appt.id },
          data: { reminderSent: true },
        }),
      ]);

      results.push({
        appointmentId: appt.id,
        patientName: appt.patient.name,
        phone: appt.patient.phone,
        time: timeStr,
      });
    }

    return {
      dispatchedCount: results.length,
      reminders: results,
    };
  }
}

export const appointmentReminderService = new AppointmentReminderService();
