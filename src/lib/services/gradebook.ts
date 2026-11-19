import type { AssessmentCategoryWeight, GradeEntry, LetterGradeScale } from '$lib/types/gradebook'
export function validateWeights(weights: AssessmentCategoryWeight[]) { return Math.abs(weights.reduce((s, w) => s + w.weight, 0) - 100) < 0.001 }
export function calculateWeightedGrade(entries: GradeEntry[], weights: AssessmentCategoryWeight[]) {
  const graded = entries.filter(e => e.status === 'graded' && e.released)
  const by = new Map(weights.map(w => [w.category, w.weight])); let used = 0; let total = 0
  for (const e of graded) { const weight = by.get(e.category) ?? 0; total += (e.pointsEarned! / e.pointsPossible) * weight; used += weight }
  return used ? total / used * 100 : 0
}
export function letterFor(percent: number, scale: LetterGradeScale[]) { return [...scale].sort((a, b) => b.min - a.min).find(s => percent >= s.min)?.letter ?? 'F' }
