import { existsSync, readFileSync, renameSync, writeFileSync } from "fs";
import { join } from "path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

// Mirrors ~/.pi/agent/extensions/approval-mode.ts: the mode lives in
// pi-permission-system's global config as `yoloMode` + `authorizerChain`.
export const APPROVAL_MODES = ["auto", "ask", "yolo"] as const;
export type ApprovalMode = (typeof APPROVAL_MODES)[number];

const AUTHORIZER = "pi-auto-review";

export function isApprovalMode(value: unknown): value is ApprovalMode {
  return typeof value === "string" && (APPROVAL_MODES as readonly string[]).includes(value);
}

function configPath(agentDir = getAgentDir()): string {
  return join(agentDir, "extensions", "pi-permission-system", "config.json");
}

function readConfig(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
}

export function readApprovalMode(): { available: boolean; mode: ApprovalMode | null } {
  const path = configPath();
  if (!existsSync(path)) return { available: false, mode: null };
  const config = readConfig(path);
  if (config.yoloMode === true) return { available: true, mode: "yolo" };
  const chain = config.authorizerChain;
  return { available: true, mode: Array.isArray(chain) && chain.includes(AUTHORIZER) ? "auto" : "ask" };
}

export function writeApprovalMode(mode: ApprovalMode): void {
  const path = configPath();
  const config = readConfig(path);
  config.yoloMode = mode === "yolo";
  config.authorizerChain = mode === "auto" ? [AUTHORIZER] : [];
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(config, null, 2)}\n`);
  renameSync(tmp, path);
}
