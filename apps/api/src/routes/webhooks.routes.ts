import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { generateText, tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { prisma } from '@odonto-ai/database';
import { env } from '../config/env.js';
import { whatsAppWebhookHandler } from '../modules/whatsapp/index.js';
import { baileysSessionService } from '../modules/whatsapp/baileys-session.service.js';

export async function webhooksRoutes(app: FastifyInstance) {
  let activeClinicConfig = {
    clinicName: 'Clínica Sorriso Perfeito',
    aiAssistantName: 'Sofia',
    address: 'Av. Paulista, 1000 - Sala 402, São Paulo',
    acceptedInsurances: ['Particular', 'Amil Dental', 'Bradesco Dental', 'SulAmérica'],
    aiCustomRules:
      'Estacionamento conveniado gratuito no prédio. Avaliações iniciais sem custo para implantes e estética.',
    dentists: [] as { name: string; specialty: string; cro: string }[],
  };

  /**
   * Função compartilhada de geração da IA (usada tanto pelo Chat do Painel quanto pelo WhatsApp Real e Simulador)
   */
  async function generateDentalAiReply(data: {
    clinicName: string;
    aiAssistantName: string;
    address: string;
    acceptedInsurances: string[];
    aiCustomRules: string;
    dentists?: { name: string; specialty: string; cro: string }[];
    patientName: string;
    patientPhone: string;
    messageHistory: { sender: 'PATIENT' | 'AI' | 'HUMAN_STAFF'; content: string }[];
    newMessage: string;
    occupiedSlots?: { time: string; dentistName: string; patientName: string }[];
    patientActiveAppointment?: { time: string; dentistName: string; procedureName: string } | null;
  }) {
    dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });
    dotenv.config({ path: path.resolve(process.cwd(), '../../.env'), override: true });

    const rawGroq = process.env.GROQ_API_KEY || env.GROQ_API_KEY || '';
    const rawOpenAi = process.env.OPENAI_API_KEY || env.OPENAI_API_KEY || '';

    const groqKey = rawGroq.startsWith('gsk_')
      ? rawGroq
      : rawOpenAi.startsWith('gsk_')
      ? rawOpenAi
      : '';

    const openAiKey = rawOpenAi.startsWith('sk-')
      ? rawOpenAi
      : rawGroq.startsWith('sk-')
      ? rawGroq
      : '';

    const hasGroqKey = Boolean(groqKey && groqKey !== 'gsk_...');
    const hasOpenAiKey = Boolean(openAiKey && openAiKey !== 'sk-...');

    if (!hasGroqKey && !hasOpenAiKey) {
      throw new Error('Chave GROQ_API_KEY ou OPENAI_API_KEY não encontrada no arquivo .env');
    }

    const aiProvider = hasGroqKey
      ? createOpenAI({
          baseURL: 'https://api.groq.com/openai/v1',
          apiKey: groqKey,
        })
      : createOpenAI({
          apiKey: openAiKey,
        });

    const modelId = hasGroqKey ? 'openai/gpt-oss-120b' : 'gpt-4o-mini';

    let bookedAction: {
      time: string;
      dentistName: string;
      procedureName: string;
      contactPhone: string;
      dayLabel?: 'hoje' | 'amanhã';
    } | null = null;
    let cancelledAction: {
      reason: string;
      contactPhone: string;
    } | null = null;
    let handoffAction: { reason: string; urgency: 'HIGH' | 'NORMAL' } | null = null;
    const firstName = data.patientName.split(' ')[0];

    const now = new Date();
    const nowTimeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const nowTotalMinutes = now.getHours() * 60 + now.getMinutes();
    const allDaySlots = ['09:00', '10:30', '14:00', '16:00', '17:15', '17:30'];
    const pastSlotsToday = allDaySlots.filter((slot) => {
      const [sh, sm] = slot.split(':').map(Number);
      return sh * 60 + sm <= nowTotalMinutes;
    });
    const futureSlotsToday = allDaySlots.filter((slot) => {
      const [sh, sm] = slot.split(':').map(Number);
      return sh * 60 + sm > nowTotalMinutes && sh < 18;
    });

    const dentistsList =
      data.dentists && data.dentists.length > 0
        ? data.dentists
            .map((d) => `${d.name} (${d.specialty} - Horários base: 09:00, 10:30, 14:00, 16:00, 17:15, 17:30)`)
            .join(' | ')
        : 'Plantonista da Clínica (Horários base: 09:00, 10:30, 14:00, 16:00, 17:15, 17:30)';

    const occupiedSummary =
      data.occupiedSlots && data.occupiedSlots.length > 0
        ? data.occupiedSlots.map((s) => `${s.time} com ${s.dentistName} (OCUPADO)`).join(', ')
        : 'Nenhum horário ocupado ainda hoje';

    const currentPatientApptSummary = data.patientActiveAppointment
      ? `Possui consulta ativa hoje às ${data.patientActiveAppointment.time} com ${data.patientActiveAppointment.dentistName} (${data.patientActiveAppointment.procedureName})`
      : 'Nenhuma consulta ativa agendada para este paciente hoje';

    const systemPrompt = `Você é ${data.aiAssistantName}, recepcionista da clínica odontológica "${data.clinicName}" conversando pelo WhatsApp.
Data/Hora Atual Exata: ${now.toLocaleDateString('pt-BR')} às ${nowTimeStr}.

Dados de consulta interna (NÃO despeje tudo isso de uma vez! Use apenas quando perguntarem):
- Endereço: ${data.address}
- Expediente: Segunda a Sexta, das 08:00 às 18:00 (NÃO abrimos sábado nem domingo).
- Convênios aceitos: ${data.acceptedInsurances.join(', ')} (NÃO aceitamos outros convênios fora desta lista).
- Observações: ${data.aiCustomRules}
- Dentistas cadastrados na clínica: ${dentistsList}
- Horários de HOJE que JÁ PASSARAM da hora atual (${nowTimeStr}) — PROIBIDO agendar ou oferecer para hoje: ${pastSlotsToday.length > 0 ? pastSlotsToday.join(', ') : 'Nenhum'}
- Horários ainda disponíveis para HOJE (após ${nowTimeStr}): ${futureSlotsToday.length > 0 ? futureSlotsToday.join(', ') : 'Expediente de hoje encerrado (ofereça apenas para amanhã)'}
- Horários disponíveis para AMANHÃ: 09:00, 10:30, 14:00, 16:00
- Horários JÁ OCUPADOS na agenda de hoje (NÃO ofereça e NÃO agende nestes horários): ${occupiedSummary}
- Status atual deste paciente (${data.patientName}, Tel: ${data.patientPhone}): ${currentPatientApptSummary}
- Valores particulares base: Avaliação (R$ 150), Limpeza (R$ 250), Urgência (R$ 200)

COMO CONVERSAR DE FORMA 100% HUMANA E SEGURA NO WHATSAPP (MUITO IMPORTANTE):
1. PROIBIDO MANDAR TEXTÃO: Responda APENAS o que o paciente perguntou naquele momento em frases curtas.
2. UM PASSO DE CADA VEZ: Faça apenas UMA pergunta simples por vez.
3. DIVIDA EM 2 BALÕES CURTOS USANDO "|||": Separe suas 2 mensagens curtas com "|||".
   Exemplo: "Oi, ${firstName}! Tudo bem? 😊|||Sim, nós aceitamos Bradesco Dental para limpeza! Você prefere agendar para hoje no fim da tarde ou para amanhã?"
4. Sem formatação de robô: NUNCA use listas com bolinhas (• ou -), nunca use asteriscos duplos (**).
5. REGRAS CRÍTICAS DE AGENDA, HORÁRIO NO PASSADO, TRIAGEM E ÉTICA CLÍNICA:
   - PROIBIDO AGENDAR NO PASSADO: Agora são ${nowTimeStr}. Se o paciente pedir um horário para HOJE que já passou (ex: pedir 09:00, 10:30, 14:00 ou 16:00 quando já são ${nowTimeStr}), NUNCA chame \`bookAppointment\` para hoje! Avise que já são ${nowTimeStr} e ofereça os horários que ainda restam hoje (${futureSlotsToday.join(' ou ') || 'nenhum'}) ou agendar para AMANHÃ nesse horário.
   - NUNCA agende em um horário que já consta como OCUPADO para aquele dentista e NUNCA agende fora das 08:00 às 18:00 ou em fins de semana (sábado/domingo).
   - Se o paciente já tem consulta ativa hoje e pedir para TROCAR/REMARCAR para outro horário livre, chame APENAS \`bookAppointment\` com o novo horário (o sistema já substitui o antigo automaticamente).
   - Se o paciente pedir para cancelar/desmarcar e ele tiver consulta ativa, chame \`cancelAppointment\`. Se ele NÃO tiver consulta ativa, avise que não encontrou agendamento no número dele e peça para ele confirmar o nome ou telefone.
   - TRIAGEM OBRIGATÓRIA ANTES DE TRANSFERIR PARA A RECEPÇÃO: Se o paciente disser apenas "Quero ajuda", "Preciso de ajuda", "Pode me ajudar?" ou pedir para falar com atendente/recepção SEM explicar o motivo, NUNCA chame \`requestHumanHandoff\` de imediato! Primeiro FILTRE perguntando com simpatia: se ele gostaria de agendar/remarcar uma consulta, tirar dúvida sobre convênios/valores ou se está com alguma dor/urgência.
   - PROIBIDO RECEITAR REMÉDIOS: Você é recepcionista, não dentista. Se o paciente pedir receita de antibiótico/anti-inflamatório ou relatar dor forte, inchaço, sangramento, dente quebrado ou pós-extração, NUNCA indique medicamentos e chame IMEDIATAMENTE \`requestHumanHandoff\`.`;

    let cleanText = '';

    try {
      const result = await generateText({
        model: aiProvider(modelId),
        system: systemPrompt,
        messages: [
          ...data.messageHistory.map((m) => ({
            role: (m.sender === 'PATIENT' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.content,
          })),
          { role: 'user', content: data.newMessage },
        ],
        tools: {
          bookAppointment: tool({
            description:
              'Agenda ou remarca uma consulta quando o paciente confirma ou escolhe o horário.',
            parameters: z.object({
              time: z.string().describe('Horário escolhido no formato HH:mm (ex: "10:30")'),
              dentistName: z
                .string()
                .describe('Nome do dentista cadastrado na clínica escolhido pelo paciente'),
              procedureName: z
                .string()
                .describe('Nome do procedimento (ex: "Avaliação Inicial" ou "Limpeza")'),
              contactPhone: z
                .string()
                .describe('Número de telefone de contato do paciente'),
              dayLabel: z
                .enum(['hoje', 'amanhã'])
                .default('hoje')
                .describe('Se o agendamento é para "hoje" ou para "amanhã"'),
            }),
            execute: async ({ time, dentistName, procedureName, contactPhone, dayLabel }) => {
              bookedAction = { time, dentistName, procedureName, contactPhone, dayLabel };
              return {
                success: true,
                time,
                dentistName,
                procedureName,
                contactPhone,
                dayLabel,
              };
            },
          }),
          cancelAppointment: tool({
            description:
              'Cancela a consulta agendada do paciente quando ele pede para cancelar ou desmarcar.',
            parameters: z.object({
              reason: z.string().describe('Motivo do cancelamento informado pelo paciente'),
              contactPhone: z
                .string()
                .describe('Número de telefone de contato do paciente'),
            }),
            execute: async ({ reason, contactPhone }) => {
              cancelledAction = { reason, contactPhone };
              return {
                success: true,
                status: 'CANCELLED',
                reason,
                contactPhone,
              };
            },
          }),
          requestHumanHandoff: tool({
            description:
              'Transfere para a recepcionista humana SOMENTE após filtrar o motivo e confirmar que é dor aguda, inchaço, sangramento, dente quebrado, pós-extração, pedido de receita de medicamento ou assunto financeiro específico. NUNCA chame se o paciente apenas disse "Quero ajuda" ou "Preciso de ajuda" sem especificar o que é.',
            parameters: z.object({
              reason: z.string().describe('Resumo do motivo da urgência para a secretária'),
              urgency: z.enum(['HIGH', 'NORMAL']).describe('Nível de urgência'),
            }),
            execute: async ({ reason, urgency }) => {
              handoffAction = { reason, urgency };
              return {
                success: true,
                status: 'WAITING_HUMAN',
              };
            },
          }),
        },
        maxSteps: 1,
        temperature: 0.2,
      });

      cleanText = (result.text || '')
        .replace(/[\u202f\u00a0]/g, ' ')
        .replace(/[\u2011]/g, '-')
        .replace(/\*\*/g, '*')
        .trim();
    } catch {
      // Caso a chamada de tool do modelo falhe ou atinja limite de taxa, o extrator determinístico abaixo assume
    }

    // Extrator Determinístico Pós-LLM: garante que nenhuma intenção clara de agendamento, cancelamento ou urgência passe em branco
    const lowerMsg = data.newMessage.toLowerCase();
    const fullContextText = [
      ...data.messageHistory.map((m) => m.content.toLowerCase()),
      lowerMsg,
    ].join(' ');

    // Suporta tanto "15:00" quanto "15h", "15h30", "9h", "14 hrs"
    let extractedTime: string | null = null;
    const colonTimeMatch = lowerMsg.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    const colloquialTimeMatch = lowerMsg.match(
      /\b([01]?\d|2[0-3])\s*(?:h|hrs|horas)(?:\s*([0-5]\d))?\b/i
    );
    if (colonTimeMatch) {
      extractedTime = `${colonTimeMatch[1].padStart(2, '0')}:${colonTimeMatch[2]}`;
    } else if (colloquialTimeMatch) {
      const hh = colloquialTimeMatch[1].padStart(2, '0');
      const mm = (colloquialTimeMatch[2] || '00').padStart(2, '0');
      extractedTime = `${hh}:${mm}`;
    } else if (lowerMsg.includes('meia-noite') || lowerMsg.includes('meia noite')) {
      extractedTime = '00:00';
    } else if (lowerMsg.includes('meio-dia') || lowerMsg.includes('meio dia')) {
      extractedTime = '12:00';
    }

    const isWeekendRequested =
      (lowerMsg.includes('domingo') ||
        lowerMsg.includes('sábado') ||
        lowerMsg.includes('sabado')) &&
      !lowerMsg.includes('abre') &&
      !lowerMsg.includes('funciona');
    const isTomorrowRequested =
      lowerMsg.includes('amanhã') ||
      lowerMsg.includes('amanha') ||
      lowerMsg.includes('próximo dia') ||
      lowerMsg.includes('proximo dia') ||
      lowerMsg.includes('segunda') ||
      lowerMsg.includes('terça') ||
      lowerMsg.includes('terca') ||
      lowerMsg.includes('quarta') ||
      lowerMsg.includes('quinta') ||
      lowerMsg.includes('sexta');
    const isTodayExplicit = /\bhoje\b/i.test(lowerMsg);

    // Se o paciente respondeu "Pode ser amanhã" em 2 turnos após bloqueio de horário passado, recupera o horário pedido antes
    if (isTomorrowRequested && !extractedTime && data.messageHistory.length > 0) {
      const prevUserText = data.messageHistory
        .filter((m) => m.sender === 'PATIENT')
        .map((m) => m.content)
        .join(' ');
      const prevColon = prevUserText.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
      const prevColloq = prevUserText.match(
        /\b([01]?\d|2[0-3])\s*(?:h|hrs|horas)(?:\s*([0-5]\d))?\b/i
      );
      if (prevColon) {
        extractedTime = `${prevColon[1].padStart(2, '0')}:${prevColon[2]}`;
      } else if (prevColloq) {
        extractedTime = `${prevColloq[1].padStart(2, '0')}:${(prevColloq[2] || '00').padStart(
          2,
          '0'
        )}`;
      }
    }

    // Normaliza o horário e o dia caso a Tool da IA tenha enviado "15h" em vez de "15:00"
    if (bookedAction && (bookedAction as any).time) {
      const bTime = String((bookedAction as any).time);
      const cMatch = bTime.match(/([01]?\d|2[0-3])\s*(?:h|:)\s*([0-5]\d)?/i);
      if (cMatch) {
        (bookedAction as any).time = `${cMatch[1].padStart(2, '0')}:${(cMatch[2] || '00').padStart(
          2,
          '0'
        )}`;
      }
      // Garante que a IA não mude silenciosamente para "amanhã" se o paciente não falou "amanhã"
      (bookedAction as any).dayLabel = isTodayExplicit
        ? 'hoje'
        : isTomorrowRequested
        ? 'amanhã'
        : 'hoje';
    }

    // Extrai telefone alternativo caso o paciente tenha informado um novo número no texto
    const altPhoneMatch = data.newMessage.match(
      /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]\d{4}/
    );
    const effectivePhone = altPhoneMatch ? altPhoneMatch[0].trim() : data.patientPhone;
    if (bookedAction && altPhoneMatch) {
      (bookedAction as any).contactPhone = effectivePhone;
    }

    const isCancelIntent =
      lowerMsg.includes('cancelar') ||
      lowerMsg.includes('desmarcar') ||
      lowerMsg.includes('não vou poder ir') ||
      lowerMsg.includes('nao vou poder ir');
    const isUrgentIntent =
      lowerMsg.includes('dor') ||
      lowerMsg.includes('doendo') ||
      lowerMsg.includes('latej') ||
      lowerMsg.includes('inchad') ||
      lowerMsg.includes('inchaço') ||
      lowerMsg.includes('sangr') ||
      lowerMsg.includes('pus') ||
      lowerMsg.includes('infecc') ||
      lowerMsg.includes('infecção') ||
      lowerMsg.includes('inflam') ||
      lowerMsg.includes('quebr') ||
      lowerMsg.includes('antibiótico') ||
      lowerMsg.includes('antibiotico') ||
      lowerMsg.includes('anti-inflamatório') ||
      lowerMsg.includes('remédio') ||
      lowerMsg.includes('remedio') ||
      lowerMsg.includes('receita') ||
      lowerMsg.includes('extração') ||
      lowerMsg.includes('extracao') ||
      lowerMsg.includes('pós-operatório') ||
      lowerMsg.includes('pos-operatorio');

    const isSpecificAdminOrHumanAfterTriage =
      lowerMsg.includes('boleto') ||
      lowerMsg.includes('nota fiscal') ||
      lowerMsg.includes('reembolso') ||
      lowerMsg.includes('financeiro') ||
      lowerMsg.includes('reclamação') ||
      lowerMsg.includes('reclamacao') ||
      lowerMsg.includes('fornecedor') ||
      ((lowerMsg.includes('atendente') ||
        lowerMsg.includes('humano') ||
        lowerMsg.includes('secretária') ||
        lowerMsg.includes('secretaria') ||
        lowerMsg.includes('recepcionista') ||
        lowerMsg.includes('recepção') ||
        lowerMsg.includes('recepcao')) &&
        data.messageHistory.length >= 2);

    const isGenericHelpOrReceptionRequest =
      !isUrgentIntent &&
      !isSpecificAdminOrHumanAfterTriage &&
      !isCancelIntent &&
      !extractedTime &&
      (lowerMsg.includes('ajuda') ||
        lowerMsg.includes('ajudar') ||
        lowerMsg.includes('socorro') ||
        lowerMsg.includes('dúvida') ||
        lowerMsg.includes('duvida') ||
        lowerMsg.includes('atendente') ||
        lowerMsg.includes('recepção') ||
        lowerMsg.includes('recepcao') ||
        lowerMsg.includes('secretária') ||
        lowerMsg.includes('secretaria') ||
        lowerMsg.includes('humano') ||
        lowerMsg.includes('falar com alguém') ||
        lowerMsg.includes('falar com alguem'));

    // TRAVA DE TRIAGEM: Se a IA tentou transferir para a recepção sem o cliente ter explicado o problema (ex: "Quero ajuda"), bloqueia o handoff e filtra primeiro!
    if (handoffAction && !isUrgentIntent && !isSpecificAdminOrHumanAfterTriage) {
      handoffAction = null;
    }

    const isBookingIntent =
      Boolean(extractedTime) &&
      !isCancelIntent &&
      !lowerMsg.includes('que horas') &&
      !lowerMsg.includes('lembrar') &&
      (lowerMsg.includes('agendar') ||
        lowerMsg.includes('marcar') ||
        lowerMsg.includes('confirmar') ||
        lowerMsg.includes('confirma') ||
        lowerMsg.includes('mudar') ||
        lowerMsg.includes('trocar') ||
        lowerMsg.includes('remarcar') ||
        lowerMsg.includes('quero') ||
        lowerMsg.includes('pode') ||
        lowerMsg.includes('ótimo') ||
        lowerMsg.includes('otimo') ||
        lowerMsg.includes('fechado') ||
        lowerMsg.includes('combinado') ||
        lowerMsg.includes('prefiro') ||
        lowerMsg.includes('bom') ||
        data.messageHistory.length > 0);

    // Verifica se o paciente pediu explicitamente um(a) Dr(a). que NÃO existe na clínica
    let unknownDoctorRequested: string | null = null;
    if (data.dentists && data.dentists.length > 0) {
      const docMention = data.newMessage.match(
        /\b(?:dr\.?|dra\.?|doutor|doutora)\s+([A-ZÀ-Ÿa-zà-ÿ]+)/i
      );
      if (docMention) {
        const mentionedFirstName = docMention[1].toLowerCase();
        const existsInClinic = data.dentists.some((d) =>
          d.name.toLowerCase().includes(mentionedFirstName)
        );
        if (!existsInClinic) {
          unknownDoctorRequested = `${docMention[0]}`;
        }
      }
    }

    if (lowerMsg.includes('[paciente enviou um áudio baixo/inaudível]')) {
      bookedAction = null;
      cancelledAction = null;
      handoffAction = null;
      cleanText = `Oi, ${firstName}! Recebi seu áudio aqui, mas o som saiu bem baixinho e não consegui ouvir direito. 😊|||Você pode gravar novamente falando um pouquinho mais perto do microfone ou me escrever por texto como posso te ajudar?`;
    } else if (isWeekendRequested) {
      bookedAction = null;
      cleanText = `Oi, ${firstName}! Nossa clínica atende de segunda a sexta-feira, das 08:00 às 18:00 (não abrimos aos sábados e domingos). 😊|||Posso deixar agendado para você no próximo dia útil às ${extractedTime || '09:00'}?`;
    } else if (unknownDoctorRequested) {
      bookedAction = null;
      const availableDocs = data.dentists!.map((d) => `${d.name} (${d.specialty})`).join(' e ');
      cleanText = `Oi, ${firstName}! O(a) ${unknownDoctorRequested} não faz parte do corpo clínico aqui da nossa clínica. 😊|||Hoje nossos especialistas são: ${availableDocs}. Gostaria de agendar seu horário com algum deles?`;
    } else if (isGenericHelpOrReceptionRequest) {
      handoffAction = null;
      const askedForHumanDirectly =
        lowerMsg.includes('atendente') ||
        lowerMsg.includes('recepção') ||
        lowerMsg.includes('recepcao') ||
        lowerMsg.includes('secretária') ||
        lowerMsg.includes('secretaria') ||
        lowerMsg.includes('humano');

      if (askedForHumanDirectly) {
        cleanText = `Oi, ${firstName}! Claro! Antes de te passar para a recepção, me conta rapidinho sobre o que seria (agendamento, dúvida de convênio/valores, financeiro ou alguma urgência/dor)? 😊|||Assim já consigo te adiantar por aqui na hora ou encaminhar seu caso filtrado para a pessoa certa!`;
      } else {
        cleanText = `Oi, ${firstName}! Claro, estou aqui para te ajudar! 😊|||Me conta o que você precisa hoje: gostaria de agendar ou remarcar uma consulta, tirar dúvida sobre convênios e valores, ou está sentindo alguma dor no momento?`;
      }
    } else if (!handoffAction && isUrgentIntent) {
      handoffAction = {
        reason: `Paciente relatou urgência/medicação: "${data.newMessage}"`,
        urgency: 'HIGH',
      };
    } else if (!handoffAction && isSpecificAdminOrHumanAfterTriage) {
      handoffAction = {
        reason: `Solicitação filtrada para recepção: "${data.newMessage}"`,
        urgency: 'NORMAL',
      };
    } else if (!cancelledAction && isCancelIntent) {
      cancelledAction = {
        reason: data.newMessage,
        contactPhone: effectivePhone,
      };
    } else if (!bookedAction && isBookingIntent && extractedTime) {
      const chosenDentist =
        data.dentists?.find((d) =>
          fullContextText.includes(d.name.split(' ')[1]?.toLowerCase() || d.name.toLowerCase())
        )?.name ||
        data.patientActiveAppointment?.dentistName ||
        data.dentists?.[0]?.name ||
        'Plantonista da Clínica';
      const chosenProc = fullContextText.includes('limpeza')
        ? 'Limpeza'
        : fullContextText.includes('avalia')
        ? 'Avaliação Inicial'
        : data.patientActiveAppointment?.procedureName || 'Consulta';
      bookedAction = {
        time: extractedTime,
        dentistName: chosenDentist,
        procedureName: chosenProc,
        contactPhone: effectivePhone,
        dayLabel: isTodayExplicit ? 'hoje' : isTomorrowRequested ? 'amanhã' : 'hoje',
      };
    }

    // Validação Determinística Direta em generateDentalAiReply (cobre tanto /api/ai/live-chat quanto WhatsApp/Simulador):
    if (bookedAction) {
      const [bh, bm] = bookedAction.time.split(':').map(Number);
      const bTotalMin = (isNaN(bh) ? 11 : bh) * 60 + (isNaN(bm) ? 0 : bm);
      const bDay = bookedAction.dayLabel === 'amanhã' ? 'amanhã' : 'hoje';

      if (isNaN(bh) || bh < 8 || bh >= 18) {
        const attemptedTime = bookedAction.time;
        bookedAction = null;
        cleanText = `Oi, ${firstName}! Nosso horário de atendimento é das 08:00 às 18:00, então às ${attemptedTime} a clínica está fechada. 😊|||${
          futureSlotsToday.length > 0
            ? `Para hoje ainda temos vaga às ${futureSlotsToday.join(' ou ')}, ou para amanhã às 09:00, 10:30, 14:00 e 16:00. Qual fica melhor para você?`
            : `Para amanhã temos horários disponíveis às 09:00, 10:30, 14:00 ou 16:00. Qual desses fica melhor para você?`
        }`;
      } else if (bDay === 'hoje' && bTotalMin <= nowTotalMinutes) {
        const attemptedTime = bookedAction.time;
        bookedAction = null;
        cleanText = `Oi, ${firstName}! Como agora já são ${nowTimeStr}, o horário das ${attemptedTime} de hoje já passou. 😅|||${
          futureSlotsToday.length > 0
            ? `Para hoje ainda consigo te atender às ${futureSlotsToday.join(' ou ')}, ou se preferir já deixo agendado para amanhã às ${attemptedTime}. Como fica melhor para você?`
            : `Nosso expediente de hoje já está encerrando, mas posso deixar agendado para você amanhã às ${attemptedTime}! Posso confirmar para amanhã?`
        }`;
      }
    }

    // Fallback inteligente caso o modelo retorne texto vazio em perguntas diretas
    if (!cleanText && !handoffAction && !cancelledAction && !bookedAction) {
      if (
        lowerMsg.includes('endereço') ||
        lowerMsg.includes('endereco') ||
        lowerMsg.includes('onde fica') ||
        lowerMsg.includes('localiza')
      ) {
        cleanText = `Oi, ${firstName}! Nosso endereço é: ${data.address}. 📍|||${data.aiCustomRules} Posso te ajudar com mais alguma dúvida?`;
      } else if (
        lowerMsg.includes('que horas') ||
        lowerMsg.includes('meu horário') ||
        lowerMsg.includes('minha consulta') ||
        lowerMsg.includes('lembrar')
      ) {
        if (data.patientActiveAppointment) {
          cleanText = `Oi, ${firstName}! Sua consulta de hoje está confirmada para às ${data.patientActiveAppointment.time} com ${data.patientActiveAppointment.dentistName} (${data.patientActiveAppointment.procedureName}). 😊|||Estamos te aguardando!`;
        } else {
          cleanText = `Oi, ${firstName}! Ainda não consta nenhuma consulta ativa marcada para você hoje.|||Gostaria de ver os horários disponíveis para agendar?`;
        }
      } else if (
        lowerMsg.includes('valor') ||
        lowerMsg.includes('preço') ||
        lowerMsg.includes('preco') ||
        lowerMsg.includes('grátis') ||
        lowerMsg.includes('gratis')
      ) {
        cleanText = `Oi, ${firstName}! Nossos valores particulares são: Avaliação Inicial R$ 150, Limpeza R$ 250 e Consulta de Urgência R$ 200. 😊|||Também atendemos pelos convênios ${data.acceptedInsurances.join(', ')}. Gostaria de agendar um horário?`;
      }
    }

    let finalReply = cleanText;

    if (handoffAction) {
      const isMedRequest =
        lowerMsg.includes('remédio') ||
        lowerMsg.includes('remedio') ||
        lowerMsg.includes('antibiótico') ||
        lowerMsg.includes('antibiotico') ||
        lowerMsg.includes('anti-inflamatório') ||
        lowerMsg.includes('receita');

      if (isMedRequest) {
        finalReply = `Oi, ${firstName}! Sinto muito que você esteja passando por esse desconforto. Como sou da recepção, não posso indicar medicamentos por segurança.|||Já avisei nossa equipe com prioridade máxima e a nossa atendente (ou o próprio doutor) vai te chamar aqui agora mesmo para te orientar e encaixar, tá bom?`;
      } else if (isUrgentIntent) {
        finalReply = `Oi, ${firstName}! Sinto muito que você esteja passando por isso. Já classifiquei seu atendimento como prioridade máxima aqui na clínica! 🚨|||Nossa recepção já recebeu o filtro do seu caso e vai te responder aqui agora mesmo para priorizar o seu encaixe com o doutor, tá bom?`;
      } else {
        finalReply = `Perfeito, ${firstName}! Já registrei o assunto do seu contato e transferi seu atendimento para a nossa recepção. 😊|||Uma de nossas atendentes já vai assumir a conversa por aqui para te ajudar com isso!`;
      }
    } else if (cancelledAction) {
      const c = cancelledAction as { reason: string; contactPhone: string };
      finalReply = `Tudo bem, ${firstName}! Já cancelei sua consulta aqui no sistema para você. 😊|||Deixei o seu número (${c.contactPhone || data.patientPhone}) salvo caso queira remarcar depois. É esse mesmo o seu melhor telefone?`;
    } else if (bookedAction) {
      const b = bookedAction as {
        time: string;
        dentistName: string;
        procedureName: string;
        contactPhone: string;
        dayLabel?: 'hoje' | 'amanhã';
      };
      finalReply = `Prontinho, ${firstName}! Deixei agendada sua consulta com ${b.dentistName} para ${b.dayLabel || 'hoje'} às ${b.time}. ✅|||Só para eu deixar certinho na ficha da recepção: seu melhor número para contato é este mesmo (${b.contactPhone || data.patientPhone})?`;
    }

    const bubbles = (finalReply || `Perfeito, ${firstName}! Como posso te ajudar?`)
      .split(/\|\|\||\n\n+/)
      .map((b) => b.replace(/\*/g, '').trim())
      .filter(Boolean);

    return {
      provider: hasGroqKey ? 'Groq AI' : 'OpenAI (GPT-4o-mini)',
      reply: bubbles.join('\n\n'),
      bubbles,
      bookedAction,
      cancelledAction,
      handoffAction,
    };
  }

  // Registra o gerador de IA no conector de WhatsApp Real (Baileys) e Simulador
  baileysSessionService.registerAiGenerator(async (input) => {
    return generateDentalAiReply({
      ...activeClinicConfig,
      ...input,
    });
  });

  app.post('/api/whatsapp-real/clinic-config', async (request) => {
    const body = request.body as Partial<typeof activeClinicConfig>;
    activeClinicConfig = {
      ...activeClinicConfig,
      ...body,
    };
    return { updated: true, config: activeClinicConfig };
  });

  /**
   * Rotas do Conector de WhatsApp Real (QR Code Nativo + Mensagens Ao Vivo)
   */
  app.post('/api/whatsapp-real/connect', async () => {
    return baileysSessionService.startSession();
  });

  app.get('/api/whatsapp-real/status', async () => {
    return baileysSessionService.getState();
  });

  app.post('/api/whatsapp-real/disconnect', async () => {
    return baileysSessionService.disconnectSession();
  });

  app.post('/api/whatsapp-real/send-staff', async (request) => {
    const schema = z.object({
      remoteJid: z.string(),
      text: z.string().min(1),
    });
    const { remoteJid, text } = schema.parse(request.body);
    await baileysSessionService.sendManualStaffMessage(remoteJid, text);
    return { sent: true };
  });

  /**
   * Rotas do Painel de Teste / Simulador Standalone (Sem WhatsApp)
   */
  app.post('/api/whatsapp-real/simulate', async (request, reply) => {
    const schema = z.object({
      phone: z.string().default('11 99999-8888'),
      patientName: z.string().default('Lucas Martins'),
      insuranceName: z.string().optional(),
      text: z.string().optional(),
      mediaType: z.enum(['text', 'audio']).optional(),
      audioBase64: z.string().optional(),
      audioMimeType: z.string().optional(),
    });
    try {
      const body = schema.parse(request.body);
      return await baileysSessionService.simulateIncomingMessage(body);
    } catch (err) {
      return reply.status(400).send({ error: (err as Error).message });
    }
  });

  app.post('/api/whatsapp-real/reset-simulator', async (request) => {
    const body = (request.body as { phone?: string }) || {};
    return baileysSessionService.resetSimulation(body.phone);
  });

  app.post('/api/whatsapp-real/reactivate-ai', async (request) => {
    const schema = z.object({
      remoteJid: z.string(),
    });
    const { remoteJid } = schema.parse(request.body);
    return { conversation: baileysSessionService.reactivateAiForConversation(remoteJid) };
  });

  /**
   * Endpoint de IA em Tempo Real (Conecta o Painel Web direto ao Groq!)
   */
  app.post('/api/ai/live-chat', async (request, reply) => {
    const schema = z.object({
      clinicName: z.string(),
      aiAssistantName: z.string(),
      address: z.string(),
      acceptedInsurances: z.array(z.string()),
      aiCustomRules: z.string(),
      patientName: z.string(),
      patientPhone: z.string(),
      messageHistory: z.array(
        z.object({
          sender: z.enum(['PATIENT', 'AI', 'HUMAN_STAFF']),
          content: z.string(),
        })
      ),
      newMessage: z.string(),
    });

    try {
      const data = schema.parse(request.body);
      return await generateDentalAiReply(data);
    } catch (err) {
      return reply.status(400).send({ error: (err as Error).message });
    }
  });

  /**
   * Endpoint oficial para receber eventos da Evolution API (WhatsApp Real)
   */
  app.post('/webhooks/whatsapp', async (request) => {
    const body = request.body as Record<string, any>;

    if (body?.event === 'messages.upsert' && body?.data?.key) {
      const data = body.data;
      const isAudio = Boolean(data.message?.audioMessage);
      const textContent =
        data.message?.conversation ||
        data.message?.extendedTextMessage?.text ||
        '';

      return whatsAppWebhookHandler.handleIncomingWebhook({
        instanceId: body.instance || 'instancia-sorriso-perfeito',
        remoteJid: data.key.remoteJid,
        fromMe: Boolean(data.key.fromMe),
        pushName: data.pushName,
        messageId: data.key.id,
        messageType: isAudio ? 'audio' : 'text',
        textContent,
      });
    }

    return whatsAppWebhookHandler.handleIncomingWebhook(body as any);
  });

  app.post('/api/simulator/patient-message', async (request, reply) => {
    const schema = z.object({
      clinicId: z.string(),
      patientPhone: z.string().default('5511988881111'),
      patientName: z.string().default('Mariana Costa'),
      text: z.string().min(1),
      instantReply: z.boolean().default(true),
    });

    const { clinicId, patientPhone, patientName, text, instantReply } = schema.parse(request.body);

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) {
      return reply.status(404).send({ error: 'Clínica não encontrada.' });
    }

    const result = await whatsAppWebhookHandler.handleIncomingWebhook({
      instanceId: clinic.whatsappInstanceId || 'instancia-sorriso-perfeito',
      remoteJid: `${patientPhone.replace(/\D/g, '')}@s.whatsapp.net`,
      fromMe: false,
      pushName: patientName,
      messageId: `sim-${Date.now()}`,
      messageType: 'text',
      textContent: text,
      customDebounceMs: instantReply ? 400 : 6000,
    });

    return result;
  });
}
