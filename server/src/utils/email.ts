/**
 * Transactional email via Resend (https://resend.com).
 *
 * Uses the REST API directly (global fetch, Node 18+) so no extra dependency
 * is required. When RESEND_API_KEY is not configured — e.g. local development
 * — the email is not sent; instead the verification link is logged to the
 * console so the flow can still be completed manually.
 */
import { config } from '../config';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

interface SendResult {
  sent: boolean;
  reason?: string;
}

/** Build the verification URL the user clicks from their inbox. */
export function verificationUrl(token: string): string {
  const base = config.appUrl.replace(/\/+$/, '');
  return `${base}/api/auth/verify?token=${encodeURIComponent(token)}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}

/**
 * Send the signup verification email. Never throws — a failure to send must
 * not fail the signup request; the caller decides how to surface it.
 */
export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string,
): Promise<SendResult> {
  const link = verificationUrl(token);

  if (!config.resendApiKey) {
    // eslint-disable-next-line no-console
    console.log(`[email] RESEND_API_KEY not set — verification link for ${to}:\n  ${link}`);
    return { sent: false, reason: 'RESEND_API_KEY not configured' };
  }

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1e2233;">
      <h2 style="color:#4f46e5;">Verify your email</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>Welcome to <strong>Smart Savings Tracker</strong>! Please confirm your email address to activate your account.</p>
      <p style="margin: 28px 0;">
        <a href="${link}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;">
          Verify my email
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px;">Or paste this link into your browser:<br>${link}</p>
      <p style="color:#6b7280;font-size:13px;">If you didn't create this account, you can safely ignore this email.</p>
    </div>`;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.resendFrom,
        to,
        subject: 'Verify your email — Smart Savings Tracker',
        html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.error(`[email] Resend responded ${res.status}: ${detail}`);
      return { sent: false, reason: `Resend error ${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[email] Failed to send verification email:', err);
    return { sent: false, reason: 'network error' };
  }
}
