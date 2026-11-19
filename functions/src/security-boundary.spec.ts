import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const rules = readFileSync(resolve(root, 'firestore.production.rules'), 'utf8')
const functionsSource = readFileSync(resolve(root, 'functions/src/index.ts'), 'utf8')
const quizServiceSource = readFileSync(resolve(root, 'src/lib/services/quiz.ts'), 'utf8')

describe('assessment security boundary', () => {
  it('does not grant learners direct reads of quiz answer-key documents', () => {
    const quizRule = rules.match(/match \/quizzes\/\{quizId\} \{([\s\S]*?)\n    \}/)?.[1] ?? ''
    expect(quizRule).toContain('allow read: if admin() || teaches(resource.data.courseId);')
    expect(quizRule).not.toContain('isPublished == true')
  })

  it('denies all browser writes to authoritative attempts', () => {
    const attemptRule = rules.match(/match \/quiz-attempts\/\{attemptId\} \{([\s\S]*?)\n    \}/)?.[1] ?? ''
    expect(attemptRule).toContain('allow create, update, delete: if false;')
  })

  it('strips answer-key fields and avoids persisting keyed quiz copies', () => {
    expect(functionsSource).toContain('correctAnswer: _key')
    expect(functionsSource).toContain('acceptableAnswers: _acceptable')
    expect(quizServiceSource).toContain('lessons: arrayUnion(newLesson)')
    expect(quizServiceSource).not.toContain('lessons: arrayUnion(lessonWithQuiz)')
  })
})
