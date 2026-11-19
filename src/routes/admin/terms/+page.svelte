<script lang="ts">
 import { authState } from '$lib/auth.svelte'
 import { navigate } from '$lib/utils/navigation'
 import { getAcademicTerms, saveAcademicTerm, deleteAcademicTerm } from '$lib/services/academic'
 import type { AcademicTerm, AcademicTermStatus } from '$lib/types/academic'
 let terms = $state<AcademicTerm[]>([]); let name = $state(''); let startDate = $state(''); let endDate = $state(''); let status = $state<AcademicTermStatus>('planned'); let error = $state('')
 $effect(() => { if (!authState.loading && (!authState.user || authState.user.role !== 'admin')) navigate('/dashboard'); else if (!authState.loading && authState.user) load() })
 async function load() { terms = await getAcademicTerms() }
 async function add() { error = ''; try { if (!name || !startDate || !endDate) throw new Error('Name and dates are required'); await saveAcademicTerm({ name, startDate, endDate, status }); name = ''; await load() } catch (e) { error = e instanceof Error ? e.message : 'Unable to save term' } }
 async function remove(id: string) { await deleteAcademicTerm(id); await load() }
</script>
<svelte:head><title>Academic terms</title></svelte:head>
<main class="container mx-auto max-w-3xl p-6"><h1 class="text-2xl font-semibold">Academic terms</h1><p class="mb-6 text-muted-foreground">Manage reusable term date ranges for courses.</p>
 <div class="grid gap-2 md:grid-cols-4"><input bind:value={name} placeholder="Fall 2026" /><input type="date" bind:value={startDate} /><input type="date" bind:value={endDate} /><select bind:value={status}><option value="planned">Planned</option><option value="active">Active</option><option value="completed">Completed</option><option value="archived">Archived</option></select></div><button class="mt-2 rounded bg-primary px-3 py-2 text-primary-foreground" onclick={add}>Add term</button>{#if error}<p class="text-destructive">{error}</p>{/if}
 {#each terms as term}<div class="mt-4 flex items-center justify-between rounded border p-3"><span><strong>{term.name}</strong> · {term.startDate} – {term.endDate} · {term.status}</span><button onclick={() => remove(term.id)}>Delete</button></div>{/each}
</main>
