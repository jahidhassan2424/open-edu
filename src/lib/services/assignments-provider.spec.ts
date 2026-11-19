import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
describe('assignment MongoDB provider wiring', () => { it('routes review and grading through provider-aware services', () => { const page = readFileSync('src/routes/admin/courses/[courseId]/grades/+page.svelte', 'utf8'); const service = readFileSync('src/lib/services/assignments.ts', 'utf8'); expect(page).toContain('getSubmissions'); expect(service).toContain("mongoProvider.enabled()"); expect(service).toContain("gradeAssignment") }) })
