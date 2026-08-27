// lib/mailer.ts
//
// Nodemailer transporter for sending password-reset emails via SMTP.
// Configure via SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
// in .env.local.

import nodemailer from 'nodemailer'

const host = process.env.SMTP_HOST
const port = Number(process.env.SMTP_PORT || 587)
const user = process.env.SMTP_USER
const pass = process.env.SMTP_PASS
const from = process.env.SMTP_FROM || user

if (!host || !user || !pass) {
  console.warn(
    '[mailer] SMTP_HOST, SMTP_USER, or SMTP_PASS not set — password-reset emails will fail.'
  )
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
})

/**
 * Send a password-reset email containing a link with the given token.
 */
export async function sendPasswordResetEmail(
  to: string,
  token: string
): Promise<void> {
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000'
  const resetLink = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`

  await transporter.sendMail({
    from,
    to,
    subject: 'Veil — Reset your password',
    text: [
      'You requested a password reset for your Veil account.',
      '',
      `Click the link below to set a new password (expires in 1 hour):`,
      resetLink,
      '',
      'If you did not request this, you can safely ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #ff0000;">Veil</h2>
        <p>You requested a password reset for your Veil account.</p>
        <p>Click the button below to set a new password (expires in 1 hour):</p>
        <a href="${resetLink}"
           style="display:inline-block;padding:12px 24px;background:#ff0000;color:#fff;
                  text-decoration:none;border-radius:6px;font-weight:bold;margin:16px 0;">
          Reset Password
        </a>
        <p style="color:#888;font-size:13px;">
          If you did not request this, you can safely ignore this email.
        </p>
      </div>
    `,
  })
}
