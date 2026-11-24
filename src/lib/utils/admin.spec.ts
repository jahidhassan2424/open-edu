import { describe, expect, it } from 'vitest'
import { canManageCourse, canManageCourses } from './admin'
import type { User } from '$lib/types'

const student = { id: 'owner-1', role: 'student' } as User

describe('course management access', () => {
	it('allows every authenticated user to open their course-management workflow', () => {
		expect(canManageCourses(student)).toBe(true)
	})

	it('limits an ordinary user to courses they own', () => {
		expect(canManageCourse('owner-1', student)).toBe(true)
		expect(canManageCourse('another-owner', student)).toBe(false)
	})
})
