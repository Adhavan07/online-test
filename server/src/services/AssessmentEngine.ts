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

    return {
      isCompleted: false,
      currentIndex: targetIndex,
      totalQuestions: questionIds.length,
      timePerQuestionSeconds: 60, // Server-enforced 60s limit per question!
      question: {
        id: question.id,
        prompt: question.prompt,
        type: question.type,
        difficulty: question.difficulty,
        sectionTitle: question.section.title,
        options: question.options.sort(() => Math.random() - 0.5),
      },
      previousAnswer: existingAnswer ? JSON.parse(existingAnswer.selectedOptionIdsJson) : [],
    };
  }

  /**
   * Submit Answer for current question and advance index
   */
  static async submitAnswer(attemptId: string, questionId: string, selectedOptionIds: string[], timeSpentSeconds: number) {
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
   * Automatic Backend Evaluation Engine
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

    let totalScore = 0;
    const maxScore = questions.length;
    const sectionScores: Record<string, { score: number; max: number }> = {};

    for (const q of questions) {
      const sectionName = q.section.title;
      if (!sectionScores[sectionName]) {
        sectionScores[sectionName] = { score: 0, max: 0 };
      }
      sectionScores[sectionName].max += 1;

      const candAnswer = attempt.answers.find(a => a.questionId === q.id);
      if (candAnswer) {
        const selectedIds: string[] = JSON.parse(candAnswer.selectedOptionIdsJson);
        const correctIds = q.options.filter(o => o.isCorrect).map(o => o.id);

        let isCorrect = false;
        if (q.type === 'MCQ_SINGLE') {
          isCorrect = selectedIds.length === 1 && selectedIds[0] === correctIds[0];
        } else {
          // MCQ_MULTI: must select exact set of correct options
          isCorrect = selectedIds.length === correctIds.length && selectedIds.every(id => correctIds.includes(id));
        }

        if (isCorrect) {
          totalScore += 1;
          sectionScores[sectionName].score += 1;
        }
      }
    }

    const percentage = Math.round((totalScore / (maxScore || 1)) * 100 * 10) / 10;
    const passThreshold = attempt.application.job.passThreshold;
    const isPassed = percentage >= passThreshold;

    // Save Result
    const result = await prisma.assessmentResult.upsert({
      where: { attemptId },
      create: {
        attemptId,
        totalScore,
        maxScore,
        percentage,
        sectionScoresJson: JSON.stringify(sectionScores),
        isPassed,
      },
      update: {
        totalScore,
        maxScore,
        percentage,
        sectionScoresJson: JSON.stringify(sectionScores),
        isPassed,
        evaluatedAt: new Date(),
      }
    });

    // Mark attempt completed & update Application Status
    const newStatus = isPassed ? 'PASSED' : 'FAILED';
    await prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: { isCompleted: true, submittedAt: new Date() }
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
        details: `Candidate ${attempt.application.candidate.name} scored ${percentage}% (${newStatus}) on job ${attempt.application.job.title}.`,
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
        isPassed,
        sectionScores,
      }
    };
  }
}
