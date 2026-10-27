# 🦷 OdontoAI SaaS — Recepcionista Virtual IA & Gestão de Agenda

Plataforma SaaS White-Label para Clínicas Odontológicas que automatiza o atendimento no WhatsApp, realiza agendamentos determinísticos sem conflito de horário, gerencia cancelamentos e remarcações, confirma telefone de contato e transfere casos de urgência/dor para a recepcionista humana.

---

## 🔗 Endereços do Sistema

| Ambiente | URL Local | Função |
| :--- | :--- | :--- |
| **Painel Oficial (Cliente Final)** | **`http://localhost:3000`** | Interface limpa para a Clínica (Agenda do Dia, WhatsApp da Recepção, Cadastro de Profissionais, Personalização White-Label e Conexão QR Code). |
| **Painel Oculto de Testes (Dev/QA)** | **`http://localhost:3000/simulador`** | Simulador standalone de WhatsApp com celular virtual, cenários de 1 clique e inspector de `Tool Calls` (não requer celular conectado). |
| **Servidor Backend (API Fastify)** | **`http://localhost:3333`** | Motor de IA (Groq), regras determinísticas de agenda e conector nativo de WhatsApp (`@whiskeysockets/baileys`). |

---

## 🚀 Como Rodar em Outro PC (Passo a Passo Rápido)

Você **não precisa de Docker** para rodar o painel, a IA e o conector de WhatsApp Real. Basta ter o **Node.js** instalado:

### 1. Clonar o repositório e instalar as dependências
```bash
git clone https://github.com/PedroH2M/MVP-OdontoAI.git
cd MVP-OdontoAI
npm install
```
*(O comando `npm install` já executa automaticamente o `prisma generate` via script `postinstall`).*

### 2. Configurar a chave da IA (Groq)
Copie o arquivo de exemplo `.env.example` para `.env`:
```bash
copy .env.example .env
```
Abra o arquivo `.env` e cole a sua chave gratuita da Groq ([console.groq.com](https://console.groq.com)):
```env
GROQ_API_KEY="gsk_sua_chave_aqui"
```

### 3. Iniciar o Backend e o Frontend
Abra dois terminais na pasta do projeto:

**Terminal 1 (API na porta 3333):**
```bash
npm run dev:api
```

**Terminal 2 (Painel Web na porta 3000):**
```bash
npm run dev:web
```

---

## 📲 Como Conectar um WhatsApp Real
1. Acesse **`http://localhost:3000`**.
2. No menu lateral inferior esquerdo, clique em **Conectar QR Code**.
3. No seu celular, abra o WhatsApp em **Aparelhos Conectados > Conectar um aparelho** e escaneie o QR Code exibido na tela.
4. Para desconectar ou trocar de número a qualquer momento, clique novamente em **WhatsApp Conectado > Desconectar / Gerar Novo QR Code**.

---

## 🛡️ Regras de Negócio e Segurança Clínica Validadas (QA)
- **Anti-Overbooking Determinístico**: Impede que dois pacientes agendem no mesmo horário com o mesmo profissional, sugerindo automaticamente os horários livres restantes.
- **Remarcação Inteligente**: Quando um paciente pede para mudar seu horário, o sistema cancela o horário antigo e confirma o novo sem duplicar o agendamento.
- **Cancelamento Verificado**: Confirma se o paciente realmente possui consulta ativa antes de cancelar e salva o telefone de contato para retorno da recepção.
- **Validação de Corpo Clínico**: Só permite agendar com os dentistas cadastrados pela clínica na aba **Profissionais**.
- **Trava de Segurança Clínica**: Nunca receita medicamentos (antibióticos/anti-inflamatórios) e aciona transbordo humano imediato (`WAITING_HUMAN`) em casos de dor aguda, inchaço ou pós-operatório.
