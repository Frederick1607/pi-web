import { mkdirSync, writeFileSync } from "fs";
import { homedir } from "os";
import { basename, join } from "path";
import { pathToFileURL } from "url";
import { NextResponse } from "next/server";
import { openSessionManager, resolveSessionPath } from "@/lib/session-reader";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";
import { GET as exportHtml } from "../export/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// fork: POST /api/sessions/:id/share { kind: "path" | "html" }
//   path — the session's .jsonl file
//   html — exports the session to ~/Downloads/pi-sessions/ and returns the file path
const EXPORT_DIR = join(homedir(), "Downloads", "pi-sessions");

function exportFileName(filePath: string): string {
  const base = basename(filePath, ".jsonl");
  let name: string | undefined;
  try {
    name = openSessionManager(filePath).getSessionName()?.trim();
  } catch {
    name = undefined;
  }
  const safe = name?.replace(/[\\/:*?"<>|\r\n\t]+/g, "_").replace(/\s+/g, " ").slice(0, 80).trim();
  const shortId = base.split("_").pop()?.slice(0, 8) ?? base;
  return safe ? `${safe} (${shortId}).html` : `pi-session-${base}.html`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isApiRequestAllowed(req)) {
    return NextResponse.json({ error: "Untrusted API request" }, { status: 403 });
  }
  if (!hasJsonContentType(req)) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }
  const { id } = await params;
  const kind = ((await req.json().catch(() => null)) as { kind?: unknown } | null)?.kind;
  if (kind !== "path" && kind !== "html") {
    return NextResponse.json({ error: "kind must be path or html" }, { status: 400 });
  }

  try {
    const filePath = await resolveSessionPath(id);
    if (!filePath) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (kind === "path") return NextResponse.json({ text: filePath });

    const exported = await exportHtml(new Request(new URL(`/api/sessions/${encodeURIComponent(id)}/export`, req.url)), {
      params: Promise.resolve({ id }),
    });
    if (!exported.ok) {
      const detail = await exported.text();
      return NextResponse.json({ error: `Export failed: ${detail}` }, { status: 500 });
    }
    mkdirSync(EXPORT_DIR, { recursive: true });
    const outputPath = join(EXPORT_DIR, exportFileName(filePath));
    writeFileSync(outputPath, await exported.text(), "utf8");
    return NextResponse.json({ text: outputPath, url: pathToFileURL(outputPath).href });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
