import { prisma } from '../lib/prisma.js';
import { ResumeMatchingService } from './ResumeMatchingService.js';
import { EmailService } from './EmailService.js';
import { NotificationService } from './NotificationService.js';
import { CodeExecutionService } from './CodeExecutionService.js';

export class AssessmentEngine {
  /**
   * Verify Assessment Token and return candidate assessment details
   */
  static async verifyToken(token: string) {
    const application = await prisma.jobApplication.findUnique({
      where: { token },
      include: {
        candidate: true,
        job: {
          include: {
            company: true,
            assessmentTemplate: {
              include: {
                sections: {
                  include: {
                    questions: {
                      select: { id: true }
                    }
                  }
                }
              }
            }
          }
        },
        attempts: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          include: {
            result: true
          }
        }
      }
    });

    if (!application) {
      throw new Error('Invalid or expired assessment link.');
    }

    if (new Date() > application.tokenExpiresAt) {
      throw new Error('Assessment link has expired.');
    }

    const template = application.job.assessmentTemplate;
    const latestAttempt = application.attempts[0] || null;

    return {
      applicationId: application.id,
      token: application.token,
      candidate: {
        id: application.candidate.id,
        name: application.candidate.name,
        email: application.candidate.email,
      },
      job: {
        id: application.job.id,
        title: application.job.title,
        experienceRange: application.job.experienceRange,
        companyName: application.job.company.name,
        passThreshold: application.job.passThreshold,
      },
      template: template ? {
        id: template.id,
        title: template.title,
        durationMinutes: template.durationMinutes,
        totalQuestions: template.totalQuestions,
        sections: template.sections.map(s => ({
          id: s.id,
          title: s.title,
          description: s.description,
          questionCount: s.questions.length,
        }))
      } : null,
      status: application.status,
      isOtpVerified: application.isOtpVerified,
      latestAttempt: latestAttempt ? {
        id: latestAttempt.id,
        isCompleted: latestAttempt.isCompleted,
        result: latestAttempt.result,
      } : null,
    };
  }

  /**
   * Send 6-digit OTP to Candidate
   */
  static async sendOtp(token: string) {
    const application = await prisma.jobApplication.findUnique({
      where: { token },
      include: { candidate: true, job: true }
    });

    if (!application) throw new Error('Application not found');

    // Generate fixed 6-digit code or random for testing
    const otpCode = '123456';
    await prisma.jobApplication.update({
      where: { id: application.id },
      data: { otpCode }
    });

    const testUrl = `http://localhost:3000/assessment/${token}`;
    const emailResult = await EmailService.sendOtp(
      application.candidate.name,
      application.candidate.email,
      application.job?.title || 'Technical Assessment',
      otpCode,
      testUrl
    );

    return { 
      success: true, 
      message: `OTP sent to ${application.candidate.email}`,
      emailResult
    };
  }

  /**
   * Verify Candidate OTP
   */
  static async verifyOtp(token: string, otpCode: string) {
    const application = await prisma.jobApplication.findUnique({ where: { token } });
    if (!application) throw new Error('Application not found');

    // Allow '123456' as master bypass OTP for smooth demonstration
    if (otpCode !== '123456' && application.otpCode !== otpCode) {
      throw new Error('Invalid verification code. Please try again.');
    }

    await prisma.jobApplication.update({
      where: { id: application.id },
      data: { isOtpVerified: true }
    });

    return { success: true, isOtpVerified: true };
  }

  /**
   * Start or Resume Assessment Attempt
   */
  static async startAttempt(token: string) {
    const application = await prisma.jobApplication.findUnique({
      where: { token },
      include: {
        candidate: true,
        job: {
          include: {
            assessmentTemplate: {
              include: {
                sections: {
                  include: {
                    questions: true
                  }
                }
              }
            }
          }
        },
        attempts: {
          where: { isCompleted: false },
          take: 1
        }
      }
    });

    if (!application) throw new Error('Application not found');
    if (!application.isOtpVerified) throw new Error('Email verification required before starting test.');

    const template = application.job.assessmentTemplate;
    if (!template) throw new Error('No assessment template attached to this job opening.');

    // Check if active attempt already exists
    if (application.attempts.length > 0) {
      const activeAttempt = application.attempts[0];
      return { attemptId: activeAttempt.id, status: 'RESUMED' };
    }

    // Build question pool sequence
    const allQuestions: string[] = [];
    for (const section of template.sections) {
      let qList = [...section.questions];
      if (template.shuffleQuestions) {
        qList = qList.sort(() => Math.random() - 0.5);
      }
      const selected = qList.slice(0, section.questionCount);
      allQuestions.push(...selected.map(q => q.id));
    }

    const attempt = await prisma.assessmentAttempt.create({
      data: {
        applicationId: application.id,
        templateId: template.id,
        startedAt: new Date(),
        currentQuestionIndex: 0,
        questionOrderJson: JSON.stringify(allQuestions),
        isCompleted: false,
      },
      include: {
        answers: true,
        proctoringLogs: true,
      }
    });

    await prisma.jobApplication.update({
      where: { id: application.id },
      data: { status: 'IN_PROGRESS' }
    });

    // Dispatch in-app notification when assessment is started
    await NotificationService.createNotification({
      type: 'TEST_STARTED',
      title: 'Assessment Started',
      message: `${application.candidate.name} has begun technical assessment for ${application.job.title}`,
      candidateName: application.candidate.name,
      candidateId: application.candidate.id,
      jobTitle: application.job.title,
      link: `/assessment/${token}`,
    });

    return { attemptId: attempt.id, status: 'STARTED' };
  }

  /**
   * Safely execute candidate code in isolated sub-process with strict timeout and sandbox limits
   */
  static async executeCode(
    code: string,
    testCasesJson?: string | null,
    language?: 'javascript' | 'typescript' | 'python',
    maskHiddenDetails: boolean = false
  ) {
    const detectedLang = language || (code.includes('def ') ? 'python' : 'javascript');
    return CodeExecutionService.executeCode(code, testCasesJson, detectedLang, maskHiddenDetails);
  }

  /**
   * Helper alias for backward compatibility
   */
  static async executeJavaScriptCode(code: string, testCasesJson?: string | null) {
    return this.executeCode(code, testCasesJson, 'javascript', false);
  }

  /**
   * Run Candidate Code preview against test cases
   */
  static async runCodeTest(
    questionId?: string,
    code?: string,
    customTestCasesJson?: string,
    language?: 'javascript' | 'typescript' | 'python'
  ) {
    let testCasesJson = customTestCasesJson;
    if (questionId) {
      const question = await prisma.question.findUnique({ where: { id: questionId } });
      if (question && question.testCasesJson) {
        testCasesJson = question.testCasesJson;
      }
    }
    return this.executeCode(code || '', testCasesJson, language, true);
  }

  /**
   * Fetch current question details for candidate (Timer = 60s per question)
   */
  static async getQuestionAtIndex(attemptId: string, index?: number) {
    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: {
        application: {
          include: {
            job: true
          }
        },
        answers: true,
        proctoringLogs: true,
      }
    });

    if (!attempt) throw new Error('Attempt not found');
    if (attempt.isCompleted) {
      return { isCompleted: true };
    }

    const questionIds: string[] = JSON.parse(attempt.questionOrderJson);
    const targetIndex = index !== undefined ? index : attempt.currentQuestionIndex;

    if (targetIndex >= questionIds.length) {
      // Completed! Trigger evaluation
      await this.evaluateAssessment(attemptId);
      return { isCompleted: true };
    }

    const questionId = questionIds[targetIndex];
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        section: true,
        options: {
          select: {
            id: true,
            text: true,
            // Exclude isCorrect to prevent client-side cheating!
          }
        }
      }
    });

    if (!question) throw new Error('Question not found');

    // Server-Controlled 60-Second Question Timer (Anti-Tamper & Refresh-Safe)
    const now = new Date();
    let activeStartedAt = attempt.activeQuestionStartedAt;

    if (!activeStartedAt || attempt.currentQuestionIndex !== targetIndex) {
      activeStartedAt = now;
      await prisma.assessmentAttempt.update({
        where: { id: attemptId },
        data: {
          currentQuestionIndex: targetIndex,
          activeQuestionStartedAt: now,
        }
      });
    }

    const allowedDuration = question.type === 'CODING' ? 180 : 60;
    const elapsedSeconds = Math.floor((now.getTime() - new Date(activeStartedAt).getTime()) / 1000);
    const remainingSeconds = Math.max(0, allowedDuration - elapsedSeconds);

    // Check if already answered
    const existingAnswer = attempt.answers.find(a => a.questionId === questionId);

    // Format public test cases preview if question type is CODING
    let sampleTestCases: Array<{ description: string; input: string }> = [];
    if (question.type === 'CODING' && question.testCasesJson) {
      try {
        const fullCases = JSON.parse(question.testCasesJson);
        sampleTestCases = fullCases.map((tc: any, i: number) => ({
          description: tc.description || `Test Case #${i + 1}`,
          input: tc.input,
        }));
      } catch {}
    }

    return {
      isCompleted: false,
      currentIndex: targetIndex,
      totalQuestions: questionIds.length,
      timePerQuestionSeconds: allowedDuration,
      remainingSeconds,
      activeQuestionStartedAt: activeStartedAt,
      question: {
        id: question.id,
        prompt: question.prompt,
        type: question.type,
        difficulty: question.difficulty,
        sectionTitle: question.section.title,
        codeTemplate: question.codeTemplate,
        sampleTestCases,
        options: question.options.sort(() => Math.random() - 0.5),
      },
      previousAnswer: existingAnswer ? JSON.parse(existingAnswer.selectedOptionIdsJson) : [],
      previousCodeAnswer: existingAnswer?.codeAnswer || question.codeTemplate || '',
      proctoringViolationsCount: attempt.proctoringLogs.length,
    };
  }

  /**
   * Submit Answer for current question and advance index
   */
  static async submitAnswer(
    attemptId: string,
    questionId: string,
    selectedOptionIds: string[],
    timeSpentSeconds: number,
    codeAnswer?: string
  ) {
    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: attemptId }
    });

    if (!attempt || attempt.isCompleted) {
      throw new Error('Attempt is invalid or already completed');
    }

    const questionIds: string[] = JSON.parse(attempt.questionOrderJson);
    const currentIndex = questionIds.indexOf(questionId);

    // Record or update candidate answer
    const existing = await prisma.candidateAnswer.findFirst({
      where: { attemptId, questionId }
    });

    if (existing) {
      await prisma.candidateAnswer.update({
        where: { id: existing.id },
        data: {
          selectedOptionIdsJson: JSON.stringify(selectedOptionIds),
          codeAnswer: codeAnswer || existing.codeAnswer,
          timeSpentSeconds,
          answeredAt: new Date(),
        }
      });
    } else {
      await prisma.candidateAnswer.create({
        data: {
          attemptId,
          questionId,
          selectedOptionIdsJson: JSON.stringify(selectedOptionIds),
          codeAnswer: codeAnswer || null,
          timeSpentSeconds,
          answeredAt: new Date(),
        }
      });
    }

    const nextIndex = (currentIndex >= 0 ? currentIndex : attempt.currentQuestionIndex) + 1;

    if (nextIndex >= questionIds.length) {
      // Last question submitted -> execute server evaluation immediately
      await prisma.assessmentAttempt.update({
        where: { id: attemptId },
        data: { currentQuestionIndex: nextIndex, activeQuestionStartedAt: null }
      });
      return await this.evaluateAssessment(attemptId);
    } else {
      await prisma.assessmentAttempt.update({
        where: { id: attemptId },
        data: { currentQuestionIndex: nextIndex, activeQuestionStartedAt: null }
      });
      return { isCompleted: false, nextIndex };
    }
  }

  /**
   * Automatic Backend Evaluation Engine with Proctoring Integrity Scoring
   */
  static async evaluateAssessment(attemptId: string) {
    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: {
        application: {
          include: {
            candidate: true,
            job: {
              include: {
                company: true
              }
            }
          }
        },
        answers: true,
        proctoringLogs: true,
      }
    });

    if (!attempt) throw new Error('Attempt not found');

    const questionIds: string[] = JSON.parse(attempt.questionOrderJson);
    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      include: {
        section: true,
        options: true,
      }
    });

    let mcqScore = 0;
    let mcqMaxScore = 0;
    let codingScore = 0;
    let codingMaxScore = 0;

    const sectionScores: Record<string, { score: number; max: number }> = {};

    for (const q of questions) {
      const sectionName = q.section.title;
      if (!sectionScores[sectionName]) {
        sectionScores[sectionName] = { score: 0, max: 0 };
      }

      const candAnswer = attempt.answers.find(a => a.questionId === q.id);

      if (q.type === 'CODING') {
        const itemMaxScore = 10;
        codingMaxScore += itemMaxScore;
        sectionScores[sectionName].max += itemMaxScore;

        if (candAnswer && candAnswer.codeAnswer) {
          const evalRes = await this.executeCode(
            candAnswer.codeAnswer,
            q.testCasesJson,
            candAnswer.codeAnswer.includes('def ') ? 'python' : 'javascript',
            false
          );
          const earned = Math.round((evalRes.percentage / 100) * itemMaxScore);
          codingScore += earned;
          sectionScores[sectionName].score += earned;
        }
      } else {
        // MCQ Questions
        mcqMaxScore += 1;
        sectionScores[sectionName].max += 1;

        if (candAnswer) {
          const selectedIds: string[] = JSON.parse(candAnswer.selectedOptionIdsJson || '[]');
          const correctIds = q.options.filter(o => o.isCorrect).map(o => o.id);

          let isCorrect = false;
          if (q.type === 'MCQ_SINGLE') {
            isCorrect = selectedIds.length === 1 && selectedIds[0] === correctIds[0];
          } else {
            isCorrect = selectedIds.length === correctIds.length && selectedIds.every(id => correctIds.includes(id));
          }

          if (isCorrect) {
            mcqScore += 1;
            sectionScores[sectionName].score += 1;
          }
        }
      }
    }

    const totalScore = mcqScore + codingScore;
    const maxScore = mcqMaxScore + codingMaxScore;
    const percentage = Math.round((totalScore / (maxScore || 1)) * 100 * 10) / 10;
    const passThreshold = attempt.application.job.passThreshold;
    const isPassed = percentage >= passThreshold;

    // Calculate Weighted Proctoring Risk Score (Section 19 of Master Spec)
    let rawRiskScore = 0;
    let tabSwitches = 0;
    let fullscreenExits = 0;
    let screenShareStops = 0;
    let cameraDisconnections = 0;
    const flagReasons: string[] = [];

    for (const log of attempt.proctoringLogs) {
      switch (log.eventType) {
        case 'FOCUS_LOST':
          tabSwitches++;
          rawRiskScore += 10;
          break;
        case 'WINDOW_BLUR':
          rawRiskScore += 5;
          break;
        case 'FULLSCREEN_EXIT':
          fullscreenExits++;
          rawRiskScore += 10;
          break;
        case 'SCREEN_SHARE_STOPPED':
          screenShareStops++;
          rawRiskScore += 30;
          break;
        case 'CAMERA_DISABLED':
          cameraDisconnections++;
          rawRiskScore += 20;
          break;
        case 'MIC_DISABLED':
          rawRiskScore += 10;
          break;
        case 'COPY_PASTE':
          rawRiskScore += 15;
          break;
        case 'RIGHT_CLICK':
          rawRiskScore += 5;
          break;
        case 'SUSPICIOUS_BEHAVIOR':
          rawRiskScore += 15;
          break;
        default:
          rawRiskScore += 5;
          break;
      }
    }

    if (tabSwitches > 0) flagReasons.push(`${tabSwitches} tab switch(es) detected`);
    if (fullscreenExits > 0) flagReasons.push(`${fullscreenExits} fullscreen exit violation(s)`);
    if (screenShareStops > 0) flagReasons.push(`Screen sharing was stopped ${screenShareStops} time(s)`);
    if (cameraDisconnections > 0) flagReasons.push(`Camera was disconnected ${cameraDisconnections} time(s)`);

    const proctoringRiskScore = Math.min(100, Math.max(0, rawRiskScore));
    const integrityScore = Math.max(0, 100 - proctoringRiskScore);

    let proctoringRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (proctoringRiskScore >= 61) {
      proctoringRiskLevel = 'HIGH';
    } else if (proctoringRiskScore >= 31) {
      proctoringRiskLevel = 'MEDIUM';
    }

    // Evaluate Resume Matching & Composite Ranking (Section 29 & 30)
    let jobSkillsRequired: string[] = [];
    try {
      jobSkillsRequired = JSON.parse(attempt.application.job.skillsRequired || '[]');
    } catch {
      jobSkillsRequired = ['Git', 'Linux', 'Docker', 'Kubernetes', 'CI/CD'];
    }

    const candidateResumeText = `${attempt.application.candidate.name} ${attempt.application.candidate.resumeFileName || ''}`;
    const resumeMatch = ResumeMatchingService.evaluateResumeMatch(
      candidateResumeText,
      jobSkillsRequired
    );

    // Initial Status Determination:
    // If score >= passThreshold:
    //   - If High Risk -> MANUAL_REVIEW
    //   - Else -> PASSED
    // Else -> FAILED
    let newStatus: string = 'FAILED';
    if (isPassed) {
      if (proctoringRiskLevel === 'HIGH' || proctoringRiskScore >= 60) {
        newStatus = 'MANUAL_REVIEW';
      } else {
        newStatus = 'PASSED';
      }
    } else {
      newStatus = 'FAILED';
    }

    const ranking = ResumeMatchingService.calculateCandidateRanking({
      technicalScore: percentage,
      resumeMatchScore: resumeMatch.matchScore,
      proctoringRiskScore,
      passThreshold,
      currentStatus: newStatus,
    });

    // Save Assessment Result
    const result = await prisma.assessmentResult.upsert({
      where: { attemptId },
      create: {
        attemptId,
        totalScore,
        maxScore,
        percentage,
        integrityScore,
        proctoringRiskScore,
        proctoringRiskLevel,
        rankingScore: ranking.rankingScore,
        recommendation: ranking.recommendation,
        codingScore,
        codingMaxScore,
        sectionScoresJson: JSON.stringify(sectionScores),
        isPassed,
      },
      update: {
        totalScore,
        maxScore,
        percentage,
        integrityScore,
        proctoringRiskScore,
        proctoringRiskLevel,
        rankingScore: ranking.rankingScore,
        recommendation: ranking.recommendation,
        codingScore,
        codingMaxScore,
        sectionScoresJson: JSON.stringify(sectionScores),
        isPassed,
        evaluatedAt: new Date(),
      }
    });

    // Mark attempt completed & update Application Status & Ranking
    await prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: {
        isCompleted: true,
        submittedAt: new Date(),
        integrityScore,
        proctoringRiskScore,
        proctoringRiskLevel,
        tabSwitchCount: tabSwitches,
        fullscreenViolationCount: fullscreenExits,
        screenShareStopCount: screenShareStops,
        cameraDisconnectCount: cameraDisconnections,
        activeQuestionStartedAt: null,
      }
    });

    await prisma.jobApplication.update({
      where: { id: attempt.applicationId },
      data: {
        status: newStatus,
        resumeMatchScore: resumeMatch.matchScore,
        resumeParsedSkills: JSON.stringify(resumeMatch.matchedSkills),
        rankingScore: ranking.rankingScore,
        recommendation: ranking.recommendation,
      }
    });

    // Audit log & Notifications
    await prisma.auditLog.create({
      data: {
        action: 'ASSESSMENT_EVALUATED',
        entity: 'JobApplication',
        details: `Candidate ${attempt.application.candidate.name} evaluated: Score ${percentage}%, Status ${newStatus}, Risk ${proctoringRiskScore}/100 (${proctoringRiskLevel}), Recommendation: ${ranking.recommendationLabel}.`,
      }
    });

    if (newStatus === 'MANUAL_REVIEW') {
      await EmailService.sendManualReviewAlert(
        'recruiter@acme.com',
        attempt.application.candidate.name,
        attempt.application.job.title,
        percentage,
        proctoringRiskScore,
        proctoringRiskLevel,
        flagReasons
      );
      await NotificationService.createNotification({
        type: 'MANUAL_REVIEW',
        title: '🚨 Manual Review Flagged',
        message: `${attempt.application.candidate.name} scored ${percentage}% on ${attempt.application.job.title} but triggered High Proctoring Risk (${proctoringRiskScore}/100)`,
        candidateName: attempt.application.candidate.name,
        candidateId: attempt.application.candidate.id,
        jobTitle: attempt.application.job.title,
      });
    } else if (newStatus === 'PASSED') {
      await EmailService.sendHrPassNotification(
        'recruiter@acme.com',
        attempt.application.candidate.name,
        attempt.application.job.title,
        percentage,
        passThreshold
      );
      await NotificationService.createNotification({
        type: 'TEST_PASSED',
        title: '✅ Candidate Passed Screening',
        message: `${attempt.application.candidate.name} passed ${attempt.application.job.title} with score ${percentage}% (Shortlisted)`,
        candidateName: attempt.application.candidate.name,
        candidateId: attempt.application.candidate.id,
        jobTitle: attempt.application.job.title,
      });
    } else {
      await NotificationService.createNotification({
        type: 'TEST_FAILED',
        title: '❌ Assessment Failed',
        message: `${attempt.application.candidate.name} completed ${attempt.application.job.title} with score ${percentage}% (Below pass threshold ${passThreshold}%)`,
        candidateName: attempt.application.candidate.name,
        candidateId: attempt.application.candidate.id,
        jobTitle: attempt.application.job.title,
      });
    }

    return {
      isCompleted: true,
      result: {
        totalScore,
        maxScore,
        percentage,
        integrityScore,
        proctoringRiskScore,
        proctoringRiskLevel,
        rankingScore: ranking.rankingScore,
        recommendation: ranking.recommendation,
        recommendationLabel: ranking.recommendationLabel,
        resumeMatchScore: resumeMatch.matchScore,
        matchedSkills: resumeMatch.matchedSkills,
        missingSkills: resumeMatch.missingSkills,
        codingScore,
        codingMaxScore,
        isPassed,
        sectionScores,
        status: newStatus,
      }
    };
  }
}
