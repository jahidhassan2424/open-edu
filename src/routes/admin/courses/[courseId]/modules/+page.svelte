<script lang="ts">
 import { page } from '$app/state'
 import { CourseService } from '$lib/services/courses'
 import { validateAcademicPlan } from '$lib/services/academic'
 import { authState } from '$lib/auth.svelte'
 import { canManageCourses } from '$lib/utils/admin'
 import { navigate } from '$lib/utils/navigation'
 import type { Course } from '$lib/types'
 import type { WeeklyModule } from '$lib/types/academic'
 let course = $state<Course | null>(null); let modules = $state<WeeklyModule[]>([]); let error = $state(''); let saving = $state(false)
 const courseId = $derived(page.params.courseId as string)
 $effect(() => { if (!authState.loading) { if (!authState.user || !canManageCourses(authState.user)) navigate('/dashboard'); else load() } })
 async function load() { course = await CourseService.getCourse(courseId); modules = structuredClone(course?.modules ?? []) }
 function addModule() { modules = [...modules, { id: crypto.randomUUID(), number: modules.length + 1, title: '', startDate: '', endDate: '', objectives: [], resources: [] }] }
 function removeModule(id: string) { modules = modules.filter((m) => m.id !== id) }
 function update(id: string, changes: Partial<WeeklyModule>) { modules = modules.map((m) => m.id === id ? { ...m, ...changes } : m) }
 function resourceText(module: WeeklyModule) { return module.resources.filter((r) => r.lessonId).sort((a, b) => a.order - b.order).map((r) => r.lessonId).join('\n') }
 function updateResources(module: WeeklyModule, event: Event) { const value = (event.currentTarget as HTMLTextAreaElement).value; update(module.id, { resources: value.split('\n').map((lessonId, i) => ({ id: `${module.id}-resource-${i + 1}`, title: lessonId.trim(), type: 'lesson' as const, lessonId: lessonId.trim(), order: i + 1 })).filter((r) => r.lessonId) }) }
 async function save() { error = ''; const errors = validateAcademicPlan(modules, course?.schedule ?? [], course?.lessonsMetadata?.map((l) => l.id) ?? []); if (errors.length) { error = errors.join('; '); return }; saving = true; try { await CourseService.updateCourse(courseId, { modules }); await load() } catch (e) { error = e instanceof Error ? e.message : 'Unable to save modules' } finally { saving = false } }
</script>
<main class="container mx-auto max-w-4xl p-6"><h1 class="text-2xl font-semibold">Weekly modules</h1><p class="mb-4 text-muted-foreground">Edit dates, objectives, and ordered resource references.</p>
 {#each modules as module}<section class="mb-4 rounded border p-4"><div class="grid gap-2 md:grid-cols-4"><input type="number" min="1" value={module.number} oninput={(e: Event) => update(module.id, { number: Number((e.currentTarget as HTMLInputElement).value) })} /><input class="md:col-span-2" placeholder="Module title" value={module.title} oninput={(e: Event) => update(module.id, { title: (e.currentTarget as HTMLInputElement).value })} /><button onclick={() => removeModule(module.id)}>Remove</button></div><div class="mt-2 grid gap-2 md:grid-cols-2"><input type="date" value={module.startDate} oninput={(e: Event) => update(module.id, { startDate: (e.currentTarget as HTMLInputElement).value })} /><input type="date" value={module.endDate} oninput={(e: Event) => update(module.id, { endDate: (e.currentTarget as HTMLInputElement).value })} /></div><textarea class="mt-2 w-full" rows="2" placeholder="One objective per line" value={module.objectives.join('\n')} oninput={(e: Event) => update(module.id, { objectives: (e.currentTarget as HTMLTextAreaElement).value.split('\n').map((x) => x.trim()).filter(Boolean) })}></textarea><textarea class="mt-2 w-full" rows="2" placeholder="Ordered lesson IDs, one per line" value={resourceText(module)} oninput={(e: Event) => updateResources(module, e)}></textarea></section>{/each}
 <button class="mr-2 rounded border px-3 py-2" onclick={addModule}>Add module</button><button class="rounded bg-primary px-3 py-2 text-primary-foreground" disabled={saving} onclick={save}>{saving ? 'Saving…' : 'Save modules'}</button>{#if error}<p class="mt-3 text-destructive">{error}</p>{/if}
</main>
