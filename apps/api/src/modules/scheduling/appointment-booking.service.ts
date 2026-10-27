import { prisma, AppointmentStatus } from '@odonto-ai/database';
import { acquireDistributedLock, releaseDistributedLock } from '../../config/redis.js';
import { slotCalculatorService } from './slot-calculator.service.js';

export interface BookAppointmentInput {
  clinicId: string;
  patientName: string;
  patientPhone: string;
  insuranceName?: string;
  dentistId: string;
  procedureId: string;
  date: string;      // Formato "YYYY-MM-DD"
  startTime: string; // Formato "HH:mm"
  bookedByAi?: boolean;
  notes?: string;
}

export class AppointmentBookingService {
  /**
   * Agenda uma consulta com proteção de concorrência (Distributed Lock)
   * e dupla checagem determinística de disponibilidade.
   */
  async bookAppointment(input: BookAppointmentInput) {
    const {
      clinicId,
      patientName,
      patientPhone,
      insuranceName,
      dentistId,
      procedureId,
      date,
      startTime,
      bookedByAi = true,
      notes,
    } = input;

    // 1. Adquire Lock para este dentista e data (evita condição de corrida)
    const lockKey = `lock:booking:${dentistId}:${date}`;
    const lockAcquired = await acquireDistributedLock(lockKey, 10000);

    if (!lockAcquired) {
      throw new Error(
        'Este horário está sendo processado em outro atendimento no momento. Tente novamente em instantes.'
      );
    }

    try {
      // 2. Revalida se o horário escolhido realmente consta como livre no SlotCalculator
      const availableSlots = await slotCalculatorService.getAvailableSlots({
        clinicId,
        date,
        procedureId,
        dentistId,
      });

      const matchingSlot = availableSlots.find((slot) => slot.startTime === startTime);

      if (!matchingSlot) {
        throw new Error(
          `O horário ${startTime} do dia ${date} não está mais disponível para este procedimento.`
        );
      }

      // 3. Executa transação atômica no Postgres: Upsert do Paciente + Criação do Agendamento
      const appointment = await prisma.$transaction(async (tx) => {
        const cleanPhone = patientPhone.replace(/\D/g, '');

        const patient = await tx.patient.upsert({
          where: {
            clinicId_phone: {
              clinicId,
              phone: cleanPhone,
            },
          },
          update: {
            name: patientName,
            ...(insuranceName ? { insuranceName } : {}),
          },
          create: {
            clinicId,
            name: patientName,
            phone: cleanPhone,
            insuranceName,
          },
        });

        // Checagem final dentro da transação
        const startDate = new Date(matchingSlot.isoStart);
        const endDate = new Date(matchingSlot.isoEnd);

        const conflict = await tx.appointment.findFirst({
          where: {
            dentistId,
            status: {
              in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED],
            },
            startTime: { lt: endDate },
            endTime: { gt: startDate },
          },
        });

        if (conflict) {
          throw new Error('Conflito detectado: o horário acabou de ser preenchido.');
        }

        return tx.appointment.create({
          data: {
            clinicId,
            patientId: patient.id,
            dentistId,
            procedureId,
            startTime: startDate,
            endTime: endDate,
            status: AppointmentStatus.SCHEDULED,
            bookedByAi,
            notes,
          },
          include: {
            patient: true,
            dentist: true,
            procedure: true,
          },
        });
      });

      return appointment;
    } finally {
      // 4. Sempre libera o lock no Redis
      await releaseDistributedLock(lockKey);
    }
  }

  /**
   * Cancela ou confirma uma consulta existente (usado tanto pela IA quanto pelo Painel)
   */
  async updateAppointmentStatus(
    clinicId: string,
    appointmentId: string,
    status: AppointmentStatus,
    notes?: string
  ) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, clinicId },
    });

    if (!appointment) {
      throw new Error('Agendamento não encontrado.');
    }

    return prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status,
        ...(notes ? { notes } : {}),
      },
      include: {
        patient: true,
        dentist: true,
        procedure: true,
      },
    });
  }

  /**
   * Busca as próximas consultas ativas de um paciente pelo telefone
   * (para a IA saber se o paciente já tem horário marcado)
   */
  async getUpcomingPatientAppointments(clinicId: string, phone: string) {
    const cleanPhone = phone.replace(/\D/g, '');
    return prisma.appointment.findMany({
      where: {
        clinicId,
        patient: { phone: cleanPhone },
        status: {
          in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED],
        },
        startTime: { gte: new Date() },
      },
      include: {
        dentist: true,
        procedure: true,
      },
      orderBy: { startTime: 'asc' },
    });
  }
}

export const appointmentBookingService = new AppointmentBookingService();
