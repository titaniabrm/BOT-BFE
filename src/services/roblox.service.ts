import { BFE_CONFIG } from "../config/constants";

// Cache em memória nativo de alta performance (não requer servidor Redis instalado)
const memoryCache = new Map<string, { data: any; expiresAt: number }>();

export interface RobloxGroupMembership {
  robloxId: string;
  robloxUsername: string;
  inGroup: boolean;
  rankNumber: number;
  roleName: string;
}

export class RobloxService {
  private static CACHE_TTL_SECONDS = 45;

  private static async getCached<T>(key: string): Promise<T | null> {
    const item = memoryCache.get(key);
    if (item && item.expiresAt > Date.now()) return item.data as T;
    return null;
  }

  private static async setCache(key: string, value: any): Promise<void> {
    memoryCache.set(key, {
      data: value,
      expiresAt: Date.now() + this.CACHE_TTL_SECONDS * 1000,
    });
  }

  static async invalidateUserCache(robloxId: string): Promise<void> {
    const key = `bfe:roblox:rank:${robloxId}`;
    memoryCache.delete(key);
  }

  static async getUserGroupRank(robloxId: string, forceRefresh = false): Promise<RobloxGroupMembership> {
    const cacheKey = `bfe:roblox:rank:${robloxId}`;
    if (!forceRefresh) {
      const cached = await this.getCached<RobloxGroupMembership>(cacheKey);
      if (cached) return cached;
    }

    const [userRes, rolesRes] = await Promise.all([
      fetch(`https://users.roblox.com/v1/users/${robloxId}`),
      fetch(`https://groups.roblox.com/v2/users/${robloxId}/groups/roles`),
    ]);

    if (userRes.status === 429 || rolesRes.status === 429) {
      throw new Error("ROBLOX_RATE_LIMIT: Limite de requisições da API do Roblox atingido.");
    }

    if (!userRes.ok) {
      throw new Error(`Usuário Roblox ${robloxId} não encontrado.`);
    }

    const userData = await userRes.json();
    const rolesData = await rolesRes.json();

    const bfeGroupEntry = (rolesData.data || []).find(
      (entry: any) => Number(entry.group?.id) === BFE_CONFIG.ROBLOX_GROUP_ID
    );

    const result: RobloxGroupMembership = {
      robloxId: String(userData.id),
      robloxUsername: userData.name,
      inGroup: Boolean(bfeGroupEntry),
      rankNumber: bfeGroupEntry ? Number(bfeGroupEntry.role.rank) : 0,
      roleName: bfeGroupEntry ? bfeGroupEntry.role.name : "Civil / Fora da Divisão",
    };

    await this.setCache(cacheKey, result);
    return result;
  }

  static async setUserGroupRank(robloxId: string, targetRankNumber: number): Promise<void> {
    const apiKey = process.env.ROBLOX_OPEN_CLOUD_API_KEY;
    if (!apiKey) {
      throw new Error("ROBLOX_OPEN_CLOUD_API_KEY não configurada no arquivo .env.");
    }

    const rolesResponse = await fetch(
      `https://groups.roblox.com/v1/groups/${BFE_CONFIG.ROBLOX_GROUP_ID}/roles`
    );
    const rolesJson = await rolesResponse.json();
    const targetRole = (rolesJson.roles || []).find(
      (r: any) => Number(r.rank) === Number(targetRankNumber)
    );

    if (!targetRole) {
      throw new Error(
        `Patente de número ${targetRankNumber} não encontrada na comunidade Roblox ${BFE_CONFIG.ROBLOX_GROUP_ID}.`
      );
    }

    const membershipFilter = encodeURIComponent(`user == 'users/${robloxId}'`);
    const membershipRes = await fetch(
      `https://apis.roblox.com/cloud/v2/groups/${BFE_CONFIG.ROBLOX_GROUP_ID}/memberships?maxPageSize=1&filter=${membershipFilter}`,
      { headers: { "x-api-key": apiKey } }
    );

    const membershipData = await membershipRes.json();
    const membership = membershipData.groupMemberships?.[0];
    if (!membership) {
      throw new Error("O jogador não é membro da comunidade Roblox da BFE (171349866).");
    }

    const updateRes = await fetch(`https://apis.roblox.com/cloud/v2/${membership.path}`, {
      method: "PATCH",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: `groups/${BFE_CONFIG.ROBLOX_GROUP_ID}/roles/${targetRole.id}`,
      }),
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      throw new Error(`Falha ao atualizar patente no Roblox: ${errText}`);
    }

    await this.invalidateUserCache(robloxId);
  }

  static async exileFromRobloxGroup(robloxId: string): Promise<void> {
    const apiKey = process.env.ROBLOX_OPEN_CLOUD_API_KEY;
    if (!apiKey) {
      throw new Error("ROBLOX_OPEN_CLOUD_API_KEY não configurada.");
    }

    const exileRes = await fetch(
      `https://groups.roblox.com/v1/groups/${BFE_CONFIG.ROBLOX_GROUP_ID}/users/${robloxId}`,
      {
        method: "DELETE",
        headers: { "x-api-key": apiKey },
      }
    );

    if (!exileRes.ok && exileRes.status !== 404) {
      try {
        await this.setUserGroupRank(robloxId, 1);
      } catch {}
    }

    await this.invalidateUserCache(robloxId);
  }
}
