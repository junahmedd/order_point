import nodemailer from 'nodemailer';

/**
 * Returns the configured Nodemailer Transporter if SMTP host is specified.
 */
export function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true';

  if (!host || !user || !pass) {
    console.warn('⚠️ SMTP email credentials are not fully configured in environment variables.');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Sends a highly polished branding-compliant HTML email with the verification token and code.
 */
export async function sendVerificationEmail({
  email,
  fullName,
  verificationCode,
  verificationToken,
}: {
  email: string;
  fullName: string;
  verificationCode: string;
  verificationToken: string;
}) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const verifyLink = `${appUrl}/api/verify-email?token=${verificationToken}`;
  const fromAddress = process.env.EMAIL_FROM || '"OrderPoint Pro" <noreply@orderpointpro.com>';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your OrderPoint Pro Account</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #F8FAFC;
          color: #334155;
          margin: 0;
          padding: 0;
          -webkit-font-smoothing: antialiased;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #ffffff;
          border-radius: 16px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
          border: 1px solid #E2E8F0;
          overflow: hidden;
        }
        .header {
          background-color: #0F172A;
          padding: 32px;
          text-align: center;
        }
        .logo {
          font-size: 24px;
          font-weight: 800;
          color: #ffffff;
          text-decoration: none;
          letter-spacing: -0.5px;
        }
        .logo-accent {
          color: #10B981;
        }
        .content {
          padding: 40px 32px;
        }
        h1 {
          font-size: 22px;
          font-weight: 700;
          color: #0F172A;
          margin-top: 0;
          margin-bottom: 16px;
          text-align: center;
        }
        p {
          font-size: 14px;
          line-height: 1.6;
          color: #475569;
          margin-bottom: 24px;
        }
        .greeting {
          font-size: 16px;
          font-weight: 600;
          color: #0F172A;
        }
        .otp-container {
          background-color: #F1F5F9;
          border: 1px dashed #CBD5E1;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          margin: 32px 0;
        }
        .otp-label {
          font-size: 11px;
          font-weight: 700;
          color: #64748B;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .otp-code {
          font-family: 'Courier New', Courier, monospace;
          font-size: 32px;
          font-weight: 800;
          color: #0F172A;
          letter-spacing: 6px;
          margin: 0;
        }
        .button-container {
          text-align: center;
          margin: 32px 0;
        }
        .button {
          display: inline-block;
          background-color: #10B981;
          color: #ffffff !important;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          padding: 14px 32px;
          border-radius: 8px;
          box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2);
          transition: background-color 0.2s;
        }
        .button:hover {
          background-color: #059669;
        }
        .divider {
          border-top: 1px solid #E2E8F0;
          margin: 32px 0;
        }
        .footer {
          background-color: #F8FAFC;
          padding: 24px 32px;
          text-align: center;
          border-top: 1px solid #E2E8F0;
        }
        .footer-text {
          font-size: 12px;
          color: #64748B;
          line-height: 1.5;
        }
        .footer-links {
          margin-top: 12px;
        }
        .footer-link {
          font-size: 12px;
          color: #10B981;
          text-decoration: none;
          margin: 0 8px;
        }
        .footer-link:hover {
          text-decoration: underline;
        }
        .expiry-notice {
          font-size: 12px;
          color: #94A3B8;
          text-align: center;
          font-style: italic;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <a href="${appUrl}" class="logo">OrderPoint <span class="logo-accent">Pro</span></a>
        </div>
        <div class="content">
          <h1>Verify Your Email Address</h1>
          <p class="greeting">Hi ${fullName},</p>
          <p>Thank you for choosing OrderPoint Pro as your restaurant's operating system! To activate your 14-day free trial and complete your business registration, please verify your email address using either of the methods below.</p>
          
          <!-- Method 1: 6-Digit OTP Code -->
          <div class="otp-container">
            <div class="otp-label">ONE-TIME VERIFICATION CODE</div>
            <div class="otp-code">${verificationCode}</div>
          </div>
          
          <p>Enter this 6-digit code in the application verification page, or simply click the button below to verify instantly.</p>

          <!-- Method 2: Verification Button Link -->
          <div class="button-container">
            <a href="${verifyLink}" class="button" target="_blank">VERIFY EMAIL INSTANTLY</a>
          </div>

          <p class="expiry-notice">This verification link and code are highly secure and will expire in 15 minutes.</p>

          <div class="divider"></div>
          
          <p style="font-size: 13px; color: #64748B;">If the button doesn't work, you can copy and paste this verification link directly into your web browser:</p>
          <p style="font-size: 11px; word-break: break-all; color: #10B981; font-family: monospace;">${verifyLink}</p>
        </div>
        <div class="footer">
          <p class="footer-text">This is an automated email sent by OrderPoint Pro. If you did not sign up for an account, please ignore this email or contact support.</p>
          <div class="footer-text" style="margin-top: 8px;">OrderPoint Pro Enterprise, Inc. • One Sansome St, San Francisco, CA 94104</div>
          <div class="footer-links">
            <a href="${appUrl}" class="footer-link">Dashboard</a> • 
            <a href="#" class="footer-link">Support Desk</a> • 
            <a href="#" class="footer-link">Privacy Policy</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    Verify Your OrderPoint Pro Account

    Hi ${fullName},

    Thank you for registering your restaurant with OrderPoint Pro!
    Please verify your email to activate your account.

    Your One-Time Verification Code: ${verificationCode}

    Or verify instantly by clicking this link:
    ${verifyLink}

    For security, this link and code will expire in 15 minutes.

    OrderPoint Pro Team
  `;

  const transporter = getTransporter();

  if (!transporter) {
    console.info('==================================================');
    console.info(`📧 EMAIL SEND SIMULATION (No SMTP Host configured)`);
    console.info(`To: ${email}`);
    console.info(`User: ${fullName}`);
    console.info(`Verification Code (OTP): ${verificationCode}`);
    console.info(`Verification Link: ${verifyLink}`);
    console.info('==================================================');
    return {
      simulated: true,
      verificationCode,
      verificationToken,
    };
  }

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject: '🔑 Verify Your Email Address - OrderPoint Pro',
      text: textContent,
      html: htmlContent,
    });
    console.log(`✉️ Email successfully delivered to ${email}. Message ID: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error(`❌ Failed to deliver email to ${email}:`, error);
    throw error;
  }
}
