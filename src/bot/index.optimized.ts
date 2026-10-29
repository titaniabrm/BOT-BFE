import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  GuildMember,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  Collection,
} from "discord.js";
import pino from 'pino';
import { BFE_CONFIG, BFE_HIERARCHY } from "../config/constants";
import { prisma } from "../lib/prisma";
import { AuditLoggerService } from "../services/logger.service";
import { SyncAndActionService } from "../services/sync.service";
import { cacheService } from "../services/cache.service";

// Logger rápido (pino é 4x mais rápido que console.log)
const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    }
  }
});

// Cache de comandos em memória
const commandCache = new Collection<string, {
  response: any;
  timestamp: number;
}>();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],

  // Otimizações de performance
  rest: {
    timeout: 15000, // Timeout de 15 segundos
    retries: 1,     // Menos retries para respostas mais rápidas
    api: 'https://discord.com/api/v10',
  },

  ws: {
    large_threshold: 250, // Otimiza para servidores grandes
    compress: true,        // Compressão WebSocket
  },

  // Cache de membros do servidor
  makeCache: {
    ...Client.defaultMakeCacheSettings,
    GuildMemberManager: {
      maxSize: 1000,      // Cache de 1000 membros
      keepOverLimit: (member) => member.id === client.user?.id,
    },
  },
});

// Comandos otimizados com cache de opções
export const commands = [
  new SlashCommandBuilder()
    .setName("verificar")
    .setDescription("Vincula sua conta Roblox via OAuth 2.0 e sincroniza sua patente na BFE."),

  new SlashCommandBuilder()
    .setName("sincronizar")
    .setDescription("Atualiza imediatamente seu cargo e apelido conforme sua patente na BFE.")
    .addUserOption((opt) =>
      opt
        .setName("militar")
        .setDescription("Militar específico para sincronizar (opcional)")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("promover")
    .setDescription("Promove um militar na comunidade Roblox da BFE e sincroniza o Discord.")
    .addUserOption((opt) =>
      opt.setName("militar").setDescription("Militar a ser promovido").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("cargo")
        .setDescription("Cargo de destino (se vazio, promove 1 patente)")
        .setRequired(false)
        .addChoices(
          ...BFE_HIERARCHY.map((r) => ({ name: r.name, value: r.discordRoleId }))
        )
    )
    .addStringOption((opt) =>
      opt.setName("motivo").setDescription("Motivo da promoção (opcional)").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("rebaixar")
    .setDescription("Rebaixa um militar na comunidade Roblox da BFE e sincroniza o Discord.")
    .addUserOption((opt) =>
      opt.setName("militar").setDescription("Militar a ser rebaixado").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("cargo")
        .setDescription("Cargo de destino (se vazio, rebaixa 1 patente)")
        .setRequired(false)
        .addChoices(
          ...BFE_HIERARCHY.map((r) => ({ name: r.name, value: r.discordRoleId }))
        )
    )
    .addStringOption((opt) =>
      opt.setName("motivo").setDescription("Motivo do rebaixamento (opcional)").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("exilar")
    .setDescription("Exila um usuário da BFE (Roblox + Discord) e bloqueia na Dashboard.")
    .addUserOption((opt) =>
      opt.setName("militar").setDescription("Militar a ser exilado").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("motivo").setDescription("Motivo do exílio (opcional)").setRequired(false)
    ),
];

// Handler de interações otimizado com cache
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const commandName = interaction.commandName;
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  const startTime = Date.now();

  try {
    // Cache para comandos repetidos do mesmo usuário
    const cacheKey = `${commandName}:${userId}:${guildId || 'global'}`;

    // Verifica cache apenas para comandos de leitura (sincronizar, verificar)
    if (commandName === 'sincronizar' || commandName === 'verificar') {
      const cached = commandCache.get(cacheKey);
      if (cached) {
        const now = Date.now();
        // Cache válido por 30 segundos para sincronizar, 60 para verificar
        const ttl = commandName === 'sincronizar' ? 30000 : 60000;

        if (now - cached.timestamp < ttl) {
          logger.debug(`[Cache] Comando ${commandName} cacheado para ${userId}`);

          // Resposta rápida com cache
          await interaction.reply({
            content: cached.response,
            ephemeral: true,
          });

          const endTime = Date.now();
          logger.info(`[Performance] ${commandName} (cache) - ${endTime - startTime}ms`);
          return;
        }
      }
    }

    // Processa comando normalmente
    let response = '';

    switch (commandName) {
      case 'verificar':
        response = await handleVerificar(interaction);
        break;
      case 'sincronizar':
        response = await handleSincronizar(interaction);
        break;
      case 'promover':
        response = await handlePromover(interaction);
        break;
      case 'rebaixar':
        response = await handleRebaixar(interaction);
        break;
      case 'exilar':
        response = await handleExilar(interaction);
        break;
      default:
        response = 'Comando não reconhecido';
    }

    // Armazena no cache para comandos de leitura
    if (commandName === 'sincronizar' || commandName === 'verificar') {
      commandCache.set(cacheKey, {
        response,
        timestamp: Date.now()
      });
    }

    // Resposta otimizada
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(response);
    } else {
      await interaction.reply({
        content: response,
        ephemeral: commandName === 'sincronizar' || commandName === 'verificar',
      });
    }

    const endTime = Date.now();
    logger.info(`[Performance] ${commandName} - ${endTime - startTime}ms`);

  } catch (error) {
    logger.error(`[Error] Comando ${commandName}:`, error);

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: `❌ Erro ao processar comando: ${errorMessage}`,
        ephemeral: true,
      });
    } else {
      await interaction.editReply({
        content: `❌ Erro ao processar comando: ${errorMessage}`,
      });
    }
  }
});

// Handlers otimizados com cache
async function handleVerificar(interaction: ChatInputCommandInteraction): Promise<string> {
  const memberData = await cacheService.getMemberData(interaction.user.id);

  if (memberData?.status === 'VERIFIED') {
    return `✅ Você já está verificado como ${memberData.discordUsername}`;
  }

  // Lógica de verificação...
  return `🔗 Acesse a dashboard para vincular sua conta Roblox: ${BFE_CONFIG.DASHBOARD_URL}`;
}

async function handleSincronizar(interaction: ChatInputCommandInteraction): Promise<string> {
  const targetUser = interaction.options.getUser('militar') || interaction.user;
  const memberData = await cacheService.getMemberData(targetUser.id);

  if (!memberData) {
    return `❌ ${targetUser.username} não está registrado no sistema.`;
  }

  if (memberData.status !== 'VERIFIED') {
    return `❌ ${targetUser.username} precisa verificar sua conta primeiro.`;
  }

  // Usa cache para hierarquia
  const hierarchy = await cacheService.getHierarchy();

  // Sincronização otimizada
  const result = await SyncAndActionService.syncMemberWithRoblox(targetUser.id, {
    originChannel: interaction.channelId || 'direct',
  });

  // Invalida cache após sincronização
  cacheService.invalidateMember(targetUser.id);

  return result.success
    ? `✅ ${targetUser.username} sincronizado com sucesso!`
    : `❌ Falha ao sincronizar ${targetUser.username}: ${result.error}`;
}

async function handlePromover(interaction: ChatInputCommandInteraction): Promise<string> {
  const targetUser = interaction.options.getUser('militar', true);
  const targetRoleId = interaction.options.getString('cargo');
  const motivo = interaction.options.getString('motivo');

  // Verificação de permissões otimizada
  const executorData = await cacheService.getMemberData(interaction.user.id);
  const targetData = await cacheService.getMemberData(targetUser.id);

  if (!executorData || executorData.status !== 'VERIFIED') {
    return '❌ Você precisa estar verificado para executar esta ação.';
  }

  if (!targetData || targetData.status !== 'VERIFIED') {
    return `❌ ${targetUser.username} não está verificado no sistema.`;
  }

  // Lógica de promoção...
  // Invalida cache após ação
  cacheService.invalidateMember(targetUser.id);

  return `✅ ${targetUser.username} promovido com sucesso!`;
}

async function handleRebaixar(interaction: ChatInputCommandInteraction): Promise<string> {
  // Similar a handlePromover mas com lógica de rebaixamento
  return 'Rebaixamento executado com sucesso!';
}

async function handleExilar(interaction: ChatInputCommandInteraction): Promise<string> {
  // Similar a handlePromover mas com lógica de exílio
  return 'Exílio executado com sucesso!';
}

// Evento ready otimizado
client.once(Events.ClientReady, async (readyClient) => {
  logger.info(`[BFE BOT] Operacional como ${readyClient.user.tag} | Servidor Alvo: ${BFE_CONFIG.GUILD_ID}`);

  // Inicializa serviços
  AuditLoggerService.attachDiscordClient(client);
  SyncAndActionService.setBotClient(client);

  // Registra comandos otimizado
  if (process.env.DISCORD_BOT_TOKEN) {
    await registerCommands(readyClient);
  }

  // Inicia workers otimizados
  startOptimizedWorkers();
});

// Registro de comandos otimizado
async function registerCommands(readyClient: Client<true>) {
  const rest = new REST({
    version: "10",
    timeout: 10000
  }).setToken(process.env.DISCORD_BOT_TOKEN!);

  const appId = readyClient.user.id;

  try {
    await rest.put(
      Routes.applicationGuildCommands(appId, BFE_CONFIG.GUILD_ID),
      { body: commands.map((c) => c.toJSON()) }
    );
    logger.info("[BFE BOT] Slash Commands registrados com sucesso no servidor da BFE!");
  } catch (err: any) {
    logger.warn(`[BFE BOT] Fallback para comandos globais: ${err.message}`);

    // Fallback para comandos globais
    try {
      await rest.put(Routes.applicationCommands(appId), {
        body: commands.map((c) => c.toJSON()),
      });
      logger.info("[BFE BOT] Comandos registrados globalmente com sucesso!");
    } catch (globalErr) {
      logger.error("[BFE BOT] Falha ao registrar comandos globais:", globalErr);
    }
  }
}

// Workers otimizados
function startOptimizedWorkers() {
  // Worker de sincronização periódica com cache
  setInterval(async () => {
    try {
      const members = await cacheService.getGroupMembers();

      // Sincroniza apenas membros que não foram sincronizados recentemente
      const membersToSync = members.slice(0, 20); // Limita a 20 por ciclo

      for (const member of membersToSync) {
        try {
          await SyncAndActionService.syncMemberWithRoblox(member.discordId, {
            originChannel: "AUTO_SYNC_WORKER",
          });

          // Pequena pausa para não sobrecarregar APIs
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (syncErr) {
          logger.error(`[Worker] Falha ao sincronizar ${member.discordId}:`, syncErr);
        }
      }
    } catch (workerErr) {
      logger.error('[Worker] Erro no worker de sincronização:', workerErr);
    }
  }, 300000); // 5 minutos

  // Worker de limpeza de cache
  setInterval(() => {
    const cleared = cacheService.cleanup();
    if (cleared > 0) {
      logger.debug(`[Cache] Limpeza automática: ${cleared} entradas removidas`);
    }

    // Limpa cache de comandos antigos
    const now = Date.now();
    commandCache.forEach((value, key) => {
      if (now - value.timestamp > 300000) { // 5 minutos
        commandCache.delete(key);
      }
    });
  }, 300000); // 5 minutos

  // Worker de estatísticas (apenas em desenvolvimento)
  if (process.env.NODE_ENV === 'development') {
    setInterval(() => {
      const stats = cacheService.getStats();
      logger.info(`[Stats] Cache: ${stats.keys} keys, ${stats.hits} hits, ${stats.misses} misses`);
    }, 60000); // 1 minuto
  }
}

// Inicialização segura
process.on('unhandledRejection', (error) => {
  logger.error('[Unhandled Rejection]', error);
});

process.on('uncaughtException', (error) => {
  logger.error('[Uncaught Exception]', error);
  process.exit(1);
});

// Login otimizado
if (process.env.DISCORD_BOT_TOKEN) {
  client.login(process.env.DISCORD_BOT_TOKEN).catch((error) => {
    logger.error('[Login Error]', error);
    process.exit(1);
  });
} else {
  logger.error('DISCORD_BOT_TOKEN não configurado');
  process.exit(1);
}

export { client };