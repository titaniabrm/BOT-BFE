import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BFE_CONFIG } from "@/config/constants";
import { SyncAndActionService } from "@/services/sync.service";
import { prisma } from "@/lib/prisma";
import { AuditLoggerService } from "@/services/logger.service";
import { PermissionService } from "@/services/permissions.service";

const ActionRequestSchema = z.object({
  targetDiscordId: z.string().min(5),
  action: z.enum(["PROMOTE", "DEMOTE", "EXILE", "UNEXILE"]),
  targetNewDiscordRoleId: z.string().optional(),
  reason: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const executorDiscordId =
      req.cookies.get("bfe_verified_session")?.value ||
      req.cookies.get("bfe_discord_id")?.value;

    if (!executorDiscordId) {
      return NextResponse.json(
        { error: "Sessão expirada. Faça a verificação OAuth 2.0 novamente." },
        { status: 401 }
      );
    }

    const executorMember = await prisma.member.findUnique({
      where: { discordId: executorDiscordId },
    });

    if (!executorMember || executorMember.status !== "VERIFIED" || executorMember.isLocked) {
      return NextResponse.json(
        { error: "Você precisa estar verificado via OAuth 2.0 do Roblox para executar ações." },
        { status: 403 }
      );
    }

    let executorRoleIds: string[] = [];
    if (executorMember.currentDiscordRoleId) {
      executorRoleIds.push(executorMember.currentDiscordRoleId);
    }

    if (process.env.DISCORD_BOT_TOKEN) {
      try {
        const res = await fetch(
          `https://discord.com/api/v10/guilds/${BFE_CONFIG.GUILD_ID}/members/${executorDiscordId}`,
          { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } }
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.roles)) {
            executorRoleIds = Array.from(new Set([...executorRoleIds, ...data.roles]));
          }
        }
      } catch {}
    }

    if (!PermissionService.canAccessDashboard(executorRoleIds, executorMember.currentDiscordRoleId)) {
      return NextResponse.json(
        { error: "Sua patente atual não possui autorização para executar ações na Dashboard." },
        { status: 403 }
      );
    }

    const body = ActionRequestSchema.parse(await req.json());
    const executorName = executorMember.robloxUsername || executorMember.discordUsername;

    if (body.action === "UNEXILE") {
      const target = await prisma.member.findUnique({
        where: { discordId: body.targetDiscordId },
      });
      if (!target) {
        return NextResponse.json({ error: "Membro não encontrado." }, { status: 404 });
      }

      const unexiled = await prisma.member.update({
        where: { discordId: body.targetDiscordId },
        data: { status: "VERIFIED", isLocked: false, exileReason: null },
      });

      await AuditLoggerService.log({
        action: "UNEXILE",
        targetMemberId: target.id,
        targetSnapshot: `${target.robloxUsername} (<@${target.discordId}>)`,
        executorDiscordId,
        executorName,
        oldRoleName: "EXILADO",
        newRoleName: "Desbloqueado (Sincronizado)",
        reason: body.reason,
        originChannel: "WEB_DASHBOARD",
      });

      return NextResponse.json({ success: true, member: unexiled });
    }

    const updatedMember = await SyncAndActionService.executeAdministrativeAction({
      executorDiscordId,
      executorName,
      executorRoleIds,
      targetDiscordId: body.targetDiscordId,
      action: body.action,
      targetNewDiscordRoleId: body.targetNewDiscordRoleId,
      reason: body.reason,
      originChannel: "WEB_DASHBOARD",
    });

    return NextResponse.json({ success: true, member: updatedMember });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Falha ao executar ação administrativa." },
      { status: 400 }
    );
  }
}
