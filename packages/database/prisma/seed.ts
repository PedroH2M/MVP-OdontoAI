import { prisma, ConversationStatus, UrgencyLevel, SenderType, AppointmentStatus } from '../src';

async function main() {
  console.log('🌱 Iniciando Seed de Clínica Odontológica Demo...');

  // 1. Cria a Clínica Modelo
  const clinic = await prisma.clinic.upsert({
    where: { slug: 'clinica-sorriso-perfeito' },
    update: {},
    create: {
      name: 'Clínica Sorriso Perfeito',
      slug: 'clinica-sorriso-perfeito',
      phone: '5511999990000',
      address: 'Av. Paulista, 1000 - Sala 402, São Paulo - SP',
      acceptedInsurances: ['Particular', 'Amil Dental', 'Bradesco Dental', 'SulAmérica Odonto'],
      aiAssistantName: 'Sofia',
      aiCustomRules:
        'Temos estacionamento conveniado no prédio. Avaliações iniciais são gratuitas para tratamentos estéticos e implantes.',
      whatsappInstanceId: 'instancia-sorriso-perfeito',
      isBotActive: true,
    },
  });

  // 2. Cria Dentistas + Grade de Horários (Segunda a Sexta)
  const drCarlos = await prisma.dentist.create({
    data: {
      clinicId: clinic.id,
      name: 'Dr. Carlos Eduardo',
      cro: 'SP-102938',
      specialty: 'Implantodontia e Prótese',
      color: '#0284c7', // Sky blue
      workingHours: {
        create: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
          dayOfWeek,
          startTime: '08:00',
          endTime: '18:00',
          breakStart: '12:00',
          breakEnd: '13:30',
        })),
      },
    },
  });

  const draJuliana = await prisma.dentist.create({
    data: {
      clinicId: clinic.id,
      name: 'Dra. Juliana Mendes',
      cro: 'SP-495821',
      specialty: 'Ortodontia e Estética Dental',
      color: '#0d9488', // Teal
      workingHours: {
        create: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
          dayOfWeek,
          startTime: '09:00',
          endTime: '19:00',
          breakStart: '13:00',
          breakEnd: '14:00',
        })),
      },
    },
  });

  // 3. Cria Catálogo de Procedimentos
  const procAvaliacao = await prisma.procedure.create({
    data: {
      clinicId: clinic.id,
      name: 'Avaliação Inicial / Check-up',
      durationMinutes: 30,
      price: 150.0,
      allowAiBooking: true,
    },
  });

  const procLimpeza = await prisma.procedure.create({
    data: {
      clinicId: clinic.id,
      name: 'Limpeza Completa (Profilaxia)',
      durationMinutes: 45,
      price: 250.0,
      allowAiBooking: true,
    },
  });

  const procUrgencia = await prisma.procedure.create({
    data: {
      clinicId: clinic.id,
      name: 'Atendimento de Urgência (Dor / Quebra)',
      durationMinutes: 30,
      price: 200.0,
      allowAiBooking: true,
    },
  });

  // 4. Cria Pacientes e Conversas Exemplo para o Painel Web
  const paciente1 = await prisma.patient.create({
    data: {
      clinicId: clinic.id,
      name: 'Mariana Costa',
      phone: '5511988881111',
      insuranceName: 'Bradesco Dental',
    },
  });

  const paciente2 = await prisma.patient.create({
    data: {
      clinicId: clinic.id,
      name: 'Roberto Almeida',
      phone: '5511977772222',
      insuranceName: 'Particular',
    },
  });

  // Agendamento feito pela IA para hoje
  const todayAt14 = new Date();
  todayAt14.setHours(14, 0, 0, 0);
  const todayAt1445 = new Date(todayAt14.getTime() + procLimpeza.durationMinutes * 60000);

  await prisma.appointment.create({
    data: {
      clinicId: clinic.id,
      patientId: paciente1.id,
      dentistId: draJuliana.id,
      procedureId: procLimpeza.id,
      startTime: todayAt14,
      endTime: todayAt1445,
      status: AppointmentStatus.CONFIRMED,
      bookedByAi: true,
      notes: 'Agendado automaticamente via WhatsApp pela IA Sofia.',
    },
  });

  // Conversa 1: Resolvida pela IA
  await prisma.conversation.create({
    data: {
      clinicId: clinic.id,
      patientId: paciente1.id,
      status: ConversationStatus.AI_HANDLING,
      urgency: UrgencyLevel.NORMAL,
      messages: {
        create: [
          {
            sender: SenderType.PATIENT,
            content: 'Bom dia! Vocês aceitam Bradesco Dental para limpeza?',
          },
          {
            sender: SenderType.AI,
            content:
              'Bom dia, Mariana! 😊 Tudo bem? Aqui é a Sofia da Clínica Sorriso Perfeito. Sim, atendemos Bradesco Dental! Gostaria de verificar os horários disponíveis com a Dra. Juliana para esta semana?',
          },
        ],
      },
    },
  });

  // Conversa 2: Transbordo Humano de Urgência (para destacar no Painel da Secretária)
  await prisma.conversation.create({
    data: {
      clinicId: clinic.id,
      patientId: paciente2.id,
      status: ConversationStatus.WAITING_HUMAN,
      urgency: UrgencyLevel.HIGH,
      handoffReason: 'Paciente relatou dor intensa pós-extração e pediu encaixe imediato.',
      messages: {
        create: [
          {
            sender: SenderType.PATIENT,
            content: 'Oi, fiz uma extração ontem e está doendo muito, preciso falar com o Dr. Carlos urgente!',
          },
          {
            sender: SenderType.AI,
            content:
              'Sinto muito que esteja com dor, Roberto. Já acionei nossa equipe da recepção com prioridade máxima e a atendente vai falar com você aqui em instantes para encaixar seu atendimento com o Dr. Carlos.',
          },
        ],
      },
    },
  });

  console.log(`✅ Seed finalizado com sucesso! Clínica ID: ${clinic.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
