import { prisma } from '../lib/prisma.js';

export interface EmailPayload {
  recipientEmail: string;
  subject: string;
  type: 'INVITATION' | 'OTP_VERIFICATION' | 'PASS_ALERT' | 'REJECTION' | 'REMINDER';
  content: string;
}

export class EmailService {
  /**
   * Send an email notification and log it to the database.
   */
  static async sendEmail(payload: EmailPayload): Promise<{ success: boolean; logId: string }> {
    console.log(`[EMAIL SERVICE] Sending ${payload.type} to ${payload.recipientEmail}...`);
    
    // Save email to log for transparency in Phase 1
    const log = await prisma.emailLog.create({
      data: {
        recipientEmail: payload.recipientEmail,
        subject: payload.subject,
        type: payload.type,
        content: payload.content,
      },
    });

    return { success: true, logId: log.id };
  }

  /**
   * Render Assessment Invitation Email
   */
  static async sendInvitation(candidateName: string, candidateEmail: string, jobTitle: string, token: string, baseUrl: string) {
    const testUrl = `${baseUrl}/assessment/${token}`;
    const subject = `Technical Assessment Invitation – ${jobTitle}`;
    const content = `
Hello ${candidateName},

Thank you for applying for the ${jobTitle} position at our company.

You have been shortlisted for the technical assessment phase.

Assessment Details:
• Role: ${jobTitle}
• Questions: Role-Specific Technical MCQs (60 seconds per question)
• Proctoring: Browser System Check Required (Camera, Mic, Screen Share)

Please click the secure link below to verify your email and begin your assessment:
${testUrl}

Important: This secure link is unique to you and time-limited.

Best regards,
Hiring Team
    `.trim();

    return this.sendEmail({ recipientEmail: candidateEmail, subject, type: 'INVITATION', content });
  }

  /**
   * Send HR Notification when candidate passes
   */
  static async sendHrPassNotification(recruiterEmail: string, candidateName: string, jobTitle: string, scorePercentage: number, passThreshold: number) {
    const subject = `[PASSED] Candidate Technical Screening – ${candidateName} (${jobTitle})`;
    const content = `
Candidate Technical Screening Passed!

Candidate Name: ${candidateName}
Job Role: ${jobTitle}
Technical Score: ${scorePercentage}% (Threshold: ${passThreshold}%)
Recommendation: PROCEED TO HR INTERVIEW

Please log into the Recruiter Dashboard to review the complete performance breakdown and candidate resume.
    `.trim();

    return this.sendEmail({ recipientEmail: recruiterEmail, subject, type: 'PASS_ALERT', content });
  }
}
