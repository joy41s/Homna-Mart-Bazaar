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
import { categories } from "./categories";

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    unit: text("unit").notNull(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    stock: integer("stock").notNull().default(0),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    imageUrl: text("image_url"),
    isVisible: boolean("is_visible").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("products_slug_unique").on(table.slug)],
);

export type Product = typeof products.$inferSelect;
