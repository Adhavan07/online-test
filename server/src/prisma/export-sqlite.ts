import { prisma } from '../lib/prisma.js';
import fs from 'fs';
import path from 'path';

async function exportData() {
  console.log('🔄 Exporting SQLite data to JSON...');
  
  const companies = await prisma.company.findMany();
  const users = await prisma.user.findMany();
  const templates = await prisma.assessmentTemplate.findMany({
    include: {
      sections: {
        include: {
          questions: {
            include: {
              options: true,
            },
          },
        },
      },
    },
  });
  const jobs = await prisma.job.findMany();
  const candidates = await prisma.candidate.findMany();
  const applications = await prisma.jobApplication.findMany();
  const attempts = await prisma.assessmentAttempt.findMany({
    include: {
      answers: true,
      result: true,
      proctoringLogs: true,
    },
  });
  const recruiterNotes = await prisma.recruiterNote.findMany();
  const badges = await prisma.verifiedBadge.findMany();
  const interviewSessions = await prisma.liveInterviewSession.findMany();
  const emailLogs = await prisma.emailLog.findMany();
  const notifications = await prisma.notification.findMany();
  const settings = await prisma.systemSetting.findMany();
  const auditLogs = await prisma.auditLog.findMany();
  const webhooks = await prisma.webhookConfig.findMany();

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    companies,
    users,
    templates,
    jobs,
    candidates,
    applications,
    attempts,
    recruiterNotes,
    badges,
    interviewSessions,
    emailLogs,
    notifications,
    settings,
    auditLogs,
    webhooks,
  };

  const exportPath = path.join(process.cwd(), 'server', 'src', 'prisma', 'sqlite-data-export.json');
  fs.writeFileSync(exportPath, JSON.stringify(exportPayload, null, 2), 'utf-8');
  console.log(`✅ Successfully exported SQLite data to: ${exportPath}`);
  console.log(`Summary: ${companies.length} companies, ${jobs.length} jobs, ${candidates.length} candidates, ${applications.length} applications, ${attempts.length} attempts.`);
}

exportData()
  .catch((e) => {
    console.error('❌ Export failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
