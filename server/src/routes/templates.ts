import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const templatesRouter = Router();

/**
 * Get all assessment templates with section breakdown and question count
 */
templatesRouter.get('/', async (req, res) => {
  try {
    const templates = await prisma.assessmentTemplate.findMany({
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
 * Add a new question to a template section
 */
templatesRouter.post('/questions', async (req, res) => {
  const { sectionId, prompt, type, difficulty, explanation, options } = req.body;

  try {
    const newQuestion = await prisma.question.create({
      data: {
        sectionId,
        prompt,
        type: type || 'MCQ_SINGLE',
        difficulty: difficulty || 'MEDIUM',
        explanation,
        options: {
          create: options.map((opt: { text: string; isCorrect: boolean }) => ({
            text: opt.text,
            isCorrect: Boolean(opt.isCorrect)
          }))
        }
      },
      include: { options: true }
    });

    res.json({ success: true, question: newQuestion });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
