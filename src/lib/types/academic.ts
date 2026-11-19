export type AcademicTermStatus = 'planned' | 'active' | 'completed' | 'archived'

export interface AcademicTerm {
  id: string
  name: string
  startDate: string
  endDate: string
  status: AcademicTermStatus
}

export interface ModuleResource {
  id: string
  title: string
  type: 'lesson' | 'quiz' | 'assignment' | 'link' | 'file'
  url?: string
  lessonId?: string
  order: number
}

export interface WeeklyModule {
  id: string
  number: number
  title: string
  startDate: string
  endDate: string
  objectives: string[]
  resources: ModuleResource[]
}

export type AcademicActivityType = 'quiz' | 'assignment' | 'exam' | 'lecture' | 'deadline'

export interface AcademicActivity {
  id: string
  type: AcademicActivityType
  title: string
  date: string
  dueAt?: string
  lessonId?: string
  quizId?: string
  moduleId?: string
  description?: string
}
