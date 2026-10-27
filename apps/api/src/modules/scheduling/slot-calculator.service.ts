import { prisma, AppointmentStatus } from '@odonto-ai/database';

export interface AvailableSlot {
  dentistId: string;
  dentistName: string;
  specialty: string;
  startTime: string; // Formato "HH:mm" (ex: "09:00")
  endTime: string;   // Formato "HH:mm" (ex: "09:45")
  isoStart: string;  // ISO 8601 completo
  isoEnd: string;
}

export interface GetAvailableSlotsInput {
  clinicId: string;
  date: string; // Formato "YYYY-MM-DD"
  procedureId: string;
  dentistId?: string;
  slotStepMinutes?: number; // Intervalo da grade (padrão: 30 min)
}

export class SlotCalculatorService {
  /**
   * Calcula de forma 100% determinística todos os horários livres reais
   * levando em conta a duração do procedimento, horário de trabalho,
   * intervalo de almoço e consultas já agendadas.
   */
  async getAvailableSlots(input: GetAvailableSlotsInput): Promise<AvailableSlot[]> {
    const { clinicId, date, procedureId, dentistId, slotStepMinutes = 30 } = input;

    // 1. Busca o procedimento para saber quantos minutos ele ocupa na cadeira
    const procedure = await prisma.procedure.findFirst({
      where: { id: procedureId, clinicId },
    });

    if (!procedure) {
      throw new Error('Procedimento não encontrado para esta clínica.');
    }

    // 2. Identifica o dia da semana (0 = Domingo ... 6 = Sábado) no fuso local
    const [year, month, day] = date.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    const dayOfWeek = targetDate.getDay();

    // 3. Busca os dentistas ativos e suas grades para este dia da semana
    const dentists = await prisma.dentist.findMany({
      where: {
        clinicId,
        isActive: true,
        ...(dentistId ? { id: dentistId } : {}),
      },
      include: {
        workingHours: {
          where: { dayOfWeek },
        },
      },
    });

    if (dentists.length === 0) {
      return [];
    }

    // 4. Busca todos os agendamentos ativos deste dia na clínica
    const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
    const dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        clinicId,
        status: {
          in: [
            AppointmentStatus.SCHEDULED,
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.COMPLETED,
          ],
        },
        startTime: { lte: dayEnd },
        endTime: { gte: dayStart },
      },
    });

    const now = new Date();
    const availableSlots: AvailableSlot[] = [];

    // 5. Para cada dentista, percorre a grade e valida colisões minuto a minuto
    for (const dentist of dentists) {
      const schedule = dentist.workingHours[0];
      if (!schedule) continue; // Dentista não atende neste dia da semana

      const workStartMin = this.timeToMinutes(schedule.startTime);
      const workEndMin = this.timeToMinutes(schedule.endTime);
      const breakStartMin = schedule.breakStart ? this.timeToMinutes(schedule.breakStart) : null;
      const breakEndMin = schedule.breakEnd ? this.timeToMinutes(schedule.breakEnd) : null;

      const dentistAppointments = existingAppointments.filter((a) => a.dentistId === dentist.id);

      for (
        let candidateStartMin = workStartMin;
        candidateStartMin + procedure.durationMinutes <= workEndMin;
        candidateStartMin += slotStepMinutes
      ) {
        const candidateEndMin = candidateStartMin + procedure.durationMinutes;

        // Regra A: Verifica se invade o horário de almoço do dentista
        if (breakStartMin !== null && breakEndMin !== null) {
          const overlapsLunch =
            candidateStartMin < breakEndMin && candidateEndMin > breakStartMin;
          if (overlapsLunch) continue;
        }

        // Constrói objetos Date exatos para comparar com consultas existentes
        const slotStartDate = this.minutesToDate(year, month, day, candidateStartMin);
        const slotEndDate = this.minutesToDate(year, month, day, candidateEndMin);

        // Regra B: Não oferece horários que já passaram (com margem mínima de 15 min)
        if (slotStartDate.getTime() <= now.getTime() + 15 * 60 * 1000) {
          continue;
        }

        // Regra C: Verifica colisão com qualquer consulta já marcada para este dentista
        const hasConflict = dentistAppointments.some((appt) => {
          return slotStartDate < appt.endTime && slotEndDate > appt.startTime;
        });

        if (!hasConflict) {
          availableSlots.push({
            dentistId: dentist.id,
            dentistName: dentist.name,
            specialty: dentist.specialty,
            startTime: this.minutesToTime(candidateStartMin),
            endTime: this.minutesToTime(candidateEndMin),
            isoStart: slotStartDate.toISOString(),
            isoEnd: slotEndDate.toISOString(),
          });
        }
      }
    }

    return availableSlots;
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private minutesToTime(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60)
      .toString()
      .padStart(2, '0');
    const minutes = (totalMinutes % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private minutesToDate(year: number, month: number, day: number, totalMinutes: number): Date {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return new Date(year, month - 1, day, hours, minutes, 0, 0);
  }
}

export const slotCalculatorService = new SlotCalculatorService();
