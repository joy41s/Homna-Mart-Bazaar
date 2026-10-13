import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const adminUsers = pgTable("admin_users", {
  clerkUserId: text("clerk_user_id").primaryKey(),
  email: text("email").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminUser = typeof adminUsers.$inferSelect;
