import { integer, jsonb, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export type DeliveryOption = {
  id: string;
  label: string;
  fee: number;
  active: boolean;
};

export const storeSettings = pgTable("store_settings", {
  id: integer("id").primaryKey().default(1),
  storeName: text("store_name").notNull().default("Homna Mart"),
  deliveryCharge: numeric("delivery_charge", { precision: 10, scale: 2 }).notNull().default("30"),
  minimumOrder: numeric("minimum_order", { precision: 10, scale: 2 }).notNull().default("0"),
  deliveryOptions: jsonb("delivery_options").$type<DeliveryOption[]>().notNull().default([
    { id: "homna-town", label: "হোমনা সদর", fee: 30, active: true },
    { id: "nearby", label: "আশেপাশের এলাকা", fee: 50, active: true },
  ]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StoreSettingsRow = typeof storeSettings.$inferSelect;
