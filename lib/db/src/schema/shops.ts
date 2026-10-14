import { boolean, jsonb, numeric, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { DeliveryOption } from "./store-settings";

export const shops = pgTable(
  "shops",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    deliveryCharge: numeric("delivery_charge", { precision: 10, scale: 2 }).notNull().default("30"),
    minimumOrder: numeric("minimum_order", { precision: 10, scale: 2 }).notNull().default("0"),
    deliveryOptions: jsonb("delivery_options").$type<DeliveryOption[]>().notNull().default([
      { id: "homna-town", label: "হোমনা সদর", fee: 30, active: true },
      { id: "nearby", label: "আশেপাশের এলাকা", fee: 50, active: true },
    ]),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("shops_slug_unique").on(table.slug)],
);

export type Shop = typeof shops.$inferSelect;
