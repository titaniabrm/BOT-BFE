import { REST, Routes } from "discord.js";
import { BFE_CONFIG } from "../config/constants";
import { commands } from "./index";

async function deploy() {
  if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_CLIENT_ID) {
    throw new Error("Defina DISCORD_BOT_TOKEN e DISCORD_CLIENT_ID no arquivo .env");
  }
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
  console.log("[BFE] Registrando Slash Commands no servidor:", BFE_CONFIG.GUILD_ID);
  await rest.put(
    Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, BFE_CONFIG.GUILD_ID),
    { body: commands.map((c) => c.toJSON()) }
  );
  console.log("[BFE] Comandos registrados com sucesso!");
}

deploy().catch(console.error);
