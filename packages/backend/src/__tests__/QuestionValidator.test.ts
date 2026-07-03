import { describe, expect, it } from '@jest/globals';
import fc from 'fast-check';
import { generatedQuestionDraftArbitrary } from '@aws-exam-generator/shared/test-helpers';
import { QuestionValidator } from '../agent/QuestionValidator.js';

describe('QuestionValidator', () => {
  it('accepts generated questions matching their format invariants', () => {
    fc.assert(
      fc.property(generatedQuestionDraftArbitrary, (draft) => {
        const normalized = QuestionValidator.normalizeDraft(draft);
        const result = QuestionValidator.validateQuestion(normalized);
        expect(result.valid).toBe(true);
      }),
    );
  });

  it('rejects invalid option counts for each format', () => {
    fc.assert(
      fc.property(generatedQuestionDraftArbitrary, (draft) => {
        const invalid = {
          ...draft,
          options: draft.options.slice(0, Math.max(1, draft.options.length - 1)),
        };
        const result = QuestionValidator.validateQuestion(invalid);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }),
    );
  });
});
