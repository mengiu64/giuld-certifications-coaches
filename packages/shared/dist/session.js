import { v4 as uuidv4 } from 'uuid';
import { examResultSchema, examSessionSchema } from './schemas.js';
const shuffle = (values) => {
    const next = [...values];
    for (let index = next.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
    return next;
};
export const createExamSession = (bank, mode, timeLimitMinutes) => {
    const session = {
        sessionId: uuidv4(),
        bankId: bank.bankId,
        certificationId: bank.certificationId,
        mode,
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        timeRemainingMs: mode === 'exam' ? timeLimitMinutes * 60_000 : 0,
        questionOrder: shuffle(Array.from({ length: bank.questions.length }, (_, index) => index)),
        answers: [],
        markedForReview: [],
        studyResults: mode === 'study' ? [] : undefined,
    };
    return examSessionSchema.parse(session);
};
export const serializeExamSession = (session) => JSON.stringify(examSessionSchema.parse(session));
export const deserializeExamSession = (value) => examSessionSchema.parse(JSON.parse(value));
export const serializeExamResult = (result) => JSON.stringify(examResultSchema.parse(result));
export const deserializeExamResult = (value) => examResultSchema.parse(JSON.parse(value));
export const upsertAnswer = (session, questionIndex, answers) => {
    const answerMap = new Map(session.answers);
    answerMap.set(questionIndex, [...new Set(answers)]);
    return {
        ...session,
        answers: Array.from(answerMap.entries()).sort((left, right) => left[0] - right[0]),
    };
};
export const toggleMarkedQuestion = (session, questionIndex) => {
    const marked = new Set(session.markedForReview);
    if (marked.has(questionIndex)) {
        marked.delete(questionIndex);
    }
    else {
        marked.add(questionIndex);
    }
    return {
        ...session,
        markedForReview: Array.from(marked.values()).sort((left, right) => left - right),
    };
};
export const recordStudyResult = (session, questionIndex, selectedAnswers, isCorrect) => {
    const results = new Map();
    for (const result of session.studyResults ?? []) {
        results.set(result.questionIndex, result);
    }
    results.set(questionIndex, {
        questionIndex,
        selectedAnswers,
        isCorrect,
        answeredAt: new Date().toISOString(),
    });
    return {
        ...session,
        studyResults: Array.from(results.values()).sort((left, right) => left.questionIndex - right.questionIndex),
    };
};
//# sourceMappingURL=session.js.map