import { messageBufferService } from '../whatsapp/index.js';
import { dentalAgentService } from './dental-agent.service.js';

/**
 * Conecta a fila de Debounce do WhatsApp (Bloco 3) ao Agente de IA (Bloco 4)
 */
export function registerAiConversationWorker() {
  messageBufferService.registerProcessor(async (payload) => {
    await dentalAgentService.processConsolidatedMessage(payload);
  });
}

export * from './prompt-builder.js';
export * from './agent-tools.js';
export * from './dental-agent.service.js';
export * from './reminder.worker.js';
