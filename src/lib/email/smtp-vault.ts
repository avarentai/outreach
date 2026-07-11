import { randomUUID } from "node:crypto";

export interface SmtpSessionConfig {
  email: string;
  password: string;
  fromName: string;
  host: string;
  port: number;
  secure: boolean;
  configuredAt: string;
}

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

type VaultEntry = SmtpSessionConfig & { expiresAt: number };

declare global {
  var __avarentSmtpVault: Map<string, VaultEntry> | undefined;
}

const vault = globalThis.__avarentSmtpVault ?? new Map<string, VaultEntry>();
globalThis.__avarentSmtpVault = vault;

export const SMTP_SESSION_COOKIE = "avarent_smtp_session";

export function createSmtpSession(config: SmtpSessionConfig) {
  pruneExpiredSessions();
  const id = randomUUID();
  vault.set(id, { ...config, expiresAt: Date.now() + SESSION_TTL_MS });
  return id;
}

export function getSmtpSession(id: string | undefined) {
  if (!id) return null;
  const entry = vault.get(id);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    vault.delete(id);
    return null;
  }
  entry.expiresAt = Date.now() + SESSION_TTL_MS;
  return entry;
}

export function getServerSmtpConfig(): SmtpSessionConfig | null {
  const host = process.env.SMTP_HOST;
  const email = process.env.SMTP_USER;
  const password = process.env.SMTP_PASS;
  if (!host || !email || !password) return null;
  const port = Number(process.env.SMTP_PORT ?? 465);
  return {
    host,
    email,
    password,
    port,
    secure: port === 465,
    fromName: process.env.SMTP_FROM_NAME ?? email,
    configuredAt: "server",
  };
}

export function deleteSmtpSession(id: string | undefined) {
  if (id) vault.delete(id);
}

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [id, entry] of vault) {
    if (entry.expiresAt <= now) vault.delete(id);
  }
}
