import { and, asc, desc, eq, gte, inArray, ilike, lte, or, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { categories, db, orderItems, orders, products, shops } from "@workspace/db";
import { ApiError, asyncHandler } from "../lib/http";
import { listAccessibleMerchantShops, requireMerchantShop } from "../lib/merchant-access";

const router = Router();
const orderStatuses = ["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"] as const;
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
const deliveryOptionSchema = z.object({
  id: z.string().trim().min(1).max(40),
  label: z.string().trim().min(2).max(80),
  fee: z.number().finite().min(0).max(100_000),
  active: z.boolean(),
}).strict();
const shopSettingsPatchSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(500),
    deliveryCharge: z.number().finite().min(0).max(100_000),
    minimumOrder: z.number().finite().min(0).max(10_000_000),
    deliveryOptions: z.array(deliveryOptionSchema).max(10),
  })
  .strict()
  .partial()
  .refine((value) => Object.keys(value).length > 0)
  .superRefine((value, ctx) => {
    if (value.deliveryOptions) {
      const ids = value.deliveryOptions.map((option) => option.id);
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "ডেলিভারি এলাকার আইডি আলাদা হতে হবে", path: ["deliveryOptions"] });
      }
      if (!value.deliveryOptions.some((option) => option.active)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "অন্তত একটি ডেলিভারি এলাকা চালু রাখুন", path: ["deliveryOptions"] });
      }
    }
  });

function parseId(value: unknown, label: string) {
  const parsed = z.coerce.number().int().positive().safeParse(value);
  if (!parsed.success) throw new ApiError(400, `${label} সঠিক নয়`);
  return parsed.data;
}

function publicShop(shop: typeof shops.$inferSelect) {
  return {
    id: shop.id,
    slug: shop.slug,
    name: shop.name,
    description: shop.description,
    deliveryCharge: Number(shop.deliveryCharge),
    minimumOrder: Number(shop.minimumOrder),
    deliveryOptions: shop.deliveryOptions.filter((option) => option.active),
  };
}

function productResult(
  row: typeof products.$inferSelect,
  categoryName: string | null,
  categorySlug: string | null,
  shop: typeof shops.$inferSelect,
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
    shop: publicShop(shop),
  };
}

async function verifyCategory(categoryId: number | null | undefined) {
  if (categoryId === undefined || categoryId === null) return;
  const [category] = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
  if (!category) throw new ApiError(400, "নির্বাচিত ক্যাটাগরি পাওয়া যায়নি");
}

async function formatShopOrder(orderId: number, shopId: number) {
  const [row] = await db
    .select({ order: orders, shopName: shops.name })
    .from(orders)
    .leftJoin(shops, eq(orders.shopId, shops.id))
    .where(and(eq(orders.id, orderId), eq(orders.shopId, shopId)))
    .limit(1);
  if (!row) throw new ApiError(404, "অর্ডারটি পাওয়া যায়নি");
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  return {
    id: row.order.id,
    reference: row.order.reference,
    shopId: row.order.shopId,
    shopName: row.shopName,
    customerName: row.order.customerName,
    phone: row.order.phone,
    address: row.order.address,
    deliveryOption: row.order.deliveryOption,
    deliveryFee: Number(row.order.deliveryFee),
    subtotal: Number(row.order.subtotal),
    discountAmount: Number(row.order.discountAmount),
    total: Number(row.order.total),
    discountCode: row.order.discountCode,
    paymentMethod: row.order.paymentMethod,
    paymentStatus: row.order.paymentStatus,
    status: row.order.status,
    createdAt: row.order.createdAt.toISOString(),
    items: items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      unit: item.unit,
      unitPrice: Number(item.unitPrice),
      quantity: item.quantity,
      lineTotal: Number(item.lineTotal),
    })),
  };
}

router.get(
  "/merchant/shops",
  asyncHandler(async (req, res) => {
    const authorizedShops = await listAccessibleMerchantShops(req);
    res.json({ shops: authorizedShops.map(publicShop) });
  }),
);

router.get(
  "/merchant/shops/:shopId/products",
  asyncHandler(async (req, res) => {
    const shopId = parseId(req.params.shopId, "দোকানের আইডি");
    const { shop } = await requireMerchantShop(req, shopId);
    const rows = await db
      .select({ product: products, categoryName: categories.name, categorySlug: categories.slug })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.shopId, shopId))
      .orderBy(asc(products.name));
    res.json({
      products: rows.map((row) => productResult(row.product, row.categoryName, row.categorySlug, shop)),
    });
  }),
);

router.post(
  "/merchant/shops/:shopId/products",
  asyncHandler(async (req, res) => {
    const shopId = parseId(req.params.shopId, "দোকানের আইডি");
    const { shop } = await requireMerchantShop(req, shopId);
    const parsed = productInput.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "পণ্যের তথ্য সঠিক নয়");
    await verifyCategory(parsed.data.categoryId);
    const [saved] = await db
      .insert(products)
      .values({ ...parsed.data, shopId, price: String(parsed.data.price), updatedAt: new Date() })
      .returning();
    const [category] = saved.categoryId
      ? await db.select().from(categories).where(eq(categories.id, saved.categoryId)).limit(1)
      : [];
    res.status(201).json(productResult(saved, category?.name ?? null, category?.slug ?? null, shop));
  }),
);

router.patch(
  "/merchant/shops/:shopId/products/:id",
  asyncHandler(async (req, res) => {
    const shopId = parseId(req.params.shopId, "দোকানের আইডি");
    const id = parseId(req.params.id, "পণ্যের আইডি");
    const { shop } = await requireMerchantShop(req, shopId);
    const parsed = productPatch.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "পণ্যের তথ্য সঠিক নয়");
    await verifyCategory(parsed.data.categoryId);
    const update: Partial<typeof products.$inferInsert> = { updatedAt: new Date() };
    for (const field of ["slug", "name", "description", "unit", "stock", "categoryId", "imageUrl", "isVisible"] as const) {
      if (parsed.data[field] !== undefined) Object.assign(update, { [field]: parsed.data[field] });
    }
    if (parsed.data.price !== undefined) update.price = String(parsed.data.price);
    const [saved] = await db
      .update(products)
      .set(update)
      .where(and(eq(products.id, id), eq(products.shopId, shopId)))
      .returning();
    if (!saved) throw new ApiError(404, "পণ্যটি পাওয়া যায়নি");
    const [category] = saved.categoryId
      ? await db.select().from(categories).where(eq(categories.id, saved.categoryId)).limit(1)
      : [];
    res.json(productResult(saved, category?.name ?? null, category?.slug ?? null, shop));
  }),
);

router.delete(
  "/merchant/shops/:shopId/products/:id",
  asyncHandler(async (req, res) => {
    const shopId = parseId(req.params.shopId, "দোকানের আইডি");
    const id = parseId(req.params.id, "পণ্যের আইডি");
    await requireMerchantShop(req, shopId);
    const deleted = await db
      .delete(products)
      .where(and(eq(products.id, id), eq(products.shopId, shopId)))
      .returning({ id: products.id });
    if (!deleted.length) throw new ApiError(404, "পণ্যটি পাওয়া যায়নি");
    res.status(204).end();
  }),
);

router.get(
  "/merchant/shops/:shopId/orders",
  asyncHandler(async (req, res) => {
    const shopId = parseId(req.params.shopId, "দোকানের আইডি");
    await requireMerchantShop(req, shopId);
    const query = z.object({
      search: z.string().trim().max(100).optional(),
      status: z.enum(orderStatuses).optional(),
    }).safeParse(req.query);
    if (!query.success) throw new ApiError(400, "অর্ডার খোঁজার তথ্য সঠিক নয়");
    const conditions = [eq(orders.shopId, shopId)];
    if (query.data.status) conditions.push(eq(orders.status, query.data.status));
    if (query.data.search) {
      const like = `%${query.data.search.replace(/[%_]/g, "\\$&")}%`;
      conditions.push(or(ilike(orders.reference, like), ilike(orders.customerName, like), ilike(orders.phone, like))!);
    }
    const rows = await db
      .select({ order: orders, shopName: shops.name })
      .from(orders)
      .leftJoin(shops, eq(orders.shopId, shops.id))
      .where(and(...conditions))
      .orderBy(desc(orders.createdAt))
      .limit(100);
    const ids = rows.map((row) => row.order.id);
    const itemRows = ids.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids)) : [];
    const itemsByOrder = new Map<number, typeof itemRows>();
    for (const item of itemRows) {
      const current = itemsByOrder.get(item.orderId) ?? [];
      current.push(item);
      itemsByOrder.set(item.orderId, current);
    }
    res.json({
      orders: rows.map(({ order, shopName }) => ({
        id: order.id,
        reference: order.reference,
        shopId: order.shopId,
        shopName,
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
  "/merchant/shops/:shopId/orders/:id",
  asyncHandler(async (req, res) => {
    const shopId = parseId(req.params.shopId, "দোকানের আইডি");
    const id = parseId(req.params.id, "অর্ডারের আইডি");
    await requireMerchantShop(req, shopId);
    const parsed = z.object({ status: z.enum(orderStatuses) }).strict().safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "অর্ডারের অবস্থা সঠিক নয়");
    await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.id, id), eq(orders.shopId, shopId)))
        .for("update");
      if (!order) throw new ApiError(404, "অর্ডারটি পাওয়া যায়নি");
      if (order.status === "delivered" || order.status === "cancelled" ||
        (parsed.data.status !== order.status && !orderStatuses.includes(parsed.data.status))) {
        throw new ApiError(409, "এই অর্ডারের অবস্থা আর পরিবর্তন করা যাবে না");
      }
      if (parsed.data.status === "cancelled" && order.status !== "cancelled") {
        const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
        for (const item of items) {
          if (item.productId !== null) {
            await tx
              .update(products)
              .set({ stock: sql`${products.stock} + ${item.quantity}`, updatedAt: new Date() })
              .where(and(eq(products.id, item.productId), eq(products.shopId, shopId)));
          }
        }
      }
      await tx.update(orders).set({ status: parsed.data.status, updatedAt: new Date() }).where(eq(orders.id, order.id));
    });
    res.json(await formatShopOrder(id, shopId));
  }),
);

router.patch(
  "/merchant/shops/:shopId/orders/:id/cod-payment",
  asyncHandler(async (req, res) => {
    const shopId = parseId(req.params.shopId, "দোকানের আইডি");
    const id = parseId(req.params.id, "অর্ডারের আইডি");
    await requireMerchantShop(req, shopId);
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.shopId, shopId)))
      .limit(1);
    if (!order) throw new ApiError(404, "অর্ডারটি পাওয়া যায়নি");
    if (order.paymentMethod !== "cod" || order.status === "cancelled") {
      throw new ApiError(409, "শুধু বাতিল না হওয়া COD অর্ডারের নগদ পেমেন্ট নিশ্চিত করা যাবে");
    }
    await db.update(orders).set({ paymentStatus: "paid", updatedAt: new Date() }).where(eq(orders.id, id));
    res.json({ paymentStatus: "paid" });
  }),
);

router.get(
  "/merchant/shops/:shopId/settings",
  asyncHandler(async (req, res) => {
    const shopId = parseId(req.params.shopId, "দোকানের আইডি");
    const { shop } = await requireMerchantShop(req, shopId);
    res.json({
      id: shop.id,
      slug: shop.slug,
      name: shop.name,
      description: shop.description,
      deliveryCharge: Number(shop.deliveryCharge),
      minimumOrder: Number(shop.minimumOrder),
      deliveryOptions: shop.deliveryOptions,
    });
  }),
);

router.patch(
  "/merchant/shops/:shopId/settings",
  asyncHandler(async (req, res) => {
    const shopId = parseId(req.params.shopId, "দোকানের আইডি");
    await requireMerchantShop(req, shopId);
    const parsed = shopSettingsPatchSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "দোকানের সেটিংস সঠিক নয়");
    const update: Partial<typeof shops.$inferInsert> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) update.name = parsed.data.name;
    if (parsed.data.description !== undefined) update.description = parsed.data.description;
    if (parsed.data.deliveryCharge !== undefined) update.deliveryCharge = String(parsed.data.deliveryCharge);
    if (parsed.data.minimumOrder !== undefined) update.minimumOrder = String(parsed.data.minimumOrder);
    if (parsed.data.deliveryOptions !== undefined) update.deliveryOptions = parsed.data.deliveryOptions;
    const [saved] = await db.update(shops).set(update).where(eq(shops.id, shopId)).returning();
    if (!saved) throw new ApiError(404, "দোকানটি পাওয়া যায়নি");
    res.json({
      id: saved.id,
      slug: saved.slug,
      name: saved.name,
      description: saved.description,
      deliveryCharge: Number(saved.deliveryCharge),
      minimumOrder: Number(saved.minimumOrder),
      deliveryOptions: saved.deliveryOptions,
    });
  }),
);

router.get(
  "/merchant/shops/:shopId/summary",
  asyncHandler(async (req, res) => {
    const shopId = parseId(req.params.shopId, "দোকানের আইডি");
    await requireMerchantShop(req, shopId);
    const [today] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.shopId, shopId), gte(orders.createdAt, new Date(new Date().setHours(0, 0, 0, 0)))));
    const [pending] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.shopId, shopId), inArray(orders.status, ["pending", "confirmed", "preparing", "out_for_delivery"])));
    const [productCount] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.shopId, shopId));
    const [lowStock] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(products)
      .where(and(eq(products.shopId, shopId), lte(products.stock, 5)));
    const [sales] = await db
      .select({ value: sql<number>`coalesce(sum(${orders.total}), 0)::float` })
      .from(orders)
      .where(and(eq(orders.shopId, shopId), eq(orders.paymentStatus, "paid"), sql`${orders.status} <> 'cancelled'`));
    const [totalOrders] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.shopId, shopId));
    res.json({
      todayOrders: Number(today?.value ?? 0),
      pendingOrders: Number(pending?.value ?? 0),
      totalProducts: Number(productCount?.value ?? 0),
      lowStockProducts: Number(lowStock?.value ?? 0),
      paidSales: Number(sales?.value ?? 0),
      totalOrders: Number(totalOrders?.value ?? 0),
    });
  }),
);

export default router;
