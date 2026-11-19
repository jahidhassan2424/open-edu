import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const rules = readFileSync(resolve(root, 'firestore.production.rules'), 'utf8')
const functionsSource = readFileSync(resolve(root, 'functions/src/index.ts'), 'utf8')
const quizServiceSource = readFileSync(resolve(root, 'src/lib/services/quiz.ts'), 'utf8')

describe('assessment security boundary', () => {
  it('does not grant learners direct access to quiz answer-key documents', () => {
    const quizRule = rules.match(/match \/quizzes\/\{quizId\} \{([\s\S]*?)\n    \}/)?.[1] ?? ''
    expect(quizRule).toContain('allow read: if admin() || teaches(resource.data.courseId);')
    expect(quizRule).not.toContain('isPublished == true')
  })

  it('denies all client writes to authoritative attempts', () => {
    const attemptRule = rules.match(/match \/quiz-attempts\/\{attemptId\} \{([\s\S]*?)\n    \}/)?.[1] ?? ''
    expect(attemptRule).toContain('allow create, update, delete: if false;')
  })

  it('projects learner quizzes without answer-key fields in the callable function', () => {
    expect(functionsSource).toContain('correctAnswer: _key')
    expect(functionsSource).toContain('acceptableAnswers: _acceptable')
    expect(functionsSource).toContain("onCall(async request")
  })

  it('does not duplicate a keyed quiz into a readable course document', () => {
    expect(quizServiceSource).toContain('lessons: arrayUnion(newLesson)')
    expect(quizServiceSource).not.toContain('lessons: arrayUnion(lessonWithQuiz)')
  })

  it('protects assignment submissions behind the callable boundary', () => {
    const submissionRule = rules.match(/match \/assignmentSubmissions\/\{submissionId\} \{([\s\S]*?)\n    \}/)?.[1] ?? ''
    expect(submissionRule).toContain('allow create, update, delete: if false;')
    expect(functionsSource).toContain('createAssignmentSubmission')
    expect(functionsSource).toContain('Submitted work cannot be modified.')
    expect(functionsSource).toContain('requireEnrollment(uid, assignment.courseId)')
  })

  it('protects instructor grading behind a callable boundary', () => {
    expect(functionsSource).toContain('gradeAssignmentSubmission')
    expect(functionsSource).toContain('requireInstructor(graderId, submission.courseId)')
    expect(functionsSource).toContain('audit')
  })
})
