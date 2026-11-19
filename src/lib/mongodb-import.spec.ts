import { describe, expect, it, vi } from 'vitest'
import { importCourse } from '../../netlify/functions/_lib/repositories.mjs'

function database() {
  const collections = new Map<string, { replaceOne: ReturnType<typeof vi.fn> }>()
  return {
    collections,
    db: {
      collection(name: string) {
        if (!collections.has(name)) collections.set(name, { replaceOne: vi.fn().mockResolvedValue({ acknowledged: true }) })
        return collections.get(name)
      }
    }
  }
}

describe('MongoDB course import persistence', () => {
  it('stores private quizzes separately from learner-readable course and lesson records', async () => {
    const { db, collections } = database()
    const payload = {
      course: { id: 'course-1', title: 'Generic course' },
      lessons: [{ id: 'lesson-1', courseId: 'course-1', title: 'Quiz lesson' }],
      quizzes: [{ id: 'quiz-1', lessonId: 'lesson-1', courseId: 'course-1', questions: [{ id: 'q1', correctAnswer: 'a' }] }],
      assignments: [{ id: 'assignment-1', courseId: 'course-1' }],
      term: { id: 'term-1', name: 'Term' },
      gradeConfig: { courseId: 'course-1', weights: [{ category: 'quizzes', weight: 40 }, { category: 'assignments', weight: 60 }] }
    }

    await importCourse(db as never, payload)

    expect(collections.get('courses')?.replaceOne).toHaveBeenCalledWith({ id: 'course-1' }, payload.course, { upsert: true })
    expect(collections.get('lessons')?.replaceOne).toHaveBeenCalledTimes(1)
    expect(collections.get('quizzes')?.replaceOne).toHaveBeenCalledWith({ id: 'quiz-1' }, payload.quizzes[0], { upsert: true })
    expect(collections.get('assignments')?.replaceOne).toHaveBeenCalledTimes(1)
    expect(collections.get('gradeConfigs')?.replaceOne).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(payload.course)).not.toContain('correctAnswer')
    expect(JSON.stringify(payload.lessons)).not.toContain('correctAnswer')
  })

  it('rejects invalid grading weights before writing', async () => {
    const { db, collections } = database()
    await expect(importCourse(db as never, { course: { id: 'course-1' }, gradeConfig: { weights: [{ category: 'quizzes', weight: 90 }] } })).rejects.toThrow('must total 100')
    expect(collections.size).toBe(0)
  })
})
