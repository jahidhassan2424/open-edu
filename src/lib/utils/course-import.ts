/**
 * Course Import Utilities
 * Parse and validate course data from JSON/YAML files
 * 
 * v1.6.0: Updated duration format to Xm/Xh
 */

import yaml from 'yaml'
import { courseImportSchema, type CourseImportData } from '$lib/validation/course-import'

export type ImportFormat = 'json' | 'yaml'

export interface ParseResult {
	data: CourseImportData
	format: ImportFormat
}

/**
 * Parse duration string to minutes
 * v1.6.0: New format - Xm (minutes) or Xh (hours)
 * 
 * @param duration - Duration string (e.g., "30m", "2h", "1.5h")
 * @returns Duration in minutes
 * 
 * @example
 * parseDurationToMinutes("30m") // 30
 * parseDurationToMinutes("2h")  // 120
 * parseDurationToMinutes("1.5h") // 90
 */
export function parseDurationToMinutes(duration: string): number {
	const cleaned = duration.toLowerCase().trim()
	
	// Match new format: Xm or Xh
	const match = cleaned.match(/^(\d+(?:\.\d+)?)([mh])$/)
	if (match) {
		const value = parseFloat(match[1])
		const unit = match[2]
		
		if (unit === 'h') {
			return Math.round(value * 60)
		}
		return Math.round(value)
	}
	
	// Fallback: try to extract just the number (assume minutes)
	const numMatch = cleaned.match(/(\d+(?:\.\d+)?)/)
	if (numMatch) {
		return Math.round(parseFloat(numMatch[1]))
	}
	
	// Default fallback
	return 10
}

/**
 * Format minutes to duration string
 * @param minutes - Duration in minutes
 * @returns Formatted duration string (e.g., "30m", "2h", "1.5h")
 */
export function formatDuration(minutes: number): string {
	if (minutes >= 60 && minutes % 60 === 0) {
		return `${minutes / 60}h`
	}
	if (minutes >= 60) {
		const hours = minutes / 60
		// Use hours if it's a clean decimal
		if (hours === Math.round(hours * 10) / 10) {
			return `${hours}h`
		}
	}
	return `${minutes}m`
}

/**
 * Parse course file (JSON or YAML)
 */
export async function parseCourseFile(file: File): Promise<ParseResult> {
	const content = await file.text()
	const extension = file.name.split('.').pop()?.toLowerCase()

	let data: unknown
	let format: ImportFormat

	try {
		if (extension === 'json') {
			data = JSON.parse(content)
			format = 'json'
		} else if (extension === 'yaml' || extension === 'yml') {
			data = yaml.parse(content)
			format = 'yaml'
		} else {
			throw new Error('Unsupported file format. Please use .json, .yaml, or .yml')
		}

		// Validate with Zod
		const validated = courseImportSchema.parse(data)
		return { data: validated, format }
	} catch (err) {
		if (err instanceof Error) {
			if (err.name === 'ZodError') {
				// Format Zod validation errors nicely
				const zodError = err as { errors?: Array<{ path: string[]; message: string }> }
				const firstError = zodError.errors?.[0]
				if (firstError) {
					throw new Error(`Validation error: ${firstError.path.join('.')}: ${firstError.message}`)
				}
			}
			throw new Error(`Failed to parse ${extension?.toUpperCase()}: ${err.message}`)
		}
		throw new Error('Unknown error parsing file')
	}
}

/**
 * Generate a template course structure in user-friendly format
 * v1.6.0: Uses flattened quiz structure and new duration format (Xm/Xh)
 */
export function generateCourseTemplate(format: ImportFormat): string {
	// Template that matches v1.6.0 flattened quiz schema
	const template = {
		title: 'Course Title',
		description: 'A comprehensive description of what students will learn in this course.',
		category: 'Programming',
		difficulty: 'Beginner',
		duration: '40h', // v1.6.0: New format - Xm or Xh
		thumbnail: 'https://placehold.co/400x225/6366f1/white?text=Course+Thumbnail',
		level: 'free',
		tags: ['tag1', 'tag2'],
		prerequisites: ['Basic computer skills'],
		learningOutcomes: ['Learn concept A', 'Master skill B'],
		isPublished: false,
		isFeatured: false,
		lessons: [
			{
				title: 'Introduction Lesson',
				type: 'lesson',
				duration: '10m', // v1.6.0: New format
				content: '# Lesson Content\n\nYour markdown content here...'
			},
			{
				// v1.6.0: Quiz fields are flattened directly on lesson (no wrapper)
				title: 'Assessment Quiz',
				type: 'quiz',
				duration: '15m', // v1.6.0: New format
				description: 'Test your understanding of the concepts',
				instructions: 'Read each question carefully before answering.',
				passingScore: 70,
				timeLimit: 900, // seconds
				allowMultipleAttempts: true,
				maxAttempts: 3,
				showCorrectAnswers: true,
				showExplanations: true,
				randomizeQuestions: false,
				randomizeOptions: false,
				allowReview: true,
				questions: [
					{
						id: 'q1',
						type: 'multiple-choice',
						question: 'What is the correct answer?',
						options: ['Option A', 'Option B', 'Option C'],
						correctAnswer: 1,
						points: 10,
						explanation: 'Explanation of the correct answer'
					},
					{
						id: 'q2',
						type: 'true-false',
						question: 'This is a true/false question',
						correctAnswer: true,
						points: 5,
						explanation: 'Explanation of the answer'
					},
					{
						id: 'q3',
						type: 'multiple-select',
						question: 'Select all that apply',
						options: ['A', 'B', 'C', 'D'],
						correctAnswers: [0, 2],
						points: 15,
						explanation: 'A and C are correct'
					},
					{
						id: 'q4',
						type: 'fill-blank',
						question: 'The answer is ___',
						correctAnswer: 'answer',
						caseSensitive: false,
						points: 10,
						explanation: 'The correct answer is "answer"'
					},
					{
						id: 'q5',
						type: 'ordering',
						question: 'Put these in order',
						items: ['First', 'Second', 'Third'],
						correctOrder: [0, 1, 2],
						points: 20,
						explanation: 'The correct order is First, Second, Third'
					},
					{
						id: 'q6',
						type: 'matching',
						question: 'Match the items',
						pairs: [
							{ left: 'A', right: '1' },
							{ left: 'B', right: '2' }
						],
						points: 20,
						explanation: 'A matches with 1, B matches with 2'
					}
				]
			}
		]
	}

	if (format === 'json') {
		return JSON.stringify(template, null, 2)
	} else {
		return yaml.stringify(template)
	}
}

/**
 * Generate a copy-ready instruction for an AI that must return an importable
 * course document. The example is deliberately generated by the same template
 * function used by the download buttons, so its core structure stays in sync
 * with the importer.
 */
export function generateAiCourseJsonPrompt(): string {
	return `Generate one Open-EDU course import JSON object. Return JSON only: no Markdown fences, no prose, and no fields outside this contract.

Required root fields:
- title: string (1-200 characters)
- description: string (10-2000 characters)
- category: non-empty string
- difficulty: "Beginner", "Intermediate", or "Advanced"
- duration: string in Xm or Xh format, for example "45m", "2h", or "1.5h"
- level: "free" or "premium"
- lessons: non-empty array

Optional root fields:
- thumbnail: valid URL string
- price: non-negative number; required and greater than 0 when level is "premium"
- currency: three-character ISO currency code (defaults to "USD")
- isPublished, isFeatured: booleans
- tags: up to 10 non-empty strings
- prerequisites: string array
- learningOutcomes: up to 10 non-empty strings
- term: { name, startDate, endDate, status? }, where dates are YYYY-MM-DD and status is "planned", "active", "completed", or "archived"
- modules: array of { id, number, title, startDate, endDate, objectives, resources }; number is a positive integer, dates are YYYY-MM-DD, objectives is a string array, and each resource is { id, title, type, order, url?, lessonId?, assignmentId? } with type "lesson", "quiz", "assignment", "link", or "file" and a non-negative integer order
- schedule: array of { id, type, title, date, dueAt?, lessonId?, quizId?, moduleId?, description? }; type is "quiz", "assignment", "exam", "lecture", or "deadline". Use assignment.dueAt and/or schedule.dueAt for deadlines.
- assignments: array of { id, title, instructions, points, dueAt, rubric?, category?, moduleId?, isPublished? }; points must be positive, dueAt is a string, isPublished defaults to false, and each rubric item is { id, label, description, points } with non-negative points
- gradingCategories: array of { category, weight }, where weight is 0-100 and all weights must total exactly 100 when supplied
- sourceMetadata: object with string keys

Each lesson requires title and duration (Xm/Xh). Optional lesson fields are description, type ("lesson" or "quiz"), content, videoUrl (valid URL), questions, instructions, timeLimit (positive number), passingScore (0-100; default 70), allowMultipleAttempts, maxAttempts (positive number), showCorrectAnswers, showExplanations, randomizeQuestions, randomizeOptions, allowReview, and category. A lesson cannot contain both content and questions. A lesson with type "quiz" must contain at least one question.

Quiz questions are flattened into lesson.questions. Every question needs id, type, question, and non-negative points. Use only these types:
- multiple-choice: options (at least 2 strings), correctAnswer (zero-based number), explanation (string)
- true-false: correctAnswer (boolean), explanation (string)
- multiple-select: options (at least 2 strings), correctAnswers (non-empty zero-based number array), explanation (string)
- short-answer: correctAnswer? (string), explanation? (string; defaults to empty)
- fill-blank: correctAnswer (non-empty string), caseSensitive? (boolean), explanation (string)
- ordering: items (at least 2 strings), correctOrder (at least 2 zero-based numbers), explanation (string)
- matching: pairs (at least 2 { left, right } string objects), explanation (string)

Valid import example:
${generateCourseTemplate('json')}`
}

export async function copyAiCourseJsonPrompt(clipboard: Pick<Clipboard, 'writeText'> | undefined = typeof navigator === 'undefined' ? undefined : navigator.clipboard): Promise<void> {
	if (!clipboard) throw new Error('Clipboard is not available.')
	await clipboard.writeText(generateAiCourseJsonPrompt())
}

/**
 * Download template file
 */
export function downloadTemplate(format: ImportFormat): void {
	const content = generateCourseTemplate(format)
	const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/yaml' })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = `course-template.${format === 'json' ? 'json' : 'yaml'}`
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
	URL.revokeObjectURL(url)
}

/**
 * Validate course data
 */
export function validateCourseData(data: unknown): CourseImportData {
	return courseImportSchema.parse(data)
}
