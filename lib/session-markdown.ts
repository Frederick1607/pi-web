import type { AgentMessage, SessionEntry } from "./types";
import { buildSessionContext } from "./session-reader";

// fork: render a session's active branch as Markdown for sharing.

type Block = { type: string; text?: string; thinking?: string; toolName?: string; input?: unknown };

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return (content as Block[])
    .map((block) => (block.type === "text" ? block.text ?? "" : block.type === "image" ? "_[image]_" : ""))
    .filter(Boolean)
    .join("\n\n");
}

function fence(text: string, lang = ""): string {
  const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
  const ticks = "`".repeat(longest + 1);
  return `${ticks}${lang}\n${text.replace(/\n$/, "")}\n${ticks}`;
}

function summarizeToolInput(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const record = input as Record<string, unknown>;
  for (const key of ["command", "code", "path", "file_path", "pattern", "url", "query"]) {
    if (typeof record[key] === "string") return record[key] as string;
  }
  return JSON.stringify(input);
}

function truncate(text: string, max = 2000): string {
  return text.length > max ? `${text.slice(0, max)}\n… (${text.length - max} more characters)` : text;
}

function messageToMarkdown(message: AgentMessage): string | null {
  switch (message.role) {
    case "user": {
      const body = textOf(message.content).trim();
      return body ? `## 🧑 User\n\n${body}` : null;
    }
    case "assistant": {
      const parts: string[] = [];
      for (const block of message.content as Block[]) {
        if (block.type === "text" && block.text?.trim()) parts.push(block.text.trim());
        else if (block.type === "toolCall") {
          const summary = summarizeToolInput(block.input);
          parts.push(`**🔧 ${block.toolName}**${summary ? `\n\n${fence(truncate(summary), block.toolName === "bash" ? "bash" : block.toolName === "codemode" ? "js" : "")}` : ""}`);
        }
      }
      if (message.errorMessage) parts.push(`> ⚠️ ${message.errorMessage}`);
      if (parts.length === 0) return null;
      const model = message.model ? ` · ${message.model}` : "";
      return `## 🤖 Assistant${model}\n\n${parts.join("\n\n")}`;
    }
    case "toolResult": {
      const body = textOf(message.content).trim();
      if (!body) return null;
      const label = message.isError ? "Tool error" : "Tool result";
      return `<details><summary>${label}${message.toolName ? ` · ${message.toolName}` : ""}</summary>\n\n${fence(truncate(body))}\n\n</details>`;
    }
    case "bashExecution":
      return `## $ ${message.command}\n\n${fence(truncate(message.output ?? ""))}`;
    case "custom": {
      if (!message.display) return null;
      const body = textOf(message.content).trim();
      if (!body) return null;
      return message.customType === "compaction"
        ? `> **Compacted context**\n>\n${body.split("\n").map((line) => `> ${line}`).join("\n")}`
        : body;
    }
    default:
      return null;
  }
}

export function sessionToMarkdown(
  entries: SessionEntry[],
  options: { leafId?: string | null; title?: string | null; cwd?: string | null } = {},
): string {
  const { messages } = buildSessionContext(entries, options.leafId ?? undefined);
  const header = [`# ${options.title?.trim() || "Pi session"}`];
  if (options.cwd) header.push(`\n\n_${options.cwd}_`);
  const body = messages.map(messageToMarkdown).filter((part): part is string => Boolean(part));
  return `${header.join("")}\n\n${body.join("\n\n---\n\n")}\n`;
}
