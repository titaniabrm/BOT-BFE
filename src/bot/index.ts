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
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import { BFE_CONFIG, BFE_HIERARCHY } from "../config/constants";
import { prisma } from "../lib/prisma";
import { AuditLoggerService } from "../services/logger.service";
import { SyncAndActionService } from "../services/sync.service";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

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

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`[BFE BOT] Operacional como ${readyClient.user.tag} | Servidor Alvo: ${BFE_CONFIG.GUILD_ID}`);
  AuditLoggerService.attachDiscordClient(client);
  SyncAndActionService.setBotClient(client);

  if (process.env.DISCORD_BOT_TOKEN) {
    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
    const appId = readyClient.user.id;

    try {
      await rest.put(
        Routes.applicationGuildCommands(appId, BFE_CONFIG.GUILD_ID),
        { body: commands.map((c) => c.toJSON()) }
      );
      console.log("[BFE BOT] Slash Commands registrados com sucesso no servidor da BFE!");
    } catch (err: any) {
      console.warn(
        `\n⚠️ [AVISO DISCORD 50001]: O bot não conseguiu registrar comandos exclusivos na guilda ${BFE_CONFIG.GUILD_ID}.`
      );
      console.warn(
        `👉 Certifique-se de que o bot está no servidor usando este link de convite oficial:`
      );
      console.warn(
        `https://discord.com/oauth2/authorize?client_id=${appId}&permissions=8&scope=bot%20applications.commands\n`
      );

      // Fallback automático: Registra como comando global para nunca derrubar o bot
      try {
        await rest.put(Routes.applicationCommands(appId), {
          body: commands.map((c) => c.toJSON()),
        });
        console.log("[BFE BOT] Comandos registrados globalmente como fallback com sucesso!");
      } catch (globalErr) {
        console.error("[BFE BOT] Falha ao registrar comandos globais:", globalErr);
      }
    }
  }

  // Worker de Sincronização Contínua Roblox -> Discord
  setInterval(async () => {
    try {
      const verifiedMembers = await prisma.member.findMany({
        where: { status: "VERIFIED", isLocked: false },
        take: 30,
        orderBy: { lastSyncedAt: "asc" },
      });

      for (const member of verifiedMembers) {
        try {
          await SyncAndActionService.syncMemberWithRoblox(member.discordId, {
            originChannel: "AUTO_SYNC_WORKER",
          });
        } catch (syncErr) {
          console.error(`[BFE BOT] Falha ao sincronizar ${member.discordId}:`, syncErr);
        }
      }
    } catch (workerErr) {
      console.error('[BFE BOT] Erro no worker de sincronização:', workerErr);
    }
  }, 60_000);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    switch (interaction.commandName) {
      case "verificar":
        await handleVerifyCommand(interaction);
        break;
      case "sincronizar":
        await handleSyncCommand(interaction);
        break;
      case "promover":
      case "rebaixar":
      case "exilar":
        await handleAdminActionCommand(interaction);
        break;
    }
  } catch (err: any) {
    const msg = err?.message || "Erro interno ao processar comando.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: `❌ **Falha na operação:** ${msg}` });
    } else {
      await interaction.reply({ content: `❌ **Falha na operação:** ${msg}`, ephemeral: true });
    }
  }
});

async function handleVerifyCommand(interaction: ChatInputCommandInteraction) {
  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/discord?intent=verify`;

  const embed = new EmbedBuilder()
    .setTitle("🦅 SISTEMA CENTRAL DE VERIFICAÇÃO — 1º B F ESP")
    .setDescription(
      "Para vincular sua conta **Roblox** ao Discord da **BFE (Batalhão de Forças Especiais)** via **OAuth 2.0**:\n\n" +
        "1. Clique no botão abaixo para autenticar com segurança.\n" +
        "2. O sistema identificará sua patente atual na comunidade Roblox (`171349866`).\n" +
        "3. Seu cargo e prefixo militar (`[PATENTE] Username`) serão aplicados automaticamente."
    )
    .setColor(0xd4af37)
    .setFooter({ text: "BFE • Sincronização Oficial Roblox ↔ Discord" });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Verificar com OAuth 2.0 (Discord + Roblox)")
      .setStyle(ButtonStyle.Link)
      .setURL(verifyUrl)
  );

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handleSyncCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const targetUser = interaction.options.getUser("militar") || interaction.user;

  const { member, rank } = await SyncAndActionService.syncMemberWithRoblox(targetUser.id, {
    originChannel: `DISCORD_CMD (/sincronizar por ${interaction.user.username})`,
  });

  await interaction.editReply({
    content: `✅ **Sincronização Concluída!**\n**Militar:** \`${member.robloxUsername}\`\n**Patente Atual:** \`${rank ? rank.name : "Sem Patente"}\``,
  });
}

async function handleAdminActionCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const executorMember = interaction.member as GuildMember;
  const executorRoleIds = Array.from(executorMember.roles.cache.keys());
  const targetUser = interaction.options.getUser("militar", true);
  const desiredRoleId = interaction.options.getString("cargo") || undefined;
  const reason = interaction.options.getString("motivo") || undefined;

  const actionMap: Record<string, "PROMOTE" | "DEMOTE" | "EXILE"> = {
    promover: "PROMOTE",
    rebaixar: "DEMOTE",
    exilar: "EXILE",
  };

  const updated = await SyncAndActionService.executeAdministrativeAction({
    executorDiscordId: interaction.user.id,
    executorName: interaction.user.username,
    executorRoleIds,
    targetDiscordId: targetUser.id,
    action: actionMap[interaction.commandName],
    targetNewDiscordRoleId: desiredRoleId,
    reason,
    originChannel: `DISCORD_CMD (/${interaction.commandName})`,
  });

  await interaction.editReply({
    content:
      `🎖️ **Ação Executada com Sucesso!**\n` +
      `• **Militar:** <@${targetUser.id}> (\`${updated?.robloxUsername}\`)\n` +
      `• **Nova Situação/Patente:** \`${updated?.currentRoleName}\`\n` +
      `• **Motivo:** ${reason ? reason : "*Não informado*"}`,
  });
}

if (process.env.DISCORD_BOT_TOKEN) {
  client.login(process.env.DISCORD_BOT_TOKEN);
}
