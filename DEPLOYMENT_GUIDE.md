# 🚀 Guia de Deployment - BFE Command System

Este guia explica como fazer deploy do sistema BFE Command System para produção.

## 📋 Pré-requisitos

1. **Conta GitHub** - Para hospedar o código
2. **Conta Vercel** (gratuita) - Para a dashboard Next.js
3. **Conta Railway/Render** (gratuita) - Para o bot Discord
4. **Acesso administrativo** ao servidor Discord BFE
5. **API Roblox** configurada para o grupo BFE

## 🔧 Passo 1: Configurar Git e GitHub

### 1.1 Limpar arquivos não necessários
```bash
# Navegue até o diretório do projeto
cd "C:\Users\titan\OneDrive\Desktop\BOT BFE\bfe-command-system"

# Remover node_modules e arquivos de build
rm -rf node_modules/
rm -rf .next/
rm -rf *.db
rm -rf *.db-journal
```

### 1.2 Inicializar repositório Git
```bash
# Inicializar git
git init

# Configurar usuário (substitua com seus dados)
git config user.email "seu-email@exemplo.com"
git config user.name "Seu Nome"

# Adicionar remote do GitHub
git remote add origin https://github.com/titaniabrm/BOT-BFE.git
```

### 1.3 Primeiro commit e push
```bash
# Adicionar todos os arquivos
git add .

# Fazer commit
git commit -m "Initial commit: BFE Command System v1.1.0

Sistema integrado de gerenciamento de patentes Discord ↔ Roblox
Inclui:
- Dashboard web Next.js 14 com autenticação OAuth
- Bot Discord.js com comandos slash
- Sistema de sincronização Roblox ↔ Discord
- Painel administrativo com tema militar
- Banco de dados Prisma SQLite

Co-Authored-By: Claude Code <noreply@anthropic.com>"

# Renomear branch e fazer push
git branch -M main
git push -u origin main
```

## 🌐 Passo 2: Deploy da Dashboard (Vercel)

### 2.1 Acessar Vercel
1. Vá para [vercel.com](https://vercel.com)
2. Faça login com sua conta GitHub

### 2.2 Importar projeto
1. Clique em "Add New" → "Project"
2. Importe o repositório `titaniabrm/BOT-BFE`
3. Configure as opções:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

### 2.3 Configurar variáveis de ambiente
Adicione todas as variáveis do `.env.example` no painel da Vercel:

```env
# Banco de Dados Local SQLite (Zero configuração extra necessária)
DATABASE_URL="file:./bfe.db"

# Discord BFE (Servidor: 1551630465524572372)
DISCORD_GUILD_ID="1551630465524572372"
DISCORD_CLIENT_ID="1565054811420758087"
DISCORD_CLIENT_SECRET="SEU_CLIENT_SECRET_DISCORD"
DISCORD_BOT_TOKEN="SEU_BOT_TOKEN_DISCORD"
DISCORD_LOG_CHANNEL_ID="ID_DO_CANAL_DE_LOGS_NO_DISCORD"
DISCORD_REDIRECT_URI="https://SEU_DOMINIO_VERCEL.vercel.app/api/auth/discord"

# Comunidade Roblox BFE (Grupo: 171349866)
ROBLOX_GROUP_ID="171349866"
ROBLOX_CLIENT_ID="SEU_CLIENT_ID_OAUTH_ROBLOX"
ROBLOX_CLIENT_SECRET="SEU_CLIENT_SECRET_OAUTH_ROBLOX"
ROBLOX_OPEN_CLOUD_API_KEY="SUA_API_KEY_OPEN_CLOUD_ROBLOX"
ROBLOX_REDIRECT_URI="https://SEU_DOMINIO_VERCEL.vercel.app/api/auth/roblox"

# Segurança da Dashboard
JWT_SECRET="chave-militar-bfe-1bfesp-super-secreta-2026"
NEXT_PUBLIC_APP_URL="https://SEU_DOMINIO_VERCEL.vercel.app"
```

### 2.4 Deploy
1. Clique em "Deploy"
2. Aguarde o build completar
3. Anote o URL gerado (ex: `https://bfe-command-system.vercel.app`)

## 🤖 Passo 3: Deploy do Bot Discord (Railway)

### 3.1 Acessar Railway
1. Vá para [railway.app](https://railway.app)
2. Faça login com GitHub

### 3.2 Criar novo projeto
1. Clique em "New Project"
2. Escolha "Deploy from GitHub repo"
3. Selecione o repositório `BOT-BFE`

### 3.3 Configurar serviço
1. Railway detectará automaticamente o `railway.json`
2. Configure as variáveis de ambiente (mesmas do passo 2.3)
3. **Importante**: Adicione também:
   ```env
   NODE_ENV="production"
   ```

### 3.4 Configurar domínio (opcional)
1. No painel do projeto, vá em "Settings" → "Domains"
2. Adicione um domínio personalizado se necessário

## 🔄 Passo 4: Configurar Aplicações Discord

### 4.1 Portal de Desenvolvedor Discord
1. Acesse [Discord Developer Portal](https://discord.com/developers/applications)
2. Selecione sua aplicação BFE

### 4.2 Atualizar URLs de redirecionamento
1. Vá para "OAuth2" → "General"
2. Adicione as URLs:
   - `https://SEU_DOMINIO_VERCEL.vercel.app/api/auth/discord`
   - `https://SEU_DOMINIO_VERCEL.vercel.app/api/auth/discord/callback`

### 4.3 Configurar bot
1. Vá para "Bot" → "Privileged Gateway Intents"
2. Ative:
   - **SERVER MEMBERS INTENT** (obrigatório)
   - **MESSAGE CONTENT INTENT** (opcional)

## 🎮 Passo 5: Configurar Roblox

### 5.1 Criar aplicação OAuth no Roblox
1. Acesse [Roblox Developer Console](https://create.roblox.com/dashboard/credentials)
2. Crie uma nova aplicação OAuth 2.0
3. Configure as URLs de redirecionamento:
   - `https://SEU_DOMINIO_VERCEL.vercel.app/api/auth/roblox`
   - `https://SEU_DOMINIO_VERCEL.vercel.app/api/auth/roblox/callback`

### 5.2 Configurar API Open Cloud
1. Acesse [Roblox Open Cloud](https://create.roblox.com/credentials)
2. Crie uma nova API Key com permissões para o grupo BFE
3. Copie a API Key para as variáveis de ambiente

## 🛠️ Passo 6: Configurar Banco de Dados

### Opção A: SQLite (simples)
- O projeto já está configurado para SQLite
- Banco de dados será criado automaticamente
- **Limitação**: Não persistente em alguns serviços de hosting

### Opção B: PostgreSQL (recomendado para produção)
1. No Railway, adicione um serviço "PostgreSQL"
2. Atualize `DATABASE_URL` nas variáveis de ambiente:
   ```
   DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
   ```
3. Atualize o `schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
4. Execute migrações:
   ```bash
   npx prisma migrate dev --name init
   ```

## 📱 Passo 7: Testar o Sistema

### 7.1 Testar Dashboard
1. Acesse seu domínio Vercel
2. Tente fazer login com Discord
3. Teste a vinculação com Roblox
4. Verifique se as páginas carregam corretamente

### 7.2 Testar Bot Discord
1. Adicione o bot ao seu servidor Discord
2. Execute o comando de deploy de comandos:
   ```bash
   npm run bot:deploy
   ```
3. Teste os comandos:
   - `/verificar`
   - `/sincronizar`
   - `/promover`
   - `/rebaixar`
   - `/exilar`

### 7.3 Testar Sincronização
1. Use `/verificar` para vincular uma conta
2. Verifique se o cargo é atualizado no Discord
3. Teste promoções/rebaixamentos

## 🚨 Solução de Problemas Comuns

### Bot não responde
1. Verifique se o bot está online no Railway
2. Confirme o token do bot
3. Verifique as intents no Discord Developer Portal

### Dashboard não carrega
1. Verifique logs da Vercel
2. Confirme variáveis de ambiente
3. Teste localmente: `npm run dev`

### Erros de autenticação
1. Verifique URLs de redirecionamento
2. Confirme client ID e secret
3. Teste cada provedor separadamente

### Problemas com banco de dados
1. Para SQLite: certifique-se de permissões de escrita
2. Para PostgreSQL: verifique conexão
3. Execute `npx prisma db push` se necessário

## 📞 Suporte

Para suporte adicional:
1. Verifique logs nos painéis da Vercel e Railway
2. Consulte a documentação no README.md
3. Abra issues no GitHub

---

**🎉 Parabéns! Seu sistema BFE Command System está em produção!**

O sistema agora está rodando com:
- ✅ Dashboard web em Vercel
- ✅ Bot Discord em Railway
- ✅ Autenticação OAuth 2.0
- ✅ Sincronização Roblox ↔ Discord
- ✅ Painel administrativo completo

Lembre-se de manter backups do banco de dados e monitorar os logs regularmente.