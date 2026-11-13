/**
 * Minimal transactional email sender.
 *
 * Uses the Resend HTTP API when RESEND_API_KEY is configured. Without a key the
 * message is logged instead of sent, so local development and previews keep
 * working and the caller can report that delivery was skipped.
 */

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

export function mailerConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendMail(input: MailInput): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[mailer] RESEND_API_KEY is not set — no email sent to ${input.to}.`);
    console.info(`[mailer] Subject: ${input.subject}\n${input.text}`);
    return { delivered: false, error: "Email delivery is not configured" };
  }

  const from = process.env.MAIL_FROM ?? "LOGLEG HRMS <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[mailer] Resend responded ${res.status}: ${body.slice(0, 300)}`);
      return { delivered: false, error: `Email provider responded ${res.status}` };
    }
    return { delivered: true };
  } catch (error) {
    console.error("[mailer] send failed", error);
    return { delivered: false, error: "Email delivery failed" };
  }
}
