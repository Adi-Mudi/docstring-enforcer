import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import extensionFactory from "../docstring-enforcer.ts";

interface MockToolResultEvent {
  toolName: "write" | "edit" | "bash";
  isError: boolean;
  input: { path?: string };
}

function createMockPi() {
  const messages: { content: string; deliverAs: string }[] = [];
  const handlers: Record<string, ((event: unknown, ctx: ExtensionContext) => Promise<unknown> | unknown)[]> = {};

  const pi = {
    on: (event: string, handler: (event: unknown, ctx: ExtensionContext) => Promise<unknown> | unknown) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    },
    sendUserMessage: (content: string, options?: { deliverAs?: string }) => {
      messages.push({ content, deliverAs: options?.deliverAs ?? "nextTurn" });
    },
    _trigger: async (eventName: string, event: unknown, ctx: ExtensionContext) => {
      const eventHandlers = handlers[eventName] ?? [];
      for (const handler of eventHandlers) {
        await handler(event, ctx);
      }
    },
    getMessages: () => messages,
  } as unknown as ExtensionAPI & {
    _trigger: (eventName: string, event: unknown, ctx: ExtensionContext) => Promise<void>;
    getMessages: () => { content: string; deliverAs: string }[];
  };

  return pi;
}

function createMockContext(cwd: string): ExtensionContext {
  return {
    cwd,
    ui: {} as ExtensionContext["ui"],
    mode: "tui",
    hasUI: true,
    sessionManager: {} as ExtensionContext["sessionManager"],
    modelRegistry: {} as ExtensionContext["modelRegistry"],
    model: undefined,
    isIdle: () => true,
    isProjectTrusted: () => true,
    signal: undefined,
    abort: () => {},
    hasPendingMessages: () => false,
    shutdown: () => {},
    getContextUsage: () => undefined,
    compact: () => {},
    getSystemPrompt: () => "",
  } as ExtensionContext;
}

describe("docstring-enforcer integration", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `docstring-enforcer-int-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });
    mkdirSync(join(tempDir, ".pi", "docstring-enforcer"), { recursive: true });
  });

  it("sends JSDoc steer message for missing TypeScript docstrings", async () => {
    const filePath = join(tempDir, "foo.ts");
    writeFileSync(filePath, "function bar() {\n  return 1;\n}\n", "utf-8");

    const pi = createMockPi();
    extensionFactory(pi);

    const ctx = createMockContext(tempDir);
    await pi._trigger("tool_result", {
      toolName: "write",
      isError: false,
      input: { path: filePath },
    } as MockToolResultEvent, ctx);

    const messages = pi.getMessages();
    assert.equal(messages.length, 1);
    assert.ok(messages[0].content.includes("bar"));
    assert.equal(messages[0].deliverAs, "steer");

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("asks for Python style on first .py file", async () => {
    const filePath = join(tempDir, "foo.py");
    writeFileSync(filePath, "def bar():\n    pass\n", "utf-8");

    const pi = createMockPi();
    extensionFactory(pi);

    const ctx = createMockContext(tempDir);
    await pi._trigger("tool_result", {
      toolName: "write",
      isError: false,
      input: { path: filePath },
    } as MockToolResultEvent, ctx);

    const messages = pi.getMessages();
    assert.equal(messages.length, 1);
    assert.ok(messages[0].content.includes("google"));
    assert.ok(messages[0].content.includes("numpy"));

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("ignores non-write/edit tools", async () => {
    const pi = createMockPi();
    extensionFactory(pi);

    const ctx = createMockContext(tempDir);
    await pi._trigger("tool_result", {
      toolName: "bash",
      isError: false,
      input: { path: "foo.ts" },
    } as MockToolResultEvent, ctx);

    assert.equal(pi.getMessages().length, 0);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("ignores ignored file types", async () => {
    const filePath = join(tempDir, "README.md");
    writeFileSync(filePath, "# Hello\n", "utf-8");

    const pi = createMockPi();
    extensionFactory(pi);

    const ctx = createMockContext(tempDir);
    await pi._trigger("tool_result", {
      toolName: "write",
      isError: false,
      input: { path: filePath },
    } as MockToolResultEvent, ctx);

    assert.equal(pi.getMessages().length, 0);
    rmSync(tempDir, { recursive: true, force: true });
  });
});
