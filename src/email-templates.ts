// Email templates for Walk to Mordor
// Uses simple template strings for compatibility with various email clients

/**
 * HTML escape utility to prevent XSS in email templates
 */
function escapeHtml(text: string): string {
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char]);
}

/**
 * Common email styles shared across all templates
 */
const EMAIL_STYLES = `
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #0f3460; color: white; padding: 20px; text-align: center; border-radius: 4px 4px 0 0; }
    .content { padding: 30px 20px; background-color: #f9f9f9; border: 1px solid #ddd; border-top: none; }
    .button { display: inline-block; padding: 12px 24px; background-color: #e94560; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; font-weight: bold; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    .link-box { word-break: break-all; background-color: #fff; padding: 10px; border: 1px solid #ddd; border-radius: 4px; margin: 10px 0; }
`;

/**
 * Generate HTML email for password reset
 */
export function getPasswordResetEmailHtml(resetLink: string): string {
  const escapedLink = escapeHtml(resetLink);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${EMAIL_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🧙‍♂️ Walk to Mordor</h1>
    </div>
    <div class="content">
      <h2>Password Reset Request</h2>
      <p>You have requested to reset your password for Walk to Mordor.</p>
      <p>Click the button below to reset your password:</p>
      <p style="text-align: center;">
        <a href="${escapedLink}" class="button">Reset Password</a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <div class="link-box">${escapedLink}</div>
      <p><strong>This link will expire in 1 hour.</strong></p>
      <p>If you did not request a password reset, please ignore this email and your password will remain unchanged.</p>
    </div>
    <div class="footer">
      <p>Best regards,<br>Walk to Mordor Team</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate plain text email for password reset
 */
export function getPasswordResetEmailText(resetLink: string): string {
  return `Password Reset Request - Walk to Mordor

You have requested to reset your password for Walk to Mordor.

Please click the link below or copy it into your browser to reset your password:
${resetLink}

This link will expire in 1 hour.

If you did not request a password reset, please ignore this email and your password will remain unchanged.

Best regards,
Walk to Mordor Team`;
}

/**
 * Generate HTML email for email confirmation
 */
export function getConfirmationEmailHtml(confirmLink: string): string {
  const escapedLink = escapeHtml(confirmLink);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${EMAIL_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🧙‍♂️ Walk to Mordor</h1>
    </div>
    <div class="content">
      <h2>Welcome to Walk to Mordor!</h2>
      <p>Thank you for signing up. We're excited to have you join us on this epic journey!</p>
      <p>Click the button below to confirm your email address:</p>
      <p style="text-align: center;">
        <a href="${escapedLink}" class="button">Confirm Email</a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <div class="link-box">${escapedLink}</div>
      <p>Once confirmed, you can start tracking your progress to Mordor!</p>
    </div>
    <div class="footer">
      <p>Best regards,<br>Walk to Mordor Team</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate plain text email for email confirmation
 */
export function getConfirmationEmailText(confirmLink: string): string {
  return `Welcome to Walk to Mordor!

Thank you for signing up. We're excited to have you join us on this epic journey!

Please click the link below or copy it into your browser to confirm your email address:
${confirmLink}

Once confirmed, you can start tracking your progress to Mordor!

Best regards,
Walk to Mordor Team`;
}
