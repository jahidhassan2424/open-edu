import { collection, doc, getDocs, orderBy, query, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '$lib/firebase'
import { COLLECTIONS } from '$lib/firebase/collections'
import type { AcademicTerm, WeeklyModule, AcademicActivity } from '$lib/types/academic'
import { mongoProvider } from './mongo-provider'

export function validateAcademicPlan(modules: WeeklyModule[], schedule: AcademicActivity[] = [], lessonIds: string[] = []): string[] {
  const errors: string[] = []
  const numbers = new Set<number>()
  for (const module of modules) {
    if (module.startDate > module.endDate) errors.push(`Module ${module.number} has an invalid date range`)
    if (numbers.has(module.number)) errors.push(`Duplicate module number ${module.number}`)
    numbers.add(module.number)
    for (const resource of module.resources) {
      if (resource.lessonId && !lessonIds.includes(resource.lessonId)) errors.push(`Unknown lesson resource ${resource.lessonId}`)
    }
  }
  for (const activity of schedule) if (activity.dueAt && activity.dueAt < activity.date) errors.push(`Activity ${activity.id} has an invalid deadline`)
  return errors
}

export async function getAcademicTerms(): Promise<AcademicTerm[]> {
  if (mongoProvider.enabled()) return mongoProvider.getTerms()
  const snap = await getDocs(query(collection(db, COLLECTIONS.ACADEMIC_TERMS), orderBy('startDate', 'asc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AcademicTerm))
}
export async function saveAcademicTerm(term: Omit<AcademicTerm, 'id'>, id?: string): Promise<string> {
  if (mongoProvider.enabled()) {
    const termId = id ?? crypto.randomUUID()
    await mongoProvider.saveTerm({ ...term, id: termId })
    return termId
  }
  const ref = id ? doc(db, COLLECTIONS.ACADEMIC_TERMS, id) : doc(collection(db, COLLECTIONS.ACADEMIC_TERMS))
  await setDoc(ref, { ...term, id: ref.id })
  return ref.id
}
export async function deleteAcademicTerm(id: string): Promise<void> {
  if (mongoProvider.enabled()) return mongoProvider.deleteTerm(id)
  await deleteDoc(doc(db, COLLECTIONS.ACADEMIC_TERMS, id))
}
