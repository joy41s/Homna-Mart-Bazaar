import { boolean, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { shops } from "./shops";

export const merchantMembers = pgTable(
  "merchant_members",
  {
    id: serial("id").primaryKey(),
    shopId: integer("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    clerkUserId: text("clerk_user_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("merchant_members_shop_email_unique").on(table.shopId, table.email),
    index("merchant_members_clerk_user_idx").on(table.clerkUserId),
  ],
);

export type MerchantMember = typeof merchantMembers.$inferSelect;
