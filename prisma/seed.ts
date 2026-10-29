import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.systemConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      guildId: "1551630465524572372",
      robloxGroupId: "171349866",
      logChannelId: process.env.DISCORD_LOG_CHANNEL_ID || null,
      syncIntervalSeconds: 60,
    },
  });
  console.log("[BFE SEED] Banco SQLite configurado com sucesso (Servidor: 1551630465524572372 | Grupo Roblox: 171349866).");
}

main()
  .catch((e) => {
    console.error("[BFE SEED ERRO]:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
