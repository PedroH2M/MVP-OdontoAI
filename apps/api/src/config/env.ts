import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Carrega o .env da raiz do monorepo e do pacote atual
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3333),
  DATABASE_URL: z
    .string()
    .default('postgresql://odonto:odonto_password@localhost:5432/odonto_ai_db?schema=public'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  EVOLUTION_API_URL: z.string().default('http://localhost:8080'),
  EVOLUTION_API_KEY: z.string().default('dev-evolution-key'),
});

export const env = envSchema.parse(process.env);
