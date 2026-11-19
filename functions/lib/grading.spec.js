"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const grading_1 = require("./grading");
(0, vitest_1.describe)('server grading', () => {
    const questions = [
        { id: 'low', type: 'multiple_choice', correctAnswer: 'a', points: 1 },
        { id: 'high', type: 'multiple_choice', correctAnswer: 'b', points: 9 }
    ];
    (0, vitest_1.it)('uses point weights rather than correct-question count', () => {
        const result = (0, grading_1.gradeQuiz)(questions, [{ questionId: 'high', answer: 'b' }, { questionId: 'low', answer: 'x' }]);
        (0, vitest_1.expect)(result.pointsEarned).toBe(9);
        (0, vitest_1.expect)(result.score).toBe(90);
    });
    (0, vitest_1.it)('never trusts caller supplied correctness or points', () => {
        const result = (0, grading_1.gradeQuiz)(questions, [{ questionId: 'low', answer: 'x', isCorrect: true, pointsEarned: 999 }]);
        (0, vitest_1.expect)(result.answers[0]).toMatchObject({ isCorrect: false, pointsEarned: 0 });
    });
});
