import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncAndActionService } from "@/services/sync.service";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const discordId = req.cookies.get("bfe_discord_id")?.value;
  const discordUsername = req.cookies.get("bfe_discord_username")?.value || "Militar";

  if (!code || !discordId) {
    return NextResponse.redirect(new URL("/?error=oauth_missing_context", req.url));
  }

  const tokenRes = await fetch("https://apis.roblox.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.ROBLOX_CLIENT_ID!,
      client_secret: process.env.ROBLOX_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.ROBLOX_REDIRECT_URI!,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/?error=roblox_token_exchange_failed", req.url));
  }

  const tokenData = await tokenRes.json();

  const userInfoRes = await fetch("https://apis.roblox.com/oauth/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  const robloxProfile = await userInfoRes.json();
  const robloxId = String(robloxProfile.sub);
  const robloxUsername = String(robloxProfile.preferred_username || robloxProfile.name);

  const existingRecord = await prisma.member.findFirst({
    where: { OR: [{ discordId }, { robloxId }] },
  });

  if (existingRecord && (existingRecord.status === "EXILED" || existingRecord.isLocked)) {
    return NextResponse.redirect(new URL("/?error=user_exiled_blocked", req.url));
  }

  await prisma.member.upsert({
    where: { discordId },
    update: { robloxId, robloxUsername, discordUsername },
    create: {
      discordId,
      discordUsername,
      robloxId,
      robloxUsername,
      status: "VERIFIED",
    },
  });

  await SyncAndActionService.syncMemberWithRoblox(discordId, {
    isInitialVerification: true,
    originChannel: "OAUTH2_VERIFICATION",
  });

  const res = NextResponse.redirect(new URL("/?verified=success", req.url));
  res.cookies.set("bfe_verified_session", discordId, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
