import { pgTable, uuid, text, timestamp, numeric, boolean, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  cashBalance: numeric("cash_balance", { precision: 18, scale: 2 }).notNull().default("12540.50"),
  isDemo: boolean("is_demo").notNull().default(false),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const holdings = pgTable("holdings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  quantity: numeric("quantity", { precision: 24, scale: 8 }).notNull(),
  avgPrice: numeric("avg_price", { precision: 24, scale: 8 }).notNull(),
}, (table) => [uniqueIndex("holdings_user_symbol_idx").on(table.userId, table.symbol)]);

export const trades = pgTable("trades", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  quantity: numeric("quantity", { precision: 24, scale: 8 }).notNull(),
  price: numeric("price", { precision: 24, scale: 8 }).notNull(),
  total: numeric("total", { precision: 18, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Admin-managed trading bot catalog. Admins curate the roster and set the
// price users pay for a 7-day subscription; "active subscribers" is
// computed from botSubscriptions rather than stored here.
export const botProducts = pgTable("bot_products", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  strategy: text("strategy").notNull(), // DCA | Grid | Momentum | Scalping | Rebalancing | Yield
  riskLevel: text("risk_level").notNull().default("Moderate"), // Low | Moderate | High
  minAllocation: numeric("min_allocation", { precision: 18, scale: 2 }).notNull().default("10"),
  subscriptionAmount: numeric("subscription_amount", { precision: 18, scale: 2 }).notNull(), // price for a 7-day subscription
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// A user's paid subscription granting access to configure a bot product for
// a fixed 7-day window. Each renewal is its own row so history is preserved
// even as prices change. "Active" = expiresAt is in the future.
export const botSubscriptions = pgTable("bot_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  botProductId: uuid("bot_product_id").notNull().references(() => botProducts.id),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(), // price paid, snapshot at subscribe time
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// A user-configured running bot instance. Users may create multiple
// instances of the same bot product (e.g. one per asset) while they hold an
// active (non-expired) subscription to that product. Instances persist
// across renewals; turning one back on after a lapsed subscription requires
// resubscribing first.
export const botInstances = pgTable("bot_instances", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  botProductId: uuid("bot_product_id").notNull().references(() => botProducts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Admin-managed copy-trading profiles. Admins curate the roster and set the
// price users pay to subscribe; "active subscribers" is computed from
// copySubscriptions rather than stored here.
export const copyTraders = pgTable("copy_traders", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  handle: text("handle").notNull(), // e.g. "@olivia.trades"
  avatarInitials: text("avatar_initials").notNull(),
  avatarColor: text("avatar_color").notNull().default("blue"), // purple | orange | pink | blue | green | red
  focus: text("focus").notNull(), // e.g. "BTC, ETH"
  riskLevel: text("risk_level").notNull().default("Moderate"), // Low | Moderate | High
  returnPercent: numeric("return_percent", { precision: 6, scale: 2 }).notNull().default("0"), // e.g. 42.80 for "+42.80%"
  winRate: numeric("win_rate", { precision: 5, scale: 2 }).notNull().default("0"), // 0-100
  subscriptionAmount: numeric("subscription_amount", { precision: 18, scale: 2 }).notNull(), // price for a 7-day subscription
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// A user's paid subscription to copy a trader's strategy for a fixed
// 7-day window. Each renewal is its own row so history is preserved even
// as prices change. "Active" = expiresAt is in the future.
export const copySubscriptions = pgTable("copy_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  traderId: uuid("trader_id").notNull().references(() => copyTraders.id),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(), // price paid, snapshot at subscribe time
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// Admin-managed subscription plans. Admins set the weekly price and a list
// of feature bullet points shown to users; "active subscribers" is computed
// from planSubscriptions rather than stored here.
export const plans = pgTable("plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  priceWeekly: numeric("price_weekly", { precision: 18, scale: 2 }).notNull(),
  features: text("features").array().notNull().default([]),
  isFeatured: boolean("is_featured").notNull().default(false),
  sortOrder: numeric("sort_order", { precision: 10, scale: 0 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// A user's paid subscription to a plan for a fixed 7-day (weekly) window.
// Each renewal/switch is its own row so history is preserved even as plan
// prices change. "Current plan" = the most recent row where expiresAt is in
// the future.
export const planSubscriptions = pgTable("plan_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").notNull().references(() => plans.id),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(), // price paid, snapshot at subscribe time
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});


// Admin-managed destination accounts shown to users for a given deposit
// method (e.g. a specific crypto wallet address, bank account, PayPal
// email, Cashapp tag, or gift card instructions). Users send funds to one
// of these outside the app, then submit a deposit request + receipt.
export const depositAccounts = pgTable("deposit_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  method: text("method").notNull(), // crypto | bank_transfer | paypal | cashapp | giftcard
  label: text("label").notNull(), // e.g. "Bitcoin (BTC)" or "Chase Bank - Checking"
  instructions: text("instructions").notNull(), // address / account details / steps shown to the user
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// A user-submitted claim that they sent funds to one of the destination
// accounts above, along with proof of payment. Nothing is credited to the
// user's balance until an admin reviews and approves the request.
export const depositRequests = pgTable("deposit_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  method: text("method").notNull(), // crypto | bank_transfer | paypal | cashapp | giftcard
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  depositAccountId: uuid("deposit_account_id").references(() => depositAccounts.id, { onDelete: "set null" }),
  destinationLabel: text("destination_label"), // snapshot of the account label at submission time
  reference: text("reference"), // sender name / transaction id / last 4 digits, optional
  note: text("note"), // optional note from the user
  receiptData: text("receipt_data").notNull(), // base64 data URL of the uploaded receipt image/PDF
  receiptFilename: text("receipt_filename").notNull(),
  receiptMimeType: text("receipt_mime_type").notNull(),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  adminNote: text("admin_note"), // reason for rejection / note from admin
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A user-submitted request to pay funds OUT to a destination they choose
// (their own crypto wallet, bank account, PayPal, Cash App, gift card, or
// any other platform). The requested amount is held (deducted from
// cashBalance) immediately on submission so it can't be spent or withdrawn
// twice while pending; it is refunded automatically if an admin rejects the
// request, or finalized (ledgered as a withdrawal) if approved.
export const withdrawalRequests = pgTable("withdrawal_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  method: text("method").notNull(), // crypto | bank_transfer | paypal | cashapp | giftcard | other
  methodLabel: text("method_label"), // user-provided platform name when method = "other"
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  destination: text("destination").notNull(), // where the user wants funds sent (address/account/email/tag/etc.)
  note: text("note"), // optional note from the user
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  adminNote: text("admin_note"), // reason for rejection / note from admin
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

