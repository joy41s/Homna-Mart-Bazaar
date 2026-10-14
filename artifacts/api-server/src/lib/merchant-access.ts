import { clerkClient, getAuth } from "@clerk/express";
import { and, eq, isNull, or } from "drizzle-orm";
import type { Request } from "express";
import { db, merchantMembers, shops } from "@workspace/db";
import { ApiError } from "./http";

export async function getVerifiedPrimaryEmail(userId: string) {
  const user = await clerkClient.users.getUser(userId);
  const primary = user.emailAddresses.find((item) => item.id === user.primaryEmailAddressId);
  const email = primary?.emailAddress.trim().toLowerCase();
  if (!email || primary?.verification?.status !== "verified") {
    throw new ApiError(403, "অনুমোদিত ইমেইলটি যাচাই করুন");
  }
  return email;
}

export async function listAccessibleMerchantShops(req: Request) {
  const userId = getAuth(req).userId;
  if (!userId) throw new ApiError(401, "মার্চেন্ট হিসেবে সাইন ইন করুন");
  const email = await getVerifiedPrimaryEmail(userId);
  const matches = await db
    .select({ member: merchantMembers, shop: shops })
    .from(merchantMembers)
    .innerJoin(shops, eq(merchantMembers.shopId, shops.id))
    .where(
      and(
        eq(merchantMembers.email, email),
        eq(merchantMembers.isActive, true),
        eq(shops.isActive, true),
        or(isNull(merchantMembers.clerkUserId), eq(merchantMembers.clerkUserId, userId)),
      ),
    );
  for (const { member } of matches) {
    if (!member.clerkUserId) {
      await db
        .update(merchantMembers)
        .set({ clerkUserId: userId, updatedAt: new Date() })
        .where(and(eq(merchantMembers.id, member.id), isNull(merchantMembers.clerkUserId)));
    }
  }
  return matches.map(({ shop }) => shop);
}

export async function requireMerchantShop(req: Request, shopId: number) {
  const userId = getAuth(req).userId;
  if (!userId) throw new ApiError(401, "মার্চেন্ট হিসেবে সাইন ইন করুন");
  const email = await getVerifiedPrimaryEmail(userId);
  const matches = await db
    .select({ member: merchantMembers, shop: shops })
    .from(merchantMembers)
    .innerJoin(shops, eq(merchantMembers.shopId, shops.id))
    .where(
      and(
        eq(merchantMembers.shopId, shopId),
        eq(merchantMembers.email, email),
        eq(merchantMembers.isActive, true),
        eq(shops.isActive, true),
        or(isNull(merchantMembers.clerkUserId), eq(merchantMembers.clerkUserId, userId)),
      ),
    )
    .limit(1);
  const match = matches[0];
  if (!match) throw new ApiError(403, "এই দোকানে মার্চেন্ট অনুমতি নেই");
  if (!match.member.clerkUserId) {
    await db
      .update(merchantMembers)
      .set({ clerkUserId: userId, updatedAt: new Date() })
      .where(and(eq(merchantMembers.id, match.member.id), isNull(merchantMembers.clerkUserId)));
  }
  return { userId, email, shop: match.shop };
}
