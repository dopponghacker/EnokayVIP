import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const adminCredentials = pgTable("admin_credentials", {
  id: text().primaryKey().default("admin"),
  username: text().notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const vipTips = pgTable("vip_tips", {
  id: text().primaryKey(),
  tier: text().notNull(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  prediction: text().notNull(),
  league: text().notNull(),
  time: text().notNull(),
  date: text().notNull(),
  odds: text(),
  confidence: text().default("Medium").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const publicMatches = pgTable("public_matches", {
  id: text().primaryKey(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  prediction: text().notNull(),
  league: text().notNull(),
  odds: text(),
  date: text().notNull(),
  time: text().notNull(),
  status: text().default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bookingCodes = pgTable(
  "booking_codes",
  {
    id: text().primaryKey(),
    tier: text().notNull(),
    date: text().notNull(),
    code: text().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("booking_codes_tier_date_key").on(table.tier, table.date)],
);
