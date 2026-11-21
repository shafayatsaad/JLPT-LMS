import { z } from "zod";

export const jlptLevelSchema = z.enum(["N1", "N2", "N3", "N4", "N5"]);
export const contentStatusSchema = z.enum([
  "draft",
  "needs_review",
  "approved",
  "eligible_for_exam",
  "rejected",
  "retired",
]);

const textBlockSchema = z.object({
  type: z.literal("text"),
  text: z.string().min(1),
  ruby: z.array(z.object({ base: z.string().min(1), reading: z.string().min(1) })).optional(),
});

const imageBlockSchema = z.object({
  type: z.literal("image"),
  assetId: z.string().uuid(),
  alt: z.string().min(1),
});

const audioBlockSchema = z.object({
  type: z.literal("audio"),
  assetId: z.string().uuid(),
  playbackPolicy: z.enum(["once", "limited", "repeatable"]),
});

export const questionContentBlockSchema = z.discriminatedUnion("type", [
  textBlockSchema,
  imageBlockSchema,
  audioBlockSchema,
]);

const answerOptionSchema = z.object({
  id: z.string().min(1).max(12),
  content: z.array(questionContentBlockSchema).min(1),
});

const questionRevisionFields = z.object({
    schemaVersion: z.literal(1),
    contentKey: z.string().uuid(),
    revision: z.number().int().positive(),
    level: jlptLevelSchema,
    testSectionCode: z.string().min(1),
    scoreCategoryCode: z.string().min(1),
    itemTypeCode: z.string().min(1),
    difficultyEstimate: z.number().int().min(1).max(5),
    stimulusGroupId: z.string().uuid().optional(),
    prompt: z.array(questionContentBlockSchema).min(1),
    options: z.array(answerOptionSchema).min(2),
    correctOptionId: z.string().min(1),
    explanation: z.object({
      correctAnswer: z.string().min(1),
      distractors: z.array(z.object({ optionId: z.string().min(1), rationale: z.string().min(1) })),
    }),
    tags: z.array(z.string().min(1)).max(20),
    status: contentStatusSchema,
    authoredBy: z.string().uuid(),
    reviewedBy: z.string().uuid().optional(),
    reviewedAt: z.string().datetime().optional(),
    assetIds: z.array(z.string().uuid()),
  });

export const questionRevisionSchema = questionRevisionFields.superRefine((question, ctx) => {
    const optionIds = question.options.map((option) => option.id);
    if (new Set(optionIds).size !== optionIds.length) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Option ids must be unique." });
    }
    if (!optionIds.includes(question.correctOptionId)) {
      ctx.addIssue({ code: "custom", path: ["correctOptionId"], message: "Correct answer must match an option id." });
    }
    for (const rationale of question.explanation.distractors) {
      if (!optionIds.includes(rationale.optionId) || rationale.optionId === question.correctOptionId) {
        ctx.addIssue({ code: "custom", path: ["explanation", "distractors"], message: "Distractor rationale must reference an incorrect option." });
      }
    }
  });

export const examSafeQuestionSchema = questionRevisionFields.omit({
  correctOptionId: true,
  explanation: true,
  authoredBy: true,
  reviewedBy: true,
  reviewedAt: true,
  status: true,
});

export type QuestionRevision = z.infer<typeof questionRevisionSchema>;
export type ExamSafeQuestion = z.infer<typeof examSafeQuestionSchema>;
