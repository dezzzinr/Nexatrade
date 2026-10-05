import { pgTable, uuid, text, timestamp, numeric, boolean, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  cashBalance: numeric("cash_balance", {
    precision: 18,
    scale: 2,
  }).notNull().default("0"),
  isDemo: boolean("is_demo").notNull().default(false),

  role: text("role").notNull().default("user"),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  }).notNull().defaultNow(),
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

export const bots = pgTable("bots", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  strategy: text("strategy").notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const copiedTraders = pgTable("copied_traders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  traderKey: text("trader_key").notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("copied_user_trader_idx").on(table.userId, table.traderKey)]);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  plan: text("plan").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
