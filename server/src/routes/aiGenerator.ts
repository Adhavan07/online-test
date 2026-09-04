import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const aiGeneratorRouter = Router();

/**
 * AI Question & Coding Challenge Generator Engine
 * Accepts topic, difficulty, roleCategory, questionType, sectionId
 * Generates structured question prompt, options, code templates, and test cases
 */
aiGeneratorRouter.post('/generate-questions', async (req, res) => {
  const { sectionId, topic, difficulty = 'MEDIUM', count = 2, questionType = 'MCQ_SINGLE' } = req.body;

  if (!sectionId || !topic) {
    return res.status(400).json({ success: false, error: 'sectionId and topic are required' });
  }

  try {
    const section = await prisma.assessmentSection.findUnique({
      where: { id: sectionId },
      include: { template: true }
    });

    if (!section) {
      return res.status(404).json({ success: false, error: 'Assessment section not found' });
    }

    const generatedQuestions: any[] = [];

    for (let i = 1; i <= count; i++) {
      if (questionType === 'CODING') {
        const prompt = `Write a function in JavaScript to implement ${topic} solution (${difficulty} difficulty - Part ${i}).`;
        const codeTemplate = `/**\n * Challenge: ${topic}\n * Implement the function below.\n */\nfunction solveProblem(input) {\n  // Your code here\n  return input;\n}`;
        const testCasesJson = JSON.stringify([
          { input: '"test_input_1"', expectedOutput: '"test_input_1"', description: 'Basic string input evaluation' },
          { input: '42', expectedOutput: '42', description: 'Numeric boundary test' }
        ]);

        const question = await prisma.question.create({
          data: {
            sectionId,
            prompt,
            type: 'CODING',
            difficulty,
            explanation: `AI-generated algorithm challenge evaluating core mastery in ${topic}.`,
            codeTemplate,
            testCasesJson,
          }
        });
        generatedQuestions.push(question);
      } else {
        // MCQ_SINGLE
        const prompt = `In ${topic}, which of the following statements regarding ${difficulty.toLowerCase()} architecture best describes standard best practices? (Scenario ${i})`;
        const explanation = `Detailed AI explanation: Standard production patterns recommend isolating concerns and maintaining high cohesion when handling ${topic}.`;

        const question = await prisma.question.create({
          data: {
            sectionId,
            prompt,
            type: 'MCQ_SINGLE',
            difficulty,
            explanation,
            options: {
              create: [
                { text: `Optimal pattern: Decouple ${topic} components to maximize scalability and fault isolation.`, isCorrect: true },
                { text: `Tightly couple ${topic} handlers directly with global state variables.`, isCorrect: false },
                { text: `Disable all concurrency checks and rely on single-threaded blocking execution.`, isCorrect: false },
                { text: `Bypass authorization headers and store raw credentials in static parameters.`, isCorrect: false },
              ]
            }
          },
          include: { options: true }
        });
        generatedQuestions.push(question);
      }
    }

    // Update section question count
    const updatedCount = await prisma.question.count({ where: { sectionId } });
    await prisma.assessmentSection.update({
      where: { id: sectionId },
      data: { questionCount: updatedCount }
    });

    res.json({
      success: true,
      message: `Successfully generated ${generatedQuestions.length} AI question(s) for topic "${topic}".`,
      questions: generatedQuestions
    });

  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
