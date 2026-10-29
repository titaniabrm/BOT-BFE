export const BFE_CONFIG = {
  GUILD_ID: process.env.DISCORD_GUILD_ID || "1551630465524572372",
  ROBLOX_GROUP_ID: Number(process.env.ROBLOX_GROUP_ID || "171349866"),
  ROBLOX_GROUP_URL:
    "https://www.roblox.com/pt/communities/171349866/BFE-Batalh-o-de-For-as-Especiais#!/about",
};

export type ActionType =
  | "VERIFY"
  | "PROMOTE"
  | "DEMOTE"
  | "EXILE"
  | "UNEXILE"
  | "AUTO_SYNC"
  | "SYNC_ERROR"
  | "UNAUTHORIZED_ATTEMPT";

export interface RankDefinition {
  discordRoleId: string;
  name: string;
  prefix: string;
  weight: number;
  robloxRankNumber: number;
}

export const BFE_HIERARCHY: RankDefinition[] = [
  {
    discordRoleId: "1551630466136805457",
    name: "[CAN] Candidato",
    prefix: "[CAN]",
    weight: 10,
    robloxRankNumber: 1,
  },
  {
    discordRoleId: "1551630466136805458",
    name: "[PR] Praças",
    prefix: "[PR]",
    weight: 20,
    robloxRankNumber: 20,
  },
  {
    discordRoleId: "1554648755712827504",
    name: "[GD] Graduado",
    prefix: "[GD]",
    weight: 30,
    robloxRankNumber: 40,
  },
  {
    discordRoleId: "1551630466136805459",
    name: "[OF] Oficiais",
    prefix: "[OF]",
    weight: 40,
    robloxRankNumber: 60,
  },
  {
    discordRoleId: "1551630466136805460",
    name: "[GEN] General",
    prefix: "[GEN]",
    weight: 50,
    robloxRankNumber: 80,
  },
  {
    discordRoleId: "1551630466136805461",
    name: "[SUP] Supervisor",
    prefix: "[SUP]",
    weight: 60,
    robloxRankNumber: 100,
  },
  {
    discordRoleId: "1551630466136805462",
    name: "[SUP-G] Supervisor Geral",
    prefix: "[SUP-G]",
    weight: 70,
    robloxRankNumber: 120,
  },
  {
    discordRoleId: "1551630466136805465",
    name: "[SEC-C] Secretário do Comando",
    prefix: "[SEC-C]",
    weight: 80,
    robloxRankNumber: 140,
  },
  {
    discordRoleId: "1551630466153455726",
    name: "[SCMT] Subcomandante",
    prefix: "[SCMT]",
    weight: 90,
    robloxRankNumber: 180,
  },
  {
    discordRoleId: "1551630466153455727",
    name: "[CMT] Comandante",
    prefix: "[CMT]",
    weight: 100,
    robloxRankNumber: 200,
  },
  {
    discordRoleId: "1551630466153455728",
    name: "[DN] Dono",
    prefix: "[DN]",
    weight: 110,
    robloxRankNumber: 220,
  },
  {
    discordRoleId: "1562524426778583200",
    name: "[2-CR] Segundo Criador",
    prefix: "[2-CR]",
    weight: 120,
    robloxRankNumber: 240,
  },
  {
    discordRoleId: "1554635812287549460",
    name: "[MN-GR] Manager",
    prefix: "[MN-GR]",
    weight: 130,
    robloxRankNumber: 250,
  },
  {
    discordRoleId: "1564799570267873350",
    name: "Supervisor Administrativo",
    prefix: "[SUP-ADM]",
    weight: 140,
    robloxRankNumber: 255,
  },
];

export const MIN_COMMAND_WEIGHT = 90; // [SCMT] Subcomandante para cima

export const SPECIFIC_PERMISSION_ROLES = {
  EXILE: "1551630466086477881",   // [PERM] Exílio 📕
  DEMOTE: "1551630466086477882",  // [PERM] Rebaixamento 📙
  PROMOTE: "1565038621013319800", // [PERM] Promoção
} as const;

export const AUTHORIZED_ADMIN_ROLES = [
  "1555781498173390919", // Auxiliar Divisional
  "1555781887023251457", // Responsável Divisional
  "1564799570267873350", // Supervisor Administrativo
] as const;

export function getRankByDiscordRoleId(roleId: string): RankDefinition | undefined {
  return BFE_HIERARCHY.find((r) => r.discordRoleId === roleId);
}

export function getRankByRobloxNumber(rankNumber: number): RankDefinition | undefined {
  if (rankNumber <= 0) return undefined;
  const sorted = [...BFE_HIERARCHY].sort((a, b) => b.robloxRankNumber - a.robloxRankNumber);
  return sorted.find((r) => rankNumber >= r.robloxRankNumber);
}

export function getHighestRankFromMemberRoles(memberRoleIds: string[]): RankDefinition | null {
  const matched = BFE_HIERARCHY.filter((r) => memberRoleIds.includes(r.discordRoleId));
  if (matched.length === 0) return null;
  return matched.reduce((prev, curr) => (curr.weight > prev.weight ? curr : prev));
}
