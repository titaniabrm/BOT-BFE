import NodeCache from 'node-cache';
import { prisma } from '../lib/prisma';
import { BFE_HIERARCHY } from '../config/constants';

export class CacheService {
  private cache: NodeCache;

  constructor() {
    // TTL: 5 minutos para dados de membros, checkperiod: 60 segundos
    this.cache = new NodeCache({
      stdTTL: 300,
      checkperiod: 60,
      useClones: false,
      deleteOnExpire: true
    });
  }

  // Cache para dados de membros (frequentemente acessados)
  async getMemberData(discordId: string) {
    const key = `member:${discordId}`;
    const cached = this.cache.get(key);

    if (cached) {
      return cached;
    }

    // Se não cacheado, busca do banco
    const memberData = await prisma.member.findUnique({
      where: { discordId },
      include: {
        auditLogs: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (memberData) {
      this.cache.set(key, memberData);
    }

    return memberData;
  }

  // Cache para hierarquia (rara mudança)
  async getHierarchy() {
    const key = 'hierarchy';
    const cached = this.cache.get(key);

    if (cached) {
      return cached;
    }

    // Hierarquia estática - cache por 1 hora
    this.cache.set(key, BFE_HIERARCHY, 3600);
    return BFE_HIERARCHY;
  }

  // Cache para dados do grupo Roblox
  async getGroupMembers() {
    const key = 'group:members';
    const cached = this.cache.get(key);

    if (cached) {
      return cached;
    }

    // Busca membros do banco
    const members = await prisma.member.findMany({
      where: {
        status: 'VERIFIED',
        robloxId: { not: null }
      },
      select: {
        discordId: true,
        robloxId: true,
        discordUsername: true,
        robloxUsername: true,
        currentRank: true,
        status: true
      },
      orderBy: { currentRank: 'desc' }
    });

    this.cache.set(key, members, 600); // 10 minutos de cache
    return members;
  }

  // Cache para comandos frequentes
  getCommandResponse(commandName: string, userId: string) {
    const key = `command:${commandName}:${userId}`;
    return this.cache.get(key);
  }

  setCommandResponse(commandName: string, userId: string, response: any, ttl: number = 30) {
    const key = `command:${commandName}:${userId}`;
    this.cache.set(key, {
      response,
      timestamp: Date.now()
    }, ttl);
  }

  // Invalidar cache quando membro for atualizado
  invalidateMember(discordId: string) {
    this.cache.del(`member:${discordId}`);
    this.cache.del('group:members'); // Invalida cache de grupo também
  }

  // Invalidar cache de comandos específicos
  invalidateCommand(commandName: string, userId?: string) {
    if (userId) {
      this.cache.del(`command:${commandName}:${userId}`);
    } else {
      // Invalida todos os caches deste comando
      const keys = this.cache.keys();
      keys.forEach(key => {
        if (key.startsWith(`command:${commandName}:`)) {
          this.cache.del(key);
        }
      });
    }
  }

  // Estatísticas do cache (útil para debugging)
  getStats() {
    return {
      keys: this.cache.keys().length,
      hits: this.cache.getStats().hits,
      misses: this.cache.getStats().misses,
      ksize: this.cache.getStats().ksize,
      vsize: this.cache.getStats().vsize
    };
  }

  // Limpar cache completamente (apenas para emergências)
  clearAll() {
    this.cache.flushAll();
  }

  // Limpeza periódica de cache antigo
  cleanup() {
    const now = Date.now();
    let cleared = 0;

    this.cache.keys().forEach(key => {
      const value = this.cache.get(key) as any;
      if (value?.timestamp && now - value.timestamp > 300000) { // 5 minutos
        this.cache.del(key);
        cleared++;
      }
    });

    return cleared;
  }
}

// Singleton do serviço de cache
export const cacheService = new CacheService();

// Inicializa limpeza periódica
setInterval(() => {
  const cleared = cacheService.cleanup();
  if (cleared > 0 && process.env.NODE_ENV === 'development') {
    console.log(`[Cache] Limpeza periódica: ${cleared} entradas removidas`);
  }
}, 300000); // 5 minutos