import { NextRequest, NextResponse } from "next/server";

/**
 * Development-only pass-through for the RushPay widget.
 *
 * RushPay only sends CORS headers to the registered production domains, so a
 * widget running on http://localhost can't call Core directly. In production
 * the widget talks to https://core.rushpay.cash itself (as RushPay requires)
 * and this route does not exist.
 */
const RUSHPAY_API = "https://core.rushpay.cash";

const ALLOWED_PREFIXES = [
  "/api/v1/merchant/payments/widget-context",
  "/api/v1/merchant/payments/initiate-mobile-money",
  "/api/v1/merchant/payments/initiate-card",
  "/api/v1/merchant/payments/submit-momo-otp",
  "/api/v1/merchant/payments/resolve-mobile-name",
  "/api/v1/merchant/payments/validate-giftcard",
  "/api/v1/merchant/payments/process-giftcard",
  "/api/v1/merchant/payments/pay",
  "/api/v1/merchant/payments/charge-status",
];

async function proxyRequest(request: NextRequest, path: string[]) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rushpayPath = `/${path.join("/")}`;
  if (!ALLOWED_PREFIXES.some((p) => rushpayPath.startsWith(p))) {
    return NextResponse.json(
      { success: false, message: "Prohibited endpoint" },
      { status: 403 }
    );
  }

  const headers = new Headers();
  const widgetSession = request.headers.get("x-rushpay-widget-session");
  if (widgetSession) headers.set("X-RushPay-Widget-Session", widgetSession);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  const init: RequestInit = { method: request.method, headers };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  try {
    const query = request.nextUrl.search;
    const response = await fetch(`${RUSHPAY_API}${rushpayPath}${query}`, init);
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json",
      },
    });
  } catch (error) {
    console.error("RushPay dev proxy error:", error);
    return NextResponse.json(
      { success: false, message: "Proxy request failed" },
      { status: 502 }
    );
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  return proxyRequest(request, (await params).path);
}

export async function POST(request: NextRequest, { params }: Ctx) {
  return proxyRequest(request, (await params).path);
}
