/* =========================================================================
 * Email sending layer — provider-agnostic adapter interface.
 * Multiple sending accounts each resolve to an adapter (Resend or SMTP).
 * Deterministic queueing/scheduling lives in the worker; this layer only
 * performs the transport. Server-only (never imported by client code).
 * ========================================================================= */

export interface SendParams {
  from: string; // "Name <email@domain>"
  to: string;
  subject: string;
  html?: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface SendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface EmailAdapter {
  readonly provider: "resend" | "smtp";
  send(params: SendParams): Promise<SendResult>;
}

/* --------------------------------- Resend --------------------------------- */

class ResendAdapter implements EmailAdapter {
  readonly provider = "resend" as const;
  constructor(private apiKey: string) {}

  async send(params: SendParams): Promise<SendResult> {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(this.apiKey);
      const { data, error } = await resend.emails.send({
        from: params.from,
        to: params.to,
        subject: params.subject,
        html: params.html ?? textToHtml(params.text),
        text: params.text,
        replyTo: params.replyTo,
        headers: params.headers,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, providerMessageId: data?.id };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}

/* ---------------------------------- SMTP ---------------------------------- */

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure?: boolean;
}

class SmtpAdapter implements EmailAdapter {
  readonly provider = "smtp" as const;
  constructor(private cfg: SmtpConfig) {}

  async send(params: SendParams): Promise<SendResult> {
    try {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.createTransport({
        host: this.cfg.host,
        port: this.cfg.port,
        secure: this.cfg.secure ?? this.cfg.port === 465,
        auth: { user: this.cfg.user, pass: this.cfg.pass },
      });
      const info = await transport.sendMail({
        from: params.from,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html ?? textToHtml(params.text),
        replyTo: params.replyTo,
        headers: params.headers,
      });
      return { ok: true, providerMessageId: info.messageId };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}

/* --------------------------------- factory -------------------------------- */

export interface AccountTransport {
  provider: "resend" | "smtp";
  smtp?: SmtpConfig;
}

/** Resolve an adapter for a sending account, falling back to env config. */
export function getAdapter(transport: AccountTransport): EmailAdapter | null {
  if (transport.provider === "smtp") {
    const cfg =
      transport.smtp ??
      (process.env.SMTP_HOST
        ? {
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT ?? 587),
            user: process.env.SMTP_USER ?? "",
            pass: process.env.SMTP_PASS ?? "",
          }
        : null);
    if (!cfg) return null;
    return new SmtpAdapter(cfg);
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new ResendAdapter(key);
}

export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;line-height:1.6;color:#0f172a;white-space:pre-wrap">${escaped}</div>`;
}
