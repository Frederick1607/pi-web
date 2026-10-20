import { NextResponse } from "next/server";
import { isApprovalMode, readApprovalMode, writeApprovalMode } from "@/lib/approval-mode";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(readApprovalMode());
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (!isApiRequestAllowed(req)) {
    return NextResponse.json({ error: "Untrusted API request" }, { status: 403 });
  }
  if (!hasJsonContentType(req)) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const mode = (body as { mode?: unknown } | null)?.mode;
  if (!isApprovalMode(mode)) {
    return NextResponse.json({ error: "mode must be auto, ask, or yolo" }, { status: 400 });
  }
  try {
    writeApprovalMode(mode);
    return NextResponse.json(readApprovalMode());
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
