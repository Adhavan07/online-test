import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

export const templatesRouter = Router();

/**
 * Get all assessment templates with section breakdown and question count (RECRUITER / ADMIN)
 * Returns platform templates (global) and tenant-specific custom templates
 */
templatesRouter.get('/', authenticateToken, requireRole(['RECRUITER', 'ADMIN', 'TECH_INTERVIEWER']), async (req: AuthenticatedRequest, res) => {
  try {
    const isSuperAdmin = req.user?.role === 'ADMIN' && !req.user?.companyId;
    const where = isSuperAdmin ? {} : {
      OR: [
        { companyId: null },
        { companyId: req.user?.companyId || undefined }
      ]
    };

    const templates = await prisma.assessmentTemplate.findMany({
      where,
      include: {
        sections: {
          include: {
            questions: {
              include: {
                options: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = templates.map(t => ({
      id: t.id,
      title: t.title,
      roleCategory: t.roleCategory,
      durationMinutes: t.durationMinutes,
      totalQuestions: t.totalQuestions,
      passPercentage: t.passPercentage,
      companyId: t.companyId,
      sections: t.sections.map(s => ({
        id: s.id,
        title: s.title,
        description: s.description,
        questionCount: s.questionCount,
        questions: s.questions.map(q => ({
          id: q.id,
          prompt: q.prompt,
          type: q.type,
          difficulty: q.difficulty,
          explanation: q.explanation,
          optionsCount: q.options.length,
          options: q.options.map(o => ({
            id: o.id,
            text: o.text,
            isCorrect: o.isCorrect
          }))
        }))
      }))
    }));

    res.json({ success: true, templates: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Add a new question to a template section (RECRUITER / ADMIN)
 */
templatesRouter.post('/questions', authenticateToken, requireRole(['RECRUITER', 'ADMIN']), async (req: AuthenticatedRequest, res) => {
  const { sectionId, prompt, type, difficulty, explanation, options } = req.body;

  if (!sectionId || !prompt) {
    return res.status(400).json({ success: false, error: 'sectionId and prompt are required.' });
  }

  try {
    const section = await prisma.assessmentSection.findUnique({
      where: { id: sectionId },
      include: { template: true }
    });

    if (!section) {
      return res.status(404).json({ success: false, error: 'Assessment section not found.' });
    }

    const isSuperAdmin = req.user?.role === 'ADMIN' && !req.user?.companyId;
    if (!isSuperAdmin && section.template.companyId && req.user?.companyId && section.template.companyId !== req.user.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden: You do not have permission to modify this template.' });
    }

    const newQuestion = await prisma.question.create({
      data: {
        sectionId,
        prompt: String(prompt).trim(),
        type: type || 'MCQ_SINGLE',
        difficulty: difficulty || 'MEDIUM',
        explanation: explanation ? String(explanation).trim() : null,
        options: {
          create: (Array.isArray(options) ? options : []).map((opt: { text: string; isCorrect: boolean }) => ({
            text: String(opt.text).trim(),
            isCorrect: Boolean(opt.isCorrect)
          }))
        }
      },
      include: { options: true }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        userName: req.user?.name,
        companyId: req.user?.companyId,
        action: 'QUESTION_CREATED',
        entity: 'Question',
        details: `Added question to section ${sectionId}: "${prompt.slice(0, 50)}..."`,
      }
    });

    res.json({ success: true, question: newQuestion });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
