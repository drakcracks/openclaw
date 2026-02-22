import { homedir } from "node:os";
import { join } from "node:path";

export type Mem0PluginConfig = {
  apiKey: string;
  baseUrl?: string;
  orgId?: string;
  projectId?: string;
  appId?: string;
  userIdTemplate?: string;
  autoCapture?: boolean;
  autoRecall?: boolean;
  captureMaxMessages?: number;
  captureMaxChars?: number;
  recallLimit?: number;
  recallMinScore?: number;
  telemetryEnabled?: boolean;
  telemetryPath?: string;
};

export type ResolvedMem0PluginConfig = {
  apiKey: string;
  baseUrl: string;
  orgId?: string;
  projectId?: string;
  appId?: string;
  userIdTemplate: string;
  autoCapture: boolean;
  autoRecall: boolean;
  captureMaxMessages: number;
  captureMaxChars: number;
  recallLimit: number;
  recallMinScore: number;
  telemetryEnabled: boolean;
  telemetryPath: string;
};

const DEFAULT_BASE_URL = "https://api.mem0.ai";
const DEFAULT_USER_ID_TEMPLATE = "{agentId}:{sessionKey}";
const DEFAULT_CAPTURE_MAX_MESSAGES = 8;
const DEFAULT_CAPTURE_MAX_CHARS = 1200;
const DEFAULT_RECALL_LIMIT = 4;
const DEFAULT_RECALL_MIN_SCORE = 0.25;
const DEFAULT_TELEMETRY_PATH = join(homedir(), ".openclaw", "memory", "mem0-telemetry.jsonl");

function assertAllowedKeys(value: Record<string, unknown>, allowed: string[], label: string) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length === 0) {
    return;
  }
  throw new Error(`${label} has unknown keys: ${unknown.join(", ")}`);
}

function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, envVar) => {
    const envValue = process.env[envVar];
    if (!envValue) {
      throw new Error(`Environment variable ${envVar} is not set`);
    }
    return envValue;
  });
}

function normalizeBaseUrl(raw?: string): string {
  const value = (raw ?? DEFAULT_BASE_URL).trim();
  if (!value) {
    return DEFAULT_BASE_URL;
  }
  return value.replace(/\/+$/, "");
}

function readPositiveInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  label: string,
): number {
  const raw = typeof value === "number" ? Math.floor(value) : fallback;
  if (raw < min || raw > max) {
    throw new Error(`${label} must be between ${min} and ${max}`);
  }
  return raw;
}

function readScore(value: unknown, fallback: number): number {
  const raw = typeof value === "number" ? value : fallback;
  if (!Number.isFinite(raw) || raw < 0 || raw > 1) {
    throw new Error("recallMinScore must be between 0 and 1");
  }
  return raw;
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return resolveEnvVars(trimmed);
}

export const mem0ConfigSchema = {
  parse(value: unknown): ResolvedMem0PluginConfig {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("memory-mem0 config required");
    }
    const cfg = value as Record<string, unknown>;
    assertAllowedKeys(
      cfg,
      [
        "apiKey",
        "baseUrl",
        "orgId",
        "projectId",
        "appId",
        "userIdTemplate",
        "autoCapture",
        "autoRecall",
        "captureMaxMessages",
        "captureMaxChars",
        "recallLimit",
        "recallMinScore",
        "telemetryEnabled",
        "telemetryPath",
      ],
      "memory-mem0 config",
    );

    if (typeof cfg.apiKey !== "string" || !cfg.apiKey.trim()) {
      throw new Error("apiKey is required");
    }

    const userIdTemplateRaw =
      typeof cfg.userIdTemplate === "string" ? cfg.userIdTemplate.trim() : DEFAULT_USER_ID_TEMPLATE;
    const userIdTemplate = userIdTemplateRaw || DEFAULT_USER_ID_TEMPLATE;

    return {
      apiKey: resolveEnvVars(cfg.apiKey.trim()),
      baseUrl: normalizeBaseUrl(typeof cfg.baseUrl === "string" ? cfg.baseUrl : undefined),
      orgId: readOptionalString(cfg.orgId),
      projectId: readOptionalString(cfg.projectId),
      appId: readOptionalString(cfg.appId),
      userIdTemplate,
      autoCapture: cfg.autoCapture !== false,
      autoRecall: cfg.autoRecall !== false,
      captureMaxMessages: readPositiveInt(
        cfg.captureMaxMessages,
        DEFAULT_CAPTURE_MAX_MESSAGES,
        1,
        30,
        "captureMaxMessages",
      ),
      captureMaxChars: readPositiveInt(
        cfg.captureMaxChars,
        DEFAULT_CAPTURE_MAX_CHARS,
        120,
        12_000,
        "captureMaxChars",
      ),
      recallLimit: readPositiveInt(cfg.recallLimit, DEFAULT_RECALL_LIMIT, 1, 12, "recallLimit"),
      recallMinScore: readScore(cfg.recallMinScore, DEFAULT_RECALL_MIN_SCORE),
      telemetryEnabled: cfg.telemetryEnabled !== false,
      telemetryPath:
        typeof cfg.telemetryPath === "string" && cfg.telemetryPath.trim()
          ? resolveEnvVars(cfg.telemetryPath.trim())
          : DEFAULT_TELEMETRY_PATH,
    };
  },
  uiHints: {
    apiKey: {
      label: "Mem0 API Key",
      sensitive: true,
      placeholder: "m0-...",
      help: "Token for Mem0 API auth (or use ${MEM0_API_KEY})",
    },
    baseUrl: {
      label: "Mem0 Base URL",
      placeholder: DEFAULT_BASE_URL,
      advanced: true,
      help: "Mem0 API base URL",
    },
    orgId: {
      label: "Org ID",
      advanced: true,
      help: "Optional Mem0 organization id",
    },
    projectId: {
      label: "Project ID",
      advanced: true,
      help: "Optional Mem0 project id",
    },
    appId: {
      label: "App ID",
      advanced: true,
      help: "Optional app scope for memory records",
    },
    userIdTemplate: {
      label: "User ID Template",
      advanced: true,
      placeholder: DEFAULT_USER_ID_TEMPLATE,
      help: "Supports {agentId}, {sessionKey}, {sessionId}",
    },
    autoCapture: {
      label: "Auto-Capture",
      help: "Store recent chat turns to Mem0 after each successful run",
    },
    autoRecall: {
      label: "Auto-Recall",
      help: "Inject relevant Mem0 memories into context before each run",
    },
    captureMaxMessages: {
      label: "Capture Max Messages",
      advanced: true,
      placeholder: String(DEFAULT_CAPTURE_MAX_MESSAGES),
    },
    captureMaxChars: {
      label: "Capture Max Chars",
      advanced: true,
      placeholder: String(DEFAULT_CAPTURE_MAX_CHARS),
    },
    recallLimit: {
      label: "Recall Limit",
      advanced: true,
      placeholder: String(DEFAULT_RECALL_LIMIT),
    },
    recallMinScore: {
      label: "Recall Min Score",
      advanced: true,
      placeholder: String(DEFAULT_RECALL_MIN_SCORE),
    },
    telemetryEnabled: {
      label: "Telemetry Enabled",
      help: "Record per-run token telemetry for Mem0 recall analysis",
      advanced: true,
    },
    telemetryPath: {
      label: "Telemetry Path",
      help: "JSONL output path for Mem0 token telemetry reports",
      placeholder: DEFAULT_TELEMETRY_PATH,
      advanced: true,
    },
  },
};
