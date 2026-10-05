"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, ArrowLeft, Check, Clock3, LockKeyhole, RefreshCw, ShieldCheck, Trash2, UsersRound, X } from "lucide-react";
import { DEPOSIT_METHODS, depositMethodLabel, type DepositMethod } from "@/lib/deposits";
import { withdrawalMethodLabel } from "@/lib/withdrawals";
import { AVATAR_COLORS, RISK_LEVELS, type AvatarColor, type RiskLevel } from "@/lib/copy-trading";

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
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function AdminPage() {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [authState, setAuthState] = useState<"loading" | "denied" | "ok">("loading");
  const [tab, setTab] = useState<"deposits" | "withdrawals" | "accounts" | "traders">("deposits");
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
    </main>
    {toast && <div className={`toast ${toast.error ? "error" : ""}`}><span>{toast.error ? <X size={17}/> : <Check size={17}/>}</span>{toast.text}<button onClick={() => setToast(null)}><X size={15}/></button></div>}
  </div>;
}
