import dotenv from 'dotenv';
import path from 'path';
import { env } from '../../config/env.js';

export class AudioTranscriptionService {
  private resolveApiKey(): { apiKey: string; isGroq: boolean } {
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

    if (groqKey && groqKey !== 'gsk_...') {
      return { apiKey: groqKey, isGroq: true };
    }
    if (openAiKey && openAiKey !== 'sk-...') {
      return { apiKey: openAiKey, isGroq: false };
    }
    return { apiKey: '', isGroq: false };
  }

  /**
   * Transcreve um Buffer de áudio (ex: baixado diretamente do WhatsApp via Baileys)
   * usando Groq Whisper (whisper-large-v3-turbo) ou OpenAI Whisper (whisper-1).
   */
  async transcribeAudioBuffer(
    buffer: Buffer,
    mimeType: string = 'audio/ogg'
  ): Promise<{ text: string | null; error?: string }> {
    const { apiKey, isGroq } = this.resolveApiKey();

    if (!apiKey) {
      console.warn('[AudioTranscription] Chave GROQ_API_KEY/OPENAI_API_KEY ausente.');
      return {
        text: null,
        error: 'Chave GROQ_API_KEY/OPENAI_API_KEY ausente no .env',
      };
    }

    try {
      const cleanMime = (mimeType || 'audio/ogg').split(';')[0].trim() || 'audio/ogg';
      let ext = 'ogg';
      if (cleanMime.includes('mp4') || cleanMime.includes('m4a')) ext = 'm4a';
      else if (cleanMime.includes('mpeg') || cleanMime.includes('mp3')) ext = 'mp3';
      else if (cleanMime.includes('wav')) ext = 'wav';
      else if (cleanMime.includes('webm')) ext = 'webm';

      const formData = new FormData();
      const blob = new Blob([new Uint8Array(buffer)], { type: cleanMime });
      formData.append('file', blob, `whatsapp-audio.${ext}`);
      formData.append('model', isGroq ? 'whisper-large-v3-turbo' : 'whisper-1');
      formData.append('language', 'pt');
      formData.append(
        'prompt',
        'Áudio de paciente no WhatsApp de clínica odontológica falando sobre agendamento de consulta, limpeza, avaliação, dor de dente, canal, implante, aparelho, convênio ou pedindo ajuda.'
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

      const result = (await response.json()) as { text?: string };
      const cleanText = (result.text || '').trim();

      if (!cleanText) {
        return { text: null, error: 'Áudio vazio ou sem fala detectada' };
      }

      return { text: cleanText };
    } catch (error) {
      console.error('[AudioTranscription] Erro na transcrição:', (error as Error).message);
      return { text: null, error: (error as Error).message };
    }
  }

  /**
   * Transcreve áudios em Base64 enviados por pacientes no WhatsApp ou Simulador.
   */
  async transcribeBase64Audio(base64Audio: string, mimeType: string = 'audio/ogg'): Promise<string> {
    const cleanBase64 = base64Audio.replace(/^data:audio\/[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const res = await this.transcribeAudioBuffer(buffer, mimeType);
    if (res.text) {
      return res.text;
    }
    return '[Paciente enviou um áudio que não pôde ser transcrito claramente]';
  }
}

export const audioTranscriptionService = new AudioTranscriptionService();
