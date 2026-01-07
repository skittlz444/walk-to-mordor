// Email sending utilities using Cloudflare Email Routing
import { createMimeMessage } from 'mimetext';

/**
 * Send password reset email with token
 */
export async function sendPasswordResetEmail(
  env: any,
  recipientEmail: string,
  recipientName: string,
  resetToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if email binding is available
    if (!env.EMAIL) {
      console.warn('Email binding not configured. Skipping email send.');
      return { success: false, error: 'Email service not configured' };
    }

    // Create reset URL - use the domain from the request or a configured domain
    const resetUrl = `https://wtm.haydencarson.com/reset-password?token=${resetToken}`;
    
    // Create MIME message
    const msg = createMimeMessage();
    
    // Set sender - must be from the domain with Email Routing enabled
    msg.setSender({ 
      name: 'Walk to Mordor', 
      addr: 'noreply@haydencarson.com' 
    });
    
    // Set recipient
    msg.setRecipient(recipientEmail);
    
    // Set subject
    msg.setSubject('Password Reset Request - Walk to Mordor');
    
    // Add plain text message
    msg.addMessage({
      contentType: 'text/plain',
      data: `Hello ${recipientName},

You have requested to reset your password for Walk to Mordor.

Please click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you did not request a password reset, please ignore this email.

Best regards,
Walk to Mordor Team`
    });
    
    // Add HTML message (optional, for better formatting)
    msg.addMessage({
      contentType: 'text/html',
      data: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #0f3460; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .button { display: inline-block; padding: 12px 24px; background-color: #e94560; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🧙‍♂️ Walk to Mordor</h1>
    </div>
    <div class="content">
      <h2>Password Reset Request</h2>
      <p>Hello ${recipientName},</p>
      <p>You have requested to reset your password for Walk to Mordor.</p>
      <p>Click the button below to reset your password:</p>
      <p style="text-align: center;">
        <a href="${resetUrl}" class="button">Reset Password</a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; background-color: #fff; padding: 10px; border: 1px solid #ddd;">${resetUrl}</p>
      <p><strong>This link will expire in 1 hour.</strong></p>
      <p>If you did not request a password reset, please ignore this email.</p>
    </div>
    <div class="footer">
      <p>Best regards,<br>Walk to Mordor Team</p>
    </div>
  </div>
</body>
</html>`
    });

    // Import EmailMessage from cloudflare:email
    // Note: This is a Cloudflare Workers built-in module
    const { EmailMessage } = await import('cloudflare:email');
    
    // Create email message
    const message = new EmailMessage(
      'noreply@haydencarson.com',
      recipientEmail,
      msg.asRaw()
    );

    // Send email using the EMAIL binding
    await env.EMAIL.send(message);
    
    return { success: true };
  } catch (error: any) {
    console.error('Error sending password reset email:', error);
    return { success: false, error: error.message };
  }
}
