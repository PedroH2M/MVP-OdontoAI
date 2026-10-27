import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../../config/redis.js';

export interface DebouncedConversationJob {
  clinicId: string;
  conversationId: string;
  patientId: string;
  patientPhone: string;
}

type ConversationProcessorCallback = (
  payload: DebouncedConversationJob & { consolidatedMessage: string }
) => Promise<void>;

/**
 * Gerencia o Buffer e Debounce de mensagens do WhatsApp.
 * Se o paciente mandar 4 mensagens seguidas ("Oi", "Tudo bem?", "Tem vaga", "Pra sexta?"),
 * aguarda 6 segundos de silêncio e junta tudo em uma única chamada para a IA.
 */
export class MessageBufferService {
  private readonly DEBOUNCE_MS = 6000; // 6 segundos de janela de agrupamento
  private queue: Queue<DebouncedConversationJob> | null = null;
  private worker: Worker<DebouncedConversationJob> | null = null;
  private processorCallback: ConversationProcessorCallback | null = null;

  // Fallback em memória para desenvolvimento local caso o Redis esteja desligado
  private memoryBuffers = new Map<string, string[]>();
  private memoryTimers = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.initQueue();
  }

  private initQueue() {
    // Ativa fila BullMQ apenas se REDIS_ENABLED=true; caso contrário usa o buffer rápido em memória
    if (process.env.REDIS_ENABLED !== 'true') {
      return;
    }
    try {
      this.queue = new Queue<DebouncedConversationJob>('whatsapp-conversation-debounce', {
        connection: redis,
      });
    } catch {
      // Usa buffer em memória
    }
  }

  /**
   * Registra a função do Orquestrador de IA (Bloco 4) que será chamada
   * assim que o tempo de debounce expirar.
   */
  registerProcessor(callback: ConversationProcessorCallback) {
    this.processorCallback = callback;

    if (this.queue) {
      this.worker = new Worker<DebouncedConversationJob>(
        'whatsapp-conversation-debounce',
        async (job: Job<DebouncedConversationJob>) => {
          const consolidatedMessage = await this.consumeBuffer(
            job.data.clinicId,
            job.data.patientPhone
          );
          if (!consolidatedMessage || !this.processorCallback) return;

          await this.processorCallback({
            ...job.data,
            consolidatedMessage,
          });
        },
        { connection: redis, concurrency: 10 }
      );

      this.worker.on('error', (err) => {
        console.warn('[MessageBuffer Worker] Aviso:', err.message);
      });
    }
  }

  /**
   * Adiciona uma nova mensagem ao buffer do paciente e reinicia o cronômetro de 6 segundos.
   */
  async enqueuePatientMessage(
    jobData: DebouncedConversationJob,
    messageText: string,
    customDebounceMs?: number
  ): Promise<void> {
    const bufferKey = `wa:buffer:${jobData.clinicId}:${jobData.patientPhone}`;
    const jobId = `debounce-${jobData.clinicId}-${jobData.patientPhone}`;
    const delay = customDebounceMs ?? this.DEBOUNCE_MS;

    try {
      // 1. Empilha a frase na lista do Redis
      await redis.rpush(bufferKey, messageText);
      await redis.expire(bufferKey, 300); // Expira em 5 min por segurança

      if (!this.queue) throw new Error('Queue offline');

      // 2. Se já existe um Job esperando os 6 segundos, remove para reiniciar o timer
      const existingJob = await this.queue.getJob(jobId);
      if (existingJob) {
        await existingJob.remove();
      }

      // 3. Agenda novo disparo para daqui a 6 segundos
      await this.queue.add('process-buffered-messages', jobData, {
        jobId,
        delay,
        removeOnComplete: true,
        removeOnFail: 50,
      });
    } catch {
      // Fallback transparente em memória se o Redis não estiver rodando localmente
      const list = this.memoryBuffers.get(bufferKey) ?? [];
      list.push(messageText);
      this.memoryBuffers.set(bufferKey, list);

      const existingTimer = this.memoryTimers.get(jobId);
      if (existingTimer) clearTimeout(existingTimer);

      const timer = setTimeout(async () => {
        this.memoryTimers.delete(jobId);
        const messages = this.memoryBuffers.get(bufferKey) ?? [];
        this.memoryBuffers.delete(bufferKey);

        const consolidatedMessage = messages.join('\n');
        if (consolidatedMessage && this.processorCallback) {
          await this.processorCallback({
            ...jobData,
            consolidatedMessage,
          });
        }
      }, delay);

      this.memoryTimers.set(jobId, timer);
    }
  }

  /**
   * Lê todas as mensagens acumuladas na janela de debounce e limpa a lista do Redis
   */
  private async consumeBuffer(clinicId: string, patientPhone: string): Promise<string> {
    const bufferKey = `wa:buffer:${clinicId}:${patientPhone}`;
    const messages = await redis.lrange(bufferKey, 0, -1);
    await redis.del(bufferKey);
    return messages.join('\n').trim();
  }
}

export const messageBufferService = new MessageBufferService();
