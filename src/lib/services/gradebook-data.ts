import { collection, doc, getDoc, getDocs, query, where, setDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '$lib/firebase'
import { COLLECTIONS } from '$lib/firebase/collections'
import type { CourseGradeConfig, FinalResult } from '$lib/types/gradebook'
import { mongoProvider, getMongoGradebook } from './mongo-provider'
export async function getGradeConfig(courseId: string) { const snap = await getDoc(doc(db, COLLECTIONS.GRADE_CONFIGS, courseId)); return snap.exists() ? snap.data() as CourseGradeConfig : null }
export async function saveGradeConfig(config: CourseGradeConfig) { await setDoc(doc(db, COLLECTIONS.GRADE_CONFIGS, config.courseId), config) }
export async function getFinalResult(courseId: string, userId: string) { const snap = await getDoc(doc(db, COLLECTIONS.FINAL_RESULTS, `${userId}_${courseId}`)); return snap.exists() ? snap.data() as FinalResult : null }
export const getLearnerGradebook = (data: { courseId: string }) => mongoProvider.enabled() ? getMongoGradebook(data.courseId) : httpsCallable<{ courseId: string }, { entries: unknown[]; average: number; pending: number; finalResult?: FinalResult }>(functions, 'getLearnerGradebook')(data)
export const finalizeLearnerGradebook = httpsCallable<{ courseId: string; userId: string }, { result: FinalResult }>(functions, 'finalizeLearnerGradebook')
