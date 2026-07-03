import { examResultSchema } from './schemas.js';
const normalizeAnswers = (answers) => [...new Set(answers.map((answer) => answer.trim().toUpperCase()))].sort();
export const isAnswerCorrect = (question, selectedAnswers) => {
    const actual = normalizeAnswers(question.correctAnswers);
    const selected = normalizeAnswers(selectedAnswers);
    return actual.length === selected.length && actual.every((answer, index) => answer === selected[index]);
};
export const calculateExamResult = (session, bank) => {
    const answers = new Map(session.answers);
    const domainBreakdown = {};
    let correctCount = 0;
    for (const question of bank.questions) {
        const selectedAnswers = answers.get(bank.questions.indexOf(question)) ?? [];
        const isCorrect = isAnswerCorrect(question, selectedAnswers);
        const entry = domainBreakdown[question.domain] ?? { correct: 0, total: 0 };
        entry.total += 1;
        if (isCorrect) {
            entry.correct += 1;
            correctCount += 1;
        }
        domainBreakdown[question.domain] = entry;
    }
    const totalQuestions = bank.questions.length;
    const score = totalQuestions === 0 ? 0 : Math.round((correctCount / totalQuestions) * 100);
    const result = {
        sessionId: session.sessionId,
        bankId: bank.bankId,
        completedAt: new Date().toISOString(),
        score,
        passed: score >= 75,
        totalQuestions,
        correctCount,
        domainBreakdown,
    };
    return examResultSchema.parse(result);
};
//# sourceMappingURL=scoring.js.map