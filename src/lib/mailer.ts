/**
 * Transactional email sender.
 *
 * Hosts such as Railway block outbound SMTP (465/587 time out), so the primary
 * transport is the Resend HTTPS API on port 443:
 *
 *   RESEND_API_KEY  — API key from https://resend.com/api-keys
 *   MAIL_FROM       — verified sender, e.g. "LOGLEG HRMS <no-reply@yourdomain>"
 *
 * Gmail SMTP remains available as a secondary transport for hosts that do allow
 * it, and with nothing configured the message is only logged, which keeps local
 * development working (password reset links are also returned to the client
 * outside production).
 */

import nodemailer, { type Transporter } from "nodemailer";

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface MailResult {
  delivered: boolean;
  error?: string;
}

export type MailProvider = "resend" | "smtp" | "none";

export interface MailStatus {
  provider: MailProvider;
  configured: boolean;
  lastSentAt: string | null;
  lastError: string | null;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RESEND_TEST_SENDER = "LOGLEG HRMS <onboarding@resend.dev>";

function resendApiKey(): string | null {
  const key = process.env.RESEND_API_KEY?.trim();
  return key ? key : null;
}

function smtpCredentials(): { user: string; pass: string } | null {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!user || !pass) return null;
  return { user, pass };
}

export function mailProvider(): MailProvider {
  if (resendApiKey()) return "resend";
  if (smtpCredentials()) return "smtp";
  return "none";
}

export function mailerConfigured(): boolean {
  return mailProvider() !== "none";
}

let lastSentAt: string | null = null;
let lastError: string | null = null;

/** Current mail configuration state, for diagnostics (never includes secrets). */
export function mailStatus(): MailStatus {
  const provider = mailProvider();
  return { provider, configured: provider !== "none", lastSentAt, lastError };
}

/** Logs once at boot so a missing configuration is visible in the deploy logs. */
export function logMailerConfiguration(): void {
  const provider = mailProvider();
  if (provider === "resend") {
    console.info(`[mailer] Using the Resend HTTPS API (from: ${senderAddress()}).`);
    return;
  }
  if (provider === "smtp") {
    console.info(`[mailer] Using Gmail SMTP (from: ${senderAddress()}).`);
    return;
  }
  console.warn(
    "[mailer] No email provider configured — password reset emails will NOT be delivered. " +
      "Set RESEND_API_KEY (recommended; sends over HTTPS so blocked SMTP ports don't matter) " +
      "and MAIL_FROM to a verified sender.",
  );
}

function senderAddress(): string {
  return process.env.MAIL_FROM?.trim() || RESEND_TEST_SENDER;
}

async function sendViaResend(apiKey: string, input: MailInput): Promise<string> {
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: senderAddress(),
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
  if (!response.ok) {
    throw new Error(
      `Resend ${response.status}${payload?.message ? `: ${payload.message}` : response.statusText ? `: ${response.statusText}` : ""}`,
    );
  }
  return payload?.id ?? "accepted";
}

const transports = new Map<string, Transporter>();

function getTransporter(credentials: { user: string; pass: string }, port: number): Transporter {
  const key = `${credentials.user}:${port}`;
  const cached = transports.get(key);
  if (cached) return cached;

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user: credentials.user, pass: credentials.pass },
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
  });
  transports.set(key, transporter);
  return transporter;
}

/** Connection-level failures worth retrying on the other Gmail port. */
function isConnectionFailure(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code ?? "";
  return ["ETIMEDOUT", "ESOCKET", "ECONNECTION", "ECONNREFUSED", "EHOSTUNREACH", "ENOTFOUND"].includes(code);
}

async function sendViaSmtp(credentials: { user: string; pass: string }, input: MailInput): Promise<string> {
  const send = (port: number) =>
    getTransporter(credentials, port).sendMail({
      from: senderAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

  let info;
  try {
    info = await send(587);
  } catch (error) {
    if (!isConnectionFailure(error)) throw error;
    console.warn("[mailer] Port 587 unreachable, retrying over implicit TLS on 465.");
    info = await send(465);
  }
  return info.messageId;
}

export async function sendMail(input: MailInput): Promise<MailResult> {
  const provider = mailProvider();

  if (provider === "none") {
    lastError = "Email delivery is not configured (no RESEND_API_KEY or SMTP credentials)";
    console.warn(
      `[mailer] No email provider configured — not sending to ${input.to}. ` +
        "Set RESEND_API_KEY and MAIL_FROM to deliver over HTTPS.",
    );
    // Log the message body so a reset link is still recoverable during development.
    console.info(`[mailer] Subject: ${input.subject}\n${input.text}`);
    return { delivered: false, error: lastError };
  }

  try {
    const messageId =
      provider === "resend"
        ? await sendViaResend(resendApiKey()!, input)
        : await sendViaSmtp(smtpCredentials()!, input);

    lastSentAt = new Date().toISOString();
    lastError = null;
    console.info(`[mailer] Sent "${input.subject}" to ${input.to} via ${provider} (id: ${messageId})`);
    return { delivered: true };
  } catch (error) {
    const err = error as { code?: string; response?: string; responseCode?: number; message?: string };
    lastError =
      `[${provider}]` +
      (err?.code ? ` [${err.code}]` : "") +
      (err?.responseCode ? ` (status ${err.responseCode})` : "") +
      (err?.response ? ` ${err.response}` : "") +
      (err?.message ? ` ${err.message}` : "");
    console.error(`[mailer] ${provider} send failed for ${input.to}: ${lastError}`);
    if (provider === "smtp" && isConnectionFailure(error)) {
      console.error(
        "[mailer] The SMTP ports look blocked (as on Railway). Set RESEND_API_KEY to send over HTTPS instead.",
      );
    }
    return { delivered: false, error: lastError };
  }
}
