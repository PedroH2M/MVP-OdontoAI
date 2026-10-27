# ☁️ Guia de Deploy 100% Gratuito (Custo R$ 0,00/mês)

Este guia mostra como ativar a **Inteligência Artificial Real (Texto + Voz)** e colocar todo o seu SaaS (**OdontoAI**) na internet gratuitamente sem precisar de cartão de crédito ou servidor VPS pago no início.

---

## Passo 1: Ativar a IA Real Gratuita na Groq (Leva 1 Minuto)

A **Groq Cloud** fornece gratuitamente tanto o cérebro da nossa recepcionista (**Llama 3.3 70B com Tool Calling**) quanto o transcritor de áudios do WhatsApp (**Whisper Large V3 Turbo**).

1. Acesse **[console.groq.com](https://console.groq.com/)** e entre com sua conta Google ou GitHub (não pede cartão de crédito).
2. No menu lateral esquerdo, clique em **API Keys** -> **Create API Key**.
3. Dê o nome `odonto-ai` e copie a chave gerada (ela começa com `gsk_...`).
4. Na pasta `C:\Users\pedro.miguel\odonto-ai-saas`, crie um arquivo chamado `.env` (copiando do `.env.example`) e cole sua chave:
   ```env
   GROQ_API_KEY="gsk_sua_chave_aqui"
   ```
Pronto! O nosso arquivo `dental-agent.service.ts` detecta automaticamente a chave `gsk_` e passa a usar o **Llama 3.3 70B** para conversar e agendar consultas + **Whisper** para transcrever áudios gratuitamente!

---

## Passo 2: Criar o Banco de Dados PostgreSQL Gratuito na Nuvem (Neon.tech)

Para não precisar instalar Docker ou PostgreSQL pesado na sua máquina:

1. Acesse **[neon.tech](https://neon.tech/)** e crie uma conta gratuita com seu GitHub/Google.
2. Clique em **New Project** e dê o nome `odonto-ai-db`.
3. Copie a **Connection String** que aparece na tela (começa com `postgresql://...`).
4. Cole no seu arquivo `.env` na linha `DATABASE_URL`:
   ```env
   DATABASE_URL="postgresql://usuario:senha@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require"
   ```
5. No terminal da pasta `C:\Users\pedro.miguel\odonto-ai-saas`, rode:
   ```bash
   npm run db:generate
   npm run db:push
   npm run db:seed
   ```
Isso criará todas as tabelas na nuvem e já cadastrará a *Clínica Sorriso Perfeito*!

---

## Passo 3: Publicar o Painel Web de Graça na Vercel (`apps/web`)

1. Suba a pasta `odonto-ai-saas` para um repositório privado no seu **GitHub**.
2. Acesse **[vercel.com](https://vercel.com/)** (Plano Hobby Gratuito) e clique em **Add New > Project**.
3. Selecione o seu repositório `odonto-ai-saas`.
4. Em **Root Directory**, selecione `apps/web`.
5. Clique em **Deploy**. Em 1 minuto você terá um link público com HTTPS (ex: `https://odonto-ai-painel.vercel.app`) para abrir no celular ou mandar para clientes testarem!

---

## Passo 4: Publicar a API de Graça no Render (`apps/api`)

1. Acesse **[render.com](https://render.com/)** e crie sua conta gratuita.
2. Clique em **New > Web Service** e conecte seu repositório do GitHub.
3. O Render lerá automaticamente o nosso arquivo `render.yaml`.
4. Adicione as duas variáveis de ambiente (`DATABASE_URL` do Neon e `GROQ_API_KEY` da Groq) e clique em **Create Web Service**.
5. Copie a URL gerada pelo Render (ex: `https://odonto-ai-api.onrender.com`) e coloque na variável `NEXT_PUBLIC_API_URL` lá no painel da Vercel.

---

## Quando migrar para uma VPS paga (R$ 35/mês)?
Apenas quando você fechar sua **primeira ou segunda clínica pagante** (que vai te pagar R$ 500 a R$ 1.200/mês). Com o dinheiro do próprio cliente, você contrata uma VPS simples (Hetzner, Hostinger ou DigitalOcean) para rodar a **Evolution API (WhatsApp)** 24h por dia sem limites!
