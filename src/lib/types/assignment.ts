export interface AssignmentRubricCriterion { id: string; label: string; description: string; points: number }
export interface Assignment { id: string; courseId: string; title: string; instructions: string; points: number; dueAt: string; rubric: AssignmentRubricCriterion[]; category?: string; moduleId?: string; isPublished: boolean; createdBy: string; createdAt?: string; updatedAt?: string }
export type AssignmentSubmissionStatus = 'draft' | 'submitted' | 'returned'
import type { GradeAudit } from './gradebook'
export interface AssignmentSubmission { id: string; assignmentId: string; courseId: string; userId: string; text: string; status: AssignmentSubmissionStatus; createdAt: string; updatedAt: string; submittedAt?: string; feedback?: string; pointsEarned?: number; gradeReleased?: boolean; gradedAt?: string; gradedBy?: string; audit?: GradeAudit[] }
