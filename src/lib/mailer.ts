/**
 * Minimal transactional email sender.
 *
 * Uses Gmail SMTP through Nodemailer when SMTP_USER and SMTP_PASS are
 * configured. Without credentials the message is logged instead of sent, so
 * local development and previews keep working and the caller can report that
 * delivery was skipped.
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

function smtpCredentials(): { user: string; pass: string } | null {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!user || !pass) return null;
  return { user, pass };
}

export function mailerConfigured(): boolean {
  return smtpCredentials() !== null;
}

let transporter: Transporter | null = null;
let transporterKey = "";

/** Builds (and caches) the Gmail transporter for the current credentials. */
function getTransporter(credentials: { user: string; pass: string }): Transporter {
  const key = `${credentials.user}:${credentials.pass}`;
  if (!transporter || transporterKey !== key) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: credentials.user,
        pass: credentials.pass,
      },
    });
    transporterKey = key;
  }
  return transporter;
}

export async function sendMail(input: MailInput): Promise<MailResult> {
  const credentials = smtpCredentials();
  if (!credentials) {
    console.warn(`[mailer] SMTP_USER/SMTP_PASS are not set — no email sent to ${input.to}.`);
    console.info(`[mailer] Subject: ${input.subject}\n${input.text}`);
    return { delivered: false, error: "Email delivery is not configured" };
  }

  const from = process.env.MAIL_FROM?.trim() || credentials.user;

  try {
    const info = await getTransporter(credentials).sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    console.info(`[mailer] Sent "${input.subject}" to ${input.to} (messageId: ${info.messageId})`);
    return { delivered: true };
  } catch (error) {
    const err = error as { code?: string; response?: string; responseCode?: number; command?: string };
    console.error(
      `[mailer] Gmail SMTP send failed for ${input.to}` +
        (err?.code ? ` [${err.code}]` : "") +
        (err?.responseCode ? ` (status ${err.responseCode})` : ""),
      {
        command: err?.command,
        response: err?.response,
        error,
      },
    );
    return { delivered: false, error: "Email delivery failed" };
  }
}
