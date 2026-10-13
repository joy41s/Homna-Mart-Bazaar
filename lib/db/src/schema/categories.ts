import { boolean, integer, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [uniqueIndex("categories_slug_unique").on(table.slug)],
);

export type Category = typeof categories.$inferSelect;
