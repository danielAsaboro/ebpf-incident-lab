import { headers } from "next/headers";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const runnerUrl = process.env.INCIDENT_RUNNER_URL;
  const token = process.env.INCIDENT_RUNNER_TOKEN;
  if (!runnerUrl || !token) return Response.json({ error:"runner_unconfigured", message:"The hosted runner is not configured. The documented local labs remain available." }, { status:503 });
  const { path } = await context.params;
  const incoming = await headers();
  const target = `${runnerUrl.replace(/\/$/, "")}/${path.join("/")}`;
  const outbound = new Headers({ "x-incident-runner-token": token, "x-incident-client": incoming.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown" });
  const accessId = process.env.CF_ACCESS_CLIENT_ID;
  const accessSecret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (accessId && accessSecret) { outbound.set("CF-Access-Client-Id", accessId); outbound.set("CF-Access-Client-Secret", accessSecret); }
  const contentType = request.headers.get("content-type"); if (contentType) outbound.set("content-type", contentType);
  try {
    const response = await fetch(target, { method:request.method, headers:outbound, body:request.method === "GET" ? undefined : await request.text(), cache:"no-store", signal:AbortSignal.timeout(20000) });
    const responseHeaders = new Headers();
    responseHeaders.set("content-type", response.headers.get("content-type") ?? "application/json");
    responseHeaders.set("cache-control", "no-store");
    return new Response(response.body, { status:response.status, headers:responseHeaders });
  } catch {
    return Response.json({ error:"runner_unavailable", message:"The dedicated Linux runner is unavailable. No successful run is claimed." }, { status:502 });
  }
}

export const GET = proxy;
export const POST = proxy;
