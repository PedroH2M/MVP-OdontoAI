import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { registerAiConversationWorker } from './modules/ai/index.js';
import { dashboardRoutes } from './routes/dashboard.routes.js';
import { appointmentsRoutes } from './routes/appointments.routes.js';
import { conversationsRoutes } from './routes/conversations.routes.js';
import { webhooksRoutes } from './routes/webhooks.routes.js';

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'development' ? 'info' : 'warn',
    },
  });

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Rota raiz amigável caso o usuário abra http://localhost:3333 no navegador
  app.get('/', async () => ({
    status: 'online',
    service: 'OdontoAI Backend API (Porta 3333)',
    aiConfigured: Boolean(env.GROQ_API_KEY || env.OPENAI_API_KEY),
    painelVisualUrl: 'http://localhost:3000',
    message: 'A API está rodando! Para acessar o Painel Visual da Clínica, abra http://localhost:3000 no navegador.',
  }));

  // Healthcheck
  app.get('/health', async () => ({
    status: 'ok',
    service: 'odonto-ai-api',
    timestamp: new Date().toISOString(),
  }));

  // Registra as rotas modulares
  await app.register(dashboardRoutes);
  await app.register(appointmentsRoutes);
  await app.register(conversationsRoutes);
  await app.register(webhooksRoutes);

  // Inicializa o Worker que conecta o Debounce do WhatsApp ao Agente de IA
  registerAiConversationWorker();

  return app;
}

async function start() {
  const app = await buildServer();
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`🚀 [OdontoAI API] Servidor rodando em http://localhost:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
