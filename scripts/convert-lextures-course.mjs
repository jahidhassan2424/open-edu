#!/usr/bin/env node
/** Convert a Lextures export to the Open-EDU import shape without silently dropping fields. */
import fs from 'node:fs'
import path from 'node:path'

const input = process.argv[2] ?? 'PSYC110_Lextures_Import_2026-11-20.json'
const output = process.argv[3] ?? 'exports/PSYC110_OpenEDU_Import_2026-11-20.json'
if (!fs.existsSync(input)) { console.error(`Source file not found: ${input}`); process.exitCode = 2; process.exit() }
const source = JSON.parse(fs.readFileSync(input, 'utf8'))
const pick = (o, keys, fallback = '') => keys.map(k => o?.[k]).find(v => v !== undefined) ?? fallback
const duration = value => { const m = String(value ?? '').match(/([0-9]+(?:\.[0-9]+)?)/); return `${m ? m[1] : '1'}h` }
const structure = source.structure ?? []
const weeks = source.weeks ?? source.modules ?? source.weeklyModules ?? structure.filter(x => x.kind === 'module')
const lectureItems = source.lessons ?? source.lectures ?? source.content?.lectures ?? structure.filter(x => x.kind === 'external_link')
const quizItems = Object.entries(source.quizzes ?? {}).map(([id, q]) => ({ id, ...q }))
const questions = source.questions ?? source.assessment?.questions ?? quizItems.flatMap(q => q.questions ?? [])
const normalizeQuestion = (q, i) => {
  const rawType = q.type ?? q.questionType
  const type = rawType === 'multiple_choice' ? 'multiple-choice' : rawType === 'true_false' ? 'true-false' : rawType === 'multiple_select' ? 'multiple-select' : (rawType === 'short_answer' || rawType === 'essay') ? 'short-answer' : rawType ?? (q.options ? 'multiple-choice' : q.correctAnswer !== undefined ? 'true-false' : undefined)
  if (!type) throw new Error(`Question ${i + 1} has no supported type`)
  const normalized = { id: String(q.id ?? `q-${i + 1}`), type, question: String(q.question ?? q.prompt ?? ''), explanation: String(q.explanation ?? ''), points: Number(q.points ?? q.score ?? 1) }
  if (type === 'multiple-choice') Object.assign(normalized, { options: (q.options ?? q.choices).map(o => typeof o === 'string' ? o : o.text ?? o), correctAnswer: Number(q.correctAnswer ?? q.correctIndex ?? q.correctChoiceIndex) })
  else if (type === 'true-false') normalized.correctAnswer = Boolean(q.correctAnswer)
  else if (type === 'multiple-select') Object.assign(normalized, { options: (q.options ?? q.choices).map(o => typeof o === 'string' ? o : o.text ?? o), correctAnswers: q.correctAnswers ?? q.correctChoiceIndexes })
  else if (type === 'fill-blank') normalized.correctAnswer = String(q.correctAnswer ?? '')
  else if (type === 'short-answer') normalized.correctAnswer = q.correctAnswer
  else if (type === 'ordering') Object.assign(normalized, { items: q.items, correctOrder: q.correctOrder })
  else if (type === 'matching') normalized.pairs = q.pairs
  else throw new Error(`Unsupported question type: ${type}`)
  return normalized
}
const packageData = {
  title: pick(source.course ?? source, ['title', 'courseTitle'], 'PSYC 110'), description: pick(source.course ?? source, ['description', 'courseDescription'], 'Imported Lextures course'), category: pick(source, ['category'], 'Psychology'), difficulty: pick(source, ['difficulty'], 'Beginner'), duration: duration(pick(source.course ?? source, ['duration'], '16h')), level: 'free', isPublished: false, isFeatured: false,
  tags: source.tags ?? ['PSYC 110'], prerequisites: source.prerequisites ?? [], learningOutcomes: source.learningOutcomes ?? [],
  term: source.term ?? { name: 'PSYC 110 Semester 01', startDate: source.course.startsAt.slice(0, 10), endDate: source.course.endsAt.slice(0, 10), status: 'planned' }, modules: weeks.map((w, i) => { const children = structure.filter(x => x.parentId === w.id); const markdown = source.contentPages?.[children.find(c => c.kind === 'content_page')?.id]?.markdown ?? ''; const dates = markdown.match(/Dates:\s*(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/); return { id: String(w.id ?? `week-${i + 1}`), number: Number(w.number ?? w.week ?? i + 1), title: String(w.title ?? `Week ${i + 1}`), startDate: String(w.startDate ?? w.start ?? dates?.[1] ?? source.course.startsAt.slice(0, 10)), endDate: String(w.endDate ?? w.end ?? dates?.[2] ?? source.course.endsAt.slice(0, 10)), objectives: w.objectives ?? [], resources: children.filter(x => x.kind === 'external_link' || x.kind === 'assignment' || x.kind === 'quiz').map((r, j) => ({ id: r.id, title: r.title, type: r.kind === 'external_link' ? 'link' : r.kind, url: r.externalUrl, order: j + 1 })) } }),
  schedule: [...Object.entries(source.assignments ?? {}).map(([id, a]) => ({ id, type: 'assignment', title: a.markdown?.split('\n')[0]?.replace(/^#\s*/, '') ?? id, date: a.availableFrom ?? a.dueAt, dueAt: a.dueAt })), ...quizItems.map(q => ({ id: q.id, type: 'quiz', title: q.id, date: q.availableFrom ?? q.dueAt, dueAt: q.dueAt }))],
  assignments: Object.entries(source.assignments ?? {}).map(([id, a]) => ({ id, title: a.markdown?.split('\n')[0]?.replace(/^#\s*/, '') ?? id, instructions: a.markdown ?? '', points: Number(a.pointsWorth ?? 10), dueAt: a.dueAt, rubric: [], isPublished: false })),
  lessons: [...lectureItems.map((l, i) => ({ title: String(l.title ?? l.name ?? `Lecture ${i + 1}`), description: l.description ?? '', duration: duration(l.duration ?? '1h'), type: 'lesson', content: l.externalUrl ?? l.url ?? l.content ?? '' })), ...quizItems.map(q => ({ title: q.id, description: q.markdown ?? '', duration: duration(`${q.timeLimitMinutes ?? 1}m`), type: 'quiz', instructions: q.markdown ?? '', timeLimit: q.timeLimitMinutes, questions: (q.questions ?? []).map(normalizeQuestion) }))],
  gradingCategories: source.gradingCategories ?? source.grading?.assignmentGroups?.map(g => ({ category: g.name, weight: g.weightPercent })),
  sourceMetadata: { source: 'Lextures', sourceVersion: source.version ?? null, unsupportedFields: source.unsupportedFields ?? {}, originalQuestionCount: questions.length }
}
const allQuestions = packageData.lessons.flatMap(l => l.questions ?? [])
if (questions.length && allQuestions.length !== questions.length) throw new Error(`Question count mismatch: source ${questions.length}, output ${allQuestions.length}`)
if (packageData.gradingCategories && Math.abs(packageData.gradingCategories.reduce((s, x) => s + Number(x.weight ?? 0), 0) - 100) > 0.001) throw new Error('Grading category weights must total 100')
fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(packageData, null, 2) + '\n'); console.log(JSON.stringify({ output, weeks: packageData.modules.length, lessons: packageData.lessons.length, questions: allQuestions.length }))
