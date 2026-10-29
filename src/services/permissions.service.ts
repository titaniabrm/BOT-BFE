import {
  AUTHORIZED_ADMIN_ROLES,
  BFE_HIERARCHY,
  getHighestRankFromMemberRoles,
  MIN_COMMAND_WEIGHT,
  RankDefinition,
  SPECIFIC_PERMISSION_ROLES,
} from "../config/constants";

export type AdministrativeAction = "PROMOTE" | "DEMOTE" | "EXILE";

export interface ValidationContext {
  executorDiscordId: string;
  executorRoleIds: string[];
  targetDiscordId: string;
  targetCurrentRank: RankDefinition | null;
  targetNewRank?: RankDefinition;
  isTargetExiled: boolean;
  action: AdministrativeAction;
}

export interface ValidationResult {
  allowed: boolean;
  errorReason?: string;
}

export class PermissionService {
  /**
   * Verifica se o militar verificado possui patente ou cargo autorizado para entrar na Dashboard Administrativa
   */
  static canAccessDashboard(memberRoleIds: string[], currentDiscordRoleId?: string | null): boolean {
    const allRoles = new Set(memberRoleIds);
    if (currentDiscordRoleId) allRoles.add(currentDiscordRoleId);
    const roleArray = Array.from(allRoles);

    const highestRank = getHighestRankFromMemberRoles(roleArray);
    if (highestRank && highestRank.weight >= MIN_COMMAND_WEIGHT) {
      return true;
    }

    if (AUTHORIZED_ADMIN_ROLES.some((id) => roleArray.includes(id))) {
      return true;
    }

    if (
      roleArray.includes(SPECIFIC_PERMISSION_ROLES.PROMOTE) ||
      roleArray.includes(SPECIFIC_PERMISSION_ROLES.DEMOTE) ||
      roleArray.includes(SPECIFIC_PERMISSION_ROLES.EXILE)
    ) {
      return true;
    }

    return false;
  }

  static hasActionCapability(executorRoleIds: string[], action: AdministrativeAction): boolean {
    const highestRank = getHighestRankFromMemberRoles(executorRoleIds);

    if (highestRank && highestRank.weight >= MIN_COMMAND_WEIGHT) {
      return true;
    }

    if (AUTHORIZED_ADMIN_ROLES.some((adminRoleId) => executorRoleIds.includes(adminRoleId))) {
      return true;
    }

    if (action === "PROMOTE" && executorRoleIds.includes(SPECIFIC_PERMISSION_ROLES.PROMOTE)) {
      return true;
    }
    if (action === "DEMOTE" && executorRoleIds.includes(SPECIFIC_PERMISSION_ROLES.DEMOTE)) {
      return true;
    }
    if (action === "EXILE" && executorRoleIds.includes(SPECIFIC_PERMISSION_ROLES.EXILE)) {
      return true;
    }

    return false;
  }

  static validateAction(ctx: ValidationContext): ValidationResult {
    if (ctx.executorDiscordId === ctx.targetDiscordId) {
      return {
        allowed: false,
        errorReason: "Violação de segurança: Você não pode executar ações administrativas em si próprio.",
      };
    }

    if (ctx.isTargetExiled) {
      return {
        allowed: false,
        errorReason: "Operação bloqueada: O usuário alvo encontra-se EXILADO e bloqueado no sistema.",
      };
    }

    if (!this.hasActionCapability(ctx.executorRoleIds, ctx.action)) {
      return {
        allowed: false,
        errorReason: `Acesso negado: Você não possui permissão para executar a ação de ${ctx.action}.`,
      };
    }

    const executorRank = getHighestRankFromMemberRoles(ctx.executorRoleIds);
    const isSuperAdmin = ctx.executorRoleIds.includes("1564799570267873350");

    if (!executorRank && !isSuperAdmin) {
      return {
        allowed: false,
        errorReason: "Erro hierárquico: Você não possui nenhuma patente válida identificada na BFE.",
      };
    }

    const effectiveExecutorWeight = isSuperAdmin ? 999 : executorRank!.weight;
    const currentTargetWeight = ctx.targetCurrentRank ? ctx.targetCurrentRank.weight : 0;

    if (currentTargetWeight >= effectiveExecutorWeight) {
      return {
        allowed: false,
        errorReason:
          "Violação hierárquica: Você não pode alterar a patente ou exilar um membro de patente igual ou superior à sua.",
      };
    }

    if (ctx.action === "PROMOTE") {
      if (!ctx.targetNewRank) {
        return { allowed: false, errorReason: "Cargo de destino não informado para a promoção." };
      }

      if (ctx.targetNewRank.weight <= currentTargetWeight) {
        return {
          allowed: false,
          errorReason: "A patente de promoção deve ser superior à patente atual do militar.",
        };
      }

      if (ctx.targetNewRank.weight >= effectiveExecutorWeight) {
        return {
          allowed: false,
          errorReason:
            "Limite de autoridade excedido: A promoção só pode ser feita até um cargo abaixo da sua própria patente.",
        };
      }
    }

    if (ctx.action === "DEMOTE") {
      if (!ctx.targetNewRank) {
        return { allowed: false, errorReason: "Cargo de destino não informado para o rebaixamento." };
      }

      if (ctx.targetNewRank.weight >= currentTargetWeight) {
        return {
          allowed: false,
          errorReason: "A nova patente no rebaixamento deve ser inferior à patente atual do militar.",
        };
      }
    }

    return { allowed: true };
  }

  static getAdjacentRank(currentRoleId: string | null, direction: "UP" | "DOWN"): RankDefinition | null {
    const sorted = [...BFE_HIERARCHY].sort((a, b) => a.weight - b.weight);
    if (!currentRoleId) {
      return direction === "UP" ? sorted[0] : null;
    }
    const index = sorted.findIndex((r) => r.discordRoleId === currentRoleId);
    if (index === -1) return direction === "UP" ? sorted[0] : null;

    if (direction === "UP" && index + 1 < sorted.length) {
      return sorted[index + 1];
    }
    if (direction === "DOWN" && index - 1 >= 0) {
      return sorted[index - 1];
    }
    return null;
  }
}
