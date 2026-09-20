import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

const RUSHPAY_API = "https://core.rushpay.cash";

const ALLOWED_PREFIXES = [
  "/api/v1/merchant/payments/widget-context",
  "/api/v1/merchant/payments/initiate-mobile-money",
  "/api/v1/merchant/payments/initiate-card",
  "/api/v1/merchant/payments/submit-momo-otp",
  "/api/v1/merchant/payments/validate-giftcard",
  "/api/v1/merchant/payments/process-giftcard",
  "/api/v1/merchant/payments/pay",
  "/api/v1/merchant/payments/charge-status",
];

const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "https://enokayvvip.com";

function getCorsHeaders(origin: string | null) {
  const allowed = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-RushPay-Widget-Session",
    "Access-Control-Max-Age": "86400",
  };
}

async function proxyRequest(request: NextRequest, path: string[]) {
  const rushpayPath = `/${path.join("/")}`;

  if (!ALLOWED_PREFIXES.some((p) => rushpayPath.startsWith(p))) {
    return NextResponse.json(
      { success: false, message: "Prohibited endpoint" },
      { status: 403 }
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = checkRateLimit(`rushpay-proxy:${ip}`, 60, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, message: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  const headers = new Headers();

  const widgetSession = request.headers.get("x-rushpay-widget-session");
  if (widgetSession) {
    headers.set("X-RushPay-Widget-Session", widgetSession);
  }

  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "follow",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  try {
    const response = await fetch(`${RUSHPAY_API}${rushpayPath}`, init);
    const data = await response.text();

    const origin = request.headers.get("origin");
    const resHeaders = new Headers(getCorsHeaders(origin));
    resHeaders.set(
      "Content-Type",
      response.headers.get("content-type") || "application/json"
    );

    return new NextResponse(data, {
      status: response.status,
      headers: resHeaders,
    });
  } catch (error) {
    console.error("RushPay proxy error:", error);
    return NextResponse.json(
      { success: false, message: "Proxy request failed" },
      { status: 502 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}
