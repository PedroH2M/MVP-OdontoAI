import { env } from '../../config/env.js';

export interface SendMessageOptions {
  instanceId: string;
  phone: string;
  text: string;
  simulateTyping?: boolean;
}

export class WhatsAppProvider {
  private readonly baseUrl = env.EVOLUTION_API_URL;
  private readonly apiKey = env.EVOLUTION_API_KEY;

  /**
   * Envia status "digitando..." (composing) no WhatsApp do paciente
   * para gerar experiência humanizada antes da resposta chegar.
   */
  async sendTypingPresence(instanceId: string, phone: string, durationMs: number = 1500): Promise<void> {
    if (this.isSimulationMode(instanceId)) {
      return;
    }

    try {
      await fetch(`${this.baseUrl}/chat/sendPresence/${instanceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey,
        },
        body: JSON.stringify({
          number: phone,
          options: {
            delay: durationMs,
            presence: 'composing',
          },
        }),
      });
    } catch (err) {
      console.warn('[WhatsAppProvider] Falha ao enviar presence:', (err as Error).message);
    }
  }

  /**
   * Envia mensagem de texto para o paciente via Evolution API.
   * Quebra respostas longas em blocos naturais se houver múltiplos parágrafos.
   */
  async sendTextMessage(options: SendMessageOptions): Promise<void> {
    const { instanceId, phone, text, simulateTyping = true } = options;
    const cleanPhone = phone.replace(/\D/g, '');

    // Divide em até 2 blocos se houver quebra dupla de parágrafo para parecer humano
    const paragraphs = text
      .split('\n\n')
      .map((p) => p.trim())
      .filter(Boolean);

    for (const chunk of paragraphs) {
      if (simulateTyping) {
        const typingTime = Math.min(Math.max(chunk.length * 25, 1200), 3500);
        await this.sendTypingPresence(instanceId, cleanPhone, typingTime);
        await this.sleep(this.isSimulationMode(instanceId) ? 200 : typingTime);
      }

      if (this.isSimulationMode(instanceId)) {
        console.log(`📲 [WhatsApp Simulado -> ${cleanPhone}]: ${chunk}`);
        continue;
      }

      const response = await fetch(`${this.baseUrl}/message/sendText/${instanceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey,
        },
        body: JSON.stringify({
          number: cleanPhone,
          text: chunk,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`[WhatsAppProvider] Erro ao enviar mensagem (${response.status}):`, body);
      }
    }
  }

  /**
   * Baixa o arquivo de áudio em Base64 pela Evolution API quando o paciente envia mensagem de voz
   */
  async downloadMediaBase64(instanceId: string, messageKeyId: string): Promise<string | null> {
    if (this.isSimulationMode(instanceId)) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/getBase64FromMediaMessage/${instanceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey,
        },
        body: JSON.stringify({
          message: {
            key: { id: messageKeyId },
          },
          convertToMp4: false,
        }),
      });

      if (!response.ok) return null;
      const data = (await response.json()) as { base64?: string };
      return data.base64 ?? null;
    } catch (err) {
      console.error('[WhatsAppProvider] Erro ao baixar mídia:', (err as Error).message);
      return null;
    }
  }

  /**
   * Solicita o QR Code de pareamento da instância na Evolution API
   * para a secretária ler com o celular da clínica direto no Painel Web.
   */
  async getInstanceQrCode(instanceId: string): Promise<{
    status: 'CONNECTED' | 'QRCODE';
    qrCodeBase64?: string;
    pairingCode?: string;
  }> {
    if (this.isSimulationMode(instanceId)) {
      return {
        status: 'QRCODE',
        pairingCode: 'ODONTO-AI-2026',
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/instance/connect/${instanceId}`, {
        method: 'GET',
        headers: {
          apikey: this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Status ${response.status}`);
      }

      const data = (await response.json()) as {
        base64?: string;
        code?: string;
        instance?: { state?: string };
      };

      if (data.instance?.state === 'open') {
        return { status: 'CONNECTED' };
      }

      return {
        status: 'QRCODE',
        qrCodeBase64: data.base64,
        pairingCode: data.code,
      };
    } catch (err) {
      console.warn('[WhatsAppProvider] Fallback QR Code:', (err as Error).message);
      return {
        status: 'QRCODE',
        pairingCode: 'ODONTO-AI-2026',
      };
    }
  }

  private isSimulationMode(instanceId: string): boolean {
    return (
      this.apiKey === 'dev-evolution-key' ||
      instanceId.startsWith('sim-') ||
      instanceId === 'instancia-sorriso-perfeito'
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const whatsAppProvider = new WhatsAppProvider();
