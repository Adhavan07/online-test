import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { prisma } from '../lib/prisma.js';

export interface EmailPayload {
  recipientEmail: string;
  subject: string;
  type: 'INVITATION' | 'OTP_VERIFICATION' | 'PASS_ALERT' | 'REJECTION' | 'REMINDER' | 'INTERVIEW_INVITE' | 'SYSTEM';
  content: string;
  htmlContent?: string;
}

export interface SmtpConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
  service?: string; // e.g. 'gmail'
}

export class EmailService {
  private static transporter: Transporter | null = null;
  private static cachedConfig: SmtpConfig | null = null;

  /**
   * Initialize or retrieve the active Nodemailer transporter
   */
  static async getTransporter(): Promise<{ transporter: Transporter; transportType: string; isRealSmtp: boolean }> {
    // 1. Check if user configured SMTP in database settings
    if (!this.cachedConfig) {
      try {
        const setting = await prisma.systemSetting.findUnique({ where: { key: 'SMTP_CONFIG' } });
        if (setting && setting.value) {
          this.cachedConfig = JSON.parse(setting.value);
        }
      } catch (err) {
        console.warn('Could not read SMTP_CONFIG from DB:', err);
      }
    }

    const config = this.cachedConfig || {};
    const envGmailUser = process.env.GMAIL_USER;
    const envGmailPass = process.env.GMAIL_APP_PASSWORD;
    const envSmtpHost = process.env.SMTP_HOST;
    const envSmtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
    const envSmtpUser = process.env.SMTP_USER;
    const envSmtpPass = process.env.SMTP_PASS;

    // Check for explicit Gmail configuration
    if (config.service === 'gmail' && config.user && config.pass) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: config.user,
          pass: config.pass,
        },
      });
      return { transporter: this.transporter, transportType: 'GMAIL', isRealSmtp: true };
    }

    if (envGmailUser && envGmailPass) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: envGmailUser,
          pass: envGmailPass,
        },
      });
      return { transporter: this.transporter, transportType: 'GMAIL', isRealSmtp: true };
    }

    // Check for standard custom SMTP
    const host = config.host || envSmtpHost;
    const port = config.port || envSmtpPort || 587;
    const user = config.user || envSmtpUser;
    const pass = config.pass || envSmtpPass;
    const secure = config.secure !== undefined ? config.secure : port === 465;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      });
      return { transporter: this.transporter, transportType: 'SMTP', isRealSmtp: true };
    }

    // Fallback: Create ephemeral Ethereal test account so emails can be viewed in browser without error
    if (!this.transporter) {
      try {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        console.log('📧 [EMAIL SERVICE] Using Ethereal test mail transport (configure Gmail/SMTP in settings to send live emails)');
      } catch (err) {
        console.warn('Failed to create Ethereal account, using mock fallback transport');
      }
    }

    return { 
      transporter: this.transporter!, 
      transportType: 'ETHEREAL', 
      isRealSmtp: false 
    };
  }

  /**
   * Save dynamic SMTP configuration into database and refresh transporter
   */
  static async saveSmtpConfig(config: SmtpConfig) {
    this.cachedConfig = config;
    this.transporter = null; // force re-init

    await prisma.systemSetting.upsert({
      where: { key: 'SMTP_CONFIG' },
      update: { value: JSON.stringify(config) },
      create: { key: 'SMTP_CONFIG', value: JSON.stringify(config) },
    });

    return this.verifyConnection();
  }

  /**
   * Retrieve current SMTP config with secret passwords masked
   */
  static async getSmtpConfig(): Promise<{
    configured: boolean;
    transportType: string;
    host?: string;
    port?: number;
    user?: string;
    from?: string;
    service?: string;
  }> {
    let config = this.cachedConfig;
    if (!config) {
      try {
        const setting = await prisma.systemSetting.findUnique({ where: { key: 'SMTP_CONFIG' } });
        if (setting?.value) config = JSON.parse(setting.value);
      } catch {}
    }

    const envGmailUser = process.env.GMAIL_USER;
    const envSmtpHost = process.env.SMTP_HOST;
    const envSmtpUser = process.env.SMTP_USER;

    const isConfigured = Boolean(
      (config?.user && config?.pass) ||
      (envGmailUser && process.env.GMAIL_APP_PASSWORD) ||
      (envSmtpHost && envSmtpUser && process.env.SMTP_PASS)
    );

    const transportType = (config?.service === 'gmail' || envGmailUser) ? 'GMAIL' : (config?.host || envSmtpHost) ? 'SMTP' : 'ETHEREAL';

    return {
      configured: isConfigured,
      transportType,
      host: config?.host || envSmtpHost || 'smtp.ethereal.email',
      port: config?.port || (process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587),
      user: config?.user || envGmailUser || envSmtpUser || '',
      from: config?.from || process.env.SMTP_FROM || 'TechScreen Pro <no-reply@techscreen.io>',
      service: config?.service || (envGmailUser ? 'gmail' : undefined),
    };
  }

  /**
   * Verify SMTP connection status
   */
  static async verifyConnection(): Promise<{ success: boolean; message: string; transportType: string }> {
    try {
      const { transporter, transportType, isRealSmtp } = await this.getTransporter();
      await transporter.verify();
      return {
        success: true,
        message: isRealSmtp ? `Connected successfully via ${transportType}` : 'Ready using Ethereal dev transport',
        transportType,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `SMTP Connection Failed: ${err.message}`,
        transportType: 'ERROR',
      };
    }
  }

  /**
   * Base method: Send an email notification, transmit via Nodemailer, and log to DB
   */
  static async sendEmail(payload: EmailPayload): Promise<{
    success: boolean;
    logId: string;
    transport: string;
    previewUrl?: string;
    error?: string;
  }> {
    let transportType = 'SIMULATION';
    let status = 'DELIVERED';
    let previewUrl: string | undefined;
    let errorMessage: string | undefined;

    try {
      const { transporter, transportType: tType, isRealSmtp } = await this.getTransporter();
      transportType = tType;

      const smtpConfig = await this.getSmtpConfig();
      const senderFrom = smtpConfig.from || `"TechScreen Pro" <${smtpConfig.user || 'no-reply@techscreen.io'}>`;

      console.log(`[EMAIL SERVICE] Transmitting ${payload.type} via ${transportType} to ${payload.recipientEmail}...`);

      const info = await transporter.sendMail({
        from: senderFrom,
        to: payload.recipientEmail,
        subject: payload.subject,
        text: payload.content,
        html: payload.htmlContent || this.wrapHtml(payload.subject, payload.content),
      });

      if (!isRealSmtp) {
        const testUrl = nodemailer.getTestMessageUrl(info);
        if (testUrl) {
          previewUrl = testUrl.toString();
          status = 'SIMULATED';
          console.log(`[EMAIL SERVICE] 🌐 Ethereal Preview URL: ${previewUrl}`);
        }
      } else {
        console.log(`[EMAIL SERVICE] ✅ Sent successfully via ${transportType} to ${payload.recipientEmail} (ID: ${info.messageId})`);
      }
    } catch (err: any) {
      console.error(`[EMAIL SERVICE] ❌ Delivery failed to ${payload.recipientEmail}:`, err.message);
      status = 'FAILED';
      errorMessage = err.message;
    }

    // Record in EmailLog table
    const log = await prisma.emailLog.create({
      data: {
        recipientEmail: payload.recipientEmail,
        subject: payload.subject,
        type: payload.type,
        content: payload.content,
        status,
        transport: transportType,
        previewUrl,
        errorMessage,
      },
    });

    return {
      success: status !== 'FAILED',
      logId: log.id,
      transport: transportType,
      previewUrl,
      error: errorMessage,
    };
  }

  /**
   * HTML wrapper for clean, responsive, high-aesthetic emails
   */
  private static wrapHtml(title: string, bodyText: string, actionButton?: { text: string; url: string }): string {
    const formattedBody = bodyText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        if (line.startsWith('•') || line.startsWith('-')) {
          return `<li style="margin-bottom: 6px; color: #374151;">${line.replace(/^[•-]\s*/, '')}</li>`;
        }
        return `<p style="margin: 0 0 14px 0; line-height: 1.6; color: #1f2937; font-size: 14px;">${line}</p>`;
      })
      .join('');

    const buttonHtml = actionButton ? `
      <div style="margin: 28px 0; text-align: center;">
        <a href="${actionButton.url}" target="_blank" style="background-color: #09090b; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block; letter-spacing: 0.2px;">
          ${actionButton.text} &rarr;
        </a>
      </div>
      <p style="font-size: 11px; color: #6b7280; text-align: center; word-break: break-all; margin-top: 10px;">
        Or copy and paste this link in your browser:<br/>
        <a href="${actionButton.url}" style="color: #2563eb; text-decoration: underline;">${actionButton.url}</a>
      </p>
    ` : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5; padding: 32px 16px;">
          <tr>
            <td align="center">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e4e4e7; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <!-- Header Banner -->
                <tr>
                  <td style="background-color: #09090b; padding: 20px 28px; border-bottom: 2px solid #2563eb;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td>
                          <span style="color: #ffffff; font-weight: 800; font-size: 16px; letter-spacing: -0.5px;">TECHSCREEN <span style="color: #3b82f6;">PRO</span></span>
                        </td>
                        <td align="right">
                          <span style="color: #a1a1aa; font-size: 11px; font-family: monospace; text-transform: uppercase;">Automated Screening</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Content Area -->
                <tr>
                  <td style="padding: 28px 28px 24px 28px;">
                    ${formattedBody}
                    ${buttonHtml}
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #fafafa; padding: 18px 28px; border-top: 1px solid #f4f4f5; text-align: center;">
                    <p style="margin: 0; font-size: 11px; color: #71717a; line-height: 1.5;">
                      This is an automated communication from the TechScreen Pro evaluation platform.<br/>
                      Ensure your camera and microphone permissions are granted before starting.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `.trim();
  }

  /**
   * Render and send Assessment Invitation Email
   */
  static async sendInvitation(candidateName: string, candidateEmail: string, jobTitle: string, token: string, baseUrl: string) {
    const testUrl = `${baseUrl}/assessment/${token}`;
    const subject = `Technical Assessment Invitation – ${jobTitle}`;
    const content = `
Hello ${candidateName},

Thank you for applying for the ${jobTitle} position.

You have been shortlisted for our automated first-round technical assessment.

Assessment Overview:
• Position: ${jobTitle}
• Format: 60-Second Rapid Assessment per Question
• Proctoring: Camera, Microphone, and Screen Share Permissions Required
• Duration: ~15 to 30 minutes

Please click the button below to verify your email and access your secure assessment room:
    `.trim();

    const htmlContent = this.wrapHtml(subject, content, {
      text: 'Verify Identity & Start Assessment',
      url: testUrl,
    });

    return this.sendEmail({
      recipientEmail: candidateEmail,
      subject,
      type: 'INVITATION',
      content: `${content}\n\nStart URL: ${testUrl}`,
      htmlContent,
    });
  }

  /**
   * Send 6-Digit OTP Verification Email
   */
  static async sendOtp(candidateName: string, candidateEmail: string, jobTitle: string, otpCode: string, testUrl: string) {
    const subject = `Your Verification Passcode: ${otpCode} – TechScreen Assessment`;
    const content = `
Hello ${candidateName},

Here is your 6-digit access passkey to unlock your technical screening assessment for ${jobTitle}:

Access Passcode: ${otpCode}

Please enter this 6-digit code on the verification screen to begin. This passcode is unique to your session and expires shortly.
    `.trim();

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 32px 16px;">
          <tr>
            <td align="center">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e4e4e7; overflow: hidden;">
                <tr>
                  <td style="background-color: #09090b; padding: 18px 24px;">
                    <span style="color: #ffffff; font-weight: 800; font-size: 15px;">TECHSCREEN <span style="color: #3b82f6;">PRO</span></span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 28px 24px;">
                    <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #18181b;">Verification Code</h2>
                    <p style="margin: 0 0 20px 0; color: #52525b; font-size: 14px; line-height: 1.5;">
                      Hello <strong>${candidateName}</strong>, enter the 6-digit passcode below to verify your identity and access your technical assessment for <strong>${jobTitle}</strong>:
                    </p>
                    <div style="background-color: #f4f4f5; border: 2px dashed #3b82f6; border-radius: 8px; padding: 18px; text-align: center; margin: 20px 0;">
                      <span style="font-size: 32px; font-weight: 800; font-family: monospace; letter-spacing: 8px; color: #09090b;">${otpCode}</span>
                    </div>
                    <p style="margin: 0; color: #71717a; font-size: 12px; text-align: center;">
                      Do not share this code with anyone. It will expire in 15 minutes.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #fafafa; padding: 14px; border-top: 1px solid #f4f4f5; text-align: center; font-size: 11px; color: #a1a1aa;">
                    TechScreen Pro Security Engine &bull; Candidate ID Verification
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `.trim();

    return this.sendEmail({
      recipientEmail: candidateEmail,
      subject,
      type: 'OTP_VERIFICATION',
      content: `${content}\n\nPasscode: ${otpCode}\nAssessment URL: ${testUrl}`,
      htmlContent,
    });
  }

  /**
   * Send HR Notification when candidate passes
   */
  static async sendHrPassNotification(
    recruiterEmail: string,
    candidateName: string,
    jobTitle: string,
    scorePercentage: number,
    passThreshold: number,
    dashboardUrl = 'http://localhost:3000'
  ) {
    const subject = `[PASSED] Candidate Technical Screening – ${candidateName} (${scorePercentage}%)`;
    const content = `
Candidate Technical Screening Passed!

Candidate Name: ${candidateName}
Job Role: ${jobTitle}
Technical Score: ${scorePercentage}% (Threshold: ${passThreshold}%)
Recommendation: PROCEED TO HR INTERVIEW

Please log into the Recruiter Dashboard to review the complete performance breakdown, code submissions, and candidate resume.
    `.trim();

    const htmlContent = this.wrapHtml(subject, content, {
      text: 'Review Candidate in Dashboard',
      url: dashboardUrl,
    });

    return this.sendEmail({
      recipientEmail: recruiterEmail,
      subject,
      type: 'PASS_ALERT',
      content,
      htmlContent,
    });
  }

  /**
   * Send Recruiter Notification when candidate is flagged for MANUAL_REVIEW
   */
  static async sendManualReviewAlert(
    recruiterEmail: string,
    candidateName: string,
    jobTitle: string,
    scorePercentage: number,
    riskScore: number,
    riskLevel: string,
    reasons: string[],
    dashboardUrl = 'http://localhost:3000'
  ) {
    const subject = `[MANUAL REVIEW REQUIRED] Technical Screening – ${candidateName} (Risk: ${riskScore}/100)`;
    const reasonsList = reasons.length > 0 ? reasons.map(r => `• ${r}`).join('\n') : '• Proctoring risk threshold exceeded';
    const content = `
ACTION REQUIRED: Assessment Flagged for Manual Proctoring Review.

Candidate: ${candidateName}
Role: ${jobTitle}
Technical Score: ${scorePercentage}%
Proctoring Risk: ${riskScore}/100 (${riskLevel})

Flagged Events:
${reasonsList}

Please review the proctoring timeline and screen share events before approving or rejecting this candidate.
    `.trim();

    const htmlContent = this.wrapHtml(subject, content, {
      text: 'Inspect Proctoring Timeline',
      url: dashboardUrl,
    });

    return this.sendEmail({
      recipientEmail: recruiterEmail,
      subject,
      type: 'PASS_ALERT',
      content,
      htmlContent,
    });
  }

  /**
   * Send Polite Rejection Email
   */
  static async sendRejectionEmail(candidateName: string, candidateEmail: string, jobTitle: string) {
    const subject = `Update regarding your application for ${jobTitle}`;
    const content = `
Hello ${candidateName},

Thank you for taking the time to participate in our technical screening assessment for the ${jobTitle} position.

After careful review of your assessment results alongside our current hiring requirements, we will not be proceeding with your application at this stage.

We truly appreciate the time and effort you dedicated to completing the assessment and wish you the best in your career journey.

Sincerely,
The Hiring Team
    `.trim();

    const htmlContent = this.wrapHtml(subject, content);

    return this.sendEmail({
      recipientEmail: candidateEmail,
      subject,
      type: 'REJECTION',
      content,
      htmlContent,
    });
  }

  /**
   * Send Assessment Reminder Email
   */
  static async sendReminderEmail(candidateName: string, candidateEmail: string, jobTitle: string, token: string, baseUrl: string) {
    const testUrl = `${baseUrl}/assessment/${token}`;
    const subject = `Reminder: Technical Assessment Pending – ${jobTitle}`;
    const content = `
Hello ${candidateName},

This is a gentle reminder to complete your technical screening assessment for the ${jobTitle} role before your link expires.

Please ensure you have a working camera, microphone, and stable internet before starting.
    `.trim();

    const htmlContent = this.wrapHtml(subject, content, {
      text: 'Complete Assessment Now',
      url: testUrl,
    });

    return this.sendEmail({
      recipientEmail: candidateEmail,
      subject,
      type: 'REMINDER',
      content: `${content}\n\nLink: ${testUrl}`,
      htmlContent,
    });
  }

  /**
   * Send HR Interview Scheduled Email
   */
  static async sendInterviewInvite(candidateName: string, candidateEmail: string, jobTitle: string, scheduledDate: string, meetingUrl: string) {
    const subject = `HR Interview Scheduled – ${jobTitle}`;
    const content = `
Hi ${candidateName},

Congratulations! Based on your technical screening results, you have been shortlisted for an HR Interview for the position of ${jobTitle}.

Scheduled Date/Time: ${scheduledDate}
Meeting Link: ${meetingUrl}

Please be ready 5 minutes prior to the scheduled time.

Best regards,
TechScreen Pro Hiring Team
    `.trim();

    const htmlContent = this.wrapHtml(subject, content, {
      text: 'Join Video Interview',
      url: meetingUrl,
    });

    return this.sendEmail({
      recipientEmail: candidateEmail,
      subject,
      type: 'INTERVIEW_INVITE',
      content: `${content}\n\nJoin URL: ${meetingUrl}`,
      htmlContent,
    });
  }

  /**
   * Send Test Email to verify SMTP configuration
   */
  static async sendTestEmail(recipientEmail: string) {
    const subject = `TechScreen Pro – SMTP Configuration Test Delivery`;
    const content = `
Congratulations!

Your SMTP / Gmail mail transport is properly configured and successfully communicating with external mail servers.

Delivered to: ${recipientEmail}
Timestamp: ${new Date().toISOString()}

All technical assessment invitations, 6-digit verification passcodes, and recruiter alerts will now be dispatched live to their respective inboxes.
    `.trim();

    const htmlContent = this.wrapHtml(subject, content);

    return this.sendEmail({
      recipientEmail,
      subject,
      type: 'SYSTEM',
      content,
      htmlContent,
    });
  }
}
