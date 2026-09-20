import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';

export const legalRouter = Router();

/**
 * Helper: Mask email for privacy display (e.g. a***n@domain.com)
 */
function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length <= 2 
    ? name[0] + '***' 
    : name[0] + '***' + name[name.length - 1];
  return `${maskedName}@${domain}`;
}

/**
 * Generate a cryptographically secure, signed single-use unsubscribe token
 */
export async function generateUnsubscribeToken(email: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.unsubscribeToken.create({
    data: {
      tokenHash,
      email: email.trim().toLowerCase(),
      isUsed: false,
      expiresAt,
    },
  });

  return rawToken;
}

/**
 * GET /api/legal/config
 * Returns active legal entity configuration, DPO/Grievance Officer contact, and disclaimer.
 * Reads dynamically from environment/settings with zero hard-coded business identities.
 */
legalRouter.get('/config', async (req: Request, res: Response) => {
  const config = {
    legalEntityName: process.env.LEGAL_ENTITY_NAME || '[Configured by Workspace Administrator]',
    legalPostalAddress: process.env.LEGAL_POSTAL_ADDRESS || '[Configured Registered Address, India]',
    grievanceOfficer: {
      name: process.env.GRIEVANCE_OFFICER_NAME || '[Designated Grievance Officer]',
      email: process.env.GRIEVANCE_OFFICER_EMAIL || '[grievance-contact@configured-domain.local]',
      address: process.env.GRIEVANCE_OFFICER_ADDRESS || '[Grievance Officer Physical Address, India]',
      phone: process.env.GRIEVANCE_OFFICER_PHONE || null,
      redressalTimeline: 'Acknowledgment within 24 hours; resolution within 15 days as per Rule 3(2) of Information Technology (Intermediary Guidelines) Rules, 2021',
    },
    privacyPolicyVersion: 'DPDP-2025-v1.0',
    applicableFrameworks: [
      'Digital Personal Data Protection Act, 2023 (DPDP Act)',
      'Information Technology Act, 2000 & IT Intermediary Guidelines Rules, 2021',
      'Consumer Protection (Guidelines for Prevention and Regulation of Dark Patterns), 2023',
    ],
    lawyerReviewNotice: '/* [LAWYER_REVIEW] NOTE: Implementation placeholder for Indian operations. Final legal wording must be reviewed by an Indian privacy lawyer. */',
  };

  res.json({ success: true, config });
});

/**
 * GET /api/legal/policies
 * Returns structured legal notices, candidate terms, and proctoring advisory
 */
legalRouter.get('/policies', async (req: Request, res: Response) => {
  const entityName = process.env.LEGAL_ENTITY_NAME || '[Company / Data Fiduciary]';
  const grievanceEmail = process.env.GRIEVANCE_OFFICER_EMAIL || '[grievance-contact@configured-domain.local]';

  res.json({
    success: true,
    policies: {
      dpdpNotice: {
        title: 'Privacy Notice (Digital Personal Data Protection Act, 2023)',
        version: 'DPDP-2025-v1.0',
        summary: 'This Privacy Notice explains how personal data of candidates and recruiters is processed on this platform.',
        categoriesCollected: [
          'Identity & Contact Data: Name, email address, telephone number.',
          'Professional Data: Resume PDF, parsed skills, employment history, portfolio links.',
          'Assessment Performance: Answers, code submissions, test scores, question time-spent telemetry.',
          'Proctoring & Integrity Signals: Periodic webcam snapshots (if enabled for the test), tab switch counts, fullscreen exit events.',
          'Technical Logs: Timestamp of test actions, IP address, and browser user agent for anti-cheat verification and session security.',
        ],
        purposes: [
          'Verifying candidate identity and authenticating assessment sessions.',
          'Evaluating technical competency against job role requirements.',
          'Ensuring fair and uncompromised evaluation via automated proctoring telemetry.',
          'Facilitating recruitment communication and interview scheduling.',
        ],
        dataPrincipalRights: [
          'Right to Access: Request a summary of personal data processed by the platform.',
          'Right to Correction: Request correction of inaccurate or incomplete personal data.',
          'Right to Erasure: Request erasure of personal data when the hiring purpose is served, subject to statutory retention obligations.',
          'Right to Withdraw Consent: Withdraw consent to processing at any stage.',
          'Right to Grievance Redressal: Contact the designated Grievance Officer with any compliance concern.',
        ],
      },
      proctoringAdvisory: {
        title: 'Proctoring Telemetry & Algorithmic Signals Advisory',
        disclaimer: 'Notice: Automated proctoring flags (tab switches, gaze/facial movement signals) are algorithmic review indicators designed solely to assist human recruiter review. They do not constitute conclusive proof of academic or professional dishonesty.',
        safeguards: [
          'Candidate consent is required prior to starting any proctored assessment.',
          'Webcam snapshots are stored with tenant-level disk isolation and accessible only to authorized hiring personnel.',
          'Configurable data retention policies ensure media is purged once hiring evaluations are completed.',
        ],
      },
      grievanceProcedure: {
        officer: process.env.GRIEVANCE_OFFICER_NAME || '[Designated Grievance Officer]',
        email: grievanceEmail,
        redressalTimeline: '24-hour receipt acknowledgment; 15-day formal grievance resolution window.',
      },
      lawyerReviewDisclaimer: '/* [LAWYER_REVIEW] NOTE: Implementation placeholder for Indian operations. Final legal wording must be reviewed by an Indian privacy lawyer. */',
    },
  });
});

/**
 * GET /api/legal/unsubscribe
 * Validates a signed single-use unsubscribe token and returns status with masked email
 */
legalRouter.get('/unsubscribe', async (req: Request, res: Response) => {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ success: false, error: 'Invalid or missing unsubscribe token.' });
  }

  const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

  const tokenRecord = await prisma.unsubscribeToken.findUnique({
    where: { tokenHash },
  });

  if (!tokenRecord) {
    return res.status(404).json({ success: false, error: 'Unsubscribe link is invalid or has expired.' });
  }

  if (tokenRecord.isUsed) {
    return res.json({
      success: true,
      alreadyUnsubscribed: true,
      message: 'This email address has already been unsubscribed.',
      maskedEmail: maskEmail(tokenRecord.email),
    });
  }

  if (new Date() > tokenRecord.expiresAt) {
    return res.status(410).json({ success: false, error: 'This unsubscribe link has expired.' });
  }

  res.json({
    success: true,
    valid: true,
    maskedEmail: maskEmail(tokenRecord.email),
  });
});

/**
 * POST /api/legal/unsubscribe
 * Consumes the single-use token, marks it used, and adds the email to EmailSuppression
 */
legalRouter.post('/unsubscribe', async (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ success: false, error: 'Invalid or missing unsubscribe token.' });
  }

  const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

  const tokenRecord = await prisma.unsubscribeToken.findUnique({
    where: { tokenHash },
  });

  if (!tokenRecord) {
    return res.status(404).json({ success: false, error: 'Unsubscribe link is invalid or has expired.' });
  }

  if (tokenRecord.isUsed) {
    return res.status(400).json({
      success: false,
      error: 'This unsubscribe link has already been used or expired.',
      maskedEmail: maskEmail(tokenRecord.email),
    });
  }

  if (new Date() > tokenRecord.expiresAt) {
    return res.status(410).json({ success: false, error: 'This unsubscribe link has expired.' });
  }

  // Atomically mark token as used and add to suppression list
  await prisma.$transaction([
    prisma.unsubscribeToken.update({
      where: { id: tokenRecord.id },
      data: { isUsed: true },
    }),
    prisma.emailSuppression.upsert({
      where: { email: tokenRecord.email },
      update: { reason: 'USER_UNSUBSCRIBE' },
      create: {
        email: tokenRecord.email,
        reason: 'USER_UNSUBSCRIBE',
      },
    }),
    prisma.auditLog.create({
      data: {
        action: 'DPDP_MARKETING_UNSUBSCRIBE',
        entity: 'EmailSuppression',
        details: `Marketing email suppression requested via single-use token for ${maskEmail(tokenRecord.email)}`,
      },
    }),
  ]);

  res.json({
    success: true,
    message: 'You have been successfully unsubscribed from marketing and promotional communications.',
    maskedEmail: maskEmail(tokenRecord.email),
  });
});
