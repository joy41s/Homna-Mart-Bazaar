import { clerkClient, getAuth } from "@clerk/express";
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql, sum } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import {
  adminUsers,
  categories,
  db,
  discounts,
  orderItems,
  orders,
  products,
  storeSettings,
  type DeliveryOption,
} from "@workspace/db";
import { ApiError, asyncHandler, decimalFromCents, fromCents, toCents } from "../lib/http";
import { getAllowedAdminEmails, requireAdmin, requireSignedIn } from "../middlewares/requireAdmin";

const router = Router();
const slugSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(100);
const imageUrlSchema = z
  .string()
  .trim()
  .max(1000)
  .nullable()
  .refine(
    (value) =>
      value === null ||
      value.startsWith("/api/assets/") ||
      (() => {
        try {
          return new URL(value).protocol === "https:";
        } catch {
          return false;
        }
      })(),
    "ছবির লিংক HTTPS হতে হবে",
  );
const productFields = {
  slug: slugSchema,
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000),
  unit: z.string().trim().min(1).max(40),
  price: z.number().finite().min(0).max(10_000_000),
  stock: z.number().int().min(0).max(1_000_000),
  categoryId: z.number().int().positive().nullable(),
  imageUrl: imageUrlSchema,
  isVisible: z.boolean(),
};
const productInput = z.object(productFields).strict();
const productPatch = productInput.partial().strict().refine((value) => Object.keys(value).length > 0);
const categoryInput = z.object({
  slug: slugSchema.max(80),
  name: z.string().trim().min(2).max(80),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(10_000),
}).strict();
const categoryPatch = categoryInput.partial().strict().refine((value) => Object.keys(value).length > 0);
const orderStatuses = ["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"] as const;
const paymentStatuses = ["pending", "paid", "failed", "refunded"] as const;
const discountFields = {
    code: z.string().trim().min(2).max(40),
    kind: z.enum(["percent", "fixed"]),
    amount: z.number().finite().positive().max(10_000_000),
    minimumOrder: z.number().finite().min(0).max(10_000_000),
    active: z.boolean(),
    startsAt: z.string().datetime({ offset: true }).nullable(),
    endsAt: z.string().datetime({ offset: true }).nullable(),
    usageLimit: z.number().int().positive().nullable(),
};
const discountBaseSchema = z.object(discountFields).strict();
const discountInputSchema = discountBaseSchema.superRefine((value, ctx) => {
  if (value.kind === "percent" && value.amount > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "শতকরা ছাড় ১০০-এর বেশি হতে পারে না", path: ["amount"] });
  }
  if (value.startsAt && value.endsAt && new Date(value.endsAt).getTime() <= new Date(value.startsAt).getTime()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "শেষের সময় শুরুর সময়ের পরে হতে হবে", path: ["endsAt"] });
  }
});
const discountPatchSchema = discountBaseSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0)
  .superRefine((value, ctx) => {
    if (value.kind === "percent" && value.amount !== undefined && value.amount > 100) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "শতকরা ছাড় ১০০-এর বেশি হতে পারে না", path: ["amount"] });
    }
    if (value.startsAt && value.endsAt && new Date(value.endsAt).getTime() <= new Date(value.startsAt).getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "শেষের সময় শুরুর সময়ের পরে হতে হবে", path: ["endsAt"] });
    }
  });
const deliveryOptionSchema = z.object({
  id: z.string().trim().min(1).max(40),
  label: z.string().trim().min(2).max(80),
  fee: z.number().finite().min(0).max(100_000),
  active: z.boolean(),
}).strict();
const settingsPatchSchema = z
  .object({
    storeName: z.string().trim().min(2).max(80),
    deliveryCharge: z.number().finite().min(0).max(100_000),
    minimumOrder: z.number().finite().min(0).max(10_000_000),
    deliveryOptions: z.array(deliveryOptionSchema).max(10),
  })
  .strict()
  .partial()
  .refine((value) => Object.keys(value).length > 0)
  .superRefine((value, ctx) => {
    const options = value.deliveryOptions;
    if (options) {
      const ids = options.map((option) => option.id);
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "ডেলিভারি এলাকার আইডি আলাদা হতে হবে", path: ["deliveryOptions"] });
      }
    }
  });

function productResult(
  row: typeof products.$inferSelect,
  categoryName: string | null,
  categorySlug: string | null,
) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    unit: row.unit,
    price: Number(row.price),
    stock: row.stock,
    categoryId: row.categoryId,
    categoryName,
    categorySlug,
    imageUrl: row.imageUrl,
    isVisible: row.isVisible,
  };
}

function discountResult(row: typeof discounts.$inferSelect) {
  return {
    id: row.id,
    code: row.code,
    kind: row.kind as "percent" | "fixed",
    amount: Number(row.amount),
    minimumOrder: Number(row.minimumOrder),
    active: row.active,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    usageLimit: row.usageLimit,
    usedCount: row.usedCount,
  };
}

async function validateCategory(categoryId: number | null | undefined) {
  if (categoryId === undefined || categoryId === null) return;
  const [category] = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
  if (!category) throw new ApiError(400, "নির্বাচিত ক্যাটাগরি পাওয়া যায়নি");
}

function bangladeshStartOfDay() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "01";
  return new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00+06:00`);
}

function validTransition(current: string, next: string) {
  if (current === next) return true;
  if (current === "delivered" || current === "cancelled") return false;
  return orderStatuses.includes(next as (typeof orderStatuses)[number]);
}

router.get(
  "/admin/me",
  requireSignedIn,
  asyncHandler(async (req, res) => {
    const userId = getAuth(req).userId;
    if (!userId) throw new ApiError(401, "অনুগ্রহ করে প্রশাসক হিসেবে সাইন ইন করুন");
    const allowedEmails = getAllowedAdminEmails();
    if (allowedEmails.size === 0) throw new ApiError(503, "প্রশাসকের অনুমতি এখনো সেট করা হয়নি");

    const clerkUser = await clerkClient.users.getUser(userId);
    const primaryEmail = clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId,
    );
    const email = primaryEmail?.emailAddress.trim().toLowerCase();
    if (!email || primaryEmail?.verification?.status !== "verified" || !allowedEmails.has(email)) {
      throw new ApiError(403, "এই অ্যাকাউন্টে প্রশাসনিক অনুমতি নেই");
    }

    await db
      .insert(adminUsers)
      .values({ clerkUserId: userId, email, isActive: true, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: adminUsers.clerkUserId,
        set: { email, isActive: true, updatedAt: new Date() },
      });
    res.json({ authorized: true, email });
  }),
);

router.use("/admin", requireAdmin);

router.get(
  "/admin/summary",
  asyncHandler(async (_req, res) => {
    const startOfDay = bangladeshStartOfDay();
    const [today] = await db
      .select({ value: count() })
      .from(orders)
      .where(gte(orders.createdAt, startOfDay));
    const [pending] = await db
      .select({ value: count() })
      .from(orders)
      .where(inArray(orders.status, ["pending", "confirmed", "preparing", "out_for_delivery"]));
    const [productCount] = await db.select({ value: count() }).from(products);
    const [lowStock] = await db.select({ value: count() }).from(products).where(lte(products.stock, 5));
    const [allOrders] = await db.select({ value: count() }).from(orders);
    const [sales] = await db
      .select({ value: sum(orders.total) })
      .from(orders)
      .where(and(eq(orders.paymentStatus, "paid"), sql`${orders.status} <> 'cancelled'`));

    res.json({
      todayOrders: Number(today?.value ?? 0),
      pendingOrders: Number(pending?.value ?? 0),
      totalProducts: Number(productCount?.value ?? 0),
      lowStockProducts: Number(lowStock?.value ?? 0),
      paidSales: Number(sales?.value ?? 0),
      totalOrders: Number(allOrders?.value ?? 0),
    });
  }),
);

router.get(
  "/admin/products",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({ product: products, categoryName: categories.name, categorySlug: categories.slug })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .orderBy(asc(products.id));
    res.json({ products: rows.map((row) => productResult(row.product, row.categoryName, row.categorySlug)) });
  }),
);

router.post(
  "/admin/products",
  asyncHandler(async (req, res) => {
    const parsed = productInput.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "পণ্যের তথ্য সঠিক নয়");
    await validateCategory(parsed.data.categoryId);
    const [saved] = await db
      .insert(products)
      .values({
        ...parsed.data,
        price: String(parsed.data.price),
        updatedAt: new Date(),
      })
      .returning();
    const [category] = saved.categoryId
      ? await db.select().from(categories).where(eq(categories.id, saved.categoryId)).limit(1)
      : [];
    res.status(201).json(productResult(saved, category?.name ?? null, category?.slug ?? null));
  }),
);

router.patch(
  "/admin/products/:id",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    const parsed = productPatch.safeParse(req.body);
    if (!id.success || !parsed.success) throw new ApiError(400, "পণ্যের তথ্য সঠিক নয়");
    await validateCategory(parsed.data.categoryId);
    const updates: Partial<typeof products.$inferInsert> = { updatedAt: new Date() };
    if (parsed.data.slug !== undefined) updates.slug = parsed.data.slug;
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.unit !== undefined) updates.unit = parsed.data.unit;
    if (parsed.data.price !== undefined) updates.price = String(parsed.data.price);
    if (parsed.data.stock !== undefined) updates.stock = parsed.data.stock;
    if (parsed.data.categoryId !== undefined) updates.categoryId = parsed.data.categoryId;
    if (parsed.data.imageUrl !== undefined) updates.imageUrl = parsed.data.imageUrl;
    if (parsed.data.isVisible !== undefined) updates.isVisible = parsed.data.isVisible;
    const [saved] = await db.update(products).set(updates).where(eq(products.id, id.data)).returning();
    if (!saved) throw new ApiError(404, "পণ্যটি পাওয়া যায়নি");
    const [category] = saved.categoryId
      ? await db.select().from(categories).where(eq(categories.id, saved.categoryId)).limit(1)
      : [];
    res.json(productResult(saved, category?.name ?? null, category?.slug ?? null));
  }),
);

router.delete(
  "/admin/products/:id",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!id.success) throw new ApiError(400, "পণ্যের আইডি সঠিক নয়");
    const deleted = await db.delete(products).where(eq(products.id, id.data)).returning({ id: products.id });
    if (deleted.length === 0) throw new ApiError(404, "পণ্যটি পাওয়া যায়নি");
    res.status(204).end();
  }),
);

router.get(
  "/admin/categories",
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.id));
    res.json({ categories: rows });
  }),
);

router.post(
  "/admin/categories",
  asyncHandler(async (req, res) => {
    const parsed = categoryInput.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "ক্যাটাগরির তথ্য সঠিক নয়");
    const [saved] = await db.insert(categories).values(parsed.data).returning();
    res.status(201).json(saved);
  }),
);

router.patch(
  "/admin/categories/:id",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    const parsed = categoryPatch.safeParse(req.body);
    if (!id.success || !parsed.success) throw new ApiError(400, "ক্যাটাগরির তথ্য সঠিক নয়");
    const [saved] = await db.update(categories).set(parsed.data).where(eq(categories.id, id.data)).returning();
    if (!saved) throw new ApiError(404, "ক্যাটাগরিটি পাওয়া যায়নি");
    res.json(saved);
  }),
);

router.delete(
  "/admin/categories/:id",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!id.success) throw new ApiError(400, "ক্যাটাগরির আইডি সঠিক নয়");
    const [used] = await db
      .select({ value: count() })
      .from(products)
      .where(eq(products.categoryId, id.data));
    if (Number(used?.value ?? 0) > 0) throw new ApiError(409, "পণ্য যুক্ত আছে; আগে অন্য ক্যাটাগরিতে সরান");
    const deleted = await db.delete(categories).where(eq(categories.id, id.data)).returning({ id: categories.id });
    if (deleted.length === 0) throw new ApiError(404, "ক্যাটাগরিটি পাওয়া যায়নি");
    res.status(204).end();
  }),
);

router.get(
  "/admin/orders",
  asyncHandler(async (req, res) => {
    const querySchema = z.object({
      search: z.string().trim().max(100).optional(),
      status: z.enum(orderStatuses).optional(),
    });
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) throw new ApiError(400, "অর্ডার খোঁজার তথ্য সঠিক নয়");
    const conditions = [];
    if (parsed.data.status) conditions.push(eq(orders.status, parsed.data.status));
    const term = parsed.data.search;
    if (term) {
      const like = `%${term.replace(/[%_]/g, "\\$&")}%`;
      conditions.push(or(ilike(orders.reference, like), ilike(orders.customerName, like), ilike(orders.phone, like))!);
    }
    const resultRows = await db
      .select()
      .from(orders)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(orders.createdAt))
      .limit(100);
    const ids = resultRows.map((order) => order.id);
    const itemRows = ids.length
      ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids))
      : [];
    const itemsByOrder = new Map<number, typeof itemRows>();
    for (const item of itemRows) {
      const current = itemsByOrder.get(item.orderId) ?? [];
      current.push(item);
      itemsByOrder.set(item.orderId, current);
    }
    res.json({
      orders: resultRows.map((order) => ({
        id: order.id,
        reference: order.reference,
        customerName: order.customerName,
        phone: order.phone,
        address: order.address,
        deliveryOption: order.deliveryOption,
        deliveryFee: Number(order.deliveryFee),
        subtotal: Number(order.subtotal),
        discountAmount: Number(order.discountAmount),
        total: Number(order.total),
        discountCode: order.discountCode,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        status: order.status,
        createdAt: order.createdAt.toISOString(),
        items: (itemsByOrder.get(order.id) ?? []).map((item) => ({
          productId: item.productId,
          productName: item.productName,
          unit: item.unit,
          unitPrice: Number(item.unitPrice),
          quantity: item.quantity,
          lineTotal: Number(item.lineTotal),
        })),
      })),
    });
  }),
);

router.patch(
  "/admin/orders/:id",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    const body = z.object({ status: z.enum(orderStatuses) }).strict().safeParse(req.body);
    if (!id.success || !body.success) throw new ApiError(400, "অর্ডারের অবস্থা সঠিক নয়");

    await db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, id.data)).for("update");
      if (!order) throw new ApiError(404, "অর্ডারটি পাওয়া যায়নি");
      if (!validTransition(order.status, body.data.status)) {
        throw new ApiError(409, "এই অর্ডারের অবস্থা আর পরিবর্তন করা যাবে না");
      }
      if (body.data.status === "cancelled" && order.status !== "cancelled") {
        const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
        for (const item of items) {
          if (item.productId !== null) {
            await tx
              .update(products)
              .set({ stock: sql`${products.stock} + ${item.quantity}`, updatedAt: new Date() })
              .where(eq(products.id, item.productId));
          }
        }
      }
      await tx
        .update(orders)
        .set({ status: body.data.status, updatedAt: new Date() })
        .where(eq(orders.id, order.id));
    });

    res.json({ updated: true, id: id.data, status: body.data.status });
  }),
);

router.patch(
  "/admin/orders/:id/cod-payment",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!id.success) throw new ApiError(400, "অর্ডারের আইডি সঠিক নয়");
    const [order] = await db.select().from(orders).where(eq(orders.id, id.data)).limit(1);
    if (!order) throw new ApiError(404, "অর্ডারটি পাওয়া যায়নি");
    if (order.paymentMethod !== "cod" || order.status === "cancelled") {
      throw new ApiError(409, "শুধু বাতিল না হওয়া COD অর্ডারের নগদ পেমেন্ট নিশ্চিত করা যাবে");
    }
    await db
      .update(orders)
      .set({ paymentStatus: "paid", updatedAt: new Date() })
      .where(eq(orders.id, order.id));
    res.json({ paymentStatus: "paid" });
  }),
);

router.get(
  "/admin/settings",
  asyncHandler(async (_req, res) => {
    const [settings] = await db.select().from(storeSettings).where(eq(storeSettings.id, 1)).limit(1);
    if (!settings) throw new ApiError(503, "দোকানের সেটিংস এখনো প্রস্তুত নয়");
    res.json({
      storeName: settings.storeName,
      deliveryCharge: Number(settings.deliveryCharge),
      minimumOrder: Number(settings.minimumOrder),
      deliveryOptions: settings.deliveryOptions,
    });
  }),
);

router.patch(
  "/admin/settings",
  asyncHandler(async (req, res) => {
    const parsed = settingsPatchSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "দোকানের সেটিংস সঠিক নয়");
    const update: Partial<typeof storeSettings.$inferInsert> = { updatedAt: new Date() };
    if (parsed.data.storeName !== undefined) update.storeName = parsed.data.storeName;
    if (parsed.data.deliveryCharge !== undefined) update.deliveryCharge = String(parsed.data.deliveryCharge);
    if (parsed.data.minimumOrder !== undefined) update.minimumOrder = String(parsed.data.minimumOrder);
    if (parsed.data.deliveryOptions !== undefined) {
      update.deliveryOptions = parsed.data.deliveryOptions as DeliveryOption[];
    }
    const [settings] = await db
      .update(storeSettings)
      .set(update)
      .where(eq(storeSettings.id, 1))
      .returning();
    if (!settings) throw new ApiError(503, "দোকানের সেটিংস এখনো প্রস্তুত নয়");
    res.json({
      storeName: settings.storeName,
      deliveryCharge: Number(settings.deliveryCharge),
      minimumOrder: Number(settings.minimumOrder),
      deliveryOptions: settings.deliveryOptions,
    });
  }),
);

router.get(
  "/admin/discounts",
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(discounts).orderBy(desc(discounts.id));
    res.json({ discounts: rows.map(discountResult) });
  }),
);

router.post(
  "/admin/discounts",
  asyncHandler(async (req, res) => {
    const parsed = discountInputSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "ডিসকাউন্টের তথ্য সঠিক নয়");
    const data = parsed.data;
    const [saved] = await db
      .insert(discounts)
      .values({
        ...data,
        code: data.code.toUpperCase(),
        amount: String(data.amount),
        minimumOrder: String(data.minimumOrder),
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
      })
      .returning();
    res.status(201).json(discountResult(saved));
  }),
);

router.patch(
  "/admin/discounts/:id",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    const parsed = discountPatchSchema.safeParse(req.body);
    if (!id.success || !parsed.success) throw new ApiError(400, "ডিসকাউন্টের তথ্য সঠিক নয়");
    const data = parsed.data;
    const current = await db.select().from(discounts).where(eq(discounts.id, id.data)).limit(1);
    if (!current[0]) throw new ApiError(404, "ডিসকাউন্টটি পাওয়া যায়নি");
    const effectiveKind = data.kind ?? current[0].kind;
    if (effectiveKind === "percent" && data.amount !== undefined && data.amount > 100) {
      throw new ApiError(400, "শতকরা ছাড় ১০০-এর বেশি হতে পারে না");
    }
    const effectiveStart = data.startsAt === undefined ? current[0].startsAt : data.startsAt ? new Date(data.startsAt) : null;
    const effectiveEnd = data.endsAt === undefined ? current[0].endsAt : data.endsAt ? new Date(data.endsAt) : null;
    if (effectiveStart && effectiveEnd && effectiveEnd.getTime() <= effectiveStart.getTime()) {
      throw new ApiError(400, "শেষের সময় শুরুর সময়ের পরে হতে হবে");
    }
    const update: Partial<typeof discounts.$inferInsert> = {};
    if (data.code !== undefined) update.code = data.code.toUpperCase();
    if (data.kind !== undefined) update.kind = data.kind;
    if (data.amount !== undefined) update.amount = String(data.amount);
    if (data.minimumOrder !== undefined) update.minimumOrder = String(data.minimumOrder);
    if (data.active !== undefined) update.active = data.active;
    if (data.startsAt !== undefined) update.startsAt = data.startsAt ? new Date(data.startsAt) : null;
    if (data.endsAt !== undefined) update.endsAt = data.endsAt ? new Date(data.endsAt) : null;
    if (data.usageLimit !== undefined) update.usageLimit = data.usageLimit;
    const [saved] = await db.update(discounts).set(update).where(eq(discounts.id, id.data)).returning();
    if (!saved) throw new ApiError(404, "ডিসকাউন্টটি পাওয়া যায়নি");
    res.json(discountResult(saved));
  }),
);

router.delete(
  "/admin/discounts/:id",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!id.success) throw new ApiError(400, "ডিসকাউন্টের আইডি সঠিক নয়");
    const deleted = await db.delete(discounts).where(eq(discounts.id, id.data)).returning({ id: discounts.id });
    if (deleted.length === 0) throw new ApiError(404, "ডিসকাউন্টটি পাওয়া যায়নি");
    res.status(204).end();
  }),
);

export default router;
