import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, PAYMENT_TOKEN_COOKIE, sessionCookieOptions, paymentCookieOptions } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    ...sessionCookieOptions,
    maxAge: 0,
  });
  response.cookies.set(PAYMENT_TOKEN_COOKIE, "", {
    ...paymentCookieOptions,
    maxAge: 0,
  });
  return response;
}
