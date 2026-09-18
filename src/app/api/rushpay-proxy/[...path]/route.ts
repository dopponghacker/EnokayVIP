import { NextRequest, NextResponse } from "next/server";

const RUSHPAY_API = "https://core.rushpay.cash";

async function proxyRequest(request: NextRequest, path: string[]) {
  const rushpayUrl = `${RUSHPAY_API}/${path.join("/")}`;

  const headers = new Headers();

  const widgetSession = request.headers.get("x-rushpay-widget-session");
  if (widgetSession) {
    headers.set("X-RushPay-Widget-Session", widgetSession);
  }

  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  const accept = request.headers.get("accept");
  if (accept) {
    headers.set("Accept", accept);
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
    const response = await fetch(rushpayUrl, init);
    const data = await response.text();

    const resHeaders = new Headers();
    resHeaders.set("Content-Type", response.headers.get("content-type") || "application/json");
    resHeaders.set("Access-Control-Allow-Origin", "*");
    resHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    resHeaders.set("Access-Control-Allow-Headers", "*");

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

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    },
  });
}
