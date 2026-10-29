import { NextRequest, NextResponse } from "next/server";
import { BFE_CONFIG } from "@/config/constants";
import { prisma } from "@/lib/prisma";
import { PermissionService } from "@/services/permissions.service";

export async function GET(req: NextRequest) {
  const discordId =
    req.cookies.get("bfe_verified_session")?.value ||
    req.cookies.get("bfe_discord_id")?.value;

  if (!discordId) {
    return NextResponse.json({ authenticated: false, reason: "NOT_LOGGED_IN" });
  }

  const member = await prisma.member.findUnique({ where: { discordId } });

  if (!member || !member.robloxId || member.status !== "VERIFIED") {
    return NextResponse.json({
      authenticated: false,
      reason: "ROBLOX_OAUTH_NOT_VERIFIED",
    });
  }

  if (member.status === "EXILED" || member.isLocked) {
    return NextResponse.json({
      authenticated: false,
      reason: "EXILED_BLOCKED",
      member,
    });
  }

  // Busca todos os cargos atuais do militar no servidor Discord 1551630465524572372
  let discordRoleIds: string[] = [];
  if (member.currentDiscordRoleId) {
    discordRoleIds.push(member.currentDiscordRoleId);
  }

  if (process.env.DISCORD_BOT_TOKEN) {
    try {
      const guildMemberRes = await fetch(
        `https://discord.com/api/v10/guilds/${BFE_CONFIG.GUILD_ID}/members/${discordId}`,
        {
          headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
        }
      );
      if (guildMemberRes.ok) {
        const guildMemberData = await guildMemberRes.json();
        if (Array.isArray(guildMemberData.roles)) {
          discordRoleIds = Array.from(new Set([...discordRoleIds, ...guildMemberData.roles]));
        }
      }
    } catch {}
  }

  const authorizedForDashboard = PermissionService.canAccessDashboard(
    discordRoleIds,
    member.currentDiscordRoleId
  );

  return NextResponse.json({
    authenticated: true,
    authorizedForDashboard,
    member,
    discordRoleIds,
  });
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete("bfe_verified_session");
  res.cookies.delete("bfe_discord_id");
  res.cookies.delete("bfe_discord_username");
  return res;
}
