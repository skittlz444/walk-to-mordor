// Email sending utilities using Resend API
import { 
  getPasswordResetEmailHtml, 
  getPasswordResetEmailText,
  getConfirmationEmailHtml,
  getConfirmationEmailText 
} from './email-templates';

// Import Env type for proper typing
type Env = {
  RESEND_API_KEY: string;
};

// Email configuration constants
const EMAIL_SENDER_ADDRESS = 'noreply@haydencarson.com';
const EMAIL_SENDER_NAME = 'Walk to Mordor';
const RESEND_API_URL = 'https://api.resend.com/emails';

/**
 * Options for sending an email
 */
export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Result of sending an email
 */
export interface EmailResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

// Resend API Response Types
interface ResendSuccess {
  id: string;
}

interface ResendError {
  name: string;
  message: string;
  statusCode?: number;
}

/**
 * Core function to send email via Resend API
 * Uses fetch() for Edge compatibility
 */
export async function sendEmail(
  env: Env,
  options: EmailOptions
): Promise<EmailResult> {
  try {
    // Check if API key is configured
    if (!env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured in environment');
      return { 
        success: false, 
        error: 'Email service not configured. Please contact administrator.' 
      };
    }

    // Prepare the request payload for Resend API
    const payload = {
      from: `${EMAIL_SENDER_NAME} <${EMAIL_SENDER_ADDRESS}>`,
      to: [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text || undefined
    };

    // Send email via Resend API
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    // Handle rate limiting (429)
    if (response.status === 429) {
      console.warn('Resend API rate limit hit');
      return {
        success: false,
        error: 'Too many email requests. Please try again later.'
      };
    }

    // Parse response
    const result = await response.json() as ResendSuccess | ResendError;

    // Check for errors
    if (!response.ok) {
      const errorResult = result as ResendError;
      console.error('Resend API error:', {
        status: response.status,
        error: errorResult
      });
      
      return {
        success: false,
        error: errorResult.message || `Email service error (${response.status}). Please try again later.`
      };
    }

    // Success
    const successResult = result as ResendSuccess;
    return {
      success: true,
      messageId: successResult.id
    };

  } catch (error: any) {
    console.error('Error sending email via Resend:', error);
    return {
      success: false,
      error: 'Failed to send email. Please try again later.'
    };
  }
}

/**
 * Send password reset email with token
 * @param recipientName - Currently unused but maintained for API compatibility and future personalization
 */
export async function sendPasswordResetEmail(
  env: Env,
  recipientEmail: string,
  recipientName: string,
  resetToken: string,
  origin: string
): Promise<{ success: boolean; error?: string }> {
  // Create reset URL
  const resetUrl = `${origin}/reset-password?token=${resetToken}`;
  
  // Use email templates
  const html = getPasswordResetEmailHtml(resetUrl);
  const text = getPasswordResetEmailText(resetUrl);
  
  // Send via core sendEmail function
  const result = await sendEmail(env, {
    to: recipientEmail,
    subject: 'Password Reset Request - Walk to Mordor',
    html,
    text
  });

  return {
    success: result.success,
    error: result.error
  };
}

/**
 * Send email confirmation link
 */
export async function sendConfirmationEmail(
  env: Env,
  recipientEmail: string,
  confirmLink: string
): Promise<{ success: boolean; error?: string }> {
  // Use email templates
  const html = getConfirmationEmailHtml(confirmLink);
  const text = getConfirmationEmailText(confirmLink);
  
  // Send via core sendEmail function
  const result = await sendEmail(env, {
    to: recipientEmail,
    subject: 'Confirm Your Email - Walk to Mordor',
    html,
    text
  });

  return {
    success: result.success,
    error: result.error
  };
}
