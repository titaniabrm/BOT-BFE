import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    const discordAuthUrl = new URL("https://discord.com/api/oauth2/authorize");
    discordAuthUrl.searchParams.set("client_id", process.env.DISCORD_CLIENT_ID || "");
    discordAuthUrl.searchParams.set(
      "redirect_uri",
      process.env.DISCORD_REDIRECT_URI || "http://localhost:3000/api/auth/discord"
    );
    discordAuthUrl.searchParams.set("response_type", "code");
    discordAuthUrl.searchParams.set("scope", "identify guilds.members.read");
    return NextResponse.redirect(discordAuthUrl.toString());
  }

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID || "",
      client_secret: process.env.DISCORD_CLIENT_SECRET || "",
      grant_type: "authorization_code",
      code,
      redirect_uri:
        process.env.DISCORD_REDIRECT_URI || "http://localhost:3000/api/auth/discord",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/?error=discord_oauth_failed", req.url));
  }

  const tokenData = await tokenRes.json();
  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const discordUser = await userRes.json();

  const robloxAuthUrl = new URL("https://apis.roblox.com/oauth/v1/authorize");
  robloxAuthUrl.searchParams.set("client_id", process.env.ROBLOX_CLIENT_ID || "");
  robloxAuthUrl.searchParams.set(
    "redirect_uri",
    process.env.ROBLOX_REDIRECT_URI || "http://localhost:3000/api/auth/roblox"
  );
  robloxAuthUrl.searchParams.set("scope", "openid profile");
  robloxAuthUrl.searchParams.set("response_type", "code");

  const response = NextResponse.redirect(robloxAuthUrl.toString());
  response.cookies.set("bfe_discord_id", String(discordUser.id), { httpOnly: true, path: "/" });
  response.cookies.set("bfe_discord_username", String(discordUser.username), {
    httpOnly: true,
    path: "/",
  });

  return response;
}
