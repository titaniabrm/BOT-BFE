# 🦅 BFE Command System - Sistema de Integração Discord ↔ Roblox

![BFE Banner](https://img.shields.io/badge/BFE-Command%20System-red)
![Version](https://img.shields.io/badge/version-1.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Next.js](https://img.shields.io/badge/Next.js-14.2.7-black)
![Discord.js](https://img.shields.io/badge/Discord.js-14.16.2-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5.4-blue)

Sistema integrado de gerenciamento de patentes entre Discord e Roblox para o **1º Batalhão de Forças Especiais (BFE)**. Controle total de hierarquia militar via Dashboard web com autenticação OAuth 2.0.

## ✨ Características Principais

### 🤖 Bot Discord
- **Comandos Slash** integrados com verificação de permissões
- **Sincronização automática** de patentes Roblox → Discord
- **Sistema de logs** completo com auditoria de todas as ações
- **Validação de segurança** com prevenção de auto-promoção

### 🌐 Dashboard Web
- **Painel administrativo** com tema vermelho/preto militar
- **Autenticação OAuth 2.0** (Discord + Roblox)
- **Gerenciamento visual** de membros e patentes
- **Histórico completo** de todas as ações executadas
- **Interface responsiva** e moderna

### 🔒 Sistema de Segurança
- **Validação hierárquica** baseada em pesos de patente
- **Prevenção de ações não autorizadas**
- **Bloqueio de auto-ações** (não pode promover/rebaixar a si mesmo)
- **Logging detalhado** de todas as operações

## 🚀 Tecnologias Utilizadas

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Bot**: Discord.js 14, TypeScript
- **Banco de Dados**: SQLite (Prisma)
- **Autenticação**: OAuth 2.0 (Discord + Roblox)
- **Deploy**: Vercel (recomendado)

## 📋 Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Conta Discord com servidor
- Grupo Roblox com API habilitada
- Conta no Roblox para integração

## ⚙️ Configuração

### 1. Clone o repositório
```bash
git clone https://github.com/titaniabrm/BOT-BFE.git
cd bfe-command-system
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure as variáveis de ambiente
Crie um arquivo `.env` na raiz do projeto baseado no `.env.example`:

```env
# Discord
DISCORD_BOT_TOKEN=seu_token_do_bot_discord
DISCORD_CLIENT_ID=seu_client_id_discord
DISCORD_CLIENT_SECRET=seu_client_secret_discord
DISCORD_GUILD_ID=id_do_servidor_discord

# Roblox
ROBLOX_API_KEY=sua_api_key_roblox
ROBLOX_GROUP_ID=id_do_grupo_roblox

# Next.js
NEXTAUTH_SECRET=seu_secret_nextauth
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Banco de Dados
DATABASE_URL="file:./dev.db"
```

### 4. Configure o banco de dados
```bash
npm run db:push
npm run db:seed
```

### 5. Configure os comandos do bot
```bash
npm run bot:deploy
```

### 6. Inicie o projeto
```bash
# Modo desenvolvimento
npm run dev

# Bot em desenvolvimento (separado)
npm run bot:dev
```

## 🎮 Comandos do Bot Discord

### `/verificar`
Vincule sua conta Roblox via OAuth 2.0 e sincronize sua patente na BFE.

### `/sincronizar`
Atualize imediatamente seu cargo e apelido conforme sua patente na BFE.
- **Opção**: `militar` (opcional) - Militar específico para sincronizar

### `/promover`
Promova um militar na comunidade Roblox da BFE e sincronize no Discord.
- **Opções**: 
  - `militar` (obrigatório) - Militar a ser promovido
  - `cargo` (opcional) - Cargo de destino (se vazio, promove 1 patente)
  - `motivo` (opcional) - Motivo da promoção

### `/rebaixar`
Rebaixe um militar na comunidade Roblox da BFE e sincronize no Discord.
- **Opções**: 
  - `militar` (obrigatório) - Militar a ser rebaixado
  - `cargo` (opcional) - Cargo de destino (se vazio, rebaixa 1 patente)
  - `motivo` (opcional) - Motivo do rebaixamento

### `/exilar`
Exile um usuário da BFE (Roblox + Discord) e bloqueie na Dashboard.
- **Opções**:
  - `militar` (obrigatório) - Militar a ser exilado
  - `motivo` (opcional) - Motivo do exílio

## 🖥️ Dashboard Web

### Acesso
1. Acesse `http://localhost:3000` (ou seu domínio de deploy)
2. Clique em "Autenticar via OAuth 2.0"
3. Faça login com Discord
4. Vincule sua conta Roblox
5. Acesso concedido apenas para patentes autorizadas

### Funcionalidades da Dashboard

#### 📊 Visão Geral
- Estatísticas em tempo real
- Últimas ações registradas
- Membros exilados e pendentes

#### 👥 Gerenciamento de Membros
- Lista completa de membros verificados
- Filtros por patente e status
- Ações rápidas (promover, rebaixar, exilar)

#### ⚡ Central de Ações
- Execução de ações administrativas
- Seleção de nova patente
- Registro de motivo (opcional)

#### 📝 Logs de Auditoria
- Histórico completo de todas as ações
- Filtros por tipo, usuário e responsável
- Timestamps detalhados

#### ⚙️ Configurações
- Visualização de parâmetros do sistema
- Mapeamento de IDs de cargos
- Informações do grupo Roblox

## 🏗️ Estrutura do Projeto

```
bfe-command-system/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API Routes
│   │   │   ├── auth/       # Autenticação OAuth
│   │   │   ├── actions/    # Ações administrativas
│   │   │   ├── logs/       # Logs de auditoria
│   │   │   └── members/    # Gerenciamento de membros
│   │   ├── globals.css     # Estilos globais
│   │   ├── layout.tsx      # Layout principal
│   │   └── page.tsx        # Dashboard principal
│   ├── bot/                # Bot Discord
│   │   ├── index.ts        # Bot principal
│   │   └── deploy-commands.ts # Deploy de comandos
│   ├── config/             # Configurações
│   │   └── constants.ts    # Constantes do sistema
│   ├── lib/                # Utilitários
│   │   └── prisma.ts       # Cliente Prisma
│   └── services/           # Serviços
│       ├── sync.service.ts # Sincronização Roblox↔Discord
│       ├── permissions.service.ts # Validação de permissões
│       ├── roblox.service.ts # API Roblox
│       └── logger.service.ts # Sistema de logs
├── prisma/                 # Prisma ORM
│   ├── schema.prisma      # Schema do banco
│   └── seed.ts            # Dados iniciais
├── public/                # Arquivos estáticos
└── package.json          # Dependências
```

## 🔧 Configuração de Permissões

### Hierarquia BFE
O sistema usa um sistema de pesos para determinar hierarquia:

| Patente | Peso | Permissões |
|---------|------|------------|
| Comandante | 100 | Acesso total |
| Subcomandante | 90 | Todas ações |
| Capitão | 80 | Promover/Rebaixar até 2 níveis abaixo |
| Tenente | 70 | Promover/Rebaixar até 1 nível abaixo |
| Sargento | 60 | Apenas visualização |

### Cargos Administrativos
IDs específicos no Discord podem ter permissões especiais:
- `PROMOTE_ROLE_ID` - Permite apenas promoções
- `DEMOTE_ROLE_ID` - Permite apenas rebaixamentos
- `EXILE_ROLE_ID` - Permite apenas exílios

## 🚢 Deployment

### Vercel (Recomendado)
```bash
# Instale a CLI da Vercel
npm i -g vercel

# Faça login
vercel login

# Deploy
vercel
```

### Configuração de Variáveis no Vercel
Adicione todas as variáveis do `.env` no painel da Vercel.

### Manter o Bot Online
Use um serviço como:
- **Railway** (recomendado para bots)
- **Heroku**
- **Fly.io**
- Servidor VPS

## 🐛 Solução de Problemas

### Bot não responde aos comandos
1. Verifique se o token do bot está correto
2. Confirme se o bot tem as intents necessárias
3. Execute `npm run bot:deploy` para registrar comandos

### Dashboard não carrega
1. Verifique as variáveis de ambiente
2. Confirme se o banco de dados está configurado
3. Verifique os logs do servidor

### Sincronização Roblox falha
1. Confirme a API key do Roblox
2. Verifique se o usuário está no grupo
3. Confirme as permissões da API

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 👥 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📞 Suporte

Para suporte, abra uma issue no GitHub ou entre em contato através do Discord.

---

**Desenvolvido com ❤️ para o 1º Batalhão de Forças Especiais (BFE)**