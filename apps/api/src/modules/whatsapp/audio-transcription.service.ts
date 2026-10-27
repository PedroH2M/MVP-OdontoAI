import { env } from '../../config/env.js';

export class AudioTranscriptionService {
  /**
   * Transcreve áudios enviados por pacientes no WhatsApp usando Whisper (Groq ou OpenAI).
   * Pacientes odontológicos frequentemente mandam áudios relatando dor ou dúvidas de horário.
   */
  async transcribeBase64Audio(base64Audio: string, mimeType: string = 'audio/ogg'): Promise<string> {
    const apiKey = env.GROQ_API_KEY || env.OPENAI_API_KEY;
    const isGroq = Boolean(env.GROQ_API_KEY);

    if (!apiKey) {
      console.warn('[AudioTranscription] Chave GROQ_API_KEY/OPENAI_API_KEY ausente. Retornando placeholder.');
      return '[Áudio recebido - transcrição indisponível sem chave de API configurada]';
    }

    try {
      const cleanBase64 = base64Audio.replace(/^data:audio\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');

      const formData = new FormData();
      const blob = new Blob([buffer], { type: mimeType });
      formData.append('file', blob, 'whatsapp-audio.ogg');
      formData.append('model', isGroq ? 'whisper-large-v3-turbo' : 'whisper-1');
      formData.append('language', 'pt');
      formData.append(
        'prompt',
        'Áudio de paciente para clínica odontológica sobre agendamento de consulta, limpeza, avaliação, dor de dente, canal, implante, aparelho ou convênio.'
      );

      const endpoint = isGroq
        ? 'https://api.groq.com/openai/v1/audio/transcriptions'
        : 'https://api.openai.com/v1/audio/transcriptions';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Falha Whisper (${response.status}): ${errText}`);
      }

      const result = (await response.json()) as { text: string };
      return `[Áudio transcrito do paciente]: "${result.text.trim()}"`;
    } catch (error) {
      console.error('[AudioTranscription] Erro na transcrição:', (error as Error).message);
      return '[Paciente enviou um áudio que não pôde ser transcrito claramente]';
    }
  }
}

export const audioTranscriptionService = new AudioTranscriptionService();
