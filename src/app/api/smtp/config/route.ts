import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { z } from "zod";

import {
  SMTP_SESSION_COOKIE,
  createSmtpSession,
  deleteSmtpSession,
  getServerSmtpConfig,
  getSmtpSession,
} from "@/lib/email/smtp-vault";

export const runtime = "nodejs";

const ZOHO_HOSTS = {
  us: "smtp.zoho.com",
  eu: "smtp.zoho.eu",
  in: "smtp.zoho.in",
  au: "smtp.zoho.com.au",
  jp: "smtp.zoho.jp",
} as const;

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  fromName: z.string().trim().min(1).max(100),
  region: z.enum(["us", "eu", "in", "au", "jp"]).default("us"),
});

export async function GET() {
  const cookieStore = await cookies();
  const sessionConfig = getSmtpSession(cookieStore.get(SMTP_SESSION_COOKIE)?.value);
  const config = sessionConfig ?? getServerSmtpConfig();
  if (!config) return NextResponse.json({ connected: false });
  return NextResponse.json({
    connected: true,
    email: config.email,
    fromName: config.fromName,
    host: config.host,
    configuredAt: config.configuredAt,
    managed: !sessionConfig,
  });
}

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid Zoho email, app password, and sender name." }, { status: 400 });
  }

  const { email, password, fromName, region } = parsed.data;
  const host = ZOHO_HOSTS[region];
  const transport = nodemailer.createTransport({
    host,
    port: 465,
    secure: true,
    auth: { user: email, pass: password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  try {
    await transport.verify();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Zoho rejected the connection.";
    return NextResponse.json(
      { error: `Could not connect to Zoho SMTP. Use a Zoho app password. ${detail}` },
      { status: 422 },
    );
  } finally {
    transport.close();
  }

  const cookieStore = await cookies();
  const previousId = cookieStore.get(SMTP_SESSION_COOKIE)?.value;
  deleteSmtpSession(previousId);
  const sessionId = createSmtpSession({
    email,
    password,
    fromName,
    host,
    port: 465,
    secure: true,
    configuredAt: new Date().toISOString(),
  });
  cookieStore.set(SMTP_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 12 * 60 * 60,
  });

  return NextResponse.json({ connected: true, email, fromName, host });
}

export async function DELETE() {
  const cookieStore = await cookies();
  deleteSmtpSession(cookieStore.get(SMTP_SESSION_COOKIE)?.value);
  cookieStore.delete(SMTP_SESSION_COOKIE);
  const managed = getServerSmtpConfig();
  return NextResponse.json(
    managed
      ? { connected: true, managed: true, email: managed.email, fromName: managed.fromName, host: managed.host }
      : { connected: false },
  );
}
