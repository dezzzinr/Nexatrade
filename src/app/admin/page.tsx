"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, ArrowLeft, Bot, Check, Clock3, LockKeyhole, Plus, RefreshCw, ShieldCheck, Sparkles, Trash2, UsersRound, X } from "lucide-react";
import { DEPOSIT_METHODS, depositMethodLabel, type DepositMethod } from "@/lib/deposits";
import { withdrawalMethodLabel } from "@/lib/withdrawals";
import { AVATAR_COLORS, RISK_LEVELS, type AvatarColor, type RiskLevel } from "@/lib/copy-trading";
import { BOT_STRATEGIES, type BotStrategy } from "@/lib/bots";

type AdminUser = { id: string; name: string; email: string | null };
type DepositRequestRow = {
  id: string; method: string; amount: string; destinationLabel: string | null; reference: string | null; note: string | null;
  status: string; adminNote: string | null; receiptFilename: string; receiptMimeType: string; createdAt: string; reviewedAt: string | null;
  userId: string; userName: string; userEmail: string | null;
};
type WithdrawalRequestRow = {
  id: string; method: string; methodLabel: string | null; amount: string; destination: string; note: string | null;
  status: string; adminNote: string | null; createdAt: string; reviewedAt: string | null;
  userId: string; userName: string; userEmail: string | null;
};
type DepositAccountRow = { id: string; method: string; label: string; instructions: string; isActive: boolean; createdAt: string; updatedAt: string };
type CopyTraderRow = { id: string; name: string; handle: string; avatarInitials: string; avatarColor: string; focus: string; riskLevel: string; returnPercent: string; winRate: string; subscriptionAmount: string; isActive: boolean; activeSubscribers: number; createdAt: string };
type BotProductRow = { id: string; name: string; description: string; strategy: string; riskLevel: string; minAllocation: string; subscriptionAmount: string; isActive: boolean; activeSubscribers: number; createdAt: string };
type PlanRow = { id: string; name: string; description: string; priceWeekly: string; features: string[]; isFeatured: boolean; sortOrder: string; isActive: boolean; activeSubscribers: number; createdAt: string };
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function AdminPage() {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [authState, setAuthState] = useState<"loading" | "denied" | "ok">("loading");
  const [tab, setTab] = useState<"deposits" | "withdrawals" | "accounts" | "traders" | "bots" | "plans">("deposits");
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [requests, setRequests] = useState<DepositRequestRow[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);

  const [wStatusFilter, setWStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [wRequests, setWRequests] = useState<WithdrawalRequestRow[]>([]);
  const [wRequestsLoading, setWRequestsLoading] = useState(false);
  const [wBusyId, setWBusyId] = useState<string | null>(null);
  const [wRejectingId, setWRejectingId] = useState<string | null>(null);
  const [wRejectNote, setWRejectNote] = useState("");

  const [accounts, setAccounts] = useState<DepositAccountRow[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [newMethod, setNewMethod] = useState<DepositMethod>("crypto");
  const [newLabel, setNewLabel] = useState("");
  const [newInstructions, setNewInstructions] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editInstructions, setEditInstructions] = useState("");

  const [traders, setTraders] = useState<CopyTraderRow[]>([]);
  const [tradersLoading, setTradersLoading] = useState(false);
  const [traderCreating, setTraderCreating] = useState(false);
  const emptyTraderForm = { name: "", handle: "", avatarColor: "blue" as AvatarColor, focus: "", riskLevel: "Moderate" as RiskLevel, returnPercent: "", winRate: "", subscriptionAmount: "" };
  const [traderForm, setTraderForm] = useState(emptyTraderForm);
  const [editingTraderId, setEditingTraderId] = useState<string | null>(null);
  const [editTraderForm, setEditTraderForm] = useState(emptyTraderForm);
  const [traderBusyId, setTraderBusyId] = useState<string | null>(null);

  const [botRows, setBotRows] = useState<BotProductRow[]>([]);
  const [botsLoading, setBotsLoading] = useState(false);
  const [botCreating, setBotCreating] = useState(false);
  const emptyBotForm = { name: "", description: "", strategy: "DCA" as BotStrategy, riskLevel: "Moderate" as RiskLevel, minAllocation: "", subscriptionAmount: "" };
  const [botForm, setBotForm] = useState(emptyBotForm);
  const [editingBotId, setEditingBotId] = useState<string | null>(null);
  const [editBotForm, setEditBotForm] = useState(emptyBotForm);
  const [botBusyId, setBotBusyId] = useState<string | null>(null);

  const [planRows, setPlanRows] = useState<PlanRow[]>([]);
  const [plansLoadingAdmin, setPlansLoadingAdmin] = useState(false);
  const [planCreating, setPlanCreating] = useState(false);
  const emptyPlanForm = { name: "", description: "", priceWeekly: "", features: "", isFeatured: false, sortOrder: "0" };
  const [planForm, setPlanForm] = useState(emptyPlanForm);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editPlanForm, setEditPlanForm] = useState(emptyPlanForm);
  const [planBusyId, setPlanBusyId] = useState<string | null>(null);

  const notify = (text: string, error = false) => { setToast({ text, error }); setTimeout(() => setToast(null), 4500); };

  useEffect(() => {
    fetch("/api/admin/me", { cache: "no-store" }).then(async r => {
      if (!r.ok) { setAuthState("denied"); return; }
      const result = await r.json();
      setAdmin(result.user);
      setAuthState("ok");
    }).catch(() => setAuthState("denied"));
  }, []);

  const loadRequests = async (status = statusFilter) => {
    setRequestsLoading(true);
    try {
      const query = status === "all" ? "" : `?status=${status}`;
      const res = await fetch(`/api/admin/deposits${query}`, { cache: "no-store" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unable to load deposit requests");
      setRequests(result.requests ?? []);
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to load deposit requests", true); } finally { setRequestsLoading(false); }
  };
  const loadAccounts = async () => {
    setAccountsLoading(true);
    try {
      const res = await fetch("/api/admin/deposit-accounts", { cache: "no-store" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unable to load deposit accounts");
      setAccounts(result.accounts ?? []);
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to load deposit accounts", true); } finally { setAccountsLoading(false); }
  };
  useEffect(() => { if (authState === "ok" && tab === "deposits") void loadRequests(statusFilter); }, [authState, tab, statusFilter]);
  useEffect(() => { if (authState === "ok" && tab === "accounts") void loadAccounts(); }, [authState, tab]);

  const review = async (id: string, action: "approve" | "reject", adminNote?: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/deposits/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, adminNote }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(result.message || "Done");
      setRejectingId(null);
      setRejectNote("");
      await loadRequests(statusFilter);
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setBusyId(null); }
  };

  const loadWithdrawalRequests = async (status = wStatusFilter) => {
    setWRequestsLoading(true);
    try {
      const query = status === "all" ? "" : `?status=${status}`;
      const res = await fetch(`/api/admin/withdrawals${query}`, { cache: "no-store" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unable to load withdrawal requests");
      setWRequests(result.requests ?? []);
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to load withdrawal requests", true); } finally { setWRequestsLoading(false); }
  };
  useEffect(() => { if (authState === "ok" && tab === "withdrawals") void loadWithdrawalRequests(wStatusFilter); }, [authState, tab, wStatusFilter]);

  const reviewWithdrawal = async (id: string, action: "approve" | "reject", adminNote?: string) => {
    setWBusyId(id);
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, adminNote }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(result.message || "Done");
      setWRejectingId(null);
      setWRejectNote("");
      await loadWithdrawalRequests(wStatusFilter);
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setWBusyId(null); }
  };

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    if (newLabel.trim().length < 2) return notify("Enter a label for this destination.", true);
    if (newInstructions.trim().length < 2) return notify("Enter the account details users should send funds to.", true);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/deposit-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: newMethod, label: newLabel, instructions: newInstructions }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify("Deposit destination added");
      setNewLabel(""); setNewInstructions("");
      await loadAccounts();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setCreating(false); }
  };
  const toggleActive = async (account: DepositAccountRow) => {
    try {
      const res = await fetch(`/api/admin/deposit-accounts/${account.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !account.isActive }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      await loadAccounts();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); }
  };
  const saveEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/deposit-accounts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: editLabel, instructions: editInstructions }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify("Deposit destination updated");
      setEditingId(null);
      await loadAccounts();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); }
  };
  const removeAccount = async (id: string) => {
    if (!window.confirm("Delete this deposit destination? Past deposit requests keep a record of what was shown at the time.")) return;
    try {
      const res = await fetch(`/api/admin/deposit-accounts/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify("Deposit destination removed");
      await loadAccounts();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); }
  };

  const loadTraders = async () => {
    setTradersLoading(true);
    try {
      const res = await fetch("/api/admin/copy-traders", { cache: "no-store" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unable to load copy traders");
      setTraders(result.traders ?? []);
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to load copy traders", true); } finally { setTradersLoading(false); }
  };
  useEffect(() => { if (authState === "ok" && tab === "traders") void loadTraders(); }, [authState, tab]);

  const createTrader = async (e: React.FormEvent) => {
    e.preventDefault();
    if (traderCreating) return;
    if (traderForm.name.trim().length < 2) return notify("Enter the trader's name.", true);
    if (traderForm.handle.trim().length < 2) return notify("Enter a handle, e.g. @alex.trades.", true);
    if (traderForm.focus.trim().length < 1) return notify("Enter the trader's focus, e.g. BTC, ETH.", true);
    if (!traderForm.subscriptionAmount || Number(traderForm.subscriptionAmount) < 0) return notify("Enter a valid subscription price (0 or more).", true);
    setTraderCreating(true);
    try {
      const res = await fetch("/api/admin/copy-traders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(traderForm) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(`${result.trader?.name ?? "Trader"} added to the roster`);
      setTraderForm(emptyTraderForm);
      await loadTraders();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setTraderCreating(false); }
  };
  const toggleTraderActive = async (t: CopyTraderRow) => {
    setTraderBusyId(t.id);
    try {
      const res = await fetch(`/api/admin/copy-traders/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !t.isActive }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      await loadTraders();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setTraderBusyId(null); }
  };
  const saveTraderEdit = async (id: string) => {
    setTraderBusyId(id);
    try {
      const res = await fetch(`/api/admin/copy-traders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editTraderForm) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify("Trader profile updated");
      setEditingTraderId(null);
      await loadTraders();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setTraderBusyId(null); }
  };
  const removeTrader = async (t: CopyTraderRow) => {
    if (!window.confirm(`Delete ${t.name} from the roster? This only works if they have no subscription history.`)) return;
    setTraderBusyId(t.id);
    try {
      const res = await fetch(`/api/admin/copy-traders/${t.id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify("Trader removed");
      await loadTraders();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setTraderBusyId(null); }
  };

  const loadBots = async () => {
    setBotsLoading(true);
    try {
      const res = await fetch("/api/admin/bots", { cache: "no-store" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unable to load trading bots");
      setBotRows(result.bots ?? []);
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to load trading bots", true); } finally { setBotsLoading(false); }
  };
  useEffect(() => { if (authState === "ok" && tab === "bots") void loadBots(); }, [authState, tab]);

  const createBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (botCreating) return;
    if (botForm.name.trim().length < 2) return notify("Enter the bot's name.", true);
    if (botForm.description.trim().length < 1) return notify("Enter a short description.", true);
    if (!botForm.minAllocation || Number(botForm.minAllocation) < 0) return notify("Enter a valid minimum allocation.", true);
    if (!botForm.subscriptionAmount || Number(botForm.subscriptionAmount) < 0) return notify("Enter a valid subscription price (0 or more).", true);
    setBotCreating(true);
    try {
      const res = await fetch("/api/admin/bots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(botForm) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(`${result.bot?.name ?? "Bot"} added to the catalog`);
      setBotForm(emptyBotForm);
      await loadBots();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setBotCreating(false); }
  };
  const toggleBotActive = async (b: BotProductRow) => {
    setBotBusyId(b.id);
    try {
      const res = await fetch(`/api/admin/bots/${b.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !b.isActive }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      await loadBots();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setBotBusyId(null); }
  };
  const saveBotEdit = async (id: string) => {
    setBotBusyId(id);
    try {
      const res = await fetch(`/api/admin/bots/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editBotForm) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify("Bot updated");
      setEditingBotId(null);
      await loadBots();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setBotBusyId(null); }
  };
  const removeBot = async (b: BotProductRow) => {
    if (!window.confirm(`Delete ${b.name} from the catalog? This only works if it has no subscription history.`)) return;
    setBotBusyId(b.id);
    try {
      const res = await fetch(`/api/admin/bots/${b.id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify("Bot removed");
      await loadBots();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setBotBusyId(null); }
  };

  const loadPlansAdmin = async () => {
    setPlansLoadingAdmin(true);
    try {
      const res = await fetch("/api/admin/plans", { cache: "no-store" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unable to load plans");
      setPlanRows(result.plans ?? []);
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to load plans", true); } finally { setPlansLoadingAdmin(false); }
  };
  useEffect(() => { if (authState === "ok" && tab === "plans") void loadPlansAdmin(); }, [authState, tab]);

  const createPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (planCreating) return;
    if (planForm.name.trim().length < 2) return notify("Enter the plan's name.", true);
    if (planForm.description.trim().length < 1) return notify("Enter a short description.", true);
    if (!planForm.priceWeekly || Number(planForm.priceWeekly) < 0) return notify("Enter a valid weekly price (0 or more).", true);
    if (planForm.features.trim().length < 1) return notify("List at least one feature (one per line).", true);
    setPlanCreating(true);
    try {
      const res = await fetch("/api/admin/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(planForm) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(`${result.plan?.name ?? "Plan"} added to the catalog`);
      setPlanForm(emptyPlanForm);
      await loadPlansAdmin();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setPlanCreating(false); }
  };
  const togglePlanActive = async (p: PlanRow) => {
    setPlanBusyId(p.id);
    try {
      const res = await fetch(`/api/admin/plans/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !p.isActive }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      await loadPlansAdmin();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setPlanBusyId(null); }
  };
  const savePlanEdit = async (id: string) => {
    setPlanBusyId(id);
    try {
      const res = await fetch(`/api/admin/plans/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editPlanForm) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify("Plan updated");
      setEditingPlanId(null);
      await loadPlansAdmin();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setPlanBusyId(null); }
  };
  const removePlan = async (p: PlanRow) => {
    if (!window.confirm(`Delete ${p.name} from the catalog? This only works if it has no subscription history.`)) return;
    setPlanBusyId(p.id);
    try {
      const res = await fetch(`/api/admin/plans/${p.id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify("Plan removed");
      await loadPlansAdmin();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setPlanBusyId(null); }
  };

  if (authState === "loading") return <div className="admin-shell admin-center"><Clock3 size={22}/><p>Loading admin panel…</p></div>;
  if (authState === "denied") return <div className="admin-shell admin-center">
    <div className="panel admin-denied">
      <LockKeyhole size={28}/>
      <h2>Admins only</h2>
      <p>You need an admin account to view this page. Sign in with an admin account on the main app, then come back here.</p>
      <a className="primary-btn" href="/"><ArrowLeft size={16}/> Back to NexaTrade</a>
    </div>
  </div>;

  return <div className="admin-shell">
    <header className="admin-topbar">
      <a href="/" className="brand admin-brand"><div className="brand-icon"><Activity size={20} strokeWidth={3}/></div><span>Nexa<span>Trade</span></span></a>
      <div className="admin-topbar-right">
        <span className="admin-whoami"><ShieldCheck size={15}/> {admin?.name} · Admin</span>
        <a href="/" className="outline-btn small"><ArrowLeft size={14}/> Exit to app</a>
      </div>
    </header>
    <main className="admin-content">
      <div className="page-heading"><div><div className="eyebrow">ADMIN PANEL</div><h1>Deposits &amp; withdrawals</h1><p>Verify receipts and payout requests submitted by users, and manage where deposits are sent.</p></div></div>
      <div className="admin-tabs">
        <button className={tab === "deposits" ? "active" : ""} onClick={() => setTab("deposits")}>Deposit requests</button>
        <button className={tab === "withdrawals" ? "active" : ""} onClick={() => setTab("withdrawals")}>Withdrawal requests</button>
        <button className={tab === "accounts" ? "active" : ""} onClick={() => setTab("accounts")}>Deposit destinations</button>
        <button className={tab === "traders" ? "active" : ""} onClick={() => setTab("traders")}>Copy traders</button>
        <button className={tab === "bots" ? "active" : ""} onClick={() => setTab("bots")}>Trading bots</button>
        <button className={tab === "plans" ? "active" : ""} onClick={() => setTab("plans")}>Plans</button>
      </div>

      {tab === "deposits" && <section className="panel admin-panel">
        <div className="section-head">
          <div><h2>Deposit requests</h2><p>Approving credits the user&apos;s balance immediately; nothing is credited automatically.</p></div>
          <div className="admin-filter-row">
            <div className="segmented">{(["pending", "approved", "rejected", "all"] as const).map(s => <button key={s} className={statusFilter === s ? "active" : ""} onClick={() => setStatusFilter(s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}</div>
            <button className="outline-btn small" onClick={() => loadRequests(statusFilter)}><RefreshCw size={13} className={requestsLoading ? "spin" : ""}/> Refresh</button>
          </div>
        </div>
        <div className="admin-request-list">
          {requests.length === 0 && !requestsLoading && <div className="empty-state"><span className="empty-icon"><Clock3 size={27}/></span><h3>No {statusFilter === "all" ? "" : statusFilter} deposit requests</h3><p>Submitted deposit requests will appear here.</p></div>}
          {requests.map(r => <div className="admin-request-card" key={r.id}>
            <div className="admin-request-head">
              <div><strong>{money(Number(r.amount))}</strong><span className="admin-request-method">{depositMethodLabel(r.method)}{r.destinationLabel ? ` · ${r.destinationLabel}` : ""}</span></div>
              <span className={`status-pill ${r.status}`}><span/>{r.status === "pending" ? "Pending review" : r.status === "approved" ? "Approved" : "Rejected"}</span>
            </div>
            <div className="admin-request-meta">
              <div><span>User</span><strong>{r.userName}</strong><small>{r.userEmail}</small></div>
              <div><span>Submitted</span><strong>{new Date(r.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</strong></div>
              {r.reference && <div><span>Reference</span><strong>{r.reference}</strong></div>}
              <div><span>Receipt</span><a href={`/api/deposits/${r.id}/receipt`} target="_blank" rel="noreferrer" className="text-link">View file <Activity size={13}/></a></div>
            </div>
            {r.note && <p className="admin-request-note"><strong>User note:</strong> {r.note}</p>}
            {r.adminNote && <p className="admin-request-note admin-note-flag"><AlertTriangle size={13}/> {r.adminNote}</p>}
            {r.status === "pending" && <div className="admin-request-actions">
              {rejectingId === r.id ? <div className="admin-reject-form">
                <textarea className="text-input" placeholder="Reason for rejection (shown to the user)" value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={2}/>
                <div className="admin-reject-buttons">
                  <button className="outline-btn small" onClick={() => { setRejectingId(null); setRejectNote(""); }}>Cancel</button>
                  <button className="primary-btn small reject-btn" disabled={busyId === r.id || !rejectNote.trim()} onClick={() => review(r.id, "reject", rejectNote)}><X size={14}/> Confirm reject</button>
                </div>
              </div> : <>
                <button className="primary-btn small" disabled={busyId === r.id} onClick={() => review(r.id, "approve")}><Check size={14}/> Approve &amp; credit</button>
                <button className="outline-btn small reject-outline" disabled={busyId === r.id} onClick={() => setRejectingId(r.id)}><X size={14}/> Reject</button>
              </>}
            </div>}
          </div>)}
        </div>
      </section>}

      {tab === "withdrawals" && <section className="panel admin-panel">
        <div className="section-head">
          <div><h2>Withdrawal requests</h2><p>The requested amount is already held from the user&apos;s balance. Send the payout yourself, then approve here to finalize, or reject to refund it.</p></div>
          <div className="admin-filter-row">
            <div className="segmented">{(["pending", "approved", "rejected", "all"] as const).map(s => <button key={s} className={wStatusFilter === s ? "active" : ""} onClick={() => setWStatusFilter(s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}</div>
            <button className="outline-btn small" onClick={() => loadWithdrawalRequests(wStatusFilter)}><RefreshCw size={13} className={wRequestsLoading ? "spin" : ""}/> Refresh</button>
          </div>
        </div>
        <div className="admin-request-list">
          {wRequests.length === 0 && !wRequestsLoading && <div className="empty-state"><span className="empty-icon"><Clock3 size={27}/></span><h3>No {wStatusFilter === "all" ? "" : wStatusFilter} withdrawal requests</h3><p>Submitted withdrawal requests will appear here.</p></div>}
          {wRequests.map(r => <div className="admin-request-card" key={r.id}>
            <div className="admin-request-head">
              <div><strong>{money(Number(r.amount))}</strong><span className="admin-request-method">{withdrawalMethodLabel(r.method, r.methodLabel)}</span></div>
              <span className={`status-pill ${r.status}`}><span/>{r.status === "pending" ? "Pending review" : r.status === "approved" ? "Approved" : "Rejected"}</span>
            </div>
            <div className="admin-request-meta">
              <div><span>User</span><strong>{r.userName}</strong><small>{r.userEmail}</small></div>
              <div><span>Submitted</span><strong>{new Date(r.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</strong></div>
              <div><span>Send payout to</span><strong>{r.destination}</strong></div>
            </div>
            {r.note && <p className="admin-request-note"><strong>User note:</strong> {r.note}</p>}
            {r.adminNote && <p className="admin-request-note admin-note-flag"><AlertTriangle size={13}/> {r.adminNote}</p>}
            {r.status === "pending" && <div className="admin-request-actions">
              {wRejectingId === r.id ? <div className="admin-reject-form">
                <textarea className="text-input" placeholder="Reason for rejection (shown to the user; the held amount is refunded)" value={wRejectNote} onChange={e => setWRejectNote(e.target.value)} rows={2}/>
                <div className="admin-reject-buttons">
                  <button className="outline-btn small" onClick={() => { setWRejectingId(null); setWRejectNote(""); }}>Cancel</button>
                  <button className="primary-btn small reject-btn" disabled={wBusyId === r.id || !wRejectNote.trim()} onClick={() => reviewWithdrawal(r.id, "reject", wRejectNote)}><X size={14}/> Confirm reject &amp; refund</button>
                </div>
              </div> : <>
                <button className="primary-btn small" disabled={wBusyId === r.id} onClick={() => reviewWithdrawal(r.id, "approve")}><Check size={14}/> Approve (I sent it)</button>
                <button className="outline-btn small reject-outline" disabled={wBusyId === r.id} onClick={() => setWRejectingId(r.id)}><X size={14}/> Reject &amp; refund</button>
              </>}
            </div>}
          </div>)}
        </div>
      </section>}

      {tab === "accounts" && <section className="admin-accounts-layout">
        <section className="panel admin-panel">
          <div className="section-head"><div><h2>Add a deposit destination</h2><p>This is shown to users when they choose this payment method.</p></div></div>
          <form className="admin-account-form" onSubmit={createAccount}>
            <label className="input-label">Method</label>
            <div className="select-wrap"><select value={newMethod} onChange={e => setNewMethod(e.target.value as DepositMethod)}>{DEPOSIT_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></div>
            <label className="input-label">Label</label>
            <input className="text-input" placeholder="e.g. Bitcoin (BTC) or Chase Bank - Checking" value={newLabel} onChange={e => setNewLabel(e.target.value)} maxLength={120}/>
            <label className="input-label">Details shown to users</label>
            <textarea className="text-input deposit-textarea" placeholder={"e.g.\nAddress: bc1q...\nNetwork: Bitcoin (BTC only)"} value={newInstructions} onChange={e => setNewInstructions(e.target.value)} rows={4} maxLength={2000}/>
            <button className="primary-btn full-btn" disabled={creating}>{creating ? "Adding..." : "Add destination"}</button>
          </form>
        </section>
        <section className="panel admin-panel">
          <div className="section-head"><div><h2>Current destinations</h2><p>{accounts.length} configured</p></div><button className="outline-btn small" onClick={loadAccounts}><RefreshCw size={13} className={accountsLoading ? "spin" : ""}/> Refresh</button></div>
          <div className="admin-account-list">
            {DEPOSIT_METHODS.map(m => {
              const items = accounts.filter(a => a.method === m.id);
              if (!items.length) return null;
              return <div key={m.id} className="admin-account-group">
                <h3>{m.label}</h3>
                {items.map(a => <div className={`admin-account-item ${a.isActive ? "" : "inactive"}`} key={a.id}>
                  {editingId === a.id ? <div className="admin-account-edit">
                    <input className="text-input" value={editLabel} onChange={e => setEditLabel(e.target.value)} maxLength={120}/>
                    <textarea className="text-input deposit-textarea" value={editInstructions} onChange={e => setEditInstructions(e.target.value)} rows={3} maxLength={2000}/>
                    <div className="admin-reject-buttons"><button className="outline-btn small" onClick={() => setEditingId(null)}>Cancel</button><button className="primary-btn small" onClick={() => saveEdit(a.id)}>Save</button></div>
                  </div> : <>
                    <div className="admin-account-item-top"><strong>{a.label}</strong><span className={`status-pill ${a.isActive ? "approved" : "rejected"}`}><span/>{a.isActive ? "Active" : "Hidden"}</span></div>
                    <p>{a.instructions}</p>
                    <div className="admin-account-item-actions">
                      <button className="outline-btn small" onClick={() => { setEditingId(a.id); setEditLabel(a.label); setEditInstructions(a.instructions); }}>Edit</button>
                      <button className="outline-btn small" onClick={() => toggleActive(a)}>{a.isActive ? "Hide" : "Activate"}</button>
                      <button className="outline-btn small danger-outline" onClick={() => removeAccount(a.id)}><Trash2 size={13}/> Delete</button>
                    </div>
                  </>}
                </div>)}
              </div>;
            })}
            {accounts.length === 0 && !accountsLoading && <div className="empty-state"><span className="empty-icon"><ShieldCheck size={27}/></span><h3>No destinations configured</h3><p>Add one on the left so users know where to send funds.</p></div>}
          </div>
        </section>
      </section>}

      {tab === "traders" && <section className="admin-accounts-layout">
        <section className="panel admin-panel">
          <div className="section-head"><div><h2>Add a copy trader</h2><p>Set their profile, stats, and the price users pay for a 7-day subscription.</p></div></div>
          <form className="admin-account-form" onSubmit={createTrader}>
            <label className="input-label">Name</label>
            <input className="text-input" placeholder="e.g. Alex Morgan" value={traderForm.name} onChange={e => setTraderForm({ ...traderForm, name: e.target.value })} maxLength={80}/>
            <label className="input-label">Handle</label>
            <input className="text-input" placeholder="e.g. @alex.trades" value={traderForm.handle} onChange={e => setTraderForm({ ...traderForm, handle: e.target.value })} maxLength={40}/>
            <label className="input-label">Avatar color</label>
            <div className="select-wrap"><select value={traderForm.avatarColor} onChange={e => setTraderForm({ ...traderForm, avatarColor: e.target.value as AvatarColor })}>{AVATAR_COLORS.map(c => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}</select></div>
            <label className="input-label">Focus</label>
            <input className="text-input" placeholder="e.g. BTC, ETH" value={traderForm.focus} onChange={e => setTraderForm({ ...traderForm, focus: e.target.value })} maxLength={120}/>
            <label className="input-label">Risk level</label>
            <div className="select-wrap"><select value={traderForm.riskLevel} onChange={e => setTraderForm({ ...traderForm, riskLevel: e.target.value as RiskLevel })}>{RISK_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
            <label className="input-label">Return % (30-day)</label>
            <input className="text-input" type="number" step="0.01" placeholder="e.g. 42.80" value={traderForm.returnPercent} onChange={e => setTraderForm({ ...traderForm, returnPercent: e.target.value })}/>
            <label className="input-label">Win rate %</label>
            <input className="text-input" type="number" step="0.01" min="0" max="100" placeholder="e.g. 78" value={traderForm.winRate} onChange={e => setTraderForm({ ...traderForm, winRate: e.target.value })}/>
            <label className="input-label">Subscription price (per 7 days)</label>
            <input className="text-input" type="number" step="0.01" min="0" placeholder="e.g. 49.00" value={traderForm.subscriptionAmount} onChange={e => setTraderForm({ ...traderForm, subscriptionAmount: e.target.value })}/>
            <button className="primary-btn full-btn" disabled={traderCreating}>{traderCreating ? "Adding..." : "Add trader"}</button>
          </form>
        </section>
        <section className="panel admin-panel">
          <div className="section-head"><div><h2>Roster</h2><p>{traders.length} trader{traders.length === 1 ? "" : "s"} · active subscribers shown live</p></div><button className="outline-btn small" onClick={loadTraders}><RefreshCw size={13} className={tradersLoading ? "spin" : ""}/> Refresh</button></div>
          <div className="admin-account-list">
            {traders.map(t => <div className={`admin-account-item ${t.isActive ? "" : "inactive"}`} key={t.id}>
              {editingTraderId === t.id ? <div className="admin-account-edit">
                <input className="text-input" value={editTraderForm.name} onChange={e => setEditTraderForm({ ...editTraderForm, name: e.target.value })} maxLength={80}/>
                <input className="text-input" value={editTraderForm.handle} onChange={e => setEditTraderForm({ ...editTraderForm, handle: e.target.value })} maxLength={40}/>
                <div className="select-wrap"><select value={editTraderForm.avatarColor} onChange={e => setEditTraderForm({ ...editTraderForm, avatarColor: e.target.value as AvatarColor })}>{AVATAR_COLORS.map(c => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}</select></div>
                <input className="text-input" value={editTraderForm.focus} onChange={e => setEditTraderForm({ ...editTraderForm, focus: e.target.value })} maxLength={120}/>
                <div className="select-wrap"><select value={editTraderForm.riskLevel} onChange={e => setEditTraderForm({ ...editTraderForm, riskLevel: e.target.value as RiskLevel })}>{RISK_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                <input className="text-input" type="number" step="0.01" value={editTraderForm.returnPercent} onChange={e => setEditTraderForm({ ...editTraderForm, returnPercent: e.target.value })} placeholder="Return %"/>
                <input className="text-input" type="number" step="0.01" value={editTraderForm.winRate} onChange={e => setEditTraderForm({ ...editTraderForm, winRate: e.target.value })} placeholder="Win rate %"/>
                <input className="text-input" type="number" step="0.01" min="0" value={editTraderForm.subscriptionAmount} onChange={e => setEditTraderForm({ ...editTraderForm, subscriptionAmount: e.target.value })} placeholder="Subscription price"/>
                <div className="admin-reject-buttons"><button className="outline-btn small" onClick={() => setEditingTraderId(null)}>Cancel</button><button className="primary-btn small" disabled={traderBusyId === t.id} onClick={() => saveTraderEdit(t.id)}>Save</button></div>
              </div> : <>
                <div className="admin-account-item-top"><strong>{t.name} <span style={{ color: "#9aa4b7", fontWeight: 500 }}>{t.handle}</span></strong><span className={`status-pill ${t.isActive ? "approved" : "rejected"}`}><span/>{t.isActive ? "Active" : "Hidden"}</span></div>
                <p>{t.focus} · {t.riskLevel} risk · {Number(t.returnPercent) >= 0 ? "+" : ""}{Number(t.returnPercent).toFixed(2)}% return · {Number(t.winRate).toFixed(0)}% win rate · {money(Number(t.subscriptionAmount))}/7d · {t.activeSubscribers} active subscriber{t.activeSubscribers === 1 ? "" : "s"}</p>
                <div className="admin-account-item-actions">
                  <button className="outline-btn small" onClick={() => { setEditingTraderId(t.id); setEditTraderForm({ name: t.name, handle: t.handle, avatarColor: t.avatarColor as AvatarColor, focus: t.focus, riskLevel: t.riskLevel as RiskLevel, returnPercent: t.returnPercent, winRate: t.winRate, subscriptionAmount: t.subscriptionAmount }); }}>Edit</button>
                  <button className="outline-btn small" disabled={traderBusyId === t.id} onClick={() => toggleTraderActive(t)}>{t.isActive ? "Deactivate" : "Activate"}</button>
                  <button className="outline-btn small danger-outline" disabled={traderBusyId === t.id} onClick={() => removeTrader(t)}><Trash2 size={13}/> Delete</button>
                </div>
              </>}
            </div>)}
            {traders.length === 0 && !tradersLoading && <div className="empty-state"><span className="empty-icon"><UsersRound size={27}/></span><h3>No traders yet</h3><p>Add one on the left to let users subscribe.</p></div>}
          </div>
        </section>
      </section>}

      {tab === "bots" && <section className="admin-accounts-layout">
        <section className="panel admin-panel">
          <div className="section-head"><div><h2>Add a trading bot</h2><p>Set its strategy, risk, minimum allocation, and the price users pay for a 7-day subscription.</p></div></div>
          <form className="admin-account-form" onSubmit={createBot}>
            <label className="input-label">Name</label>
            <input className="text-input" placeholder="e.g. BTC Grid Pro" value={botForm.name} onChange={e => setBotForm({ ...botForm, name: e.target.value })} maxLength={80}/>
            <label className="input-label">Description</label>
            <textarea className="text-input" rows={3} placeholder="Short description of what this bot does" value={botForm.description} onChange={e => setBotForm({ ...botForm, description: e.target.value })} maxLength={400}/>
            <label className="input-label">Strategy</label>
            <div className="select-wrap"><select value={botForm.strategy} onChange={e => setBotForm({ ...botForm, strategy: e.target.value as BotStrategy })}>{BOT_STRATEGIES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <label className="input-label">Risk level</label>
            <div className="select-wrap"><select value={botForm.riskLevel} onChange={e => setBotForm({ ...botForm, riskLevel: e.target.value as RiskLevel })}>{RISK_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
            <label className="input-label">Minimum allocation ($)</label>
            <input className="text-input" type="number" step="0.01" min="0" placeholder="e.g. 100.00" value={botForm.minAllocation} onChange={e => setBotForm({ ...botForm, minAllocation: e.target.value })}/>
            <label className="input-label">Subscription price (per 7 days)</label>
            <input className="text-input" type="number" step="0.01" min="0" placeholder="e.g. 19.00" value={botForm.subscriptionAmount} onChange={e => setBotForm({ ...botForm, subscriptionAmount: e.target.value })}/>
            <button className="primary-btn full-btn" disabled={botCreating}>{botCreating ? "Adding..." : "Add bot"}</button>
          </form>
        </section>
        <section className="panel admin-panel">
          <div className="section-head"><div><h2>Catalog</h2><p>{botRows.length} bot{botRows.length === 1 ? "" : "s"} · active subscribers shown live</p></div><button className="outline-btn small" onClick={loadBots}><RefreshCw size={13} className={botsLoading ? "spin" : ""}/> Refresh</button></div>
          <div className="admin-account-list">
            {botRows.map(b => <div className={`admin-account-item ${b.isActive ? "" : "inactive"}`} key={b.id}>
              {editingBotId === b.id ? <div className="admin-account-edit">
                <input className="text-input" value={editBotForm.name} onChange={e => setEditBotForm({ ...editBotForm, name: e.target.value })} maxLength={80}/>
                <textarea className="text-input" rows={3} value={editBotForm.description} onChange={e => setEditBotForm({ ...editBotForm, description: e.target.value })} maxLength={400}/>
                <div className="select-wrap"><select value={editBotForm.strategy} onChange={e => setEditBotForm({ ...editBotForm, strategy: e.target.value as BotStrategy })}>{BOT_STRATEGIES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                <div className="select-wrap"><select value={editBotForm.riskLevel} onChange={e => setEditBotForm({ ...editBotForm, riskLevel: e.target.value as RiskLevel })}>{RISK_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                <input className="text-input" type="number" step="0.01" min="0" value={editBotForm.minAllocation} onChange={e => setEditBotForm({ ...editBotForm, minAllocation: e.target.value })} placeholder="Minimum allocation"/>
                <input className="text-input" type="number" step="0.01" min="0" value={editBotForm.subscriptionAmount} onChange={e => setEditBotForm({ ...editBotForm, subscriptionAmount: e.target.value })} placeholder="Subscription price"/>
                <div className="admin-reject-buttons"><button className="outline-btn small" onClick={() => setEditingBotId(null)}>Cancel</button><button className="primary-btn small" disabled={botBusyId === b.id} onClick={() => saveBotEdit(b.id)}>Save</button></div>
              </div> : <>
                <div className="admin-account-item-top"><strong>{b.name}</strong><span className={`status-pill ${b.isActive ? "approved" : "rejected"}`}><span/>{b.isActive ? "Active" : "Hidden"}</span></div>
                <p>{b.description}</p>
                <p>{b.strategy} · {b.riskLevel} risk · min {money(Number(b.minAllocation))} · {money(Number(b.subscriptionAmount))}/7d · {b.activeSubscribers} active subscriber{b.activeSubscribers === 1 ? "" : "s"}</p>
                <div className="admin-account-item-actions">
                  <button className="outline-btn small" onClick={() => { setEditingBotId(b.id); setEditBotForm({ name: b.name, description: b.description, strategy: b.strategy as BotStrategy, riskLevel: b.riskLevel as RiskLevel, minAllocation: b.minAllocation, subscriptionAmount: b.subscriptionAmount }); }}>Edit</button>
                  <button className="outline-btn small" disabled={botBusyId === b.id} onClick={() => toggleBotActive(b)}>{b.isActive ? "Deactivate" : "Activate"}</button>
                  <button className="outline-btn small danger-outline" disabled={botBusyId === b.id} onClick={() => removeBot(b)}><Trash2 size={13}/> Delete</button>
                </div>
              </>}
            </div>)}
            {botRows.length === 0 && !botsLoading && <div className="empty-state"><span className="empty-icon"><Bot size={27}/></span><h3>No bots yet</h3><p>Add one on the left to let users subscribe.</p></div>}
          </div>
        </section>
      </section>}

      {tab === "plans" && <section className="admin-accounts-layout">
        <section className="panel admin-panel">
          <div className="section-head"><div><h2>Add a plan</h2><p>Set its weekly price and feature list. Users subscribe for a 7-day (weekly) window.</p></div></div>
          <form className="admin-account-form" onSubmit={createPlan}>
            <label className="input-label">Name</label>
            <input className="text-input" placeholder="e.g. Pro" value={planForm.name} onChange={e => setPlanForm({ ...planForm, name: e.target.value })} maxLength={60}/>
            <label className="input-label">Description</label>
            <textarea className="text-input" rows={2} placeholder="Short tagline for this plan" value={planForm.description} onChange={e => setPlanForm({ ...planForm, description: e.target.value })} maxLength={300}/>
            <label className="input-label">Price per week ($)</label>
            <input className="text-input" type="number" step="0.01" min="0" placeholder="e.g. 15.00" value={planForm.priceWeekly} onChange={e => setPlanForm({ ...planForm, priceWeekly: e.target.value })}/>
            <label className="input-label">Features (one per line)</label>
            <textarea className="text-input" rows={5} placeholder={"Trading bot subscriptions\nCopy trading subscriptions\nAdvanced market signals"} value={planForm.features} onChange={e => setPlanForm({ ...planForm, features: e.target.value })}/>
            <label className="input-label">Sort order</label>
            <input className="text-input" type="number" step="1" placeholder="0" value={planForm.sortOrder} onChange={e => setPlanForm({ ...planForm, sortOrder: e.target.value })}/>
            <label className="checkbox-row"><input type="checkbox" checked={planForm.isFeatured} onChange={e => setPlanForm({ ...planForm, isFeatured: e.target.checked })}/> Featured (highlighted) plan</label>
            <button className="primary-btn full-btn" disabled={planCreating}>{planCreating ? "Adding..." : "Add plan"}</button>
          </form>
        </section>
        <section className="panel admin-panel">
          <div className="section-head"><div><h2>Catalog</h2><p>{planRows.length} plan{planRows.length === 1 ? "" : "s"} · active subscribers shown live</p></div><button className="outline-btn small" onClick={loadPlansAdmin}><RefreshCw size={13} className={plansLoadingAdmin ? "spin" : ""}/> Refresh</button></div>
          <div className="admin-account-list">
            {planRows.map(p => <div className={`admin-account-item ${p.isActive ? "" : "inactive"}`} key={p.id}>
              {editingPlanId === p.id ? <div className="admin-account-edit">
                <input className="text-input" value={editPlanForm.name} onChange={e => setEditPlanForm({ ...editPlanForm, name: e.target.value })} maxLength={60}/>
                <textarea className="text-input" rows={2} value={editPlanForm.description} onChange={e => setEditPlanForm({ ...editPlanForm, description: e.target.value })} maxLength={300}/>
                <input className="text-input" type="number" step="0.01" min="0" value={editPlanForm.priceWeekly} onChange={e => setEditPlanForm({ ...editPlanForm, priceWeekly: e.target.value })} placeholder="Price per week"/>
                <textarea className="text-input" rows={5} value={editPlanForm.features} onChange={e => setEditPlanForm({ ...editPlanForm, features: e.target.value })} placeholder="Features (one per line)"/>
                <input className="text-input" type="number" step="1" value={editPlanForm.sortOrder} onChange={e => setEditPlanForm({ ...editPlanForm, sortOrder: e.target.value })} placeholder="Sort order"/>
                <label className="checkbox-row"><input type="checkbox" checked={editPlanForm.isFeatured} onChange={e => setEditPlanForm({ ...editPlanForm, isFeatured: e.target.checked })}/> Featured (highlighted) plan</label>
                <div className="admin-reject-buttons"><button className="outline-btn small" onClick={() => setEditingPlanId(null)}>Cancel</button><button className="primary-btn small" disabled={planBusyId === p.id} onClick={() => savePlanEdit(p.id)}>Save</button></div>
              </div> : <>
                <div className="admin-account-item-top"><strong>{p.name}{p.isFeatured && <span style={{ marginLeft: 8, color: "var(--blue)" }}><Sparkles size={13}/></span>}</strong><span className={`status-pill ${p.isActive ? "approved" : "rejected"}`}><span/>{p.isActive ? "Active" : "Hidden"}</span></div>
                <p>{p.description}</p>
                <p>{money(Number(p.priceWeekly))}/week · sort {p.sortOrder} · {p.activeSubscribers} active subscriber{p.activeSubscribers === 1 ? "" : "s"}</p>
                <p style={{ color: "#9aa4b7" }}>{p.features.join(" · ")}</p>
                <div className="admin-account-item-actions">
                  <button className="outline-btn small" onClick={() => { setEditingPlanId(p.id); setEditPlanForm({ name: p.name, description: p.description, priceWeekly: p.priceWeekly, features: p.features.join("\n"), isFeatured: p.isFeatured, sortOrder: p.sortOrder }); }}>Edit</button>
                  <button className="outline-btn small" disabled={planBusyId === p.id} onClick={() => togglePlanActive(p)}>{p.isActive ? "Deactivate" : "Activate"}</button>
                  <button className="outline-btn small danger-outline" disabled={planBusyId === p.id} onClick={() => removePlan(p)}><Trash2 size={13}/> Delete</button>
                </div>
              </>}
            </div>)}
            {planRows.length === 0 && !plansLoadingAdmin && <div className="empty-state"><span className="empty-icon"><Plus size={27}/></span><h3>No plans yet</h3><p>Add one on the left to let users subscribe.</p></div>}
          </div>
        </section>
      </section>}
    </main>
    {toast && <div className={`toast ${toast.error ? "error" : ""}`}><span>{toast.error ? <X size={17}/> : <Check size={17}/>}</span>{toast.text}<button onClick={() => setToast(null)}><X size={15}/></button></div>}
  </div>;
}
