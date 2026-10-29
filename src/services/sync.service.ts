import { Client } from "discord.js";
import {
  BFE_CONFIG,
  BFE_HIERARCHY,
  getRankByDiscordRoleId,
  getRankByRobloxNumber,
  RankDefinition,
} from "../config/constants";
import { prisma } from "../lib/prisma";
import { AuditLoggerService } from "./logger.service";
import { AdministrativeAction, PermissionService } from "./permissions.service";
import { RobloxService } from "./roblox.service";

export class SyncAndActionService {
  private static botClient: Client | null = null;

  static setBotClient(client: Client) {
    this.botClient = client;
  }

  static formatMilitaryNickname(prefix: string, robloxUsername: string): string {
    const raw = `${prefix} ${robloxUsername}`.trim();
    return raw.length > 32 ? raw.substring(0, 32) : raw;
  }

  static async syncMemberWithRoblox(
    discordId: string,
    options: { originChannel?: string; isInitialVerification?: boolean } = {}
  ) {
    const memberRecord = await prisma.member.findUnique({ where: { discordId } });
    if (!memberRecord || !memberRecord.robloxId) {
      throw new Error("Membro não possui conta Roblox vinculada no sistema. Use /verificar primeiro.");
    }

    if (memberRecord.status === "EXILED" || memberRecord.isLocked) {
      await this.stripAllHierarchyRolesOnDiscord(discordId);
      throw new Error("Sincronização bloqueada: Este usuário consta como EXILADO na BFE.");
    }

    const robloxInfo = await RobloxService.getUserGroupRank(memberRecord.robloxId, true);
    const matchedRank = robloxInfo.inGroup
      ? getRankByRobloxNumber(robloxInfo.rankNumber)
      : undefined;

    const oldRoleName = memberRecord.currentRoleName || "Sem Patente";
    const oldRoleId = memberRecord.currentDiscordRoleId;

    if (this.botClient && this.botClient.isReady()) {
      const guild = await this.botClient.guilds.fetch(BFE_CONFIG.GUILD_ID).catch(() => null);
      const guildMember = guild
        ? await guild.members.fetch(discordId).catch(() => null)
        : null;

      if (guildMember) {
        const allHierarchyRoleIds = BFE_HIERARCHY.map((r) => r.discordRoleId);
        const rolesToRemove = guildMember.roles.cache
          .filter(
            (role) =>
              allHierarchyRoleIds.includes(role.id) &&
              role.id !== matchedRank?.discordRoleId
          )
          .map((r) => r.id);

        if (rolesToRemove.length > 0) {
          await guildMember.roles.remove(rolesToRemove, "Sincronização de Patente BFE").catch(() => null);
        }

        if (matchedRank && !guildMember.roles.cache.has(matchedRank.discordRoleId)) {
          await guildMember.roles
            .add(matchedRank.discordRoleId, "Sincronização de Patente BFE")
            .catch(() => null);
        }

        const targetPrefix = matchedRank ? matchedRank.prefix : "[CIV]";
        const desiredNick = this.formatMilitaryNickname(
          targetPrefix,
          robloxInfo.robloxUsername
        );

        if (guildMember.manageable && guildMember.nickname !== desiredNick) {
          await guildMember.setNickname(desiredNick, "Padronização de Perfil BFE").catch(() => null);
        }
      }
    }

    const updatedMember = await prisma.member.update({
      where: { discordId },
      data: {
        robloxUsername: robloxInfo.robloxUsername,
        currentRobloxRank: robloxInfo.rankNumber,
        currentDiscordRoleId: matchedRank ? matchedRank.discordRoleId : null,
        currentRoleName: matchedRank ? matchedRank.name : "Sem Patente no Grupo",
        status: "VERIFIED",
        lastSyncedAt: new Date(),
      },
    });

    if (
      options.isInitialVerification ||
      oldRoleId !== (matchedRank?.discordRoleId ?? null)
    ) {
      await AuditLoggerService.log({
        action: options.isInitialVerification ? "VERIFY" : "AUTO_SYNC",
        targetMemberId: updatedMember.id,
        targetSnapshot: `${robloxInfo.robloxUsername} (<@${discordId}>)`,
        executorDiscordId: "SYSTEM",
        executorName: "Sistema Automático BFE",
        oldRoleId,
        oldRoleName,
        newRoleId: matchedRank?.discordRoleId || null,
        newRoleName: matchedRank?.name || "Sem Patente",
        reason: options.isInitialVerification
          ? "Vinculação e verificação via OAuth 2.0"
          : "Espelhamento automático de alteração na comunidade Roblox",
        originChannel: options.originChannel || "AUTO_SYNC",
      });
    }

    return { member: updatedMember, rank: matchedRank };
  }

  private static async stripAllHierarchyRolesOnDiscord(discordId: string) {
    if (!this.botClient || !this.botClient.isReady()) return;
    const guild = await this.botClient.guilds.fetch(BFE_CONFIG.GUILD_ID).catch(() => null);
    if (!guild) return;

    const guildMember = await guild.members.fetch(discordId).catch(() => null);
    if (!guildMember) return;

    const allHierarchyRoleIds = BFE_HIERARCHY.map((r) => r.discordRoleId);
    const toRemove = guildMember.roles.cache
      .filter((r) => allHierarchyRoleIds.includes(r.id))
      .map((r) => r.id);

    if (toRemove.length > 0) {
      await guildMember.roles.remove(toRemove, "Usuário Exilado da BFE").catch(() => null);
    }

    if (guildMember.manageable) {
      const exiledNick = this.formatMilitaryNickname(
        "[EXILADO]",
        guildMember.user.username
      );
      await guildMember.setNickname(exiledNick).catch(() => null);
    }
  }

  static async executeAdministrativeAction(params: {
    executorDiscordId: string;
    executorName: string;
    executorRoleIds: string[];
    targetDiscordId: string;
    action: AdministrativeAction;
    targetNewDiscordRoleId?: string;
    reason?: string;
    originChannel: string;
  }) {
    const targetMember = await prisma.member.findUnique({
      where: { discordId: params.targetDiscordId },
    });

    if (!targetMember || !targetMember.robloxId) {
      throw new Error("O militar alvo não está verificado no banco de dados da BFE.");
    }

    const currentRank = targetMember.currentDiscordRoleId
      ? getRankByDiscordRoleId(targetMember.currentDiscordRoleId) || null
      : null;

    let desiredNewRank: RankDefinition | undefined;
    if (params.action === "PROMOTE" || params.action === "DEMOTE") {
      if (params.targetNewDiscordRoleId) {
        desiredNewRank = getRankByDiscordRoleId(params.targetNewDiscordRoleId);
      } else {
        desiredNewRank =
          PermissionService.getAdjacentRank(
            targetMember.currentDiscordRoleId,
            params.action === "PROMOTE" ? "UP" : "DOWN"
          ) || undefined;
      }
    }

    const validation = PermissionService.validateAction({
      executorDiscordId: params.executorDiscordId,
      executorRoleIds: params.executorRoleIds,
      targetDiscordId: params.targetDiscordId,
      targetCurrentRank: currentRank,
      targetNewRank: desiredNewRank,
      isTargetExiled: targetMember.status === "EXILED" || targetMember.isLocked,
      action: params.action,
    });

    if (!validation.allowed) {
      await AuditLoggerService.log({
        action: "UNAUTHORIZED_ATTEMPT",
        targetMemberId: targetMember.id,
        targetSnapshot: `${targetMember.robloxUsername} (<@${targetMember.discordId}>)`,
        executorDiscordId: params.executorDiscordId,
        executorName: params.executorName,
        oldRoleName: currentRank?.name || "Nenhum",
        newRoleName: desiredNewRank?.name || params.action,
        reason: `Bloqueado: ${validation.errorReason}`,
        originChannel: params.originChannel,
      });

      throw new Error(validation.errorReason);
    }

    if (params.action === "EXILE") {
      await RobloxService.exileFromRobloxGroup(targetMember.robloxId);
      await this.stripAllHierarchyRolesOnDiscord(targetMember.discordId);

      const exiledMember = await prisma.member.update({
        where: { id: targetMember.id },
        data: {
          status: "EXILED",
          isLocked: true,
          currentDiscordRoleId: null,
          currentRoleName: "EXILADO",
          currentRobloxRank: 0,
          exiledByDiscordId: params.executorDiscordId,
          exiledAt: new Date(),
          exileReason: params.reason || null,
        },
      });

      await AuditLoggerService.log({
        action: "EXILE",
        targetMemberId: targetMember.id,
        targetSnapshot: `${targetMember.robloxUsername} (<@${targetMember.discordId}>)`,
        executorDiscordId: params.executorDiscordId,
        executorName: params.executorName,
        oldRoleId: currentRank?.discordRoleId || null,
        oldRoleName: currentRank?.name || "Sem Patente",
        newRoleName: "EXILADO (Bloqueado)",
        reason: params.reason,
        originChannel: params.originChannel,
      });

      return exiledMember;
    }

    if (!desiredNewRank) {
      throw new Error("Não foi possível determinar a patente de destino na hierarquia.");
    }

    await RobloxService.setUserGroupRank(
      targetMember.robloxId,
      desiredNewRank.robloxRankNumber
    );

    await this.syncMemberWithRoblox(targetMember.discordId, {
      originChannel: params.originChannel,
    });

    await AuditLoggerService.log({
      action: params.action,
      targetMemberId: targetMember.id,
      targetSnapshot: `${targetMember.robloxUsername} (<@${targetMember.discordId}>)`,
      executorDiscordId: params.executorDiscordId,
      executorName: params.executorName,
      oldRoleId: currentRank?.discordRoleId || null,
      oldRoleName: currentRank?.name || "Sem Patente",
      newRoleId: desiredNewRank.discordRoleId,
      newRoleName: desiredNewRank.name,
      reason: params.reason,
      originChannel: params.originChannel,
    });

    return prisma.member.findUnique({ where: { id: targetMember.id } });
  }
}
