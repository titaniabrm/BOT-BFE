import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const config = await prisma.systemConfig.findUnique({ where: { id: "default" } });
  return NextResponse.json({ config });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const config = await prisma.systemConfig.upsert({
    where: { id: "default" },
    update: {
      logChannelId: body.logChannelId,
      syncIntervalSeconds: Number(body.syncIntervalSeconds || 60),
    },
    create: {
      id: "default",
      guildId: "1551630465524572372",
      robloxGroupId: "171349866",
      logChannelId: body.logChannelId,
      syncIntervalSeconds: Number(body.syncIntervalSeconds || 60),
    },
  });
  return NextResponse.json({ config });
}
