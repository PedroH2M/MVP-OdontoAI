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
    } | null = null;
    let cancelledAction: {
      reason: string;
      contactPhone: string;
    } | null = null;
    let handoffAction: { reason: string; urgency: 'HIGH' | 'NORMAL' } | null = null;
    const firstName = data.patientName.split(' ')[0];

    const dentistsList =
      data.dentists && data.dentists.length > 0
        ? data.dentists
            .map((d) => `${d.name} (${d.specialty} - Horários base: 09:00, 10:30, 14:00, 16:00)`)
            .join(' | ')
        : 'Plantonista da Clínica (Horários base: 09:00, 10:30, 14:00, 16:00)';

    const occupiedSummary =
      data.occupiedSlots && data.occupiedSlots.length > 0
        ? data.occupiedSlots.map((s) => `${s.time} com ${s.dentistName} (OCUPADO)`).join(', ')
        : 'Nenhum horário ocupado ainda hoje';

    const currentPatientApptSummary = data.patientActiveAppointment
      ? `Possui consulta ativa hoje às ${data.patientActiveAppointment.time} com ${data.patientActiveAppointment.dentistName} (${data.patientActiveAppointment.procedureName})`
      : 'Nenhuma consulta ativa agendada para este paciente hoje';

    const systemPrompt = `Você é ${data.aiAssistantName}, recepcionista da clínica odontológica "${data.clinicName}" conversando pelo WhatsApp.
Data/Hora Atual: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.

Dados de consulta interna (NÃO despeje tudo isso de uma vez! Use apenas quando perguntarem):
- Endereço: ${data.address}
- Expediente: Segunda a Sexta, das 08:00 às 18:00.
- Convênios aceitos: ${data.acceptedInsurances.join(', ')} (NÃO aceitamos outros convênios fora desta lista).
- Observações: ${data.aiCustomRules}
- Dentistas cadastrados na clínica: ${dentistsList}
- Horários JÁ OCUPADOS na agenda de hoje (NÃO ofereça e NÃO agende nestes horários): ${occupiedSummary}
- Status atual deste paciente (${data.patientName}, Tel: ${data.patientPhone}): ${currentPatientApptSummary}
- Valores particulares base: Avaliação (R$ 150), Limpeza (R$ 250), Urgência (R$ 200)

COMO CONVERSAR DE FORMA 100% HUMANA E SEGURA NO WHATSAPP (MUITO IMPORTANTE):
1. PROIBIDO MANDAR TEXTÃO: Responda APENAS o que o paciente perguntou naquele momento em frases curtas.
2. UM PASSO DE CADA VEZ: Faça apenas UMA pergunta simples por vez.
3. DIVIDA EM 2 BALÕES CURTOS USANDO "|||": Separe suas 2 mensagens curtas com "|||".
   Exemplo: "Oi, ${firstName}! Tudo bem? 😊|||Sim, nós aceitamos Bradesco Dental para limpeza! Você prefere agendar na parte da manhã ou da tarde?"
4. Sem formatação de robô: NUNCA use listas com bolinhas (• ou -), nunca use asteriscos duplos (**).
5. REGRAS CRÍTICAS DE AGENDA E ÉTICA CLÍNICA:
   - NUNCA agende em um horário que já consta como OCUPADO para aquele dentista e NUNCA agende fora das 08:00 às 18:00.
   - Se o paciente já tem consulta ativa hoje e pedir para TROCAR/REMARCAR para outro horário livre, chame APENAS \`bookAppointment\` com o novo horário (o sistema já substitui o antigo automaticamente).
   - Se o paciente pedir para cancelar/desmarcar e ele tiver consulta ativa, chame \`cancelAppointment\`. Se ele NÃO tiver consulta ativa, avise que não encontrou agendamento no número dele e peça para ele confirmar o nome ou telefone.
   - PROIBIDO RECEITAR REMÉDIOS: Você é recepcionista, não dentista. Se o paciente pedir receita de antibiótico/anti-inflamatório ou relatar dor forte, inchaço, sangramento ou pós-extração, NUNCA indique medicamentos e chame IMEDIATAMENTE \`requestHumanHandoff\`.`;

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
            }),
            execute: async ({ time, dentistName, procedureName, contactPhone }) => {
              bookedAction = { time, dentistName, procedureName, contactPhone };
              return {
                success: true,
                time,
                dentistName,
                procedureName,
                contactPhone,
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
              'Transfere para a recepcionista humana em caso de dor aguda, inchaço, pós-extração, pedido de receita de medicamento ou urgência.',
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

    // Extrator Determinístico Pós-LLM: garante que nenhuma intenção clara de agendamento, cancelamento ou urgência passe em branco mesmo se o modelo esquecer de disparar a Tool JSON
    const lowerMsg = data.newMessage.toLowerCase();
    const timeMatch = lowerMsg.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    const isCancelIntent =
      lowerMsg.includes('cancelar') ||
      lowerMsg.includes('desmarcar') ||
      lowerMsg.includes('não vou poder ir') ||
      lowerMsg.includes('nao vou poder ir');
    const isUrgentIntent =
      lowerMsg.includes('dor') ||
      lowerMsg.includes('doendo') ||
      lowerMsg.includes('inchad') ||
      lowerMsg.includes('sangrando') ||
      lowerMsg.includes('antibiótico') ||
      lowerMsg.includes('antibiotico') ||
      lowerMsg.includes('anti-inflamatório') ||
      lowerMsg.includes('remédio') ||
      lowerMsg.includes('remedio') ||
      lowerMsg.includes('extração') ||
      lowerMsg.includes('extracao');
    const isBookingIntent =
      Boolean(timeMatch) &&
      !isCancelIntent &&
      (lowerMsg.includes('agendar') ||
        lowerMsg.includes('marcar') ||
        lowerMsg.includes('confirmar') ||
        lowerMsg.includes('confirma') ||
        lowerMsg.includes('mudar') ||
        lowerMsg.includes('trocar') ||
        lowerMsg.includes('remarcar') ||
        lowerMsg.includes('quero') ||
        lowerMsg.includes('pode ser'));

    if (!handoffAction && isUrgentIntent) {
      handoffAction = {
        reason: `Paciente relatou urgência/medicação: "${data.newMessage}"`,
        urgency: 'HIGH',
      };
    } else if (!cancelledAction && isCancelIntent) {
      cancelledAction = {
        reason: data.newMessage,
        contactPhone: data.patientPhone,
      };
    } else if (!bookedAction && isBookingIntent && timeMatch) {
      const chosenDentist =
        data.dentists?.find((d) =>
          lowerMsg.includes(d.name.split(' ')[1]?.toLowerCase() || d.name.toLowerCase())
        )?.name ||
        data.patientActiveAppointment?.dentistName ||
        data.dentists?.[0]?.name ||
        'Plantonista da Clínica';
      const chosenProc = lowerMsg.includes('limpeza')
        ? 'Limpeza'
        : lowerMsg.includes('avalia')
        ? 'Avaliação Inicial'
        : data.patientActiveAppointment?.procedureName || 'Consulta';
      bookedAction = {
        time: timeMatch[0],
        dentistName: chosenDentist,
        procedureName: chosenProc,
        contactPhone: data.patientPhone,
      };
    }

    let finalReply = cleanText;

    if (handoffAction) {
      finalReply = `Oi, ${firstName}! Sinto muito que você esteja passando por esse desconforto. Como sou da recepção, não posso indicar medicamentos por segurança.|||Já avisei nossa equipe com prioridade máxima e a nossa atendente (ou o próprio doutor) vai te chamar aqui agora mesmo para te orientar e encaixar, tá bom?`;
    } else if (cancelledAction) {
      const c = cancelledAction as { reason: string; contactPhone: string };
      finalReply = `Tudo bem, ${firstName}! Já cancelei sua consulta aqui no sistema para você. 😊|||Deixei o seu número (${c.contactPhone || data.patientPhone}) salvo caso queira remarcar depois. É esse mesmo o seu melhor telefone?`;
    } else if (bookedAction) {
      const b = bookedAction as {
        time: string;
        dentistName: string;
        procedureName: string;
        contactPhone: string;
      };
      finalReply = `Prontinho, ${firstName}! Deixei agendada sua consulta com ${b.dentistName} para às ${b.time}. ✅|||Só para eu deixar certinho na ficha da recepção: seu melhor número para contato é este mesmo (${b.contactPhone || data.patientPhone})?`;
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
      text: z.string().min(1),
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
