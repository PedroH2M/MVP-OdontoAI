# 🦷 OdontoAI SaaS — Recepcionista Virtual IA & Gestão de Agenda

Plataforma Multi-tenant B2B para Clínicas Odontológicas que automatiza o atendimento no WhatsApp (texto e áudio), consulta horários livres de forma 100% determinística, realiza agendamentos sem conflito, envia lembretes 24h antes (Anti-No-Show) e transfere emergências para a recepcionista humana.

---

## 🏗️ Arquitetura em 6 Blocos

1. **Bloco 1 — Banco de Dados Multi-tenant (`packages/database`)**: Prisma + PostgreSQL com isolamento por `clinicId`, grades de horário com intervalo de almoço, catálogo de procedimentos e histórico de conversas.
2. **Bloco 2 — Motor de Agenda Determinística (`apps/api/src/modules/scheduling`)**: Cálculo exato de janelas disponíveis (`SlotCalculatorService`) + trava distribuída no Redis (`AppointmentBookingService`) contra *double booking*.
3. **Bloco 3 — Pipeline de WhatsApp, Áudio & Debounce (`apps/api/src/modules/whatsapp`)**: Integração Evolution API, transcrição de áudios via Whisper (Groq/OpenAI), agrupamento de mensagens picadas com Debounce de 6 segundos no BullMQ e pausa automática quando a secretária responde pelo celular.
4. **Bloco 4 — Orquestrador de IA & Tools (`apps/api/src/modules/ai`)**: System Prompt com tabela temporal de 14 dias + 4 Zod Tools + Motor Local Custo Zero para testes gratuitos + Worker de lembrete 24h.
5. **Bloco 5 — API Fastify (`apps/api/src/routes`)**: Rotas de ROI executivo, agenda, inbox em tempo real e simulador de WhatsApp.
6. **Bloco 6 — Painel Web Moderno & Clean (`apps/web`)**: Interface em Next.js + TailwindCSS desenhada para recepcionistas e dentistas.

---

## 🚀 Como Rodar o Projeto no seu Computador

### 1. Instalar dependências (na raiz do monorepo)
```bash
cd C:\Users\pedro.miguel\odonto-ai-saas
npm install
```

### 2. Testar o Painel Visual Imediatamente (Modo Demo Interativo — Sem precisar de Docker)
Você pode abrir o Frontend direto mesmo antes de subir o banco de dados:
```bash
npm run dev:web
```
Acesse **`http://localhost:3000`** no navegador. Clique no botão **"Simular Paciente no WhatsApp"** no topo direito para testar os 3 cenários (Dúvida de horários, Agendamento automático e Transbordo de Urgência/Dor).

### 3. Subir o Sistema Completo (Banco PostgreSQL + Redis + API + Frontend)
Se tiver o Docker Desktop instalado:
```bash
# 1. Sobe PostgreSQL e Redis
docker compose up -d

# 2. Cria o arquivo .env na raiz (copiando de .env.example)
copy .env.example .env

# 3. Gera o Prisma Client, cria as tabelas e popula a Clínica Sorriso Perfeito
npm run db:generate
npm run db:push
npm run db:seed

# 4. Inicia a API (porta 3333) e o Painel Web (porta 3000)
npm run dev:api
npm run dev:web
```

---

## 🔑 Como Configurar as Chaves de IA e WhatsApp para Produção

### Passo 1: Chave da OpenAI (`gpt-4o-mini`)
1. Acesse [platform.openai.com](https://platform.openai.com/) e crie sua conta.
2. Vá em **Settings > Billing** e adicione **$5 USD** (crédito mínimo que dura milhares de conversas).
3. Vá em **API Keys > Create new secret key**, copie a chave `sk-...` e cole em `OPENAI_API_KEY` no seu arquivo `.env`.

### Passo 2: Chave da Groq para Transcrição de Áudio Ultrarrápida (Gratuita)
1. Acesse [console.groq.com](https://console.groq.com/) e crie uma conta gratuita.
2. Gere uma API Key (`gsk_...`) e cole em `GROQ_API_KEY` no arquivo `.env`.

### Passo 3: Conectar o WhatsApp da Clínica (Evolution API)
1. Suba uma instância da **Evolution API** (via Docker) ou use um gateway como Z-API.
2. Crie uma instância com o nome configurado na clínica (ex: `instancia-sorriso-perfeito`).
3. Configure o Webhook da instância apontando para `https://seu-dominio-api.com/webhooks/whatsapp` (evento `MESSAGES_UPSERT`).
4. A secretária da clínica lê o QR Code no WhatsApp da clínica e o bot começa a atender imediatamente!
