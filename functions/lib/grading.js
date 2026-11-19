"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gradeQuiz = gradeQuiz;
function gradeQuiz(questions, submitted) {
    const supplied = new Map(submitted.map(answer => [answer.questionId, answer.answer]));
    const answers = questions.map(question => {
        const answer = supplied.get(question.id) ?? null;
        const isCorrect = answer !== null && question.type !== 'essay' && isAnswerCorrect(question, answer);
        return { questionId: question.id, questionType: question.type, answer, isCorrect, pointsEarned: isCorrect ? question.points : 0, pointsPossible: question.points, answeredAt: new Date().toISOString() };
    });
    const totalPoints = questions.reduce((total, question) => total + question.points, 0);
    const pointsEarned = answers.reduce((total, answer) => total + answer.pointsEarned, 0);
    return { answers, totalPoints, pointsEarned, score: totalPoints === 0 ? 0 : (pointsEarned / totalPoints) * 100 };
}
function isAnswerCorrect(question, answer) {
    if (question.type === 'multiple_select') {
        return Array.isArray(answer) && Array.isArray(question.correctAnswer)
            && answer.length === question.correctAnswer.length
            && [...answer].sort().every((value, index) => value === [...question.correctAnswer].sort()[index]);
    }
    if (question.type === 'short_answer' || question.type === 'fill_blank') {
        if (typeof answer !== 'string' || typeof question.correctAnswer !== 'string')
            return false;
        const normalise = (value) => question.caseSensitive ? value.trim() : value.trim().toLocaleLowerCase();
        return [question.correctAnswer, ...(question.acceptableAnswers ?? [])].some(value => normalise(value) === normalise(answer));
    }
    return answer === question.correctAnswer;
}
