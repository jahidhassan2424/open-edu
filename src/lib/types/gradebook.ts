export type AssessmentCategory = string
export interface AssessmentCategoryWeight { category: AssessmentCategory; weight: number }
export interface LetterGradeScale { min: number; letter: string }
export interface GradeEntry { id: string; category: AssessmentCategory; title: string; pointsEarned?: number; pointsPossible: number; status: 'pending' | 'missing' | 'graded'; released: boolean }
export interface GradeAudit { at: string; graderId: string; pointsEarned: number; feedback?: string }
export interface CourseGradeConfig { courseId: string; weights: AssessmentCategoryWeight[]; letterScale: LetterGradeScale[]; updatedAt?: string }
export interface FinalResult { userId: string; courseId: string; percentage: number; letter: string; status: 'in_progress' | 'completed'; calculatedAt: string }
