import {
  boolean,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const discounts = pgTable(
  "discounts",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    kind: text("kind").notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    minimumOrder: numeric("minimum_order", { precision: 10, scale: 2 }).notNull().default("0"),
    active: boolean("active").notNull().default(true),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    usageLimit: integer("usage_limit"),
    usedCount: integer("used_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("discounts_code_unique").on(table.code)],
);

export type Discount = typeof discounts.$inferSelect;
