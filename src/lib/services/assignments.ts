import { collection, doc, getDocs, query, where, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '$lib/firebase'
import { netlifyCall } from '$lib/netlify-api'
import { COLLECTIONS } from '$lib/firebase/collections'
import type { Assignment, AssignmentSubmission } from '$lib/types/assignment'
import { mongoProvider, mongoCourseWrite, getMongoSubmissions } from './mongo-provider'
export async function getSubmissions(assignmentId: string) { if (mongoProvider.enabled()) return getMongoSubmissions(assignmentId); const snap = await getDocs(query(collection(db, COLLECTIONS.ASSIGNMENT_SUBMISSIONS), where('assignmentId', '==', assignmentId))); return snap.docs.map(d => ({ id: d.id, ...d.data() } as AssignmentSubmission)) }
export async function getAssignments(courseId: string) { if (mongoProvider.enabled()) return mongoProvider.getAssignments(courseId); const snap = await getDocs(query(collection(db, COLLECTIONS.ASSIGNMENTS), where('courseId', '==', courseId))); return snap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment)) }
export async function saveAssignment(assignment: Omit<Assignment, 'id'>, id?: string) { if (mongoProvider.enabled()) { const value = { ...assignment, id: id ?? `${assignment.courseId}-${Date.now()}` }; await mongoCourseWrite('saveAssignment', value); return value.id } const ref = id ? doc(db, COLLECTIONS.ASSIGNMENTS, id) : doc(collection(db, COLLECTIONS.ASSIGNMENTS)); await setDoc(ref, { ...assignment, id: ref.id }); return ref.id }
export async function deleteAssignment(id: string) { if (mongoProvider.enabled()) { await mongoCourseWrite('deleteAssignment', { id }); return } await deleteDoc(doc(db, COLLECTIONS.ASSIGNMENTS, id)) }
export const submitAssignment = (data: { assignmentId: string; text: string }) => mongoProvider.enabled() ? mongoProvider.submitAssignment(data) : netlifyCall<{ submission: AssignmentSubmission }>('submitAssignment', data)
export const gradeAssignmentSubmission = (data: { submissionId: string; pointsEarned: number; feedback?: string; released: boolean }) => mongoProvider.enabled() ? mongoProvider.gradeAssignment(data) : netlifyCall<{ submission: AssignmentSubmission }>('gradeAssignment', data)
