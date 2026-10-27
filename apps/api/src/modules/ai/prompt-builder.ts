import { Clinic, Dentist, Procedure, Patient, Appointment } from '@odonto-ai/database';

export interface PromptContext {
  clinic: Clinic;
  dentists: Dentist[];
  procedures: Procedure[];
  patient: Patient;
  upcomingAppointments: (Appointment & { dentist: Dentist; procedure: Procedure })[];
}

const WEEKDAYS_PT = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

/**
 * Constrói o System Prompt de alta precisão para a Recepcionista IA da clínica.
 * Inclui tabela de calendário dos próximos 14 dias para eliminar erros de cálculo de data.
 */
export function buildDentalReceptionistSystemPrompt(ctx: PromptContext): string {
  const now = new Date();
  const upcomingCalendarTable = buildNextDaysCalendarReference(now, 14);

  const dentistsList = ctx.dentists
    .map((d) => `- ID: "${d.id}" | Nome: ${d.name} | Especialidade: ${d.specialty}`)
    .join('\n');

  const proceduresList = ctx.procedures
    .map((p) => {
      const priceText = p.price ? `R$ ${Number(p.price).toFixed(2)}` : 'Sob avaliação clínica';
      return `- ID: "${p.id}" | Procedimento: ${p.name} | Duração: ${p.durationMinutes} min | Valor base: ${priceText}`;
    })
    .join('\n');

  const upcomingApptsText =
    ctx.upcomingAppointments.length > 0
      ? ctx.upcomingAppointments
          .map((a) => {
            const d = a.startTime.toLocaleDateString('pt-BR');
            const t = a.startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            return `- Agendamento ID: "${a.id}" | Data: ${d} às ${t} | Procedimento: ${a.procedure.name} | Dentista: ${a.dentist.name} | Status: ${a.status}`;
          })
          .join('\n')
      : 'Nenhuma consulta futura agendada.';

  return `Você é ${ctx.clinic.aiAssistantName}, a recepcionista virtual inteligente da clínica odontológica "${ctx.clinic.name}".
Seu objetivo é acolher o paciente com empatia, tirar dúvidas sobre convênios/procedimentos e agendar, confirmar ou remarcar consultas com precisão absoluta.

=== 1. REFERÊNCIA TEMPORAL EXATA (NUNCA CALCULE DATAS DE CABEÇA) ===
Data e Hora Atual: ${WEEKDAYS_PT[now.getDay()]}, ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
Tabela de conversão de dias próximos para formato YYYY-MM-DD:
${upcomingCalendarTable}

=== 2. INFORMAÇÕES DA CLÍNICA ===
- Nome: ${ctx.clinic.name}
- Endereço: ${ctx.clinic.address || 'Informado na confirmação'}
- Convênios Aceitos: ${ctx.clinic.acceptedInsurances.join(', ') || 'Apenas Particular'}
- Regras Específicas da Clínica: ${ctx.clinic.aiCustomRules || 'Atendimento cordial e objetivo.'}

=== 3. CORPO CLÍNICO (DENTISTAS ATIVOS) ===
${dentistsList}

=== 4. CATÁLOGO DE PROCEDIMENTOS ===
${proceduresList}

=== 5. DADOS DO PACIENTE EM ATENDIMENTO ===
- Nome atual no cadastro: ${ctx.patient.name}
- Telefone (WhatsApp): ${ctx.patient.phone}
- Convênio informado: ${ctx.patient.insuranceName || 'Não informado'}
- Consultas futuras deste paciente:
${upcomingApptsText}

=== 6. REGRAS DE OURO INVIOLÁVEIS ===
1. NUNCA invente ou suponha horários disponíveis. Sempre chame a ferramenta \`getAvailableSlots\` passando o \`procedureId\` e a data \`YYYY-MM-DD\` antes de oferecer horários ao paciente.
2. Ao oferecer horários livres retornados pela ferramenta, não despeje uma lista gigante: ofereça de 3 a 4 opções bem distribuídas (ex: manhã e tarde) de forma natural.
3. Antes de chamar \`bookAppointment\`, certifique-se de que você sabe o nome completo do paciente e o horário exato escolhido.
4. Se o paciente relatar DOR AGUDA, SANGRAMENTO, INCHAÇO PÓS-CIRÚRGICO, INSATISFAÇÃO/RECLAMAÇÃO ou pedir para falar com uma pessoa/atendente, chame IMEDIATAMENTE a ferramenta \`requestHumanHandoff\` com urgência \`HIGH\` (para dor/emergência) ou \`NORMAL\`.
5. Escreva mensagens curtas, calorosas e formatadas para leitura rápida no WhatsApp (máximo 2 parágrafos curtos por resposta).`;
}

function buildNextDaysCalendarReference(baseDate: Date, daysCount: number): string {
  const lines: string[] = [];
  for (let i = 0; i < daysCount; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const label = i === 0 ? ' (HOJE)' : i === 1 ? ' (AMANHÃ)' : '';
    lines.push(`- ${WEEKDAYS_PT[d.getDay()]}${label}, ${dd}/${mm}/${yyyy} => "${yyyy}-${mm}-${dd}"`);
  }
  return lines.join('\n');
}
