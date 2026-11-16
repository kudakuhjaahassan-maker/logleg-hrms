/**
 * Transactional email sender.
 *
 * Uses Gmail SMTP through Nodemailer when SMTP_USER and SMTP_PASS are set.
 * Without credentials nothing is sent — which used to happen invisibly, so the
 * reset screen claimed a link was on its way while no mail existed. Now the
 * omission is logged at startup and reported through mailStatus(), and a failed
 * send is returned to the caller instead of being swallowed.
 *
 * Gmail listens on 587 (STARTTLS) and 465 (implicit TLS). Some hosts block one or
 * the other, so 587 is tried first with a fallback to 465 on connection errors.
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

export interface MailStatus {
  configured: boolean;
  lastSentAt: string | null;
  lastError: string | null;
}

function smtpCredentials(): { user: string; pass: string } | null {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!user || !pass) return null;
  return { user, pass };
}

export function mailerConfigured(): boolean {
  return smtpCredentials() !== null;
}

let lastSentAt: string | null = null;
let lastError: string | null = null;

/** Current mail configuration state, for diagnostics (never includes the password). */
export function mailStatus(): MailStatus {
  return { configured: mailerConfigured(), lastSentAt, lastError };
}

/** Logs once at boot so a missing configuration is visible in the deploy logs. */
export function logMailerConfiguration(): void {
  if (mailerConfigured()) {
    const from = process.env.MAIL_FROM?.trim() || smtpCredentials()!.user;
    console.info(`[mailer] Gmail SMTP configured (from: ${from}).`);
    return;
  }
  console.warn(
    "[mailer] SMTP_USER / SMTP_PASS are not set — password reset emails will NOT be delivered. " +
      "Set both (SMTP_PASS must be a Gmail App Password) in the host's environment variables.",
  );
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

async function sendOnce(credentials: { user: string; pass: string }, port: number, input: MailInput) {
  const from = process.env.MAIL_FROM?.trim() || credentials.user;
  return getTransporter(credentials, port).sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
}

export async function sendMail(input: MailInput): Promise<MailResult> {
  const credentials = smtpCredentials();
  if (!credentials) {
    lastError = "Email delivery is not configured (SMTP_USER/SMTP_PASS missing)";
    console.warn(`[mailer] SMTP is not configured — no email sent to ${input.to}.`);
    console.info(`[mailer] Subject: ${input.subject}\n${input.text}`);
    return { delivered: false, error: lastError };
  }

  try {
    let info;
    try {
      info = await sendOnce(credentials, 587, input);
    } catch (error) {
      if (!isConnectionFailure(error)) throw error;
      console.warn("[mailer] Port 587 unreachable, retrying over implicit TLS on 465.");
      info = await sendOnce(credentials, 465, input);
    }
    lastSentAt = new Date().toISOString();
    lastError = null;
    console.info(`[mailer] Sent "${input.subject}" to ${input.to} (messageId: ${info.messageId})`);
    return { delivered: true };
  } catch (error) {
    const err = error as { code?: string; response?: string; responseCode?: number; command?: string; message?: string };
    lastError =
      `[${err?.code ?? "ERROR"}]` +
      (err?.responseCode ? ` (status ${err.responseCode})` : "") +
      (err?.response ? ` ${err.response}` : "") +
      (err?.message ? ` ${err.message}` : "");
    console.error(`[mailer] Gmail SMTP send failed for ${input.to}: ${lastError}`);
    return { delivered: false, error: lastError };
  }
}
