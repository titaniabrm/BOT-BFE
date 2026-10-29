"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Shield,
  Users,
  UserCheck,
  UserX,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Search,
  FileText,
  Settings,
  Award,
  ChevronRight,
  ExternalLink,
  Lock,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { BFE_CONFIG, BFE_HIERARCHY, getRankByDiscordRoleId } from "@/config/constants";

type TabType = "overview" | "members" | "actions" | "logs" | "settings";

interface RealMember {
  id: string;
  discordId: string;
  discordUsername: string;
  robloxId: string | null;
  robloxUsername: string | null;
  currentDiscordRoleId: string | null;
  currentRoleName: string | null;
  currentRobloxRank: number | null;
  status: "VERIFIED" | "PENDING" | "EXILED";
  isLocked: boolean;
  updatedAt: string;
}

interface RealAuditLog {
  id: string;
  action: string;
  targetSnapshot: string;
  executorDiscordId: string;
  executorName: string;
  oldRoleName: string | null;
  newRoleName: string | null;
  reason: string | null;
  originChannel: string;
  createdAt: string;
}

export default function BFEDashboard() {
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState<{
    authenticated: boolean;
    authorizedForDashboard?: boolean;
    reason?: string;
    member?: RealMember;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [members, setMembers] = useState<RealMember[]>([]);
  const [logs, setLogs] = useState<RealAuditLog[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Filtros de Membros Reais
  const [memberSearch, setMemberSearch] = useState("");
  const [memberRoleFilter, setMemberRoleFilter] = useState("ALL");
  const [memberStatusFilter, setMemberStatusFilter] = useState("ALL");

  // Estado da Página de Ações
  const [selectedMemberDiscordId, setSelectedMemberDiscordId] = useState<string>("");
  const [selectedAction, setSelectedAction] = useState<"PROMOTE" | "DEMOTE" | "EXILE" | "UNEXILE">("PROMOTE");
  const [targetRoleId, setTargetRoleId] = useState<string>(BFE_HIERARCHY[1].discordRoleId);
  const [actionReason, setActionReason] = useState<string>("");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);

  // Filtros de Logs Reais
  const [logTypeFilter, setLogTypeFilter] = useState("ALL");
  const [logUserFilter, setLogUserFilter] = useState("");
  const [logExecutorFilter, setLogExecutorFilter] = useState("");

  const loadDashboardData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [membersRes, logsRes] = await Promise.all([
        fetch("/api/members"),
        fetch("/api/logs"),
      ]);
      if (membersRes.ok) {
        const mJson = await membersRes.json();
        setMembers(mJson.members || []);
        if (mJson.members?.length > 0 && !selectedMemberDiscordId) {
          setSelectedMemberDiscordId(mJson.members[0].discordId);
        }
      }
      if (logsRes.ok) {
        const lJson = await logsRes.json();
        setLogs(lJson.logs || []);
      }
    } finally {
      setLoadingData(false);
    }
  }, [selectedMemberDiscordId]);

  useEffect(() => {
    async function checkSession() {
      setAuthLoading(true);
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        setSession(data);
        if (data.authenticated && data.authorizedForDashboard) {
          await loadDashboardData();
        }
      } catch {
        setSession({ authenticated: false });
      } finally {
        setAuthLoading(false);
      }
    }
    checkSession();
  }, [loadDashboardData]);

  function formatNickname(m: RealMember): string {
    if (m.status === "EXILED") return `[EXILADO] ${m.robloxUsername || m.discordUsername}`;
    const rank = m.currentDiscordRoleId ? getRankByDiscordRoleId(m.currentDiscordRoleId) : undefined;
    const prefix = rank ? rank.prefix : "[BFE]";
    return `${prefix} ${m.robloxUsername || m.discordUsername}`;
  }

  const stats = useMemo(() => {
    return {
      total: members.length,
      verified: members.filter((m) => m.status === "VERIFIED").length,
      exiled: members.filter((m) => m.status === "EXILED").length,
      pending: members.filter((m) => m.status === "PENDING").length,
      promotions: logs.filter((l) => l.action === "PROMOTE").length,
      demotions: logs.filter((l) => l.action === "DEMOTE").length,
    };
  }, [members, logs]);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const nick = formatNickname(m).toLowerCase();
      const rbx = (m.robloxUsername || "").toLowerCase();
      const dsc = m.discordUsername.toLowerCase();
      const q = memberSearch.toLowerCase();

      const matchesQuery = nick.includes(q) || rbx.includes(q) || dsc.includes(q) || m.discordId.includes(q);
      const matchesRole = memberRoleFilter === "ALL" || m.currentDiscordRoleId === memberRoleFilter;
      const matchesStatus = memberStatusFilter === "ALL" || m.status === memberStatusFilter;
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [members, memberSearch, memberRoleFilter, memberStatusFilter]);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      const matchesType = logTypeFilter === "ALL" || l.action === logTypeFilter;
      const matchesTarget = l.targetSnapshot.toLowerCase().includes(logUserFilter.toLowerCase());
      const matchesExec = l.executorName.toLowerCase().includes(logExecutorFilter.toLowerCase());
      return matchesType && matchesTarget && matchesExec;
    });
  }, [logs, logTypeFilter, logUserFilter, logExecutorFilter]);

  const selectedMember = members.find((m) => m.discordId === selectedMemberDiscordId) || null;

  async function handleConfirmActionExecution() {
    if (!selectedMember) return;
    setSubmittingAction(true);
    setFeedbackMsg(null);

    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetDiscordId: selectedMember.discordId,
          action: selectedAction,
          targetNewDiscordRoleId:
            selectedAction === "PROMOTE" || selectedAction === "DEMOTE"
              ? targetRoleId
              : undefined,
          reason: actionReason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedbackMsg({ type: "err", text: data.error || "Erro ao executar ação." });
      } else {
        setFeedbackMsg({
          type: "ok",
          text: `Ordem militar (${selectedAction}) executada com sucesso no Roblox e Discord!`,
        });
        setActionReason("");
        await loadDashboardData();
      }
    } catch (err: any) {
      setFeedbackMsg({ type: "err", text: err.message || "Falha de comunicação com o servidor." });
    } finally {
      setSubmittingAction(false);
      setConfirmModalOpen(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    window.location.reload();
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bfe-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-full border-4 border-bfe-primary/30 border-t-bfe-primary animate-spin"></div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">SISTEMA BFE</h3>
            <p className="text-bfe-muted text-sm">
              Verificando credenciais OAuth 2.0 (Discord + Roblox) e Patente BFE...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // TELA DE BLOQUEIO OBRIGATÓRIO OAUTH 2.0 ROBLOX + PATENTE AUTORIZADA
  if (!session?.authenticated || !session?.authorizedForDashboard) {
    return (
      <div className="min-h-screen bg-bfe-black text-zinc-100 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-bfe-card border-2 border-bfe-primary rounded-2xl p-8 space-y-6 shadow-[0_0_40px_rgba(220,38,38,0.15)] text-center">
          <div className="w-16 h-20 mx-auto rounded-b-2xl border-2 border-bfe-primary bg-black flex flex-col overflow-hidden shadow-lg">
            <div className="bg-bfe-primary text-[10px] font-black text-white py-0.5">1º B F ESP</div>
            <div className="bg-gradient-to-r from-bfe-primary to-bfe-secondary h-1.5 w-full" />
            <div className="flex-1 flex items-center justify-center bg-bfe-dark">
              <Shield className="w-8 h-8 text-bfe-primary" />
            </div>
          </div>

          <div className="space-y-3">
            <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-bfe-secondary text-white border border-bfe-primary/50 rounded">
              Acesso Restrito • 1º B F ESP
            </span>
            <h1 className="text-2xl font-black uppercase text-white">
              SISTEMA DE COMANDO — <span className="text-bfe-primary">BFE</span>
            </h1>
            <p className="text-sm text-zinc-400">
              Para acessar o Painel de Controle, é obrigatório passar pela{" "}
              <strong className="text-white">Verificação OAuth 2.0 (Discord + Roblox)</strong> e possuir{" "}
              <strong className="text-bfe-primary">Patente Autorizada</strong> ([SCMT] Subcomandante+, Cargos Administrativos ou Permissão Especial).
            </p>
          </div>

          {session?.reason === "EXILED_BLOCKED" && (
            <div className="p-4 rounded-xl bg-red-900/20 border border-red-500 text-red-200 text-sm font-bold">
              🔒 ACESSO BLOQUEADO: Sua conta consta como EXILADA do Batalhão de Forças Especiais.
            </div>
          )}

          {session?.authenticated && !session?.authorizedForDashboard && session.member && (
            <div className="p-4 rounded-xl bg-red-900/10 border border-red-500/50 text-left space-y-2">
              <p className="font-bold text-bfe-primary uppercase">
                ✅ Conta Roblox Verificada com Sucesso!
              </p>
              <div className="space-y-1 text-sm">
                <p className="text-zinc-300">
                  <strong>Militar:</strong> {formatNickname(session.member)}
                </p>
                <p className="text-zinc-300">
                  <strong>Patente Atual:</strong> {session.member.currentRoleName || "Sem Patente"}
                </p>
              </div>
              <p className="text-red-400 font-semibold pt-2 border-t border-red-500/20 text-sm">
                ⚠️ Seu cargo no Discord já foi sincronizado, porém sua patente atual não possui permissão administrativa para acessar o Painel de Controle.
              </p>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <a
              href="/api/auth/discord"
              className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl bg-gradient-to-r from-bfe-primary to-bfe-secondary hover:from-bfe-accent hover:to-bfe-primary border border-red-500/50 text-white font-bold uppercase tracking-wider text-sm shadow-lg transition-all hover:scale-[1.02]"
            >
              <Lock className="w-5 h-5" />
              Autenticar via OAuth 2.0 (Discord + Roblox)
            </a>

            {session?.authenticated && (
              <button
                onClick={handleLogout}
                className="w-full py-2.5 text-sm text-zinc-400 hover:text-white hover:underline transition"
              >
                Trocar de Conta
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bfe-black text-zinc-100 font-sans selection:bg-bfe-primary selection:text-white">
      <header className="border-b border-bfe-primary/30 bg-gradient-to-r from-bfe-dark via-bfe-card to-bfe-dark sticky top-0 z-30 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-16 rounded-b-2xl border-2 border-bfe-primary bg-black flex flex-col overflow-hidden shadow-lg shrink-0">
              <div className="bg-gradient-to-r from-bfe-primary to-bfe-secondary text-[9px] font-black tracking-tighter text-center text-white leading-tight py-0.5">
                1º B F ESP
              </div>
              <div className="h-1.5 w-full bg-gradient-to-r from-red-500 to-bfe-primary" />
              <div className="flex-1 flex items-center justify-center bg-bfe-card">
                <Shield className="w-7 h-7 text-bfe-primary stroke-[2.2]" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-gradient-to-r from-bfe-primary to-bfe-secondary text-white border border-bfe-primary/50 rounded">
                  1º B F ESP • Forças Especiais
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-red-900/30 text-red-300 border border-red-500/30 rounded">
                  Roblox Group: {BFE_CONFIG.ROBLOX_GROUP_ID}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-wider uppercase text-white mt-1">
                PAINEL DE CONTROLE — <span className="text-bfe-primary">BFE COMMAND</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {session.member && (
              <div className="px-3 py-1.5 rounded bg-bfe-card/80 border border-bfe-primary/30 text-right">
                <p className="text-[10px] text-green-400 font-bold uppercase">
                  Operador Verificado
                </p>
                <p className="text-xs font-bold text-bfe-primary">{formatNickname(session.member)}</p>
              </div>
            )}
            <button
              onClick={loadDashboardData}
              className="p-2.5 rounded bg-bfe-card hover:bg-bfe-dark border border-bfe-primary/20 text-bfe-primary transition-colors"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-4 h-4 ${loadingData ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={handleLogout}
              className="p-2.5 rounded bg-red-900/20 hover:bg-red-900/30 border border-red-500/30 text-red-300 transition-colors"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex overflow-x-auto gap-0 pt-1">
          {[
            { id: "overview", label: "Visão Geral", icon: Shield },
            { id: "members", label: "Membros", icon: Users },
            { id: "actions", label: "Ações", icon: Award },
            { id: "logs", label: "Logs", icon: FileText },
            { id: "settings", label: "Configurações", icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap relative ${
                  active
                    ? "border-bfe-primary text-bfe-primary bg-gradient-to-t from-red-900/10 to-transparent"
                    : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-bfe-card/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {active && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-bfe-primary to-bfe-accent"></div>
                )}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {feedbackMsg && (
          <div
            className={`p-4 rounded-lg border text-sm font-medium ${
              feedbackMsg.type === "ok"
                ? "bg-green-900/20 border-green-500/50 text-green-300"
                : "bg-red-900/20 border-red-500/50 text-red-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMsg.type === "ok" ? (
                <span className="text-green-400">✓</span>
              ) : (
                <span className="text-red-400">✗</span>
              )}
              {feedbackMsg.text}
            </div>
          </div>
        )}

        {activeTab === "overview" && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <StatCard title="Total de Membros" value={stats.total} icon={Users} accent="gold" />
              <StatCard title="Verificados" value={stats.verified} icon={UserCheck} accent="cyan" />
              <StatCard title="Exilados" value={stats.exiled} icon={UserX} accent="red" />
              <StatCard title="Promoções" value={stats.promotions} icon={TrendingUp} accent="gold" />
              <StatCard title="Rebaixamentos" value={stats.demotions} icon={TrendingDown} accent="orange" />
              <StatCard title="Pendentes" value={stats.pending} icon={AlertTriangle} accent="red" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-bfe-card border border-bfe-dark rounded-xl p-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-bfe-dark pb-3 mb-4">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-bfe-primary" /> Últimas Ações Registradas
                  </h2>
                  <button
                    onClick={() => setActiveTab("logs")}
                    className="text-xs text-bfe-accent hover:text-bfe-primary flex items-center gap-1 transition-colors"
                  >
                    Ver Histórico Completo <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {logs.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-6 text-center">
                    Nenhuma ação registrada no banco de dados ainda.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {logs.slice(0, 6).map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-lg bg-bfe-dark border border-bfe-dark/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <ActionBadge action={log.action} />
                            <span className="font-bold text-sm text-white">{log.targetSnapshot}</span>
                            <span className="text-xs text-zinc-400">
                              ({log.oldRoleName || "N/A"} →{" "}
                              <span className="text-bfe-primary">{log.newRoleName || "N/A"}</span>)
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-1">
                            Responsável: <strong className="text-zinc-200">{log.executorName}</strong> • Motivo:{" "}
                            <span className="italic text-zinc-300">
                              {log.reason ? log.reason : "Sem motivo informado"}
                            </span>
                          </p>
                        </div>
                        <div className="text-right text-[11px] font-mono text-zinc-500">
                          <div>{new Date(log.createdAt).toLocaleString("pt-BR")}</div>
                          <div>{log.originChannel}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-bfe-card border border-bfe-primary/20 rounded-xl p-5 shadow-xl space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-bfe-primary flex items-center gap-2 border-b border-bfe-dark pb-3">
                  <AlertTriangle className="w-4 h-4" /> Exilados & Pendências Reais
                </h2>

                {members.filter((m) => m.status !== "VERIFIED").length === 0 ? (
                  <p className="text-xs text-zinc-500 py-6 text-center">
                    Nenhum membro pendente ou exilado no momento.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {members
                      .filter((m) => m.status !== "VERIFIED")
                      .map((m) => (
                        <div
                          key={m.id}
                          className="p-3 rounded-lg bg-red-950/20 border border-red-900/40 flex items-center justify-between"
                        >
                          <div>
                            <p className="text-sm font-bold text-white">{formatNickname(m)}</p>
                            <p className="text-xs text-zinc-400">
                              Roblox: {m.robloxUsername || "Não vinculado"} • Status:{" "}
                              <strong className="text-red-400">{m.status}</strong>
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedMemberDiscordId(m.discordId);
                              setActiveTab("actions");
                            }}
                            className="px-2.5 py-1 text-xs font-bold bg-red-800 hover:bg-red-700 text-white rounded"
                          >
                            Gerenciar
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "members" && (
          <div className="bg-bfe-card border border-bfe-dark rounded-xl p-5 shadow-xl space-y-5">
            <div className="flex flex-col md:flex-row gap-3 justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Pesquisar membro real por Nome, Roblox Username ou Discord ID..."
                  className="w-full bg-black border border-zinc-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-[#D4AF37] outline-none"
                />
              </div>

              <select
                value={memberRoleFilter}
                onChange={(e) => setMemberRoleFilter(e.target.value)}
                className="bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-[#D4AF37] outline-none"
              >
                <option value="ALL">Todas as Patentes BFE</option>
                {BFE_HIERARCHY.map((r) => (
                  <option key={r.discordRoleId} value={r.discordRoleId}>
                    {r.name}
                  </option>
                ))}
              </select>

              <select
                value={memberStatusFilter}
                onChange={(e) => setMemberStatusFilter(e.target.value)}
                className="bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-[#D4AF37] outline-none"
              >
                <option value="ALL">Todos os Status</option>
                <option value="VERIFIED">Verificados</option>
                <option value="PENDING">Pendentes</option>
                <option value="EXILED">Exilados (Bloqueados)</option>
              </select>
            </div>

            {filteredMembers.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 text-sm">
                Nenhum membro real encontrado com esses filtros. Assim que os jogadores se verificarem via{" "}
                <code className="text-bfe-primary">/verificar</code> ou OAuth 2.0, aparecerão aqui automaticamente.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-bfe-dark text-[11px] font-bold uppercase text-zinc-400">
                      <th className="py-3 px-4">Perfil Discord (Prefixo + Nome)</th>
                      <th className="py-3 px-4">Roblox Username</th>
                      <th className="py-3 px-4">Discord Vinculado</th>
                      <th className="py-3 px-4">Patente Atual</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Última Atualização</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-sm">
                    {filteredMembers.map((m) => (
                      <tr key={m.id} className="hover:bg-white/[0.02]">
                        <td className="py-3.5 px-4 font-bold text-bfe-primary">{formatNickname(m)}</td>
                        <td className="py-3.5 px-4 text-zinc-200">
                          {m.robloxUsername || "—"}{" "}
                          {m.robloxId && (
                            <span className="text-xs text-zinc-500 font-mono">({m.robloxId})</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-zinc-300">
                          @{m.discordUsername} ({m.discordId})
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-xs font-semibold">
                            {m.currentRoleName || "Sem Patente"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusPill status={m.status} />
                        </td>
                        <td className="py-3.5 px-4 text-xs text-zinc-400">
                          {new Date(m.updatedAt).toLocaleString("pt-BR")}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5">
                          <button
                            onClick={() => {
                              setSelectedMemberDiscordId(m.discordId);
                              setSelectedAction("PROMOTE");
                              setActiveTab("actions");
                            }}
                            className="px-2.5 py-1 rounded bg-amber-600/20 hover:bg-amber-600/40 border border-[#D4AF37]/50 text-bfe-primary text-xs font-bold"
                          >
                            Promover
                          </button>
                          <button
                            onClick={() => {
                              setSelectedMemberDiscordId(m.discordId);
                              setSelectedAction("DEMOTE");
                              setActiveTab("actions");
                            }}
                            className="px-2.5 py-1 rounded bg-orange-950/60 hover:bg-orange-900/60 border border-orange-600/40 text-orange-300 text-xs font-bold"
                          >
                            Rebaixar
                          </button>
                          <button
                            onClick={() => {
                              setSelectedMemberDiscordId(m.discordId);
                              setSelectedAction(m.status === "EXILED" ? "UNEXILE" : "EXILE");
                              setActiveTab("actions");
                            }}
                            className="px-2.5 py-1 rounded bg-red-950/80 hover:bg-red-900 border border-red-600/50 text-red-200 text-xs font-bold"
                          >
                            {m.status === "EXILED" ? "Desbloquear" : "Exilar"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "actions" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-bfe-card border border-bfe-primary/30 rounded-xl p-6 shadow-xl space-y-5">
              <h2 className="text-base font-black uppercase tracking-wider text-bfe-primary flex items-center gap-2 border-b border-bfe-dark pb-3">
                <Award className="w-5 h-5" /> Executar Ação de Comando Real (Roblox ↔ Discord)
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-400 mb-1.5">
                    Selecionar Militar Verificado
                  </label>
                  <select
                    value={selectedMemberDiscordId}
                    onChange={(e) => setSelectedMemberDiscordId(e.target.value)}
                    className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#D4AF37] outline-none"
                  >
                    {members.map((m) => (
                      <option key={m.discordId} value={m.discordId}>
                        {formatNickname(m)} — ({m.currentRoleName || "Sem Patente"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-400 mb-1.5">
                    Tipo de Operação
                  </label>
                  <select
                    value={selectedAction}
                    onChange={(e) => setSelectedAction(e.target.value as any)}
                    className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#D4AF37] outline-none"
                  >
                    <option value="PROMOTE">🎖️ Promover Patente</option>
                    <option value="DEMOTE">📙 Rebaixar Patente</option>
                    <option value="EXILE">📕 Exilar e Bloquear Usuário</option>
                    <option value="UNEXILE">🔓 Desbloquear / Revogar Exílio</option>
                  </select>
                </div>
              </div>

              {(selectedAction === "PROMOTE" || selectedAction === "DEMOTE") && (
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-400 mb-1.5">
                    Nova Patente na Hierarquia BFE
                  </label>
                  <select
                    value={targetRoleId}
                    onChange={(e) => setTargetRoleId(e.target.value)}
                    className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-bfe-primary font-bold focus:border-[#D4AF37] outline-none"
                  >
                    {BFE_HIERARCHY.map((r) => (
                      <option key={r.discordRoleId} value={r.discordRoleId}>
                        {r.name} — (ID: {r.discordRoleId} | Peso: {r.weight})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-400 mb-1.5">
                  Motivo da Ação <span className="text-zinc-500 font-normal">(Opcional — Pode ficar em branco)</span>
                </label>
                <textarea
                  rows={3}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Informe o motivo ou deixe em branco (a ação e o log serão registrados normalmente)..."
                  className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-sm text-white focus:border-[#D4AF37] outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  disabled={!selectedMember || submittingAction}
                  onClick={() => setConfirmModalOpen(true)}
                  className="px-6 py-3 rounded-lg bg-gradient-to-r from-red-800 to-red-700 hover:from-red-700 hover:to-red-600 disabled:opacity-50 border border-[#D4AF37] text-white font-black uppercase tracking-wider text-xs shadow-lg"
                >
                  Confirmar e Executar no Roblox & Discord
                </button>
              </div>
            </div>

            <div className="bg-bfe-card border border-bfe-dark rounded-xl p-5 space-y-3 text-xs text-zinc-300">
              <h3 className="text-sm font-black uppercase text-bfe-primary border-b border-bfe-dark pb-2">
                Travas de Segurança Ativas
              </h3>
              <p>• <strong>Verificação OAuth 2.0 Obrigatória:</strong> Apenas operadores autenticados no Roblox + Discord com patente autorizada acessam este painel.</p>
              <p>• <strong>Auto-promoção bloqueada:</strong> Nenhum membro pode alterar sua própria patente.</p>
              <p>• <strong>Limite de Promoção:</strong> Permitida apenas até 1 patente abaixo da patente do executor.</p>
              <p>• <strong>Bloqueio de Exílio:</strong> Remove cargo no Roblox, remove cargo no Discord e bloqueia novas sincronizações.</p>
            </div>
          </div>
        )}

        {activeTab === "logs" && (
          <div className="bg-bfe-card border border-bfe-dark rounded-xl p-5 shadow-xl space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                value={logTypeFilter}
                onChange={(e) => setLogTypeFilter(e.target.value)}
                className="bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="ALL">Filtrar por Tipo de Ação (Todos)</option>
                <option value="VERIFY">Verificação OAuth 2.0</option>
                <option value="PROMOTE">Promoção</option>
                <option value="DEMOTE">Rebaixamento</option>
                <option value="EXILE">Exílio</option>
                <option value="UNEXILE">Desbloqueio</option>
                <option value="UNAUTHORIZED_ATTEMPT">Tentativa Sem Permissão</option>
              </select>

              <input
                type="text"
                value={logUserFilter}
                onChange={(e) => setLogUserFilter(e.target.value)}
                placeholder="Filtrar por Militar Afetado..."
                className="bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
              />

              <input
                type="text"
                value={logExecutorFilter}
                onChange={(e) => setLogExecutorFilter(e.target.value)}
                placeholder="Filtrar por Responsável..."
                className="bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-bfe-dark text-[11px] uppercase text-zinc-400">
                    <th className="py-3 px-4">Data / Hora</th>
                    <th className="py-3 px-4">Ação</th>
                    <th className="py-3 px-4">Usuário Afetado</th>
                    <th className="py-3 px-4">Responsável</th>
                    <th className="py-3 px-4">Cargo Antigo → Novo</th>
                    <th className="py-3 px-4">Motivo (Opcional)</th>
                    <th className="py-3 px-4">Canal de Origem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredLogs.map((l) => (
                    <tr key={l.id}>
                      <td className="py-3 px-4 font-mono text-xs text-zinc-400">
                        {new Date(l.createdAt).toLocaleString("pt-BR")}
                      </td>
                      <td className="py-3 px-4">
                        <ActionBadge action={l.action} />
                      </td>
                      <td className="py-3 px-4 font-bold text-white">{l.targetSnapshot}</td>
                      <td className="py-3 px-4 text-zinc-300">{l.executorName}</td>
                      <td className="py-3 px-4 text-xs">
                        <span className="text-zinc-400">{l.oldRoleName || "Nenhum"}</span> →{" "}
                        <span className="text-bfe-primary font-bold">{l.newRoleName || "Nenhum"}</span>
                      </td>
                      <td className="py-3 px-4 text-xs italic text-zinc-300">
                        {l.reason ? l.reason : "— (Sem motivo informado)"}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-zinc-400">{l.originChannel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-bfe-card border border-bfe-dark rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-black uppercase text-bfe-primary border-b border-bfe-dark pb-2">
                Parâmetros Gerais da Divisão BFE
              </h2>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-xs text-zinc-400 uppercase font-bold">ID Comunidade Roblox</label>
                  <input
                    readOnly
                    value={BFE_CONFIG.ROBLOX_GROUP_ID}
                    className="w-full bg-black border border-bfe-dark rounded px-3 py-2 font-mono text-bfe-primary mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 uppercase font-bold">ID Servidor Discord</label>
                  <input
                    readOnly
                    value={BFE_CONFIG.GUILD_ID}
                    className="w-full bg-black border border-bfe-dark rounded px-3 py-2 font-mono text-bfe-primary mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="bg-bfe-card border border-bfe-dark rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-black uppercase text-bfe-primary border-b border-bfe-dark pb-2">
                Mapeamento Oficial de IDs de Cargos (BFE)
              </h2>
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1 text-xs">
                {BFE_HIERARCHY.map((r) => (
                  <div
                    key={r.discordRoleId}
                    className="flex items-center justify-between p-2 rounded bg-black/60 border border-bfe-dark"
                  >
                    <span className="font-bold text-white">{r.name}</span>
                    <span className="font-mono text-bfe-primary">{r.discordRoleId}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {confirmModalOpen && selectedMember && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-bfe-card border-2 border-[#D4AF37] rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-black uppercase text-bfe-primary">
              Confirmar Ordem Militar — BFE
            </h3>
            <p className="text-sm text-zinc-300">
              Você está prestes a executar a ação <strong className="text-white">{selectedAction}</strong>{" "}
              sobre o militar <strong className="text-bfe-primary">{formatNickname(selectedMember)}</strong>.
            </p>
            <div className="p-3 rounded bg-black border border-bfe-dark text-xs space-y-1">
              <div>
                <strong>Roblox Username:</strong> {selectedMember.robloxUsername}
              </div>
              <div>
                <strong>Patente Atual:</strong> {selectedMember.currentRoleName}
              </div>
              <div>
                <strong>Motivo:</strong>{" "}
                {actionReason.trim() ? actionReason : "Não informado (será salvo vazio)"}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 rounded bg-zinc-800 text-zinc-300 text-xs font-bold uppercase"
              >
                Cancelar
              </button>
              <button
                disabled={submittingAction}
                onClick={handleConfirmActionExecution}
                className="px-5 py-2 rounded bg-red-700 hover:bg-red-600 border border-[#D4AF37] text-white text-xs font-black uppercase"
              >
                {submittingAction ? "Executando..." : "Confirmar Execução"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  accent,
}: {
  title: string;
  value: number;
  icon: any;
  accent: "gold" | "red" | "cyan" | "orange";
}) {
  const accentMap = {
    gold: {
      bg: "bg-gradient-to-br from-amber-900/10 to-transparent",
      border: "border-amber-500/30",
      text: "text-amber-400",
      icon: "text-amber-500",
    },
    red: {
      bg: "bg-gradient-to-br from-red-900/20 to-transparent",
      border: "border-red-500/40",
      text: "text-red-400",
      icon: "text-red-500",
    },
    cyan: {
      bg: "bg-gradient-to-br from-cyan-900/20 to-transparent",
      border: "border-cyan-500/40",
      text: "text-cyan-400",
      icon: "text-cyan-500",
    },
    orange: {
      bg: "bg-gradient-to-br from-orange-900/20 to-transparent",
      border: "border-orange-500/40",
      text: "text-orange-400",
      icon: "text-orange-500",
    },
  };

  const styles = accentMap[accent];

  return (
    <div className={`bg-bfe-card border ${styles.border} rounded-xl p-4 shadow-lg ${styles.bg}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase text-zinc-400">{title}</span>
        <Icon className={`w-4 h-4 ${styles.icon}`} />
      </div>
      <p className={`text-2xl font-black ${styles.text} mt-2`}>{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: RealMember["status"] }) {
  if (status === "VERIFIED") {
    return (
      <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold">
        VERIFICADO
      </span>
    );
  }
  if (status === "EXILED") {
    return (
      <span className="px-2 py-0.5 rounded-full bg-red-950 border border-red-500 text-red-300 text-[11px] font-bold">
        EXILADO / BLOQUEADO
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[11px] font-bold">
      PENDENTE
    </span>
  );
}

function ActionBadge({ action }: { action: string }) {
  const styles: Record<string, string> = {
    VERIFY: "bg-cyan-900/30 text-cyan-300 border-cyan-500/40",
    PROMOTE: "bg-amber-900/20 text-amber-300 border-amber-500/40",
    DEMOTE: "bg-orange-900/20 text-orange-300 border-orange-500/40",
    EXILE: "bg-red-900/30 text-red-300 border-red-500/50",
    UNEXILE: "bg-emerald-900/20 text-emerald-300 border-emerald-500/40",
    UNAUTHORIZED_ATTEMPT: "bg-red-800 text-white border-red-500",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${
        styles[action] || "bg-bfe-dark text-zinc-400 border-bfe-dark"
      }`}
    >
      {action}
    </span>
  );
}
