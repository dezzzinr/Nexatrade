"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowDownLeft, ArrowDownRight, ArrowLeftRight, ArrowRight, ArrowUpRight, Bell, Bot, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Copy, CreditCard, Eye, EyeOff, FileText, Hourglass, History, LayoutDashboard, LockKeyhole, LogOut, Menu, MoreHorizontal, Paperclip, Plus, RefreshCw, Search, Settings2, ShieldCheck, Signal, SlidersHorizontal, Sparkles, Trash2, TrendingDown, TrendingUp, UploadCloud, UserRound, UsersRound, Wallet, WandSparkles, X, XCircle, Zap } from "lucide-react";
import { assets as catalogAssets, getAsset as getCatalogAsset, money, marketPrice, type Asset, type ChartPoint, type ChartPeriod, type MarketSnapshot } from "@/lib/market";
import { DEPOSIT_METHODS, MAX_RECEIPT_BYTES, type DepositMethod } from "@/lib/deposits";
import { WITHDRAWAL_METHODS, type WithdrawalMethod } from "@/lib/withdrawals";
import MarketChart from "@/components/market-chart";

type Page = "Overview" | "Portfolio" | "Trade" | "Trading Bot" | "Markets" | "Plans" | "Copy Trading" | "Deposit" | "Withdraw" | "Trading Signals" | "Transactions" | "Trade History";
type DepositAccount = { id: string; method: string; label: string; instructions: string };
type DepositRequest = { id: string; method: string; amount: string; destinationLabel: string | null; reference: string | null; note: string | null; status: string; adminNote: string | null; receiptFilename: string; createdAt: string; reviewedAt: string | null };
type WithdrawalRequest = { id: string; method: string; methodLabel: string | null; amount: string; destination: string; note: string | null; status: string; adminNote: string | null; createdAt: string; reviewedAt: string | null };
type AppData = { user: { id: string; name: string; email: string | null; isDemo: boolean; role: string; cashBalance: number }; holdings: { id: string; symbol: string; quantity: string; avgPrice: string }[]; trades: { id: string; symbol: string; side: string; quantity: string; price: string; total: string; createdAt: string }[]; transactions: { id: string; type: string; amount: string; description: string; createdAt: string }[]; plan: string | null; planExpiresAt: string | null };
type CopyTrader = { id: string; name: string; handle: string; avatarInitials: string; avatarColor: string; focus: string; riskLevel: string; returnPercent: string; winRate: string; subscriptionAmount: string; activeSubscribers: number; mySubscription: { expiresAt: string; amount: string } | null };
type CopySubscription = { id: string; traderId: string; traderName: string; traderHandle: string; amount: string; startedAt: string; expiresAt: string };
type TradingBot = { id: string; name: string; description: string; strategy: string; riskLevel: string; minAllocation: string; subscriptionAmount: string; activeSubscribers: number; mySubscription: { expiresAt: string; amount: string } | null };
type BotSubscription = { id: string; botProductId: string; botName: string; amount: string; startedAt: string; expiresAt: string };
type BotInstance = { id: string; botProductId: string; botName: string; strategy: string; name: string; symbol: string; amount: string; active: boolean; createdAt: string; subscriptionActive: boolean };
type Plan = { id: string; name: string; description: string; priceWeekly: string; features: string[]; isFeatured: boolean; activeSubscribers: number; mySubscription: { expiresAt: string; amount: string; isCurrent: boolean } | null };
type PlanSubscription = { id: string; planId: string; planName: string; amount: string; startedAt: string; expiresAt: string };
const preview: AppData = {
  user: { id: "preview", name: "Alex Morgan", email: null, isDemo: true, role: "user", cashBalance: 12540.50 },
  holdings: [{ id: "a", symbol: "BTC", quantity: "0.28450000", avgPrice: "61240.00" }, { id: "b", symbol: "ETH", quantity: "3.25000000", avgPrice: "3180.00" }, { id: "c", symbol: "SOL", quantity: "42.00000000", avgPrice: "148.50" }, { id: "d", symbol: "AVAX", quantity: "80.00000000", avgPrice: "34.20" }],
  trades: [{ id: "t1", symbol: "BTC", side: "buy", quantity: "0.08450000", price: "66421.50", total: "5612.62", createdAt: new Date(Date.now() - 7200000).toISOString() }, { id: "t2", symbol: "ETH", side: "buy", quantity: "1.25000000", price: "3482.20", total: "4352.75", createdAt: new Date(Date.now() - 90000000).toISOString() }, { id: "t3", symbol: "SOL", side: "sell", quantity: "12.00000000", price: "168.40", total: "2020.80", createdAt: new Date(Date.now() - 259200000).toISOString() }],
  transactions: [], plan: null, planExpiresAt: null
};
const navGroups: { label: string; items: { name: Page; icon: typeof LayoutDashboard }[] }[] = [
  { label: "WORKSPACE", items: [{ name: "Overview", icon: LayoutDashboard }, { name: "Portfolio", icon: Wallet }, { name: "Trade", icon: ArrowLeftRight }, { name: "Markets", icon: Activity }] },
  { label: "GROW YOUR WEALTH", items: [{ name: "Trading Bot", icon: Bot }, { name: "Copy Trading", icon: UsersRound }, { name: "Trading Signals", icon: Signal }, { name: "Plans", icon: Sparkles }] },
  { label: "ACCOUNT", items: [{ name: "Deposit", icon: ArrowDownLeft }, { name: "Withdraw", icon: ArrowUpRight }, { name: "Transactions", icon: CreditCard }, { name: "Trade History", icon: History }] },
];
const fmtQty = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 8 });
function AssetIcon({ asset, size = 38 }: { asset: Asset; size?: number }) {
  const [imageFailed, setImageFailed] = useState(false);
  return <span className="asset-icon" style={{ width: size, height: size, background: asset.image && !imageFailed ? "transparent" : asset.color, fontSize: size * .52 }}>
    {asset.image && !imageFailed ? <img src={asset.image} alt={`${asset.name} logo`} width={size} height={size} loading="lazy" onError={() => setImageFailed(true)}/> : asset.mark}
  </span>;
}
function Sparkline({ values, positive = true, width = 104, height = 40 }: { values: number[]; positive?: boolean; width?: number; height?: number }) {
  if (values.length < 2) return <span className="price-placeholder">—</span>;
  const min = Math.min(...values), max = Math.max(...values);
  const padding = (max - min) * .15 || Math.max(max * .02, 0.000001);
  const points = values.map((v, i) => `${i * width / (values.length - 1)},${height - 4 - ((v - min + padding) / (max - min + 2 * padding)) * (height - 8)}`).join(" ");
  return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-label="Seven day price trend"><polyline points={points} fill="none" stroke={positive ? "#16b981" : "#f05b67"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function PageTitle({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description: string; children?: React.ReactNode }) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow || "YOUR WORKSPACE"}</div><h1>{title}</h1><p>{description}</p></div>{children && <div className="heading-actions">{children}</div>}</div>; }
function SectionHead({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) { return <div className="section-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>; }
function EmptyState({ icon: Icon, title, text }: { icon: typeof Bot; title: string; text: string }) { return <div className="empty-state"><span className="empty-icon"><Icon size={27}/></span><h3>{title}</h3><p>{text}</p></div>; }

export default function HomePage() {
  const [data, setData] = useState<AppData>(preview);
  const [page, setPage] = useState<Page>("Overview");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [period, setPeriod] = useState<ChartPeriod>("7D");
  const [market, setMarket] = useState<Omit<MarketSnapshot, "status"> & { status: MarketSnapshot["status"] | "loading" }>({ assets: [], status: "loading", updatedAt: null, source: "CoinGecko" });
  const [marketRefreshing, setMarketRefreshing] = useState(false);
  const [chartPoints, setChartPoints] = useState<ChartPoint[]>([]);
  const [chartStatus, setChartStatus] = useState<"loading" | "ready" | "error">("loading");
  const [chartRefresh, setChartRefresh] = useState(0);
  const [hideBalance, setHideBalance] = useState(false);
  const [search, setSearch] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [symbol, setSymbol] = useState("BTC");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [tradeAmount, setTradeAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState<DepositMethod>("crypto");
  const [depositAccounts, setDepositAccounts] = useState<DepositAccount[]>([]);
  const [depositAccountsLoaded, setDepositAccountsLoaded] = useState(false);
  const [depositAccountId, setDepositAccountId] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositReference, setDepositReference] = useState("");
  const [depositNote, setDepositNote] = useState("");
  const [receiptFile, setReceiptFile] = useState<{ name: string; type: string; size: number; dataUrl: string } | null>(null);
  const [receiptError, setReceiptError] = useState("");
  const [depositSubmitting, setDepositSubmitting] = useState(false);
  const [myDeposits, setMyDeposits] = useState<DepositRequest[]>([]);
  const [withdrawalMethod, setWithdrawalMethod] = useState<WithdrawalMethod>("crypto");
  const [withdrawalMethodLabelInput, setWithdrawalMethodLabelInput] = useState("");
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalDestination, setWithdrawalDestination] = useState("");
  const [withdrawalNote, setWithdrawalNote] = useState("");
  const [withdrawalSubmitting, setWithdrawalSubmitting] = useState(false);
  const [myWithdrawals, setMyWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [botAmount, setBotAmount] = useState("500");
  const [botStrategy, setBotStrategy] = useState("DCA");
  const [botSymbol, setBotSymbol] = useState("BTC");
  const [copyTraders, setCopyTraders] = useState<CopyTrader[]>([]);
  const [copyTradersLoaded, setCopyTradersLoaded] = useState(false);
  const [mySubscriptions, setMySubscriptions] = useState<CopySubscription[]>([]);
  const [subscribingId, setSubscribingId] = useState("");
  const [tradingBots, setTradingBots] = useState<TradingBot[]>([]);
  const [tradingBotsLoaded, setTradingBotsLoaded] = useState(false);
  const [botSubHistory, setBotSubHistory] = useState<BotSubscription[]>([]);
  const [botInstances, setBotInstances] = useState<BotInstance[]>([]);
  const [botSubscribingId, setBotSubscribingId] = useState("");
  const [configuringBotId, setConfiguringBotId] = useState<string | null>(null);
  const [newInstanceSymbol, setNewInstanceSymbol] = useState("BTC");
  const [newInstanceAmount, setNewInstanceAmount] = useState("");
  const [newInstanceName, setNewInstanceName] = useState("");
  const [instanceCreating, setInstanceCreating] = useState(false);
  const [instanceBusyId, setInstanceBusyId] = useState("");
  const [plansCatalog, setPlansCatalog] = useState<Plan[]>([]);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [planSubHistory, setPlanSubHistory] = useState<PlanSubscription[]>([]);
  const [planSubscribingId, setPlanSubscribingId] = useState("");
  const [marketTab, setMarketTab] = useState("All assets");
  const [historyTab, setHistoryTab] = useState("All");

  const notify = (text: string, error = false) => { setToast({ text, error }); setTimeout(() => setToast(null), 4500); };
  const refresh = async () => { try { const response = await fetch("/api/app", { cache: "no-store" }); if (!response.ok) throw new Error("Could not load your account"); setData(await response.json()); setReady(true); } catch { notify("Could not connect to your workspace. Please refresh.", true); } };
  useEffect(() => { void refresh(); }, []);
  const refreshMarket = async () => {
    setMarketRefreshing(true);
    try {
      const response = await fetch("/api/market", { cache: "no-store" });
      if (!response.ok) throw new Error("Market request failed");
      const snapshot = await response.json() as MarketSnapshot;
      if (!Array.isArray(snapshot.assets)) throw new Error("Invalid market data");
      setMarket(previous => snapshot.status === "unavailable" && previous.assets.length ? { ...previous, status: "stale" } : snapshot);
    } catch {
      setMarket(previous => ({ ...previous, status: previous.assets.length ? "stale" : "unavailable" }));
    } finally { setMarketRefreshing(false); }
  };
  useEffect(() => {
    void refreshMarket();
    const interval = window.setInterval(() => { if (!document.hidden) void refreshMarket(); }, 60000);
    const onVisible = () => { if (!document.hidden) void refreshMarket(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  const holdingsKey = data.holdings.map(h => `${h.symbol}:${h.quantity}`).join(",") + `:${data.user.cashBalance}`;
  useEffect(() => {
    if (!ready || (page !== "Overview" && page !== "Trade")) return;
    const controller = new AbortController();
    setChartPoints([]);
    setChartStatus("loading");
    const query = new URLSearchParams({ period, ...(page === "Overview" ? { mode: "portfolio" } : { symbol }) });
    fetch(`/api/market/chart?${query}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error("Chart unavailable"); return response.json(); })
      .then((result: { points?: ChartPoint[] }) => {
        if (!Array.isArray(result.points) || result.points.length < 2) throw new Error("Chart unavailable");
        setChartPoints(result.points);
        setChartStatus("ready");
      })
      .catch(() => { if (!controller.signal.aborted) setChartStatus("error"); });
    return () => controller.abort();
  }, [page, period, symbol, ready, data.user.id, holdingsKey, chartRefresh]);
  const loadMyDeposits = async () => { try { const res = await fetch("/api/deposits", { cache: "no-store" }); if (!res.ok) return; const result = await res.json(); if (Array.isArray(result.requests)) setMyDeposits(result.requests); } catch { /* ignore */ } };
  useEffect(() => {
    if (!ready || page !== "Deposit") return;
    void loadMyDeposits();
    if (!depositAccountsLoaded) fetch("/api/deposit-accounts", { cache: "no-store" }).then(r => r.json()).then(result => { if (Array.isArray(result.accounts)) setDepositAccounts(result.accounts); setDepositAccountsLoaded(true); }).catch(() => setDepositAccountsLoaded(true));
  }, [ready, page, depositAccountsLoaded]);
  const methodAccounts = depositAccounts.filter(a => a.method === depositMethod);
  useEffect(() => { setDepositAccountId(methodAccounts[0]?.id ?? ""); }, [depositMethod, depositAccounts.length]);
  const handleReceiptFile = (file: File | null) => {
    setReceiptError("");
    if (!file) { setReceiptFile(null); return; }
    const okType = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"].includes(file.type);
    if (!okType) { setReceiptError("Upload a JPG, PNG, WEBP, HEIC, or PDF file."); setReceiptFile(null); return; }
    if (file.size > MAX_RECEIPT_BYTES) { setReceiptError(`File is too large. Max size is ${(MAX_RECEIPT_BYTES / (1024 * 1024)).toFixed(0)}MB.`); setReceiptFile(null); return; }
    const reader = new FileReader();
    reader.onload = () => setReceiptFile({ name: file.name, type: file.type, size: file.size, dataUrl: String(reader.result) });
    reader.onerror = () => setReceiptError("Could not read that file. Please try again.");
    reader.readAsDataURL(file);
  };
  const submitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (depositSubmitting) return;
    if (methodAccounts.length && !depositAccountId) return notify("Select a destination account.", true);
    if (!receiptFile) return notify("Attach a receipt or screenshot of your payment.", true);
    const amount = Number(depositAmount);
    if (!amount || amount <= 0) return notify("Enter a valid deposit amount.", true);
    setDepositSubmitting(true);
    try {
      const res = await fetch("/api/deposits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: depositMethod, amount, depositAccountId: depositAccountId || null, reference: depositReference, note: depositNote, receipt: receiptFile.dataUrl, receiptFilename: receiptFile.name }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(result.message || "Deposit request submitted");
      setDepositAmount(""); setDepositReference(""); setDepositNote(""); setReceiptFile(null);
      await loadMyDeposits();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setDepositSubmitting(false); }
  };
  const action = async (body: Record<string, unknown>) => { if (loading) return false; setLoading(true); try { const res = await fetch("/api/app", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await res.json(); if (!res.ok) throw new Error(result.error || "Something went wrong"); notify(result.message || "Done successfully"); await refresh(); return true; } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); return false; } finally { setLoading(false); } };
  const authenticate = async (e: React.FormEvent) => { e.preventDefault(); setLoading(true); try { const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: authMode, name: authName, email: authEmail, password: authPassword }) }); const result = await res.json(); if (!res.ok) throw new Error(result.error); setAuthMode(null); setAuthPassword(""); setPage("Overview"); await refresh(); notify(authMode === "register" ? "Welcome to NexaTrade! Your account is ready." : "Welcome back!"); } catch (error) { notify(error instanceof Error ? error.message : "Authentication failed", true); } finally { setLoading(false); } };
  const logout = async () => { await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) }); setProfileOpen(false); await refresh(); setPage("Overview"); notify("Switched to a fresh demo workspace"); };
  const go = (p: Page) => { setPage(p); setMobileMenu(false); setProfileOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const assets: Asset[] = market.assets.length ? market.assets : catalogAssets;
  const getAsset = (ticker: string) => assets.find(a => a.symbol === ticker) ?? getCatalogAsset(ticker);
  const hasQuotes = market.assets.length === catalogAssets.length && market.assets.every(a => a.price > 0);
  const quoteLive = market.status === "live" && hasQuotes && !!market.updatedAt && Date.now() - Date.parse(market.updatedAt) < 10 * 60 * 1000;
  const currentAsset = getAsset(symbol)!;
  const portfolioValue = hasQuotes ? data.holdings.reduce((sum, h) => sum + Number(h.quantity) * (getAsset(h.symbol)?.price ?? 0), 0) : NaN;
  const totalBalance = hasQuotes ? portfolioValue + data.user.cashBalance : NaN;
  const pnl = hasQuotes ? data.holdings.reduce((sum, h) => sum + Number(h.quantity) * ((getAsset(h.symbol)?.price ?? 0) - Number(h.avgPrice)), 0) : NaN;
  const costBasis = data.holdings.reduce((sum, h) => sum + Number(h.quantity) * Number(h.avgPrice), 0);
  const pnlPercent = hasQuotes && costBasis > 0 ? pnl / costBasis * 100 : 0;
  const periodDelta = chartStatus === "ready" && chartPoints.length > 1 && hasQuotes ? totalBalance - chartPoints[0].price : null;
  const periodPercent = periodDelta !== null && chartPoints[0].price > 0 ? periodDelta / chartPoints[0].price * 100 : null;
  const filteredAssets = assets.filter(a => (marketTab === "Gainers" ? a.price > 0 && a.change > 0 : marketTab === "Losers" ? a.price > 0 && a.change < 0 : true) && (a.symbol.toLowerCase().includes(search.toLowerCase()) || a.name.toLowerCase().includes(search.toLowerCase())));
  const signals = market.assets.filter(a => a.price > 0).slice(0, 4);
  const allocations = data.holdings.map((h, i) => ({ symbol: h.symbol, value: Number(h.quantity) * (getAsset(h.symbol)?.price ?? 0), color: ["#3936ee", "#8175f7", "#28b7a4", "#f7b846", "#ec6676", "#4f86ec"][i % 6] })).filter(a => a.value > 0);
  let allocationCursor = 0;
  const allocationBackground = hasQuotes && portfolioValue > 0 ? `conic-gradient(${allocations.map(item => { const start = allocationCursor; allocationCursor += item.value / portfolioValue * 100; return `${item.color} ${start}% ${allocationCursor}%`; }).join(", ")})` : "#edf0f6";
  const asOf = market.updatedAt ? new Date(market.updatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;
  const firstName = data.user.name.split(" ")[0];
  const date = useMemo(() => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date()), []);
  const trade = async (e: React.FormEvent) => { e.preventDefault(); if (!quoteLive || currentAsset.price <= 0) return notify("Live quotes are unavailable. Paper trading is paused.", true); const usd = Number(tradeAmount); if (!usd || usd <= 0) return notify("Enter a valid USD amount", true); const quantity = Math.floor((usd / currentAsset.price) * 1e8) / 1e8; if (!quantity) return notify("Amount is too small for this asset", true); const ok = await action({ action: "trade", symbol, side, quantity }); if (ok) { setTradeAmount(""); void refreshMarket(); } };
  const loadMyWithdrawals = async () => { try { const res = await fetch("/api/withdrawals", { cache: "no-store" }); if (!res.ok) return; const result = await res.json(); if (Array.isArray(result.requests)) setMyWithdrawals(result.requests); } catch { /* ignore */ } };
  useEffect(() => { if (ready && page === "Withdraw") void loadMyWithdrawals(); }, [ready, page]);
  const loadCopyTraders = async () => { try { const res = await fetch("/api/copy-traders", { cache: "no-store" }); if (!res.ok) return; const result = await res.json(); if (Array.isArray(result.traders)) setCopyTraders(result.traders); } catch { /* ignore */ } finally { setCopyTradersLoaded(true); } };
  const loadMySubscriptions = async () => { try { const res = await fetch("/api/copy-subscriptions", { cache: "no-store" }); if (!res.ok) return; const result = await res.json(); if (Array.isArray(result.subscriptions)) setMySubscriptions(result.subscriptions); } catch { /* ignore */ } };
  useEffect(() => { if (ready && page === "Copy Trading") { void loadCopyTraders(); void loadMySubscriptions(); } }, [ready, page]);
  const subscribeToTrader = async (trader: CopyTrader) => {
    if (subscribingId) return;
    setSubscribingId(trader.id);
    try {
      const res = await fetch("/api/copy-subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ traderId: trader.id }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(result.message || `Subscribed to ${trader.name} for 7 days`);
      await Promise.all([loadCopyTraders(), loadMySubscriptions(), refresh()]);
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setSubscribingId(""); }
  };
  const daysLeft = (expiresAt: string) => Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000));
  const loadTradingBots = async () => { try { const res = await fetch("/api/bots", { cache: "no-store" }); if (!res.ok) return; const result = await res.json(); if (Array.isArray(result.bots)) setTradingBots(result.bots); } catch { /* ignore */ } finally { setTradingBotsLoaded(true); } };
  const loadBotSubHistory = async () => { try { const res = await fetch("/api/bot-subscriptions", { cache: "no-store" }); if (!res.ok) return; const result = await res.json(); if (Array.isArray(result.subscriptions)) setBotSubHistory(result.subscriptions); } catch { /* ignore */ } };
  const loadBotInstances = async () => { try { const res = await fetch("/api/bot-instances", { cache: "no-store" }); if (!res.ok) return; const result = await res.json(); if (Array.isArray(result.instances)) setBotInstances(result.instances); } catch { /* ignore */ } };
  useEffect(() => { if (ready && page === "Trading Bot") { void loadTradingBots(); void loadBotSubHistory(); void loadBotInstances(); } }, [ready, page]);
  const subscribeToBot = async (bot: TradingBot) => {
    if (botSubscribingId) return;
    setBotSubscribingId(bot.id);
    try {
      const res = await fetch("/api/bot-subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ botProductId: bot.id }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(result.message || `Subscribed to ${bot.name} for 7 days`);
      await Promise.all([loadTradingBots(), loadBotSubHistory(), refresh()]);
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setBotSubscribingId(""); }
  };
  const openConfigureBot = (bot: TradingBot) => {
    setConfiguringBotId(configuringBotId === bot.id ? null : bot.id);
    setNewInstanceSymbol("BTC");
    setNewInstanceAmount(bot.minAllocation);
    setNewInstanceName("");
  };
  const createBotInstance = async (bot: TradingBot) => {
    if (instanceCreating) return;
    const amount = Number(newInstanceAmount);
    if (!amount || amount < Number(bot.minAllocation)) return notify(`Enter an allocation of at least ${money(Number(bot.minAllocation))}.`, true);
    setInstanceCreating(true);
    try {
      const res = await fetch("/api/bot-instances", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ botProductId: bot.id, symbol: newInstanceSymbol, amount, name: newInstanceName }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(result.message || "Bot configured");
      setConfiguringBotId(null);
      setNewInstanceName("");
      await loadBotInstances();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setInstanceCreating(false); }
  };
  const toggleBotInstance = async (instance: BotInstance) => {
    if (instanceBusyId) return;
    setInstanceBusyId(instance.id);
    try {
      const res = await fetch(`/api/bot-instances/${instance.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !instance.active }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      await loadBotInstances();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setInstanceBusyId(""); }
  };
  const removeBotInstance = async (instance: BotInstance) => {
    if (instanceBusyId || !window.confirm(`Remove ${instance.name}? This only deletes the configuration, not your bot subscription.`)) return;
    setInstanceBusyId(instance.id);
    try {
      const res = await fetch(`/api/bot-instances/${instance.id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      await loadBotInstances();
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setInstanceBusyId(""); }
  };
  const loadPlans = async () => { try { const res = await fetch("/api/plans", { cache: "no-store" }); if (!res.ok) return; const result = await res.json(); if (Array.isArray(result.plans)) setPlansCatalog(result.plans); } catch { /* ignore */ } finally { setPlansLoaded(true); } };
  const loadPlanSubHistory = async () => { try { const res = await fetch("/api/plan-subscriptions", { cache: "no-store" }); if (!res.ok) return; const result = await res.json(); if (Array.isArray(result.subscriptions)) setPlanSubHistory(result.subscriptions); } catch { /* ignore */ } };
  useEffect(() => { if (ready && page === "Plans") { void loadPlans(); void loadPlanSubHistory(); } }, [ready, page]);
  const subscribeToPlan = async (plan: Plan) => {
    if (planSubscribingId) return;
    setPlanSubscribingId(plan.id);
    try {
      const res = await fetch("/api/plan-subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: plan.id }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(result.message || `Subscribed to the ${plan.name} plan for 7 days`);
      await Promise.all([loadPlans(), loadPlanSubHistory(), refresh()]);
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setPlanSubscribingId(""); }
  };
  const submitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (withdrawalSubmitting) return;
    const amount = Number(withdrawalAmount);
    if (!amount || amount <= 0) return notify("Enter a valid withdrawal amount.", true);
    if (amount > data.user.cashBalance) return notify("You can't request more than your available balance.", true);
    if (withdrawalDestination.trim().length < 3) return notify("Tell us where to send your payout.", true);
    if (withdrawalMethod === "other" && withdrawalMethodLabelInput.trim().length < 2) return notify("Tell us the name of the platform you'd like to be paid through.", true);
    setWithdrawalSubmitting(true);
    try {
      const res = await fetch("/api/withdrawals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: withdrawalMethod, methodLabel: withdrawalMethodLabelInput, amount, destination: withdrawalDestination, note: withdrawalNote }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong");
      notify(result.message || "Withdrawal request submitted");
      setWithdrawalAmount(""); setWithdrawalDestination(""); setWithdrawalNote(""); setWithdrawalMethodLabelInput("");
      await Promise.all([loadMyWithdrawals(), refresh()]);
    } catch (error) { notify(error instanceof Error ? error.message : "Something went wrong", true); } finally { setWithdrawalSubmitting(false); }
  };
  const assetRow = (asset: Asset, i: number, showCap = false) =>
    <tr key={asset.symbol} onClick={() => { setSymbol(asset.symbol); go("Trade"); }} className="clickable-row">
      <td className="rank-cell">{asset.rank ? String(asset.rank).padStart(2, "0") : String(i + 1).padStart(2, "0")}</td>
      <td><div className="coin-cell"><AssetIcon asset={asset} size={36}/><div><strong>{asset.name}</strong><span>{asset.symbol}</span></div></div></td>
      <td className="table-strong">{marketPrice(asset.price)}</td>
      <td>{asset.price > 0 ? <span className={`change ${asset.change >= 0 ? "positive" : "negative"}`}>{asset.change >= 0 ? "+" : ""}{asset.change.toFixed(2)}%</span> : <span className="price-placeholder">—</span>}</td>
      <td className="spark-cell"><Sparkline values={asset.chart} positive={asset.change7d >= 0}/></td>
      {showCap && <><td className="muted-cell">{asset.volume}</td><td className="muted-cell">{asset.cap}</td></>}
      <td><button className="table-trade" onClick={e => { e.stopPropagation(); setSymbol(asset.symbol); go("Trade"); }}>Trade <ArrowUpRight size={14}/></button></td>
    </tr>;
  const tradeForm = (compact = false) => <form className={`trade-form ${compact ? "compact" : ""}`} onSubmit={trade}>
    <div className="segmented full"><button type="button" className={side === "buy" ? "active buy-active" : ""} onClick={() => setSide("buy")}>Buy</button><button type="button" className={side === "sell" ? "active sell-active" : ""} onClick={() => setSide("sell")}>Sell</button></div>
    <label className="input-label">Select asset</label>
    <div className="select-wrap"><AssetIcon asset={currentAsset} size={26}/><select value={symbol} onChange={e => setSymbol(e.target.value)}>{assets.map(a => <option key={a.symbol} value={a.symbol}>{a.name} ({a.symbol})</option>)}</select><ChevronDown size={16}/></div>
    <label className="input-label">Amount in USD</label>
    <div className="amount-input"><span>$</span><input type="number" min="0.01" step="0.01" placeholder="0.00" value={tradeAmount} onChange={e => setTradeAmount(e.target.value)} required/><span>USD</span></div>
    <div className="trade-details"><div><span>Indicative market price</span><strong>{marketPrice(currentAsset.price)}</strong></div><div><span>You'll {side === "buy" ? "receive" : "sell"}</span><strong>≈ {tradeAmount && currentAsset.price > 0 ? fmtQty(Math.floor((Number(tradeAmount) / currentAsset.price) * 1e8) / 1e8) : "0"} {symbol}</strong></div><div><span>Available</span><strong>{side === "buy" ? money(data.user.cashBalance) : `${fmtQty(Number(data.holdings.find(h => h.symbol === symbol)?.quantity ?? 0))} ${symbol}`}</strong></div></div>
    <button className={`primary-btn full-btn ${side === "sell" ? "sell-btn" : ""}`} disabled={loading || !ready || !quoteLive}>{loading ? "Processing..." : !quoteLive ? "Waiting for live prices" : `${side === "buy" ? "Buy" : "Sell"} ${symbol}`} <ArrowRight size={17}/></button>
    <p className={`trade-quote-note ${quoteLive ? "" : "offline"}`}>{quoteLive ? "Final paper-trade price is verified by the server at execution." : "Paper trading pauses until current market quotes are available."}</p>
    <p className="simulation-note"><ShieldCheck size={13}/> Paper trading only. No real funds involved.</p>
  </form>;
  const marketTable = (items: Asset[], full = false) => <div className="table-scroll"><table className="data-table market-table"><thead><tr><th>#</th><th>Asset</th><th>Price</th><th>24h Change</th><th>Last 7 days</th>{full && <><th>Volume (24h)</th><th>Market Cap</th></>}<th></th></tr></thead><tbody>{items.map((a, i) => assetRow(a, i, full))}</tbody></table>{items.length === 0 && <div className="no-results">No assets match your search.</div>}</div>;
  const tradeTable = (limit?: number) => <div className="table-scroll"><table className="data-table"><thead><tr><th>Asset</th><th>Type</th><th>Amount</th><th>Price</th><th>Total</th><th>Date</th><th>Status</th></tr></thead><tbody>{data.trades.slice(0, limit).map(t => { const a = getAsset(t.symbol); return <tr key={t.id}><td><div className="coin-cell">{a && <AssetIcon asset={a} size={32}/>}<div><strong>{a?.name ?? t.symbol}</strong><span>{t.symbol}</span></div></div></td><td><span className={`type-pill ${t.side}`}>{t.side === "buy" ? <ArrowDownLeft size={13}/> : <ArrowUpRight size={13}/>} {t.side === "buy" ? "Buy" : "Sell"}</span></td><td className="table-strong">{fmtQty(Number(t.quantity))} {t.symbol}</td><td>{marketPrice(Number(t.price))}</td><td className="table-strong">{money(Number(t.total))}</td><td className="muted-cell">{new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td><td><span className="status-pill"><span/>Completed</span></td></tr>; })}</tbody></table>{data.trades.length === 0 && <EmptyState icon={History} title="No trades yet" text="Your completed trades will appear here."/>}</div>;
  const card = (icon: typeof Wallet, label: string, value: string, foot: React.ReactNode, tone = "blue") => { const Icon = icon; return <div className="stat-card"><div className="stat-top"><span className={`stat-icon ${tone}`}><Icon size={19}/></span><MoreHorizontal size={20} className="dots-icon"/></div><span className="stat-label">{label}</span><strong className="stat-value">{hideBalance ? "••••••" : value}</strong><div className="stat-foot">{foot}</div></div>; };

  return <div className="app-shell">
    {mobileMenu && <div className="mobile-overlay" onClick={() => setMobileMenu(false)}/>}
    <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}><div className="brand" onClick={() => go("Overview")}><div className="brand-icon"><Activity size={23} strokeWidth={3}/></div><span>Nexa<span>Trade</span></span><button className="mobile-close" onClick={(e) => { e.stopPropagation(); setMobileMenu(false); }}><X size={19}/></button></div><div className="sidebar-body">{navGroups.map(group => <div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(item => { const Icon = item.icon; return <button key={item.name} className={`nav-item ${page === item.name ? "selected" : ""}`} onClick={() => go(item.name)}><Icon size={19} strokeWidth={page === item.name ? 2.25 : 1.8}/><span>{item.name}</span>{item.name === "Trading Signals" && <span className="nav-new">NEW</span>}</button>; })}</div>)}</div><div className="sidebar-bottom"><div className="help-card"><span className="help-bubble"><CircleHelp size={18}/></span><strong>Need a hand?</strong><p>Explore the platform with your free demo account.</p><button onClick={() => { go("Trading Signals"); }}>Explore signals <ArrowRight size={14}/></button></div><div className="sidebar-footer"><ShieldCheck size={15}/> Secure paper trading platform</div></div></aside>
    <div className="main-shell"><header className="topbar"><div className="topbar-left"><button className="icon-btn menu-btn" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={22}/></button><div className="breadcrumb">Workspace <ChevronRight size={15}/> <strong>{page}</strong></div></div><div className="topbar-right"><div className={`market-status ${market.status}`} title={market.updatedAt ? `CoinGecko quote updated ${new Date(market.updatedAt).toLocaleString()}` : "CoinGecko market data"} aria-live="polite"><i/><span className="market-status-label">{market.status === "live" ? `Live · ${asOf}` : market.status === "loading" ? "Loading markets" : market.status === "stale" ? "Stale quotes" : "Prices offline"}</span><button className="market-refresh" title="Refresh prices and chart" aria-label="Refresh prices and chart" onClick={() => { void refreshMarket(); setChartRefresh(n => n + 1); }}><RefreshCw size={13} className={marketRefreshing ? "spin" : ""}/></button></div><div className="top-search"><Search size={18}/><input placeholder="Search markets..." value={search} onChange={e => { setSearch(e.target.value); if (e.target.value) setPage("Markets"); }} onFocus={() => {}}/><span>⌘ K</span></div><span className="topbar-divider"/><div className="notification-wrap"><button className="icon-btn notif-btn" aria-label="Notifications" onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false); }}><Bell size={20}/><i/></button>{notificationsOpen && <div className="popover notification-popover"><div className="popover-title">Notifications <span>2 new</span></div><div className="notification-item"><span className="notification-icon"><TrendingUp size={16}/></span><div><strong>Market is moving</strong><p>{getAsset("BTC")!.price > 0 ? `Bitcoin is ${getAsset("BTC")!.change >= 0 ? "up" : "down"} ${Math.abs(getAsset("BTC")!.change).toFixed(2)}% in the last 24 hours.` : "Live Bitcoin quotes are loading."}</p><small>Just now</small></div></div><div className="notification-item"><span className="notification-icon purple"><Sparkles size={16}/></span><div><strong>Welcome to NexaTrade</strong><p>Explore markets and make your first paper trade.</p><small>Today</small></div></div></div>}</div><div className="profile-wrap"><button className="profile-button" onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false); }}><span className="avatar">{data.user.name.split(" ").map(n => n[0]).slice(0, 2).join("")}</span><span className="profile-meta"><strong>{data.user.name}</strong><small>{data.user.isDemo ? "Demo account" : (data.plan ? data.plan + " member" : "No active plan")}</small></span><ChevronDown size={16}/></button>{profileOpen && <div className="popover profile-popover"><div className="profile-pop-head"><strong>{data.user.name}</strong><span>{data.user.email ?? "Exploring in demo mode"}</span></div>{data.user.role === "admin" && <a href="/admin" className="admin-link-btn"><ShieldCheck size={17}/> Admin panel</a>}{data.user.isDemo ? <><button onClick={() => { setAuthMode("register"); setProfileOpen(false); }}><UserRound size={17}/> Create an account</button><button onClick={() => { setAuthMode("login"); setProfileOpen(false); }}><LockKeyhole size={17}/> Sign in</button></> : <button onClick={logout}><LogOut size={17}/> Log out</button>}</div>}</div></div></header>
    <main className="content">
      {(market.status === "stale" || market.status === "unavailable") && <div className="market-alert" role="status"><Clock3 size={17}/><span><strong>{market.status === "stale" ? "Market data is stale." : "Market prices are temporarily unavailable."}</strong> {market.status === "stale" ? `Showing last known CoinGecko quotes${asOf ? ` from ${asOf}` : ""}.` : "Check the connection or try again shortly."} Paper trading is paused until live prices return.</span><button onClick={() => void refreshMarket()}>Retry</button></div>}
      {page === "Overview" && <>
        <div className="welcome-row"><div><div className="eyebrow">{date.toUpperCase()}</div><h1>Good to see you, {firstName} <span className="wave">✌️</span></h1><p>Here's what's happening with your portfolio today.</p></div><div className="welcome-actions"><span className="demo-badge"><span/> {data.user.isDemo ? "Demo account" : "Paper trading"}</span><button className="outline-btn" onClick={() => go("Deposit")}><Plus size={17}/> Add funds</button></div></div>
        <div className="stats-grid">
          {card(Wallet, "Total balance", money(totalBalance), <span>Cash and invested assets</span>, "blue")}
          {card(Activity, "Portfolio value", money(portfolioValue), <span>{data.holdings.length} assets held</span>, "purple")}
          {card(CreditCard, "Available cash", money(data.user.cashBalance), <span>Ready for paper trades</span>, "orange")}
          {card(TrendingUp, "Unrealized profit / loss", Number.isFinite(pnl) ? `${pnl >= 0 ? "+" : "-"}${money(Math.abs(pnl))}` : "—", <>{hasQuotes && costBasis > 0 && <span className={pnl >= 0 ? "up-tag" : "negative-tag"}>{pnl >= 0 ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>} {pnl >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%</span>}<span>vs. your average buy price</span></>, "green")}
        </div>
        <div className="dashboard-grid">
          <div className="dashboard-main">
            <section className="panel performance-panel">
              <div className="section-head"><div><h2>Portfolio performance</h2><p>Estimated value of your current holdings</p></div><div className="periods">{(["24H", "7D", "30D", "1Y"] as ChartPeriod[]).map(p => <button key={p} className={period === p ? "active" : ""} onClick={() => setPeriod(p)}>{p}</button>)}</div></div>
              <div className="performance-number"><strong>{hideBalance ? "••••••" : money(totalBalance)}</strong>{periodPercent !== null && <span className={periodDelta! >= 0 ? "up-tag" : "negative-tag"}>{periodDelta! >= 0 ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>} {periodPercent >= 0 ? "+" : ""}{periodPercent.toFixed(2)}%</span>}<button aria-label={hideBalance ? "Show balance" : "Hide balance"} className="eye-btn" onClick={() => setHideBalance(!hideBalance)}>{hideBalance ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>
              <div className="performance-sub">{periodDelta === null ? "Based on your current positions" : <><span className={periodDelta >= 0 ? "positive-text" : "negative-text"}>{periodDelta >= 0 ? "+" : "-"}{money(Math.abs(periodDelta))}</span> estimated over {period}</>}</div>
              <MarketChart points={chartPoints} period={period} status={chartStatus} label="Estimated portfolio value"/>
              <div className="overview-chart-caption">Current holdings valued at historical market prices; not actual account history.</div>
            </section>
            <section className="panel market-panel"><SectionHead title="Market overview" subtitle={market.status === "live" ? `Live CoinGecko quotes · Updated ${asOf}` : market.status === "loading" ? "Loading market prices…" : "Last known CoinGecko quotes"} action={<button className="text-link" onClick={() => go("Markets")}>View all markets <ArrowRight size={16}/></button>}/>{marketTable(assets.slice(0, 4))}</section>
          </div>
          <div className="dashboard-right">
            <section className="panel quick-trade-panel"><SectionHead title="Quick trade" subtitle="Paper trade at the current quote"/>{tradeForm(true)}</section>
            <section className="panel allocation-panel"><SectionHead title="Your allocation" subtitle="Portfolio breakdown"/><div className="allocation-content"><div className="donut" style={{ background: allocationBackground }}><div><small>Total value</small><strong>{money(portfolioValue, 0)}</strong></div></div><div className="allocation-legend">{allocations.length && hasQuotes ? allocations.map(item => <div key={item.symbol}><span><i style={{ background: item.color }}/>{item.symbol}</span><strong>{(item.value / portfolioValue * 100).toFixed(1)}%</strong></div>) : <span className="allocation-empty">{hasQuotes ? "No assets held yet" : "Waiting for prices"}</span>}</div></div></section>
          </div>
        </div>
        <section className="panel recent-panel"><SectionHead title="Recent activity" subtitle="Your latest trades and transactions" action={<button className="text-link" onClick={() => go("Trade History")}>View history <ArrowRight size={16}/></button>}/>{tradeTable(3)}</section>
      </>}
      {page === "Portfolio" && <>
        <PageTitle title="My portfolio" description="Your holdings valued against current market prices."><button className="outline-btn" onClick={() => go("Trade")}><Plus size={17}/> New trade</button></PageTitle>
        <div className="stats-grid three">
          {card(Wallet, "Total portfolio", money(totalBalance), <span>Cash + invested assets</span>)}
          {card(TrendingUp, "Invested value", money(portfolioValue), <span>{data.holdings.length} assets held</span>, "purple")}
          {card(CreditCard, "Available to trade", money(data.user.cashBalance), <span>In your paper USD wallet</span>, "green")}
        </div>
        <div className="two-col portfolio-layout">
          <section className="panel"><SectionHead title="Your assets" subtitle={market.status === "live" ? `Valued using CoinGecko quotes · ${asOf}` : "Waiting for current market quotes"}/>
            {data.holdings.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Asset</th><th>Holdings</th><th>Avg. buy price</th><th>Current price</th><th>Value</th><th>Profit / Loss</th></tr></thead><tbody>
              {data.holdings.map(h => { const a = getAsset(h.symbol); if (!a) return null; const gain = hasQuotes ? Number(h.quantity) * (a.price - Number(h.avgPrice)) : NaN; return <tr key={h.id} className="clickable-row" onClick={() => { setSymbol(h.symbol); go("Trade"); }}><td><div className="coin-cell"><AssetIcon asset={a} size={36}/><div><strong>{a.name}</strong><span>{a.symbol}</span></div></div></td><td className="table-strong">{fmtQty(Number(h.quantity))} {h.symbol}</td><td>{marketPrice(Number(h.avgPrice))}</td><td>{marketPrice(a.price)}</td><td className="table-strong">{hasQuotes ? money(Number(h.quantity) * a.price) : "—"}</td><td className={Number.isFinite(gain) ? (gain >= 0 ? "positive-text" : "negative-text") : "muted-cell"}>{Number.isFinite(gain) ? `${gain >= 0 ? "+" : "-"}${money(Math.abs(gain))}` : "—"}</td></tr>; })}
            </tbody></table></div> : <EmptyState icon={Wallet} title="No holdings yet" text="Buy your first asset to start building your portfolio."/>}
          </section>
          <section className="panel portfolio-side"><SectionHead title="Asset allocation" subtitle="How your investments are distributed"/><div className="allocation-content column"><div className="donut large" style={{ background: allocationBackground }}><div><small>Invested</small><strong>{money(portfolioValue, 0)}</strong></div></div><div className="allocation-legend">{allocations.length && hasQuotes ? allocations.map(item => <div key={item.symbol}><span><i style={{ background: item.color }}/>{getAsset(item.symbol)?.name}</span><strong>{(item.value / portfolioValue * 100).toFixed(1)}%</strong></div>) : <span className="allocation-empty">{hasQuotes ? "No assets held yet" : "Waiting for prices"}</span>}</div></div></section>
        </div>
      </>}
      {page === "Trade" && <>
        <PageTitle title="Trade crypto" description="Explore live market prices and place simulated orders."/>
        <div className="trade-layout">
          <section className="panel trade-asset-panel">
            <div className="trade-asset-head"><div className="coin-cell"><AssetIcon asset={currentAsset} size={48}/><div><h2>{currentAsset.name} <span>{symbol}</span></h2><p>Market data by CoinGecko · paper trading</p></div></div><span className={`market-open ${quoteLive ? "" : "offline"}`}><span/>{quoteLive ? "Live quote" : "Trading paused"}</span></div>
            <div className="asset-price"><strong>{marketPrice(currentAsset.price)}</strong>{currentAsset.price > 0 && <span className={currentAsset.change >= 0 ? "positive-text" : "negative-text"}>{currentAsset.change >= 0 ? "+" : ""}{currentAsset.change.toFixed(2)}% today</span>}</div>
            <div className="large-chart"><MarketChart points={chartPoints} period={period} status={chartStatus} label={`${currentAsset.name} price`}/></div>
            <div className="periods chart-periods">{(["24H", "7D", "30D", "1Y"] as ChartPeriod[]).map(p => <button key={p} className={period === p ? "active" : ""} onClick={() => setPeriod(p)}>{p}</button>)}</div>
            <div className="asset-facts"><div><span>24h volume</span><strong>{currentAsset.volume}</strong></div><div><span>Market cap</span><strong>{currentAsset.cap}</strong></div><div><span>24h change</span><strong className={currentAsset.price > 0 ? (currentAsset.change >= 0 ? "positive-text" : "negative-text") : "muted-cell"}>{currentAsset.price > 0 ? `${currentAsset.change >= 0 ? "+" : ""}${currentAsset.change.toFixed(2)}%` : "—"}</strong></div></div>
          </section>
          <section className="panel trade-order-panel"><SectionHead title="Place an order" subtitle="Server-verified paper execution"/>{tradeForm()}</section>
        </div>
      </>}
      {page === "Markets" && <>
        <PageTitle title="Explore markets" description="Discover assets and find your next opportunity using CoinGecko market data."><button className="outline-btn" onClick={() => { setSearch(""); setMarketTab("All assets"); }}><SlidersHorizontal size={17}/> Reset filters</button></PageTitle>
        <div className="market-highlights">{assets.slice(0, 3).map(a => <button className="highlight-card" key={a.symbol} onClick={() => { setSymbol(a.symbol); go("Trade"); }}><div className="highlight-top"><div className="coin-cell"><AssetIcon asset={a} size={37}/><div><strong>{a.name}</strong><span>{a.symbol}</span></div></div><ArrowUpRight size={17}/></div><div className="highlight-bottom"><div><strong>{marketPrice(a.price)}</strong>{a.price > 0 ? <span className={a.change >= 0 ? "positive-text" : "negative-text"}>{a.change >= 0 ? "+" : ""}{a.change.toFixed(2)}% today</span> : <span className="price-placeholder">Waiting for quotes</span>}</div><Sparkline values={a.chart} positive={a.change7d >= 0} width={112} height={44}/></div></button>)}</div>
        <section className="panel"><div className="section-head market-section-head"><div><h2>All cryptocurrencies</h2><p>{market.status === "live" ? `Live prices · updated ${asOf}` : market.status === "loading" ? "Loading prices from CoinGecko…" : "Last known prices · trading paused"}</p></div><div className="market-controls"><div className="market-search"><Search size={17}/><input placeholder="Search assets" value={search} onChange={e => setSearch(e.target.value)}/></div><div className="segmented">{["All assets", "Gainers", "Losers"].map(t => <button key={t} className={marketTab === t ? "active" : ""} onClick={() => setMarketTab(t)}>{t}</button>)}</div></div></div>{marketTable(filteredAssets, true)}<p className="market-data-note"><Activity size={13}/> Aggregated market data by CoinGecko. Prices are indicative; trades remain simulated.</p></section>
      </>}
      {page === "Trading Bot" && <>
        <PageTitle title="Trading bots" description="Subscribe to an admin-managed bot strategy for 7 days, then configure it to trade."><span className="demo-badge"><span/> Simulation mode</span></PageTitle>
        <div className="feature-banner bot-banner"><div className="feature-icon"><Bot size={26}/></div><div><span className="banner-eyebrow">TRADE SMARTER, NOT HARDER</span><h2>Put your strategy on autopilot.</h2><p>Browse admin-curated bot strategies, subscribe for 7 days, then configure any number of instances to trade with.</p></div><div className="banner-art"><Bot size={100} strokeWidth={1}/></div></div>
        <div className="section-title-row"><div><h2>Available bots</h2><p>Each subscription runs for exactly 7 days from the moment you subscribe</p></div><span className="subtle-label">{tradingBots.filter(b=>b.mySubscription).length} active</span></div>
        {!tradingBotsLoaded ? <div className="no-results">Loading bots...</div> : tradingBots.length === 0 ? <EmptyState icon={Bot} title="No bots available yet" text="Check back soon — an admin hasn't added any trading bots yet."/> : <div className="trader-grid">{tradingBots.map(b=>{
          const subscribed = !!b.mySubscription;
          const left = b.mySubscription ? daysLeft(b.mySubscription.expiresAt) : 0;
          const price = Number(b.subscriptionAmount);
          return <div className="panel trader-card" key={b.id}>
            <div className="trader-head"><span className="trader-avatar blue"><Bot size={20}/></span><span className="verified"><CheckCircle2 size={16}/> Admin verified</span></div>
            <h3>{b.name}</h3><p>{b.strategy} strategy</p>
            <p className="bot-desc">{b.description}</p>
            <div className="trader-stats"><div><span>Risk</span><strong>{b.riskLevel}</strong></div><div><span>Min allocation</span><strong>{money(Number(b.minAllocation))}</strong></div><div><span>Active subscribers</span><strong>{b.activeSubscribers}</strong></div></div>
            <div className="trader-return" style={{marginTop:4}}><strong>{price > 0 ? money(price) : "Free"}</strong><span>/ 7 days</span></div>
            {subscribed ? <button className="outline-btn full-btn" onClick={()=>openConfigureBot(b)}><Settings2 size={17}/> Subscribed · {left}d left · {configuringBotId===b.id ? "Close" : "Configure"}</button>
              : <button className="primary-btn full-btn" disabled={loading || !ready || botSubscribingId === b.id} onClick={()=>subscribeToBot(b)}>{botSubscribingId === b.id ? "Subscribing..." : <><Copy size={17}/> Subscribe · {price > 0 ? money(price) : "Free"}</>}</button>}
            {subscribed && configuringBotId===b.id && <div className="bot-configure-form">
              <label className="input-label">Asset to trade</label>
              <div className="select-wrap"><AssetIcon asset={getAsset(newInstanceSymbol)!} size={24}/><select value={newInstanceSymbol} onChange={e=>setNewInstanceSymbol(e.target.value)}>{assets.map(a=><option key={a.symbol} value={a.symbol}>{a.name} ({a.symbol})</option>)}</select><ChevronDown size={16}/></div>
              <label className="input-label">Allocation (min {money(Number(b.minAllocation))})</label>
              <div className="amount-input"><span>$</span><input type="number" min={b.minAllocation} step="0.01" value={newInstanceAmount} onChange={e=>setNewInstanceAmount(e.target.value)}/><span>USD</span></div>
              <label className="input-label">Name (optional)</label>
              <input className="text-input" placeholder={`${b.name} · ${newInstanceSymbol}`} value={newInstanceName} onChange={e=>setNewInstanceName(e.target.value)} maxLength={80}/>
              <button className="primary-btn full-btn" disabled={instanceCreating} onClick={()=>createBotInstance(b)}>{instanceCreating ? "Adding..." : <>Add bot instance <Plus size={16}/></>}</button>
            </div>}
          </div>;
        })}</div>}
        <div className="copy-note"><ShieldCheck size={19}/><span>Bots are configurations only and do not execute live trades. Subscribing charges your demo cash balance for 7 days of access; resubscribe once it lapses to keep running your bots.</span></div>
        <div className="section-title-row"><div><h2>My bots</h2><p>Configured instances across your subscribed bots</p></div></div>
        {botInstances.length === 0 ? <EmptyState icon={Bot} title="No bots configured yet" text="Subscribe to a bot above, then configure an instance to see it here."/> : <div className="panel bot-list">{botInstances.map(bot=><div className="bot-item" key={bot.id}>
          <div className="bot-item-top"><span className="bot-item-icon"><Bot size={22}/></span><span className={`bot-status ${bot.active && bot.subscriptionActive ? "running":"paused"}`}><span/>{bot.active && bot.subscriptionActive ? "Active" : bot.active && !bot.subscriptionActive ? "Needs resubscribe" : "Paused"}</span></div>
          <h3>{bot.name}</h3><p>{bot.botName} · {bot.strategy} strategy · {bot.symbol} · Allocation {money(Number(bot.amount))}</p>
          {!bot.subscriptionActive && <p className="admin-request-note admin-note-flag"><AlertTriangle size={13}/> Subscription expired — resubscribe above to resume this bot.</p>}
          <div className="bot-item-bottom"><span>Created {new Date(bot.createdAt).toLocaleDateString()}</span><div style={{display:"flex",gap:8}}><button className="outline-btn small" disabled={instanceBusyId === bot.id || (!bot.active && !bot.subscriptionActive)} onClick={()=>toggleBotInstance(bot)}>{bot.active ? "Pause":"Resume"}</button><button className="outline-btn small danger-outline" disabled={instanceBusyId === bot.id} onClick={()=>removeBotInstance(bot)}><Trash2 size={13}/></button></div></div>
        </div>)}</div>}
        <div className="section-title-row"><div><h2>My bot subscriptions</h2><p>Your trading bot subscription history</p></div></div>
        {botSubHistory.length === 0 ? <EmptyState icon={History} title="No subscriptions yet" text="Subscribe to a bot above to see your history here."/> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Bot</th><th>Amount</th><th>Started</th><th>Expires</th><th>Status</th></tr></thead><tbody>{botSubHistory.map(s=>{
          const left = daysLeft(s.expiresAt);
          const active = new Date(s.expiresAt).getTime() > Date.now();
          return <tr key={s.id}><td><div className="coin-cell"><div><strong>{s.botName}</strong></div></div></td><td className="table-strong">{money(Number(s.amount))}</td><td className="muted-cell">{new Date(s.startedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</td><td className="muted-cell">{new Date(s.expiresAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</td><td>{active ? <span className="status-pill"><span/>Active · {left}d left</span> : <span className="status-pill expired"><span/>Expired</span>}</td></tr>;
        })}</tbody></table></div>}
      </>}
      {page === "Copy Trading" && <>
        <PageTitle title="Copy trading" description="Subscribe to a trader's strategy for 7 days and track your subscription history."/>
        <div className="feature-banner copy-banner"><div className="feature-icon"><UsersRound size={25}/></div><div><span className="banner-eyebrow">LEARN FROM THE BEST</span><h2>Great minds trade alike.</h2><p>Browse admin-curated traders and subscribe to follow their strategy for a 7-day period.</p></div><div className="banner-art"><UsersRound size={105} strokeWidth={1}/></div></div>
        <div className="section-title-row"><div><h2>Available traders</h2><p>Each subscription runs for exactly 7 days from the moment you subscribe</p></div><span className="subtle-label">{copyTraders.filter(t=>t.mySubscription).length} active</span></div>
        {!copyTradersLoaded ? <div className="no-results">Loading traders...</div> : copyTraders.length === 0 ? <EmptyState icon={UsersRound} title="No traders available yet" text="Check back soon — an admin hasn't added any copy traders yet."/> : <div className="trader-grid">{copyTraders.map(t=>{
          const subscribed = !!t.mySubscription;
          const left = t.mySubscription ? daysLeft(t.mySubscription.expiresAt) : 0;
          const price = Number(t.subscriptionAmount);
          return <div className="panel trader-card" key={t.id}>
            <div className="trader-head"><span className={`trader-avatar ${t.avatarColor}`}>{t.avatarInitials}</span><span className="verified"><CheckCircle2 size={16}/> Admin verified</span></div>
            <h3>{t.name}</h3><p>{t.handle}</p>
            <div className="trader-return"><strong>{Number(t.returnPercent) >= 0 ? "+" : ""}{Number(t.returnPercent).toFixed(2)}%</strong><span>Reported 30-day return</span></div>
            <div className="trader-stats"><div><span>Win rate</span><strong>{Number(t.winRate).toFixed(0)}%</strong></div><div><span>Active subscribers</span><strong>{t.activeSubscribers}</strong></div><div><span>Risk</span><strong>{t.riskLevel}</strong></div></div>
            <div className="trader-focus">Focus: {t.focus}</div>
            <div className="trader-return" style={{marginTop:4}}><strong>{price > 0 ? money(price) : "Free"}</strong><span>/ 7 days</span></div>
            <button className={subscribed ? "outline-btn full-btn" : "primary-btn full-btn"} disabled={loading || !ready || subscribed || subscribingId === t.id} onClick={()=>subscribeToTrader(t)}>
              {subscribed ? <><Check size={17}/> Subscribed · {left}d left</> : subscribingId === t.id ? "Subscribing..." : <><Copy size={17}/> Subscribe · {price > 0 ? money(price) : "Free"}</>}
            </button>
          </div>;
        })}</div>}
        <div className="copy-note"><ShieldCheck size={19}/><span>Subscribing charges your demo cash balance and grants 7 days of access to that trader's strategy. There is no auto-renewal — resubscribe once your access expires.</span></div>
        <div className="section-title-row"><div><h2>My subscriptions</h2><p>Your copy trading subscription history</p></div></div>
        {mySubscriptions.length === 0 ? <EmptyState icon={History} title="No subscriptions yet" text="Subscribe to a trader above to see your history here."/> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Trader</th><th>Amount</th><th>Started</th><th>Expires</th><th>Status</th></tr></thead><tbody>{mySubscriptions.map(s=>{
          const left = daysLeft(s.expiresAt);
          const active = new Date(s.expiresAt).getTime() > Date.now();
          return <tr key={s.id}><td><div className="coin-cell"><div><strong>{s.traderName}</strong><span>{s.traderHandle}</span></div></div></td><td className="table-strong">{money(Number(s.amount))}</td><td className="muted-cell">{new Date(s.startedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</td><td className="muted-cell">{new Date(s.expiresAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</td><td>{active ? <span className="status-pill"><span/>Active · {left}d left</span> : <span className="status-pill expired"><span/>Expired</span>}</td></tr>;
        })}</tbody></table></div>}
      </>}
      {page === "Trading Signals" && <>
        <PageTitle title="Market signals" description="A clearer look at price momentum and today's trading range. Not financial advice."><span className="demo-badge"><span/> {quoteLive ? `Live · ${asOf}` : "Waiting for market data"}</span></PageTitle>
        <div className="signal-summary"><div><span className="signal-summary-icon"><Signal size={24}/></span><span><strong>Market intelligence, simplified.</strong><small>Momentum observations calculated from current CoinGecko prices and 24-hour ranges, not buy or sell recommendations.</small></span></div><button className="outline-btn" onClick={() => go("Markets")}>Explore markets <ArrowRight size={16}/></button></div>
        {signals.length ? <div className="signal-grid">{signals.map(a => {
          const rangePosition = a.high24h !== null && a.low24h !== null && a.high24h > a.low24h ? Math.max(0, Math.min(100, Math.round((a.price - a.low24h) / (a.high24h - a.low24h) * 100))) : null;
          return <div className="panel signal-card" key={a.symbol}>
            <div className="signal-card-top"><div className="coin-cell"><AssetIcon asset={a} size={42}/><div><strong>{a.name}</strong><span>{a.symbol}/USD</span></div></div><span className={`signal-type ${a.change >= 0 ? "buy" : "sell"}`}>{a.change >= 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>} {a.change >= 0 ? "Rising" : "Falling"}</span></div>
            <p>{a.name} has {a.change >= 0 ? "gained" : "declined"} {Math.abs(a.change).toFixed(2)}% over 24 hours and {a.change7d >= 0 ? "gained" : "declined"} {Math.abs(a.change7d).toFixed(2)}% over 7 days.</p>
            <div className="confidence-row"><span>Position in today's price range</span><strong>{rangePosition === null ? "—" : `${rangePosition}%`}</strong></div><div className="confidence-track"><span style={{ width: `${rangePosition ?? 0}%` }}/></div>
            <div className="signal-levels"><div><span>Current quote</span><strong>{marketPrice(a.price)}</strong></div><div><span>24h low</span><strong>{a.low24h === null ? "—" : marketPrice(a.low24h)}</strong></div><div><span>24h high</span><strong>{a.high24h === null ? "—" : marketPrice(a.high24h)}</strong></div></div>
            <div className="signal-bottom"><span><Clock3 size={14}/> Updated {a.updatedAt ? new Date(a.updatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "recently"}</span><button onClick={() => { setSymbol(a.symbol); go("Trade"); }}>View chart <ArrowRight size={15}/></button></div>
          </div>;
        })}</div> : <div className="panel"><EmptyState icon={Signal} title="Market observations unavailable" text="Live market prices have not loaded yet. Try refreshing in a moment."/></div>}
        <p className="disclaimer">CoinGecko provides market data, not trading advice. All trades and account balances on NexaTrade are simulated.</p>
      </>}
      {page === "Plans" && <>
        <PageTitle title="Choose your plan" description="Subscribe weekly to unlock more of the platform. No auto-renewal — resubscribe (or switch) once your week is up."/>
        <div className="plans-intro"><span><Sparkles size={19}/></span> Your current plan is <strong>{data.plan ?? "No active plan"}</strong>{data.planExpiresAt && <> · renews by {new Date(data.planExpiresAt).toLocaleDateString()}</>}. Plan charges are simulated and deducted from your demo balance.</div>
        {!plansLoaded ? <div className="no-results">Loading plans...</div> : plansCatalog.length === 0 ? <EmptyState icon={Sparkles} title="No plans available yet" text="Check back soon — an admin hasn't added any plans yet."/> : <div className="plans-grid">{plansCatalog.map(p=>{
          const isCurrent = !!p.mySubscription?.isCurrent;
          const left = p.mySubscription ? daysLeft(p.mySubscription.expiresAt) : 0;
          const price = Number(p.priceWeekly);
          return <div className={`plan-card panel ${p.isFeatured ? "featured":""}`} key={p.id}>
            {p.isFeatured && <span className="popular-label"><Zap size={13}/> MOST POPULAR</span>}
            <span className="plan-icon">{price === 0 ?<Wallet size={24}/>:p.isFeatured?<Zap size={24}/>:<WandSparkles size={24}/>}</span>
            <h2>{p.name}</h2><p>{p.description}</p>
            <div className="plan-price"><strong>{price > 0 ? money(price) : "Free"}</strong><span>/ week</span></div>
            <button className={isCurrent ? "outline-btn full-btn":"primary-btn full-btn"} disabled={isCurrent || loading || !ready || planSubscribingId === p.id} onClick={()=>subscribeToPlan(p)}>{isCurrent ? <><Check size={17}/> Current plan · {left}d left</>:planSubscribingId===p.id?"Subscribing...":<>Choose {p.name} <ArrowRight size={17}/></>}</button>
            <div className="plan-features"><span>WHAT&apos;S INCLUDED</span>{p.features.map(f=><div key={f}><Check size={16}/>{f}</div>)}</div>
            <p className="subtle-label" style={{marginTop:10}}>{p.activeSubscribers} active subscriber{p.activeSubscribers===1?"":"s"}</p>
          </div>;
        })}</div>}
        <p className="disclaimer">This is a simulation. No real billing occurs and plans do not enable live exchange connectivity.</p>
        <div className="section-title-row"><div><h2>My plan subscriptions</h2><p>Your plan subscription history</p></div></div>
        {planSubHistory.length === 0 ? <EmptyState icon={History} title="No subscriptions yet" text="Choose a plan above to see your history here."/> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Plan</th><th>Amount</th><th>Started</th><th>Expires</th><th>Status</th></tr></thead><tbody>{planSubHistory.map(s=>{
          const left = daysLeft(s.expiresAt);
          const active = new Date(s.expiresAt).getTime() > Date.now();
          return <tr key={s.id}><td><div className="coin-cell"><div><strong>{s.planName}</strong></div></div></td><td className="table-strong">{money(Number(s.amount))}</td><td className="muted-cell">{new Date(s.startedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</td><td className="muted-cell">{new Date(s.expiresAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</td><td>{active ? <span className="status-pill"><span/>Active · {left}d left</span> : <span className="status-pill expired"><span/>Expired</span>}</td></tr>;
        })}</tbody></table></div>}
      </>}
      {page === "Deposit" && <>
        <PageTitle title="Add funds" description="Send a payment from outside NexaTrade using one of the methods below, then submit your receipt for admin review."/>
        <div className="deposit-note-banner"><Hourglass size={17}/><span>Deposits are <strong>not instant</strong>. Send funds to the destination shown, upload proof of payment, and an admin will verify and credit your balance — usually within a few hours.</span></div>
        <div className="deposit-layout">
          <section className="panel deposit-panel">
            <SectionHead title="1. Choose a payment method" subtitle="Pick how you'll send funds"/>
            <div className="deposit-method-grid">
              {DEPOSIT_METHODS.map(m => <button type="button" key={m.id} className={`deposit-method-btn ${depositMethod === m.id ? "chosen" : ""}`} onClick={() => setDepositMethod(m.id)}>
                {m.id === "crypto" ? <Wallet size={18}/> : m.id === "bank_transfer" ? <CreditCard size={18}/> : m.id === "paypal" ? <ArrowLeftRight size={18}/> : m.id === "cashapp" ? <Activity size={18}/> : <Sparkles size={18}/>}
                <span>{m.label}</span>
              </button>)}
            </div>
            <p className="deposit-method-blurb">{DEPOSIT_METHODS.find(m => m.id === depositMethod)?.blurb}</p>
            <SectionHead title="2. Send funds to" subtitle="Admin-provided destination for this method"/>
            {!depositAccountsLoaded ? <div className="deposit-accounts-empty">Loading destination accounts…</div> : methodAccounts.length === 0 ? <div className="deposit-accounts-empty"><AlertTriangle size={16}/> No destination has been configured for this method yet. Please choose another method or check back soon.</div> : <div className="deposit-account-list">
              {methodAccounts.map(acc => <label key={acc.id} className={`deposit-account-card ${depositAccountId === acc.id ? "chosen" : ""}`}>
                <input type="radio" name="depositAccount" checked={depositAccountId === acc.id} onChange={() => setDepositAccountId(acc.id)}/>
                <div><strong>{acc.label}</strong><p>{acc.instructions}</p></div>
              </label>)}
            </div>}
            <form className="deposit-form" onSubmit={submitDeposit}>
              <label className="input-label">3. Amount you sent (USD)</label>
              <div className="amount-input funding-input"><span>$</span><input type="number" min="1" step="0.01" placeholder="0.00" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} required/><span>USD</span></div>
              <label className="input-label">Reference (sender name, tx hash, last 4 digits — optional)</label>
              <input className="text-input" placeholder="e.g. Transaction ID or sender name" value={depositReference} onChange={e => setDepositReference(e.target.value)} maxLength={200}/>
              <label className="input-label">4. Upload your receipt</label>
              <label className="receipt-dropzone">
                <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" onChange={e => handleReceiptFile(e.target.files?.[0] ?? null)} hidden/>
                {receiptFile ? <><FileText size={22}/><strong>{receiptFile.name}</strong><span>{(receiptFile.size / 1024).toFixed(0)} KB · Tap to replace</span></> : <><UploadCloud size={22}/><strong>Click to upload a screenshot, photo, or PDF</strong><span>JPG, PNG, WEBP, HEIC, or PDF · Max {(MAX_RECEIPT_BYTES / (1024 * 1024)).toFixed(0)}MB</span></>}
              </label>
              {receiptError && <p className="receipt-error"><XCircle size={13}/> {receiptError}</p>}
              <label className="input-label">Note for the admin (optional)</label>
              <textarea className="text-input deposit-textarea" placeholder="Anything else the reviewer should know" value={depositNote} onChange={e => setDepositNote(e.target.value)} maxLength={1000} rows={3}/>
              <button className="primary-btn full-btn" disabled={depositSubmitting || !ready}><Paperclip size={16}/>{depositSubmitting ? "Submitting..." : "Submit deposit for review"}</button>
              <p className="simulation-note"><ShieldCheck size={13}/> Your balance only updates after an admin verifies this receipt. No automatic crediting occurs.</p>
            </form>
          </section>
          <section className="panel deposit-history-panel">
            <SectionHead title="Your deposit requests" subtitle={`${myDeposits.length} submitted`}/>
            {myDeposits.length ? <div className="deposit-request-list">{myDeposits.map(r => <div className="deposit-request-item" key={r.id}>
              <div className="deposit-request-top"><strong>{money(Number(r.amount))}</strong><span className={`status-pill ${r.status}`}><span/>{r.status === "pending" ? "Pending review" : r.status === "approved" ? "Approved" : "Rejected"}</span></div>
              <p>{DEPOSIT_METHODS.find(m => m.id === r.method)?.label ?? r.method}{r.destinationLabel ? ` · ${r.destinationLabel}` : ""}</p>
              {r.adminNote && r.status === "rejected" && <p className="deposit-admin-note"><AlertTriangle size={13}/> {r.adminNote}</p>}
              <div className="deposit-request-bottom"><span>{new Date(r.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span><a href={`/api/deposits/${r.id}/receipt`} target="_blank" rel="noreferrer">View receipt</a></div>
            </div>)}</div> : <EmptyState icon={ArrowDownLeft} title="No deposit requests yet" text="Submit your first deposit above and it will show up here while it's reviewed."/>}
          </section>
        </div>
      </>}
      {page === "Withdraw" && <>
        <PageTitle title="Withdraw funds" description="Request a payout to any platform you choose. An admin reviews and sends it before it's final."/>
        <div className="deposit-note-banner"><Hourglass size={17}/><span>The requested amount is <strong>reserved from your available balance</strong> right away. An admin manually sends your payout, then approves the request here — or rejects it and the amount is returned to your balance.</span></div>
        <div className="deposit-layout">
          <section className="panel deposit-panel">
            <SectionHead title="1. Choose a payout method" subtitle="Pick how you'd like to receive funds"/>
            <div className="deposit-method-grid">
              {WITHDRAWAL_METHODS.map(m => <button type="button" key={m.id} className={`deposit-method-btn ${withdrawalMethod === m.id ? "chosen" : ""}`} onClick={() => setWithdrawalMethod(m.id)}>
                {m.id === "crypto" ? <Wallet size={18}/> : m.id === "bank_transfer" ? <CreditCard size={18}/> : m.id === "paypal" ? <ArrowLeftRight size={18}/> : m.id === "cashapp" ? <Activity size={18}/> : m.id === "giftcard" ? <Sparkles size={18}/> : <SlidersHorizontal size={18}/>}
                <span>{m.label}</span>
              </button>)}
            </div>
            <p className="deposit-method-blurb">{WITHDRAWAL_METHODS.find(m => m.id === withdrawalMethod)?.blurb}</p>
            <form className="deposit-form" onSubmit={submitWithdrawal}>
              {withdrawalMethod === "other" && <><label className="input-label">Platform name</label><input className="text-input" placeholder="e.g. Skrill, Payoneer, Zelle..." value={withdrawalMethodLabelInput} onChange={e => setWithdrawalMethodLabelInput(e.target.value)} maxLength={60}/></>}
              <label className="input-label">2. Where should we send it?</label>
              <textarea className="text-input deposit-textarea" placeholder={WITHDRAWAL_METHODS.find(m => m.id === withdrawalMethod)?.placeholder} value={withdrawalDestination} onChange={e => setWithdrawalDestination(e.target.value)} rows={3} maxLength={500} required/>
              <label className="input-label">3. Amount to withdraw (USD)</label>
              <div className="amount-input funding-input"><span>$</span><input type="number" min="1" step="0.01" placeholder="0.00" value={withdrawalAmount} onChange={e => setWithdrawalAmount(e.target.value)} required/><span>USD</span></div>
              <div className="quick-amounts">{[100, 500, 1000, 5000].map(n => <button type="button" key={n} onClick={() => setWithdrawalAmount(String(n))}>${n.toLocaleString()}</button>)}</div>
              <div className="funding-balance"><span>Available wallet balance</span><strong>{money(data.user.cashBalance)}</strong></div>
              <label className="input-label">Note for the admin (optional)</label>
              <textarea className="text-input deposit-textarea" placeholder="Anything else the reviewer should know" value={withdrawalNote} onChange={e => setWithdrawalNote(e.target.value)} maxLength={1000} rows={2}/>
              <button className="primary-btn full-btn" disabled={withdrawalSubmitting || !ready}>{withdrawalSubmitting ? "Submitting..." : "Submit withdrawal for review"}<ArrowRight size={17}/></button>
              <p className="simulation-note"><ShieldCheck size={13}/> No automatic payout is sent. Funds leave only after an admin verifies and approves this request.</p>
            </form>
          </section>
          <section className="panel deposit-history-panel">
            <SectionHead title="Your withdrawal requests" subtitle={`${myWithdrawals.length} submitted`}/>
            {myWithdrawals.length ? <div className="deposit-request-list">{myWithdrawals.map(r => <div className="deposit-request-item" key={r.id}>
              <div className="deposit-request-top"><strong>{money(Number(r.amount))}</strong><span className={`status-pill ${r.status}`}><span/>{r.status === "pending" ? "Pending review" : r.status === "approved" ? "Approved" : "Rejected"}</span></div>
              <p>{WITHDRAWAL_METHODS.find(m => m.id === r.method)?.id === "other" ? (r.methodLabel || "Other") : WITHDRAWAL_METHODS.find(m => m.id === r.method)?.label}{" · "}{r.destination}</p>
              {r.adminNote && r.status === "rejected" && <p className="deposit-admin-note"><AlertTriangle size={13}/> {r.adminNote}</p>}
              <div className="deposit-request-bottom"><span>{new Date(r.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></div>
            </div>)}</div> : <EmptyState icon={ArrowUpRight} title="No withdrawal requests yet" text="Submit your first withdrawal above and it will show up here while it's reviewed."/>}
          </section>
        </div>
      </>}
      {page === "Transactions" && <><PageTitle title="Transactions" description="Keep track of every deposit, withdrawal, and plan charge."><button className="outline-btn" onClick={()=>go("Deposit")}><Plus size={17}/> Add funds</button></PageTitle><div className="stats-grid three">{card(ArrowDownLeft,"Total deposited",money(data.transactions.filter(t=>t.type==="deposit").reduce((s,t)=>s+Number(t.amount),0)),<span>All time</span>, "green")}{card(ArrowUpRight,"Total withdrawn",money(data.transactions.filter(t=>t.type==="withdrawal").reduce((s,t)=>s+Number(t.amount),0)),<span>All time</span>, "orange")}{card(Wallet,"Current cash balance",money(data.user.cashBalance),<span>Available to trade</span>)}</div><section className="panel"><SectionHead title="Transaction history" subtitle="A record of your wallet activity"/>{data.transactions.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Transaction</th><th>Type</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{data.transactions.map(t=><tr key={t.id}><td><div className="transaction-cell"><span className={`transaction-icon ${t.type}`}>{t.type==="deposit"?<ArrowDownLeft size={19}/>:t.type==="withdrawal"?<ArrowUpRight size={19}/>:<Sparkles size={19}/>}</span><strong>{t.description}</strong></div></td><td className="capitalize">{t.type}</td><td className="muted-cell">{new Date(t.createdAt).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"})}</td><td className={`table-strong ${t.type==="deposit"?"positive-text":""}`}>{t.type==="deposit"?"+":"-"}{money(Number(t.amount))}</td><td><span className="status-pill"><span/>Completed</span></td></tr>)}</tbody></table></div>:<EmptyState icon={CreditCard} title="No transactions yet" text="Deposits and withdrawals will show up here."/>}</section></>}
      {page === "Trade History" && <><PageTitle title="Trade history" description="Review every buy and sell order in your paper-trading account."><button className="outline-btn" onClick={()=>go("Trade")}><Plus size={17}/> New trade</button></PageTitle><div className="stats-grid three">{card(ArrowLeftRight,"Total trades",String(data.trades.length),<span>Completed orders</span>)}{card(ArrowDownLeft,"Buy orders",String(data.trades.filter(t=>t.side==="buy").length),<span>Assets purchased</span>,"green")}{card(ArrowUpRight,"Sell orders",String(data.trades.filter(t=>t.side==="sell").length),<span>Assets sold</span>,"orange")}</div><section className="panel"><div className="section-head"><div><h2>All trades</h2><p>Your complete order history</p></div><div className="segmented">{["All","Buy","Sell"].map(t=><button key={t} className={historyTab===t?"active":""} onClick={()=>setHistoryTab(t)}>{t}</button>)}</div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Asset</th><th>Type</th><th>Quantity</th><th>Price</th><th>Total</th><th>Date</th><th>Status</th></tr></thead><tbody>{data.trades.filter(t=>historyTab==="All" || t.side===historyTab.toLowerCase()).map(t=>{const a=getAsset(t.symbol);return <tr key={t.id}><td><div className="coin-cell">{a&&<AssetIcon asset={a} size={34}/>}<div><strong>{a?.name}</strong><span>{t.symbol}</span></div></div></td><td><span className={`type-pill ${t.side}`}>{t.side==="buy"?<ArrowDownLeft size={13}/>:<ArrowUpRight size={13}/>} {t.side}</span></td><td className="table-strong">{fmtQty(Number(t.quantity))} {t.symbol}</td><td>{marketPrice(Number(t.price))}</td><td className="table-strong">{money(Number(t.total))}</td><td className="muted-cell">{new Date(t.createdAt).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric"})}</td><td><span className="status-pill"><span/>Completed</span></td></tr>})}</tbody></table>{data.trades.filter(t=>historyTab==="All" || t.side===historyTab.toLowerCase()).length===0&&<EmptyState icon={History} title="No trades found" text="Your completed orders will appear here."/>}</div></section></>}
      <footer className="main-footer"><span>© 2026 NexaTrade. Built for curious traders.</span><span><ShieldCheck size={14}/> Simulation only · Not financial advice</span></footer>
    </main></div>
    {toast && <div className={`toast ${toast.error ? "error":""}`}><span>{toast.error ? <X size={17}/>:<Check size={17}/>}</span>{toast.text}<button onClick={()=>setToast(null)}><X size={15}/></button></div>}
    {authMode && <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setAuthMode(null);}}><div className="auth-modal"><button className="modal-close" onClick={()=>setAuthMode(null)} aria-label="Close"><X size={20}/></button><div className="modal-brand"><div className="brand-icon"><Activity size={23} strokeWidth={3}/></div>Nexa<span>Trade</span></div><h2>{authMode==="register"?"Create your account":"Welcome back"}</h2><p>{authMode==="register"?"Your trading journey starts here. Get $10,000 in paper funds to explore.":"Sign in to pick up right where you left off."}</p><form onSubmit={authenticate}>{authMode==="register"&&<><label className="input-label">Full name</label><input className="text-input" placeholder="Alex Morgan" value={authName} onChange={e=>setAuthName(e.target.value)} required minLength={2}/></>}<label className="input-label">Email address</label><input className="text-input" type="email" placeholder="you@example.com" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} required/><label className="input-label">Password</label><input className="text-input" type="password" placeholder="At least 8 characters" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} required minLength={authMode==="register"?8:1}/><button className="primary-btn full-btn" disabled={loading}>{loading?"Please wait...":authMode==="register"?"Create account":"Sign in"}<ArrowRight size={17}/></button></form><div className="modal-switch">{authMode==="register"?"Already have an account?":"New to NexaTrade?"} <button onClick={()=>setAuthMode(authMode==="register"?"login":"register")}>{authMode==="register"?"Sign in":"Create account"}</button></div><div className="modal-security"><LockKeyhole size={14}/> Your account is secured with encrypted credentials</div></div></div>}
  </div>;
}
