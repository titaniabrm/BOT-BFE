import { Client, EmbedBuilder, TextChannel } from "discord.js";
import { ActionType } from "../config/constants";
import { prisma } from "../lib/prisma";

export interface CreateAuditLogInput {
  action: ActionType;
  targetMemberId?: string;
  targetSnapshot: string;
  executorDiscordId: string;
  executorName: string;
  oldRoleId?: string | null;
  oldRoleName?: string | null;
  newRoleId?: string | null;
  newRoleName?: string | null;
  reason?: string | null;
  originChannel?: string;
}

export class AuditLoggerService {
  private static discordClient: Client | null = null;

  static attachDiscordClient(client: Client) {
    this.discordClient = client;
  }

  static async log(input: CreateAuditLogInput) {
    const cleanReason =
      input.reason && input.reason.trim().length > 0 ? input.reason.trim() : null;

    const record = await prisma.auditLog.create({
      data: {
        action: input.action,
        targetMemberId: input.targetMemberId,
        targetSnapshot: input.targetSnapshot,
        executorDiscordId: input.executorDiscordId,
        executorName: input.executorName,
        oldRoleId: input.oldRoleId || null,
        oldRoleName: input.oldRoleName || "Nenhum",
        newRoleId: input.newRoleId || null,
        newRoleName: input.newRoleName || "Nenhum",
        reason: cleanReason,
        originChannel: input.originChannel || "WEB_DASHBOARD",
      },
    });

    await this.sendDiscordEmbed(record);
    return record;
  }

  private static async sendDiscordEmbed(log: {
    id: string;
    action: string;
    targetSnapshot: string;
    executorDiscordId: string;
    executorName: string;
    oldRoleName: string | null;
    newRoleName: string | null;
    reason: string | null;
    originChannel: string;
    createdAt: Date;
  }) {
    if (!this.discordClient || !this.discordClient.isReady()) return;

    const config = await prisma.systemConfig.findUnique({ where: { id: "default" } });
    const channelId = config?.logChannelId || process.env.DISCORD_LOG_CHANNEL_ID;
    if (!channelId || channelId === "ID_DO_CANAL_DE_LOGS_NO_DISCORD") return;

    try {
      const channel = (await this.discordClient.channels.fetch(channelId)) as TextChannel;
      if (!channel) return;

      const colorMap: Record<string, number> = {
        VERIFY: 0x00b4d8,
        PROMOTE: 0xd4af37,
        DEMOTE: 0xf97316,
        EXILE: 0xdc2626,
        UNEXILE: 0x22c55e,
        AUTO_SYNC: 0x3b82f6,
        SYNC_ERROR: 0x991b1b,
        UNAUTHORIZED_ATTEMPT: 0x7f1d1d,
      };

      const titleMap: Record<string, string> = {
        VERIFY: "🛡️ VERIFICAÇÃO MILITAR CONCLUÍDA",
        PROMOTE: "🎖️ PROMOÇÃO DE PATENTE — BFE",
        DEMOTE: "📙 REBAIXAMENTO DE PATENTE — BFE",
        EXILE: "📕 EXÍLIO E BLOQUEIO DISCIPLINAR — BFE",
        UNEXILE: "🔓 REVOGAÇÃO DE EXÍLIO — BFE",
        AUTO_SYNC: "🔄 SINCRONIZAÇÃO AUTOMÁTICA ROBLOX ↔ DISCORD",
        SYNC_ERROR: "⚠️ ERRO DE SINCRONIZAÇÃO",
        UNAUTHORIZED_ATTEMPT: "🚨 TENTATIVA DE AÇÃO SEM PERMISSÃO",
      };

      const embed = new EmbedBuilder()
        .setTitle(titleMap[log.action] || "📋 REGISTRO BFE")
        .setColor(colorMap[log.action] || 0xd4af37)
        .addFields(
          { name: "👤 Militar Afetado", value: log.targetSnapshot, inline: true },
          {
            name: "👮 Responsável",
            value: `${log.executorName} (<@${log.executorDiscordId}>)`,
            inline: true,
          },
          { name: "📡 Origem", value: `\`${log.originChannel}\``, inline: true },
          { name: "⬅️ Cargo Anterior", value: `\`${log.oldRoleName || "N/A"}\``, inline: true },
          { name: "➡️ Novo Cargo", value: `\`${log.newRoleName || "N/A"}\``, inline: true },
          {
            name: "📝 Motivo",
            value: log.reason ? log.reason : "*Não informado pelo responsável*",
            inline: false,
          }
        )
        .setFooter({ text: `1º B F ESP • Registro #${log.id.slice(-6)}` })
        .setTimestamp(log.createdAt);

      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error("[BFE Logger] Erro ao enviar log para o Discord:", err);
    }
  }
}
