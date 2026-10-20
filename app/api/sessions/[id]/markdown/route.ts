import { NextResponse } from "next/server";
import { openSessionManager, resolveSessionPath } from "@/lib/session-reader";
import { getRpcSession } from "@/lib/rpc-manager";
import { sessionToMarkdown } from "@/lib/session-markdown";
import type { SessionEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

// fork: GET /api/sessions/:id/markdown?leafId=… — the active branch as Markdown.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const leafId = new URL(req.url).searchParams.get("leafId");
  try {
    const rpc = getRpcSession(id);
    const liveRpc = rpc?.isAlive() ? rpc : undefined;
    const filePath = liveRpc ? null : await resolveSessionPath(id);
    if (!liveRpc && !filePath) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    const sm = liveRpc?.inner.sessionManager ?? openSessionManager(filePath!);
    const markdown = sessionToMarkdown(sm.getEntries() as unknown as SessionEntry[], {
      leafId: leafId ?? sm.getLeafId(),
      title: sm.getSessionName(),
      cwd: sm.getHeader()?.cwd ?? null,
    });
    return new NextResponse(markdown, {
      headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
