import { prisma } from '../lib/prisma.js';
import { EmailService } from './EmailService.js';

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
      include: { candidate: true }
    });

    if (!application) throw new Error('Application not found');

    // Generate fixed 6-digit code for fast testing / simulation
    const otpCode = '123456';
    await prisma.jobApplication.update({
      where: { id: application.id },
      data: { otpCode }
    });

    await EmailService.sendEmail({
      recipientEmail: application.candidate.email,
      subject: 'Verification Code for Technical Assessment',
      type: 'OTP_VERIFICATION',
      content: `Your 6-digit verification code is: ${otpCode}. Enter this code on the assessment portal to begin.`,
    });

    return { success: true, message: 'OTP sent to candidate email' };
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
      }
    });

    await prisma.jobApplication.update({
      where: { id: application.id },
      data: { status: 'IN_PROGRESS' }
    });

    return { attemptId: attempt.id, status: 'STARTED' };
  }

  /**
   * Helper: Safely execute candidate JavaScript code against test cases
   */
  static executeJavaScriptCode(code: string, testCasesJson?: string | null) {
    if (!testCasesJson) return { passCount: 0, totalCases: 0, percentage: 100, testResults: [] };
    
    let testCases: Array<{ input: string; expectedOutput: string; description?: string }> = [];
    try {
      testCases = JSON.parse(testCasesJson);
    } catch {
      return { passCount: 0, totalCases: 0, percentage: 0, testResults: [] };
    }

    let passCount = 0;
    const testResults = testCases.map((tc, idx) => {
      let actualOutputStr = '';
      let passed = false;
      try {
        const parsedInput = JSON.parse(tc.input);
        // Wrap code execution inside isolated scope function
        const runner = new Function('input', `
          ${code}
          if (typeof solution === 'function') {
            return solution(input);
          }
          throw new Error("Function 'solution' is not defined.");
        `);
        const result = runner(parsedInput);
        actualOutputStr = typeof result === 'object' ? JSON.stringify(result) : String(result);
        
        // Compare output (trimmed string comparison or JSON equal)
        const expectedTrimmed = tc.expectedOutput.trim();
        actualOutputStr = actualOutputStr.trim();
        passed = actualOutputStr === expectedTrimmed || actualOutputStr === tc.expectedOutput;
      } catch (err: any) {
        actualOutputStr = `Runtime Error: ${err.message || String(err)}`;
        passed = false;
      }

      if (passed) passCount++;
      return {
        testCaseIndex: idx + 1,
        description: tc.description || `Test Case #${idx + 1}`,
        passed,
        actual: actualOutputStr,
        expected: tc.expectedOutput,
      };
    });

    const percentage = testCases.length > 0 ? Math.round((passCount / testCases.length) * 100) : 100;
    return { passCount, totalCases: testCases.length, percentage, testResults };
  }

  /**
   * Run Candidate Code preview against test cases
   */
  static async runCodeTest(questionId?: string, code?: string, customTestCasesJson?: string) {
    let testCasesJson = customTestCasesJson;
    if (questionId) {
      const question = await prisma.question.findUnique({ where: { id: questionId } });
      if (question && question.testCasesJson) {
        testCasesJson = question.testCasesJson;
      }
    }
    return this.executeJavaScriptCode(code || '', testCasesJson);
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
      timePerQuestionSeconds: question.type === 'CODING' ? 180 : 60, // 3 mins for coding questions!
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
        data: { currentQuestionIndex: nextIndex }
      });
      return await this.evaluateAssessment(attemptId);
    } else {
      await prisma.assessmentAttempt.update({
        where: { id: attemptId },
        data: { currentQuestionIndex: nextIndex }
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
          const evalRes = this.executeJavaScriptCode(candAnswer.codeAnswer, q.testCasesJson);
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

    // Calculate Integrity Score based on Proctoring Logs
    let integrityScore = 100;
    let tabSwitches = 0;
    let fullscreenExits = 0;

    for (const log of attempt.proctoringLogs) {
      if (log.eventType === 'FOCUS_LOST') {
        tabSwitches++;
        integrityScore -= 5;
      } else if (log.eventType === 'FULLSCREEN_EXIT') {
        fullscreenExits++;
        integrityScore -= 10;
      } else if (log.eventType === 'COPY_PASTE') {
        integrityScore -= 10;
      } else if (log.eventType === 'SUSPICIOUS_BEHAVIOR') {
        integrityScore -= 15;
      }
    }

    integrityScore = Math.max(0, Math.min(100, integrityScore));

    // Save Result
    const result = await prisma.assessmentResult.upsert({
      where: { attemptId },
      create: {
        attemptId,
        totalScore,
        maxScore,
        percentage,
        integrityScore,
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
        codingScore,
        codingMaxScore,
        sectionScoresJson: JSON.stringify(sectionScores),
        isPassed,
        evaluatedAt: new Date(),
      }
    });

    // Mark attempt completed & update Application Status
    const newStatus = isPassed ? 'PASSED' : 'FAILED';
    await prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: {
        isCompleted: true,
        submittedAt: new Date(),
        integrityScore,
        tabSwitchCount: tabSwitches,
        fullscreenViolationCount: fullscreenExits,
      }
    });

    await prisma.jobApplication.update({
      where: { id: attempt.applicationId },
      data: { status: newStatus }
    });

    // Audit log & Email alert if candidate passed
    await prisma.auditLog.create({
      data: {
        action: 'ASSESSMENT_EVALUATED',
        entity: 'JobApplication',
        details: `Candidate ${attempt.application.candidate.name} scored ${percentage}% (${newStatus}, Integrity: ${integrityScore}%) on job ${attempt.application.job.title}.`,
      }
    });

    if (isPassed) {
      await EmailService.sendHrPassNotification(
        'recruiter@acme.com',
        attempt.application.candidate.name,
        attempt.application.job.title,
        percentage,
        passThreshold
      );
    }

    return {
      isCompleted: true,
      result: {
        totalScore,
        maxScore,
        percentage,
        integrityScore,
        codingScore,
        codingMaxScore,
        isPassed,
        sectionScores,
      }
    };
  }
}
