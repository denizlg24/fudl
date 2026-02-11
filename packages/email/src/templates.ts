// ---------------------------------------------------------------------------
// Shared email layout — header, footer, and wrapper styles
// ---------------------------------------------------------------------------

const brandColor = "#0f172a";
const mutedColor = "#666";
const fontFamily =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/** Primary CTA button */
function button(label: string, href: string): string {
  return `
    <td align="center" style="padding: 32px 0;">
      <a href="${href}"
         style="background-color: ${brandColor}; color: #ffffff; padding: 12px 24px;
                border-radius: 6px; text-decoration: none; display: inline-block;
                font-weight: 600; font-size: 14px;">
        ${label}
      </a>
    </td>
  `;
}

/** Fallback plain-text link */
function fallbackLink(href: string): string {
  return `
    <p style="color: ${mutedColor}; font-size: 13px; line-height: 1.5;">
      Or copy and paste this link into your browser:<br/>
      <a href="${href}" style="color: ${brandColor}; word-break: break-all;">${href}</a>
    </p>
  `;
}

/** Shared email header */
function header(): string {
  return `
    <tr>
      <td style="padding: 32px 0 16px;">
        <span style="font-size: 20px; font-weight: 700; color: ${brandColor}; letter-spacing: -0.5px;">
          FUDL
        </span>
      </td>
    </tr>
  `;
}

/** Shared email footer */
function footer(): string {
  return `
    <tr>
      <td style="padding: 32px 0 16px; border-top: 1px solid #e5e7eb;">
        <p style="color: ${mutedColor}; font-size: 12px; line-height: 1.5; margin: 0;">
          &copy; ${new Date().getFullYear()} FUDL &mdash; AI-powered analytics for teams.
        </p>
      </td>
    </tr>
  `;
}

/**
 * Wraps email body content in the shared layout (header + footer + responsive table).
 * Pass the inner rows as a string.
 */
function layout(body: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
    <body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: ${fontFamily};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb;">
        <tr>
          <td align="center" style="padding: 24px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                   style="max-width: 480px; background-color: #ffffff; border-radius: 8px;
                          border: 1px solid #e5e7eb; padding: 0 32px;">
              ${header()}
              ${body}
              ${footer()}
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// ---------------------------------------------------------------------------
// Individual email templates
// ---------------------------------------------------------------------------

export interface VerificationEmailParams {
  userName?: string | null;
  url: string;
}

/** Email sent after registration to verify the user's email address. */
export function verificationEmail({ userName, url }: VerificationEmailParams): {
  subject: string;
  html: string;
} {
  const greeting = userName ? `Hi ${userName},` : "Hi,";

  const body = `
    <tr>
      <td>
        <h2 style="margin: 0 0 16px; font-size: 18px; color: ${brandColor};">Welcome to FUDL</h2>
        <p style="margin: 0 0 8px; color: #374151; line-height: 1.6;">${greeting}</p>
        <p style="margin: 0; color: #374151; line-height: 1.6;">
          Please verify your email address by clicking the button below:
        </p>
      </td>
    </tr>
    <tr>${button("Verify Email", url)}</tr>
    <tr>
      <td>
        <p style="color: ${mutedColor}; font-size: 13px; line-height: 1.5;">
          If you didn't create an account on FUDL, you can safely ignore this email.
        </p>
        ${fallbackLink(url)}
      </td>
    </tr>
  `;

  return {
    subject: "Verify your FUDL account",
    html: layout(body),
  };
}

export interface ResetPasswordEmailParams {
  userName?: string | null;
  url: string;
}

/** Email sent when a user requests a password reset. */
export function resetPasswordEmail({
  userName,
  url,
}: ResetPasswordEmailParams): { subject: string; html: string } {
  const greeting = userName ? `Hi ${userName},` : "Hi,";

  const body = `
    <tr>
      <td>
        <h2 style="margin: 0 0 16px; font-size: 18px; color: ${brandColor};">Password Reset</h2>
        <p style="margin: 0 0 8px; color: #374151; line-height: 1.6;">${greeting}</p>
        <p style="margin: 0; color: #374151; line-height: 1.6;">
          We received a request to reset your password. Click the button below to choose a new one:
        </p>
      </td>
    </tr>
    <tr>${button("Reset Password", url)}</tr>
    <tr>
      <td>
        <p style="color: ${mutedColor}; font-size: 13px; line-height: 1.5;">
          If you didn't request a password reset, you can safely ignore this email.
        </p>
        ${fallbackLink(url)}
      </td>
    </tr>
  `;

  return {
    subject: "Reset your FUDL password",
    html: layout(body),
  };
}

export interface DeleteAccountEmailParams {
  userName?: string | null;
  url: string;
}

/** Email sent when a user requests account deletion — must click to confirm. */
export function deleteAccountVerificationEmail({
  userName,
  url,
}: DeleteAccountEmailParams): { subject: string; html: string } {
  const greeting = userName ? `Hi ${userName},` : "Hi,";

  const body = `
    <tr>
      <td>
        <h2 style="margin: 0 0 16px; font-size: 18px; color: #dc2626;">Account Deletion Request</h2>
        <p style="margin: 0 0 8px; color: #374151; line-height: 1.6;">${greeting}</p>
        <p style="margin: 0; color: #374151; line-height: 1.6;">
          We received a request to permanently delete your FUDL account. This action
          <strong>cannot be undone</strong> — your personal data will be removed and you
          will be removed from all teams.
        </p>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 32px 0;">
        <a href="${url}"
           style="background-color: #dc2626; color: #ffffff; padding: 12px 24px;
                  border-radius: 6px; text-decoration: none; display: inline-block;
                  font-weight: 600; font-size: 14px;">
          Confirm Account Deletion
        </a>
      </td>
    </tr>
    <tr>
      <td>
        <p style="color: ${mutedColor}; font-size: 13px; line-height: 1.5;">
          If you didn't request this, you can safely ignore this email. Your account
          will remain active.
        </p>
        <p style="color: ${mutedColor}; font-size: 13px; line-height: 1.5;">
          <strong>Note:</strong> You must be logged in when you click the confirmation link.
          The link expires in 24 hours.
        </p>
        ${fallbackLink(url)}
      </td>
    </tr>
  `;

  return {
    subject: "Confirm your FUDL account deletion",
    html: layout(body),
  };
}

export interface InvitationEmailParams {
  inviterName: string;
  organizationName: string;
  role: string;
  inviteLink: string;
}

/** Email sent when a team member is invited to an organization. */
export function invitationEmail({
  inviterName,
  organizationName,
  role,
  inviteLink,
}: InvitationEmailParams): { subject: string; html: string } {
  const body = `
    <tr>
      <td>
        <h2 style="margin: 0 0 16px; font-size: 18px; color: ${brandColor};">You've been invited</h2>
        <p style="margin: 0; color: #374151; line-height: 1.6;">
          <strong>${inviterName}</strong> has invited you to join
          <strong>${organizationName}</strong> as a <strong>${role}</strong>.
        </p>
      </td>
    </tr>
    <tr>${button("Accept Invitation", inviteLink)}</tr>
    <tr>
      <td>
        ${fallbackLink(inviteLink)}
      </td>
    </tr>
  `;

  return {
    subject: `You're invited to join ${organizationName} on FUDL`,
    html: layout(body),
  };
}
