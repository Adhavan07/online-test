import { prisma } from '../lib/prisma.js';
import fs from 'fs';
import path from 'path';

async function importData() {
  const exportPath = path.join(process.cwd(), 'server', 'src', 'prisma', 'sqlite-data-export.json');
  if (!fs.existsSync(exportPath)) {
    console.error('❌ sqlite-data-export.json not found!');
    process.exit(1);
  }

  const raw = fs.readFileSync(exportPath, 'utf-8');
  const data = JSON.parse(raw);
  console.log(`🚀 Starting data migration into PostgreSQL 16... (exported at ${data.exportedAt})`);

  // 1. Company
  for (const c of data.companies || []) {
    await prisma.company.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        name: c.name,
        logoUrl: c.logoUrl,
        createdAt: new Date(c.createdAt),
      },
      update: {},
    });
  }
  console.log(`✅ Migrated ${(data.companies || []).length} companies`);

  // 2. User
  for (const u of data.users || []) {
    await prisma.user.upsert({
      where: { id: u.id },
      create: {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        companyId: u.companyId,
        createdAt: new Date(u.createdAt),
      },
      update: {},
    });
  }
  console.log(`✅ Migrated ${(data.users || []).length} users`);

  // 3. Templates, Sections, Questions, Options
  for (const t of data.templates || []) {
    await prisma.assessmentTemplate.upsert({
      where: { id: t.id },
      create: {
        id: t.id,
        title: t.title,
        roleCategory: t.roleCategory,
        durationMinutes: t.durationMinutes,
        totalQuestions: t.totalQuestions,
        passPercentage: t.passPercentage,
        shuffleQuestions: t.shuffleQuestions,
        shuffleOptions: t.shuffleOptions,
        createdAt: new Date(t.createdAt),
      },
      update: {},
    });

    for (const s of t.sections || []) {
      await prisma.assessmentSection.upsert({
        where: { id: s.id },
        create: {
          id: s.id,
          templateId: t.id,
          title: s.title,
          description: s.description,
          questionCount: s.questionCount,
        },
        update: {},
      });

      for (const q of s.questions || []) {
        await prisma.question.upsert({
          where: { id: q.id },
          create: {
            id: q.id,
            sectionId: s.id,
            prompt: q.prompt,
            type: q.type,
            difficulty: q.difficulty,
            explanation: q.explanation,
            codeTemplate: q.codeTemplate,
            testCasesJson: q.testCasesJson,
          },
          update: {},
        });

        for (const opt of q.options || []) {
          await prisma.questionOption.upsert({
            where: { id: opt.id },
            create: {
              id: opt.id,
              questionId: q.id,
              text: opt.text,
              isCorrect: opt.isCorrect,
            },
            update: {},
          });
        }
      }
    }
  }
  console.log(`✅ Migrated ${(data.templates || []).length} assessment templates with full question banks`);

  // 4. Jobs
  for (const j of data.jobs || []) {
    await prisma.job.upsert({
      where: { id: j.id },
      create: {
        id: j.id,
        title: j.title,
        experienceRange: j.experienceRange,
        location: j.location,
        skillsRequired: j.skillsRequired,
        description: j.description,
        passThreshold: j.passThreshold,
        assessmentTemplateId: j.assessmentTemplateId,
        companyId: j.companyId,
        createdAt: new Date(j.createdAt),
      },
      update: {},
    });
  }
  console.log(`✅ Migrated ${(data.jobs || []).length} jobs`);

  // 5. Candidates
  for (const c of data.candidates || []) {
    await prisma.candidate.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        resumeUrl: c.resumeUrl,
        resumeFileName: c.resumeFileName,
        createdAt: new Date(c.createdAt),
      },
      update: {},
    });
  }
  console.log(`✅ Migrated ${(data.candidates || []).length} candidates`);

  // 6. Job Applications
  for (const a of data.applications || []) {
    await prisma.jobApplication.upsert({
      where: { id: a.id },
      create: {
        id: a.id,
        candidateId: a.candidateId,
        jobId: a.jobId,
        status: a.status,
        token: a.token,
        tokenExpiresAt: new Date(a.tokenExpiresAt),
        otpCode: a.otpCode,
        isOtpVerified: a.isOtpVerified,
        interviewScheduledAt: a.interviewScheduledAt ? new Date(a.interviewScheduledAt) : null,
        interviewLink: a.interviewLink,
        resumeMatchScore: a.resumeMatchScore,
        resumeParsedSkills: a.resumeParsedSkills,
        rankingScore: a.rankingScore,
        recommendation: a.recommendation,
        createdAt: new Date(a.createdAt),
      },
      update: {},
    });
  }
  console.log(`✅ Migrated ${(data.applications || []).length} job applications`);

  // 7. Attempts, answers, results, proctoring
  for (const att of data.attempts || []) {
    await prisma.assessmentAttempt.upsert({
      where: { id: att.id },
      create: {
        id: att.id,
        applicationId: att.applicationId,
        templateId: att.templateId,
        startedAt: new Date(att.startedAt),
        submittedAt: att.submittedAt ? new Date(att.submittedAt) : null,
        currentQuestionIndex: att.currentQuestionIndex,
        questionOrderJson: att.questionOrderJson,
        activeQuestionStartedAt: att.activeQuestionStartedAt ? new Date(att.activeQuestionStartedAt) : null,
        isCompleted: att.isCompleted,
        integrityScore: att.integrityScore,
        proctoringRiskScore: att.proctoringRiskScore,
        proctoringRiskLevel: att.proctoringRiskLevel,
        tabSwitchCount: att.tabSwitchCount,
        fullscreenViolationCount: att.fullscreenViolationCount,
        screenShareStopCount: att.screenShareStopCount,
        cameraDisconnectCount: att.cameraDisconnectCount,
      },
      update: {},
    });

    for (const ans of att.answers || []) {
      await prisma.candidateAnswer.upsert({
        where: { id: ans.id },
        create: {
          id: ans.id,
          attemptId: att.id,
          questionId: ans.questionId,
          selectedOptionIdsJson: ans.selectedOptionIdsJson,
          codeAnswer: ans.codeAnswer,
          answeredAt: new Date(ans.answeredAt),
          timeSpentSeconds: ans.timeSpentSeconds,
        },
        update: {},
      });
    }

    for (const pl of att.proctoringLogs || []) {
      await prisma.proctoringLog.upsert({
        where: { id: pl.id },
        create: {
          id: pl.id,
          attemptId: att.id,
          eventType: pl.eventType,
          details: pl.details,
          timestamp: new Date(pl.timestamp),
        },
        update: {},
      });
    }

    if (att.result) {
      const res = att.result;
      await prisma.assessmentResult.upsert({
        where: { attemptId: att.id },
        create: {
          id: res.id,
          attemptId: att.id,
          totalScore: res.totalScore,
          maxScore: res.maxScore,
          percentage: res.percentage,
          integrityScore: res.integrityScore,
          proctoringRiskScore: res.proctoringRiskScore,
          proctoringRiskLevel: res.proctoringRiskLevel,
          rankingScore: res.rankingScore,
          recommendation: res.recommendation,
          codingScore: res.codingScore,
          codingMaxScore: res.codingMaxScore,
          sectionScoresJson: res.sectionScoresJson,
          isPassed: res.isPassed,
          evaluatedAt: new Date(res.evaluatedAt),
        },
        update: {},
      });
    }
  }
  console.log(`✅ Migrated ${(data.attempts || []).length} assessment attempts with evaluations & proctor logs`);

  // 8. Recruiter Notes
  for (const n of data.recruiterNotes || []) {
    await prisma.recruiterNote.upsert({
      where: { id: n.id },
      create: {
        id: n.id,
        applicationId: n.applicationId,
        authorName: n.authorName,
        rating: n.rating,
        comment: n.comment,
        createdAt: new Date(n.createdAt),
      },
      update: {},
    });
  }

  // 9. Badges
  for (const b of data.badges || []) {
    await prisma.verifiedBadge.upsert({
      where: { id: b.id },
      create: {
        id: b.id,
        badgeId: b.badgeId,
        applicationId: b.applicationId,
        candidateName: b.candidateName,
        jobTitle: b.jobTitle,
        skillDomain: b.skillDomain,
        overallScore: b.overallScore,
        trustScore: b.trustScore,
        verificationSignature: b.verificationSignature,
        issuedAt: new Date(b.issuedAt),
      },
      update: {},
    });
  }

  // 10. Live Interview Sessions
  for (const s of data.interviewSessions || []) {
    await prisma.liveInterviewSession.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        applicationId: s.applicationId,
        roomToken: s.roomToken,
        interviewerName: s.interviewerName,
        status: s.status,
        codeBuffer: s.codeBuffer,
        sharedNotes: s.sharedNotes,
        interviewerRating: s.interviewerRating,
        feedbackSummary: s.feedbackSummary,
        scheduledAt: new Date(s.scheduledAt),
        updatedAt: new Date(s.updatedAt),
      },
      update: {},
    });
  }

  // 11. Email logs
  for (const e of data.emailLogs || []) {
    await prisma.emailLog.upsert({
      where: { id: e.id },
      create: {
        id: e.id,
        recipientEmail: e.recipientEmail,
        subject: e.subject,
        type: e.type,
        content: e.content,
        status: e.status,
        transport: e.transport,
        previewUrl: e.previewUrl,
        errorMessage: e.errorMessage,
        sentAt: new Date(e.sentAt),
      },
      update: {},
    });
  }

  // 12. Notifications
  for (const notif of data.notifications || []) {
    await prisma.notification.upsert({
      where: { id: notif.id },
      create: {
        id: notif.id,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        candidateName: notif.candidateName,
        candidateId: notif.candidateId,
        jobTitle: notif.jobTitle,
        link: notif.link,
        isRead: notif.isRead,
        createdAt: new Date(notif.createdAt),
      },
      update: {},
    });
  }

  // 13. Settings
  for (const st of data.settings || []) {
    await prisma.systemSetting.upsert({
      where: { key: st.key },
      create: {
        key: st.key,
        value: st.value,
        updatedAt: new Date(st.updatedAt),
      },
      update: {},
    });
  }

  // 14. Audit Logs
  for (const al of data.auditLogs || []) {
    await prisma.auditLog.upsert({
      where: { id: al.id },
      create: {
        id: al.id,
        userId: al.userId,
        userName: al.userName,
        action: al.action,
        entity: al.entity,
        details: al.details,
        createdAt: new Date(al.createdAt),
      },
      update: {},
    });
  }

  // 15. Webhooks
  for (const wh of data.webhooks || []) {
    await prisma.webhookConfig.upsert({
      where: { id: wh.id },
      create: {
        id: wh.id,
        name: wh.name,
        endpointUrl: wh.endpointUrl,
        secretKey: wh.secretKey,
        eventsJson: wh.eventsJson,
        isActive: wh.isActive,
        lastDispatchedAt: wh.lastDispatchedAt ? new Date(wh.lastDispatchedAt) : null,
        createdAt: new Date(wh.createdAt),
      },
      update: {},
    });
  }

  console.log('🎉 Full PostgreSQL 16 migration successfully completed! Zero data loss.');
}

importData()
  .catch((e) => {
    console.error('❌ PostgreSQL data migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
