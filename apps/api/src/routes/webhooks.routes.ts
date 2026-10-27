import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { generateText, tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { prisma } from '@odonto-ai/database';
import { env } from '../config/env.js';
import { whatsAppWebhookHandler } from '../modules/whatsapp/index.js';

export async function webhooksRoutes(app: FastifyInstance) {
  /**
   * Endpoint de IA em Tempo Real (Conecta o Painel Web direto ao Llama 3.3 70B da Groq!)
   * Recarrega o .env em tempo real e detecta chaves gsk_ mesmo se coladas em OPENAI_API_KEY.
   */
  app.post('/api/ai/live-chat', async (request, reply) => {
    dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });
    dotenv.config({ path: path.resolve(process.cwd(), '../../.env'), override: true });

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

    const data = schema.parse(request.body);

    const rawGroq = process.env.GROQ_API_KEY || env.GROQ_API_KEY || '';
    const rawOpenAi = process.env.OPENAI_API_KEY || env.OPENAI_API_KEY || '';

    // Detecta a chave da Groq (gsk_...) mesmo se o usuário tiver colado em OPENAI_API_KEY
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
      return reply.status(400).send({
        error: 'Chave GROQ_API_KEY ou OPENAI_API_KEY não encontrada no arquivo .env',
      });
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

    const systemPrompt = `Você é ${data.aiAssistantName}, recepcionista da clínica odontológica "${data.clinicName}" conversando pelo WhatsApp.
Data/Hora Atual: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.

Dados de consulta interna (NÃO despeje tudo isso de uma vez! Use apenas quando perguntarem):
- Endereço: ${data.address}
- Convênios: ${data.acceptedInsurances.join(', ')}
- Observações: ${data.aiCustomRules}
- Dentistas e vagas: Dr. Carlos Eduardo (Implantes/Geral: 09:00, 10:30, 14:00, 16:30) e Dra. Juliana Mendes (Estética/Orto: 09:30, 11:00, 15:00, 17:00)
- Valores base: Avaliação (R$ 150), Limpeza (R$ 250), Urgência (R$ 200)
- Paciente: ${data.patientName} (Tel: ${data.patientPhone})

COMO CONVERSAR DE FORMA 100% HUMANA NO WHATSAPP (MUITO IMPORTANTE):
1. PROIBIDO MANDAR TEXTÃO: Uma secretária humana nunca manda todas as informações, preços, endereço e lista de horários em uma mensagem só. Responda APENAS o que o paciente perguntou naquele momento.
2. UM PASSO DE CADA VEZ: Se o paciente pedir informações ou quiser marcar, responda a dúvida dele em 1 frase curta e faça UMA ÚNICA pergunta simples para dar o próximo passo (ex: "Você prefere pela manhã ou à tarde?" ou "Seria pelo convênio ou particular?"). Só ofereça 2 opções de horário quando já souber o que ele precisa.
3. DIVIDA EM 2 BALÕES CURTOS USANDO "|||": No WhatsApp, humanos mandam 2 mensagens curtinhas seguidas em vez de um parágrafo longo. Separe os balões com "|||".
   Exemplo perfeito:
   "Oi, ${firstName}! Tudo bem? 😊|||Sim, nós aceitamos Bradesco Dental para limpeza! Você prefere agendar na parte da manhã ou da tarde?"
4. Sem formatação de robô: NUNCA use listas com bolinhas (• ou -), nunca use asteriscos duplos (**), nunca pareça um menu automático.
5. FERRAMENTAS (TOOLS):
   - Se o paciente confirmar um horário específico para agendar, chame \`bookAppointment\`.
   - Se o paciente pedir para cancelar/desmarcar, chame \`cancelAppointment\`.
   - Se o paciente relatar dor forte, pós-operatório ou urgência, chame \`requestHumanHandoff\`.`;

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
          description: 'Agenda uma consulta quando o paciente confirma ou escolhe o horário.',
          parameters: z.object({
            time: z.string().describe('Horário escolhido no formato HH:mm (ex: "10:30")'),
            dentistName: z
              .string()
              .describe('Nome do dentista (ex: "Dr. Carlos Eduardo" ou "Dra. Juliana Mendes")'),
            procedureName: z
              .string()
              .describe('Nome do procedimento (ex: "Avaliação Inicial" ou "Limpeza / Profilaxia")'),
            contactPhone: z
              .string()
              .describe('Número de telefone de contato informado pelo paciente ou o número atual do perfil'),
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
              .describe('Número de telefone de contato do paciente para a recepcionista ligar depois'),
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
            'Transfere para a recepcionista humana em caso de dor aguda, pós-extração, urgência ou pedido de humano.',
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
      maxSteps: 2,
      temperature: 0.2,
    });

    // Higieniza caracteres Unicode especiais do modelo gpt-oss e garante resposta impecável pós-Tool
    const cleanText = (result.text || '')
      .replace(/[\u202f\u00a0]/g, ' ')
      .replace(/[\u2011]/g, '-')
      .replace(/\*\*/g, '*')
      .trim();

    let finalReply = cleanText;

    // Respostas determinísticas limpas e divididas em balões curtos pós-Tool
    if (handoffAction) {
      finalReply = `Oi, ${firstName}! Sinto muito que você esteja passando por essa dor.|||Já avisei nossa recepção com prioridade máxima e a nossa atendente vai te chamar aqui agora mesmo para te encaixar, tá bom?`;
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
      if (!finalReply || finalReply.includes('…') || finalReply.length < 20) {
        finalReply = `Prontinho, ${firstName}! Deixei agendada sua consulta com ${b.dentistName} para às ${b.time}. ✅|||Só para eu deixar certinho na ficha da recepção: seu melhor número para contato é este mesmo (${b.contactPhone || data.patientPhone})?`;
      }
    }

    // Divide em balões curtos de WhatsApp (por "|||" ou quebra dupla de linha)
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
  });
  /**
   * Endpoint oficial para receber eventos da Evolution API (WhatsApp Real)
   */
  app.post('/webhooks/whatsapp', async (request) => {
    const body = request.body as Record<string, any>;

    // Suporta tanto o formato nativo da Evolution API (messages.upsert) quanto o formato normalizado
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

    // Formato direto
    return whatsAppWebhookHandler.handleIncomingWebhook(body as any);
  });

  /**
   * Simulador Integrado de Paciente no WhatsApp (Permite testar o fluxo completo pelo Painel Web!)
   */
  app.post('/api/simulator/patient-message', async (request, reply) => {
    const schema = z.object({
      clinicId: z.string(),
      patientPhone: z.string().default('5511988881111'),
      patientName: z.string().default('Mariana Costa'),
      text: z.string().min(1),
      instantReply: z.boolean().default(true), // No simulador visual usa 400ms para resposta rápida
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
