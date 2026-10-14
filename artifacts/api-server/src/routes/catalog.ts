import { getAuth } from "@clerk/express";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import {
  categories,
  db,
  discounts,
  orderItems,
  orders,
  products,
  shops,
  storeSettings,
} from "@workspace/db";
import { ApiError, asyncHandler, decimalFromCents, fromCents, toCents } from "../lib/http";

const router = Router();
const methodCodes = ["cod", "bkash", "nagad", "rocket", "upay", "bank", "card"] as const;
const orderInput = z.object({
  customerName: z.string().trim().min(2).max(100),
  phone: z
    .string()
    .trim()
    .min(11)
    .max(16)
    .refine((value) => /^(?:\+?88)?01[3-9]\d{8}$/.test(value.replace(/[\s-]/g, "")), {
      message: "সঠিক বাংলাদেশি মোবাইল নম্বর লিখুন",
    }),
  address: z.string().trim().min(5).max(400),
  deliveryOptionId: z.string().trim().min(1).max(40),
  paymentMethod: z.enum(methodCodes),
  discountCode: z.string().trim().max(40).optional(),
  items: z
    .array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(100) }))
    .min(1)
    .max(50),
});

const discountPreviewInput = z.object({
  code: z.string().trim().min(2).max(40),
  subtotal: z.number().finite().min(0).max(10_000_000),
});

async function getSettings() {
  const [settings] = await db.select().from(storeSettings).where(eq(storeSettings.id, 1)).limit(1);
  if (!settings) throw new ApiError(503, "দোকানের সেটিংস এখনো প্রস্তুত নয়");
  return settings;
}

function productResult(
  row: typeof products.$inferSelect,
  categoryName: string | null,
  categorySlug: string | null,
  shop: typeof shops.$inferSelect | null,
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
    shop: shop
      ? {
          id: shop.id,
          slug: shop.slug,
          name: shop.name,
          description: shop.description,
          deliveryCharge: Number(shop.deliveryCharge),
          minimumOrder: Number(shop.minimumOrder),
          deliveryOptions: shop.deliveryOptions.filter((option) => option.active),
        }
      : null,
  };
}

function activeDiscount(discount: typeof discounts.$inferSelect | undefined, subtotalCents: number) {
  if (!discount || !discount.active) throw new ApiError(400, "ডিসকাউন্ট কোডটি সঠিক নয়");
  const now = Date.now();
  if (discount.startsAt && discount.startsAt.getTime() > now) {
    throw new ApiError(400, "ডিসকাউন্ট কোডটি এখনো চালু হয়নি");
  }
  if (discount.endsAt && discount.endsAt.getTime() < now) {
    throw new ApiError(400, "ডিসকাউন্ট কোডটির মেয়াদ শেষ");
  }
  if (discount.usageLimit !== null && discount.usedCount >= discount.usageLimit) {
    throw new ApiError(400, "ডিসকাউন্ট কোড ব্যবহারের সীমা শেষ");
  }
  const minimum = toCents(discount.minimumOrder);
  if (subtotalCents < minimum) {
    throw new ApiError(400, `এই কোডের জন্য অন্তত ৳${fromCents(minimum)} টাকার পণ্য লাগবে`);
  }
  const amount = Number(discount.amount);
  const amountCents =
    discount.kind === "percent"
      ? Math.round((subtotalCents * Math.min(100, amount)) / 100)
      : toCents(amount);
  return Math.min(subtotalCents, amountCents);
}

router.get(
  "/products",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({ product: products, categoryName: categories.name, categorySlug: categories.slug, shop: shops })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .innerJoin(shops, eq(products.shopId, shops.id))
      .where(
        and(
          eq(products.isVisible, true),
          eq(shops.isActive, true),
          or(isNull(categories.id), eq(categories.isActive, true)),
        ),
      )
      .orderBy(asc(products.id));
    res.json({
      products: rows.map((row) => productResult(row.product, row.categoryName, row.categorySlug, row.shop)),
    });
  }),
);

router.get(
  "/shops",
  asyncHandler(async (_req, res) => {
    const activeShops = await db.select().from(shops).where(eq(shops.isActive, true)).orderBy(asc(shops.name));
    res.json({
      shops: activeShops.map((shop) => ({
        id: shop.id,
        slug: shop.slug,
        name: shop.name,
        description: shop.description,
        deliveryCharge: Number(shop.deliveryCharge),
        minimumOrder: Number(shop.minimumOrder),
        deliveryOptions: shop.deliveryOptions.filter((option) => option.active),
      })),
    });
  }),
);

router.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select()
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.sortOrder), asc(categories.id));
    res.json({ categories: rows });
  }),
);

router.get(
  "/store-settings",
  asyncHandler(async (_req, res) => {
    const settings = await getSettings();
    res.json({
      storeName: settings.storeName,
      deliveryCharge: Number(settings.deliveryCharge),
      minimumOrder: Number(settings.minimumOrder),
      deliveryOptions: settings.deliveryOptions.filter((option) => option.active),
    });
  }),
);

router.get("/payment-methods", (_req, res) => {
  res.json({
    methods: [
      { code: "cod", label: "ক্যাশ অন ডেলিভারি", enabled: true, availabilityNote: "পণ্য হাতে পেয়ে টাকা দিন" },
      { code: "bkash", label: "বিকাশ", enabled: false, availabilityNote: "নিরাপদ গেটওয়ে সংযোগের অপেক্ষায়" },
      { code: "nagad", label: "নগদ", enabled: false, availabilityNote: "নিরাপদ গেটওয়ে সংযোগের অপেক্ষায়" },
      { code: "rocket", label: "রকেট", enabled: false, availabilityNote: "নিরাপদ গেটওয়ে সংযোগের অপেক্ষায়" },
      { code: "upay", label: "উপায়", enabled: false, availabilityNote: "নিরাপদ গেটওয়ে সংযোগের অপেক্ষায়" },
      { code: "bank", label: "ব্যাংক পেমেন্ট", enabled: false, availabilityNote: "নিরাপদ গেটওয়ে সংযোগের অপেক্ষায়" },
      { code: "card", label: "কার্ড", enabled: false, availabilityNote: "নিরাপদ গেটওয়ে সংযোগের অপেক্ষায়" },
    ],
  });
});

router.post(
  "/discounts/preview",
  asyncHandler(async (req, res) => {
    const parsed = discountPreviewInput.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "ডিসকাউন্ট যাচাইয়ের তথ্য সঠিক নয়");
    const [discount] = await db
      .select()
      .from(discounts)
      .where(eq(discounts.code, parsed.data.code.toUpperCase()))
      .limit(1);
    const discountAmount = activeDiscount(discount, toCents(parsed.data.subtotal));
    res.json({ code: discount!.code, discountAmount: fromCents(discountAmount) });
  }),
);

router.get(
  "/my/orders",
  asyncHandler(async (req, res) => {
    const userId = getAuth(req).userId;
    if (!userId) throw new ApiError(401, "অর্ডার দেখতে সাইন ইন করুন");
    const rows = await db
      .select({ order: orders, shopName: shops.name })
      .from(orders)
      .leftJoin(shops, eq(orders.shopId, shops.id))
      .where(eq(orders.customerClerkUserId, userId))
      .orderBy(asc(orders.createdAt));
    const orderIds = rows.map((row) => row.order.id);
    const items = orderIds.length
      ? await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds))
      : [];
    const itemsByOrder = new Map<number, typeof items>();
    for (const item of items) {
      const current = itemsByOrder.get(item.orderId) ?? [];
      current.push(item);
      itemsByOrder.set(item.orderId, current);
    }
    res.json({
      orders: rows.reverse().map(({ order, shopName }) => ({
        id: order.id,
        reference: order.reference,
        shopName: shopName ?? "দোকান",
        total: Number(order.total),
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

router.post(
  "/orders",
  asyncHandler(async (req, res) => {
    const parsed = orderInput.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "অর্ডারের তথ্য সঠিক নয়");
    const input = parsed.data;

    if (input.paymentMethod !== "cod") {
      throw new ApiError(409, "এই অনলাইন পেমেন্ট পদ্ধতি এখনো চালু নয়; ক্যাশ অন ডেলিভারি বেছে নিন");
    }

    const combinedItems = Array.from(
      input.items.reduce((map, item) => {
        map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
        return map;
      }, new Map<number, number>()),
      ([productId, quantity]) => ({ productId, quantity }),
    );
    if (combinedItems.some((item) => item.quantity > 100)) {
      throw new ApiError(400, "একটি পণ্যের সর্বোচ্চ পরিমাণ ১০০");
    }

    const savedOrder = await db.transaction(async (tx) => {
      const productIds = combinedItems.map((item) => item.productId);
      const lockedProducts = await tx
        .select({ product: products, shop: shops })
        .from(products)
        .innerJoin(shops, eq(products.shopId, shops.id))
        .where(inArray(products.id, productIds))
        .for("update");
      if (lockedProducts.length !== productIds.length) {
        throw new ApiError(400, "কার্টে থাকা কোনো পণ্য আর পাওয়া যাচ্ছে না");
      }

      const shop = lockedProducts[0]?.shop;
      if (!shop || !shop.isActive || lockedProducts.some((row) => row.product.shopId !== shop.id)) {
        throw new ApiError(400, "একটি অর্ডারে একই দোকানের পণ্য থাকতে হবে");
      }
      const delivery = shop.deliveryOptions.find(
        (option) => option.id === input.deliveryOptionId && option.active,
      );
      if (!delivery) throw new ApiError(400, "ডেলিভারি এলাকা বেছে নিন");
      const productMap = new Map(lockedProducts.map((row) => [row.product.id, row.product]));
      let subtotalCents = 0;
      for (const item of combinedItems) {
        const product = productMap.get(item.productId);
        if (!product || !product.isVisible) throw new ApiError(400, "কার্টে থাকা কোনো পণ্য আর পাওয়া যাচ্ছে না");
        if (product.stock < item.quantity) {
          throw new ApiError(409, `${product.name} পর্যাপ্ত স্টকে নেই`);
        }
        subtotalCents += toCents(product.price) * item.quantity;
      }
      if (subtotalCents < toCents(shop.minimumOrder)) {
        throw new ApiError(400, `সর্বনিম্ন অর্ডার ৳${Number(shop.minimumOrder)} হতে হবে`);
      }

      let discount: typeof discounts.$inferSelect | undefined;
      let discountCents = 0;
      const discountCode = input.discountCode?.trim().toUpperCase();
      if (discountCode) {
        const rows = await tx
          .select()
          .from(discounts)
          .where(eq(discounts.code, discountCode))
          .for("update");
        discount = rows[0];
        discountCents = activeDiscount(discount, subtotalCents);
      }

      const deliveryCents = toCents(delivery.fee ?? Number(shop.deliveryCharge));
      const reference = `HM-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
      const totalCents = subtotalCents + deliveryCents - discountCents;
      const [order] = await tx
        .insert(orders)
        .values({
          reference,
          shopId: shop.id,
          customerClerkUserId: getAuth(req).userId ?? null,
          customerName: input.customerName,
          phone: input.phone.replace(/[\s-]/g, ""),
          address: input.address,
          deliveryOption: delivery.label,
          deliveryFee: decimalFromCents(deliveryCents),
          subtotal: decimalFromCents(subtotalCents),
          discountAmount: decimalFromCents(discountCents),
          total: decimalFromCents(totalCents),
          discountCode: discount?.code ?? null,
          discountId: discount?.id ?? null,
          paymentMethod: "cod",
          paymentStatus: "pending",
          status: "pending",
        })
        .returning();

      for (const item of combinedItems) {
        const product = productMap.get(item.productId)!;
        const lineTotalCents = toCents(product.price) * item.quantity;
        await tx
          .update(products)
          .set({ stock: product.stock - item.quantity, updatedAt: new Date() })
          .where(eq(products.id, product.id));
        await tx.insert(orderItems).values({
          orderId: order.id,
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          unitPrice: product.price,
          quantity: item.quantity,
          lineTotal: decimalFromCents(lineTotalCents),
        });
      }
      if (discount) {
        await tx
          .update(discounts)
          .set({ usedCount: discount.usedCount + 1 })
          .where(eq(discounts.id, discount.id));
      }
      return { order, shopName: shop.name };
    });

    res.status(201).json({
      reference: savedOrder.order.reference,
      shopName: savedOrder.shopName,
      subtotal: Number(savedOrder.order.subtotal),
      deliveryFee: Number(savedOrder.order.deliveryFee),
      discountAmount: Number(savedOrder.order.discountAmount),
      total: Number(savedOrder.order.total),
      paymentMethod: "cod",
      paymentStatus: "pending",
      orderStatus: "pending",
    });
  }),
);

export default router;
