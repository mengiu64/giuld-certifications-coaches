import { FORMAT_OPTION_COUNT, QUESTION_LABELS, generatedQuestionDraftSchema, questionSchema } from '@aws-exam-generator/shared';
import type { GeneratedQuestionDraft, Question, QuestionFormat, QuestionLabel } from '@aws-exam-generator/shared';

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const countWords = (value: string): number => value.trim().split(/\s+/).filter(Boolean).length;

export class QuestionValidator {
  static normalizeDraft(draft: GeneratedQuestionDraft): GeneratedQuestionDraft {
    const optionCount = FORMAT_OPTION_COUNT[draft.format];
    const options = draft.options
      .slice(0, optionCount)
      .map((option, index) => ({
        label: QUESTION_LABELS[index] as QuestionLabel,
        text: option.text.trim(),
      }));
    const validLabels = new Set(options.map((option) => option.label));
    const correctAnswers = [...new Set(draft.correctAnswers.map((answer) => answer.trim().toUpperCase()))]
      .filter((answer) => validLabels.has(answer as QuestionLabel))
      .sort();
    const services = [...new Set(draft.services.map((service) => service.trim()).filter(Boolean))].slice(0, 3);
    return {
      ...draft,
      stem: draft.stem.trim(),
      explanation: draft.explanation.trim(),
      domain: draft.domain.trim(),
      options,
      correctAnswers,
      services,
      referenceUrl: draft.referenceUrl?.trim() || undefined,
    };
  }

  static validateQuestion(question: GeneratedQuestionDraft | Question): ValidationResult {
    const errors: string[] = [];
    const parseResult = ('questionId' in question ? questionSchema : generatedQuestionDraftSchema).safeParse(question);
    if (!parseResult.success) {
      errors.push(...parseResult.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
      return { valid: false, errors };
    }

    const normalized = parseResult.data;
    const optionCount = FORMAT_OPTION_COUNT[normalized.format];
    const labels = QUESTION_LABELS.slice(0, optionCount);
    const optionLabels = normalized.options.map((option) => option.label);

    if (normalized.options.length !== optionCount) {
      errors.push(`Format ${normalized.format} requires ${optionCount} options.`);
    }
    if (optionLabels.some((label, index) => label !== labels[index])) {
      errors.push('Option labels must be sequential starting from A.');
    }
    if (new Set(optionLabels).size !== optionLabels.length) {
      errors.push('Option labels must be unique.');
    }
    const validCorrectAnswerCounts: Record<QuestionFormat, number[]> = {
      'single-4': [1],
      'multi-5': [2, 3],
      'multi-6': [2, 3],
    };
    if (!validCorrectAnswerCounts[normalized.format].includes(normalized.correctAnswers.length)) {
      errors.push(`Format ${normalized.format} has invalid correct answer count.`);
    }
    const optionLabelSet = new Set(optionLabels);
    if (normalized.correctAnswers.some((answer) => !optionLabelSet.has(answer as QuestionLabel))) {
      errors.push('Correct answers must reference defined option labels.');
    }
    if (new Set(normalized.correctAnswers).size !== normalized.correctAnswers.length) {
      errors.push('Correct answers must be unique.');
    }
    const stemWordCount = countWords(normalized.stem);
    if (stemWordCount < 50 || stemWordCount > 200) {
      errors.push('Stem must be between 50 and 200 words.');
    }
    const explanationWordCount = countWords(normalized.explanation);
    if (explanationWordCount < 50 || explanationWordCount > 300) {
      errors.push('Explanation must be between 50 and 300 words.');
    }
    if (normalized.services.length < 1 || normalized.services.length > 3) {
      errors.push('Services must contain between 1 and 3 entries.');
    }
    if (!normalized.services.some((service) => normalized.explanation.toLowerCase().includes(service.toLowerCase()))) {
      errors.push('Explanation must mention at least one referenced AWS service.');
    }
    return { valid: errors.length === 0, errors };
  }

  static assertValidQuestion(question: GeneratedQuestionDraft | Question): void {
    const result = QuestionValidator.validateQuestion(question);
    if (!result.valid) {
      throw new Error(result.errors.join(' | '));
    }
  }
}
