import { getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import type { RequestHandler } from "express";
import { adminUsers } from "@workspace/db";
import { db } from "@workspace/db";
import { ApiError } from "../lib/http";

export const getAllowedAdminEmails = () =>
  new Set(
    (process.env.HOMNA_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );

export const requireSignedIn: RequestHandler = (req, _res, next) => {
  if (!getAuth(req).userId) {
    next(new ApiError(401, "অনুগ্রহ করে প্রশাসক হিসেবে সাইন ইন করুন"));
    return;
  }
  next();
};

export const requireAdmin: RequestHandler = async (req, _res, next) => {
  try {
    const userId = getAuth(req).userId;
    if (!userId) throw new ApiError(401, "অনুগ্রহ করে প্রশাসক হিসেবে সাইন ইন করুন");

    const [admin] = await db
      .select()
      .from(adminUsers)
      .where(and(eq(adminUsers.clerkUserId, userId), eq(adminUsers.isActive, true)))
      .limit(1);

    if (!admin || !getAllowedAdminEmails().has(admin.email.toLowerCase())) {
      throw new ApiError(403, "এই অ্যাকাউন্টে প্রশাসনিক অনুমতি নেই");
    }
    next();
  } catch (error) {
    next(error);
  }
};
