"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
const vitest_1 = require("vitest");
const root = (0, node_path_1.resolve)((0, node_url_1.fileURLToPath)(new URL('../..', import.meta.url)));
const rules = (0, node_fs_1.readFileSync)((0, node_path_1.resolve)(root, 'firestore.production.rules'), 'utf8');
const functionsSource = (0, node_fs_1.readFileSync)((0, node_path_1.resolve)(root, 'functions/src/index.ts'), 'utf8');
const quizServiceSource = (0, node_fs_1.readFileSync)((0, node_path_1.resolve)(root, 'src/lib/services/quiz.ts'), 'utf8');
(0, vitest_1.describe)('assessment security boundary', () => {
    (0, vitest_1.it)('does not grant learners direct reads of quiz answer-key documents', () => {
        const quizRule = rules.match(/match \/quizzes\/\{quizId\} \{([\s\S]*?)\n    \}/)?.[1] ?? '';
        (0, vitest_1.expect)(quizRule).toContain('allow read: if admin() || teaches(resource.data.courseId);');
        (0, vitest_1.expect)(quizRule).not.toContain('isPublished == true');
    });
    (0, vitest_1.it)('denies all browser writes to authoritative attempts', () => {
        const attemptRule = rules.match(/match \/quiz-attempts\/\{attemptId\} \{([\s\S]*?)\n    \}/)?.[1] ?? '';
        (0, vitest_1.expect)(attemptRule).toContain('allow create, update, delete: if false;');
    });
    (0, vitest_1.it)('strips answer-key fields and avoids persisting keyed quiz copies', () => {
        (0, vitest_1.expect)(functionsSource).toContain('correctAnswer: _key');
        (0, vitest_1.expect)(functionsSource).toContain('acceptableAnswers: _acceptable');
        (0, vitest_1.expect)(quizServiceSource).toContain('lessons: arrayUnion(newLesson)');
        (0, vitest_1.expect)(quizServiceSource).not.toContain('lessons: arrayUnion(lessonWithQuiz)');
    });
});
