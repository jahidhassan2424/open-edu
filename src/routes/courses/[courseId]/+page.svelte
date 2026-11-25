<script lang="ts">
	import { page } from '$app/state'
	import { navigate } from '$lib/utils/navigation'
	import { CourseService } from '$lib/services/courses'
	import { EnrollmentService } from '$lib/services/enrollment'
	import { authState } from '$lib/auth.svelte'
	import { canManageCourses } from '$lib/utils/admin'
	import { Button } from '$lib/components/ui'
	import { Badge } from '$lib/components/ui/badge'
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui'
	import { User, Clock, Users, Star, Edit, BookOpen, Check, PlayCircle, CircleHelp, FileText, ClipboardCheck, CalendarDays } from 'lucide-svelte'
	import type { Course, Enrollment, LessonMetadata } from '$lib/types'
	import Loading from '$lib/components/Loading.svelte'
	import DynamicBreadcrumb from '$lib/components/DynamicBreadcrumb.svelte'

	const courseId = $derived(page.params.courseId as string)
	let course = $state<Course | null>(null)
	let enrollment = $state<Enrollment | null>(null)
	let loading = $state(true)
	let enrolling = $state(false)
	let error = $state<string | null>(null)
	let thumbnailFailed = $state(false)

	// Derived states
	const isEnrolled = $derived(enrollment !== null)
	const canEnroll = $derived(
		authState.user && 
		course && 
		course.isPublished && 
		!isEnrolled
	)
	const canEditCourse = $derived(
		authState.user && canManageCourses(authState.user)
	)
	
	// v1.6.0: Use lessonsMetadata for listing, fall back to legacy lessons array
	const lessonsForDisplay = $derived.by<LessonMetadata[]>(() => {
		if (course?.lessonsMetadata && course.lessonsMetadata.length > 0) {
			return course.lessonsMetadata
		}
		// Fallback: convert legacy lessons to metadata format
		if (course?.lessons) {
			return course.lessons.map(lesson => ({
				id: lesson.id,
				title: lesson.title,
				description: lesson.description,
				order: lesson.order,
				type: lesson.videoUrl ? 'video' as const : (lesson.quiz ? 'quiz' as const : 'content' as const),
				duration: lesson.duration ?? 0,
				hasQuiz: !!lesson.quiz,
				isRequired: lesson.isRequired
			}))
		}
		return []
	})
	
	// Sorted lessons metadata for display
	const sortedLessons = $derived(
		[...lessonsForDisplay].sort((a, b) => a.order - b.order)
	)
	
	// Lesson count: prefer totalLessons, fall back to metadata/lessons length
	const lessonCount = $derived(
		course?.totalLessons ?? course?.lessonsMetadata?.length ?? course?.lessons?.length ?? 0
	)
	
	const canStartLearning = $derived(
		authState.user && 
		isEnrolled && 
		lessonCount > 0
	)

	// Load course data reactively when auth is initialized
	$effect(() => {
		if (!authState.initialized) {
			return // Wait for auth to initialize
		}
		
		loadCourseData()
	})

	// Separate effect for enrollment check - runs when auth state or course changes
	$effect(() => {
		if (!authState.initialized || !course) {
			return
		}
		
		if (authState.user) {
			loadEnrollmentStatus()
		} else {
			// User not logged in - clear enrollment
			enrollment = null
		}
	})

	async function loadCourseData() {
		loading = true
		error = null

		try {
			// Load course details (public data)
			const courseData = await CourseService.getCourse(courseId)
			if (!courseData) {
				error = 'Course not found'
				return
			}
			thumbnailFailed = false
			course = courseData
	} catch (err: unknown) {
		error = err instanceof Error ? err.message : 'Failed to load course'
		console.error('Error loading course:', err)
		} finally {
			loading = false
		}
	}

	async function loadEnrollmentStatus() {
		if (!authState.user) return
		
		try {
			const enrollmentData = await EnrollmentService.getEnrollment(authState.user.id, courseId)
			enrollment = enrollmentData
	} catch (err: unknown) {
		console.error('Error loading enrollment:', err)
		// Don't set error - enrollment check failure shouldn't block viewing course
		}
	}

	async function handleEnroll() {
		if (!authState.user || !canEnroll) return

		enrolling = true
		error = null

		try {
			await EnrollmentService.enrollUser(authState.user.id, courseId)
			
			// Reload enrollment status
			const enrollmentData = await EnrollmentService.getEnrollment(authState.user.id, courseId)
			enrollment = enrollmentData
			
			// Reload course data to get updated enrolled count
			const courseData = await CourseService.getCourse(courseId)
			if (courseData) {
				course = courseData
			}
			
	} catch (err: unknown) {
		error = err instanceof Error ? err.message : 'Failed to enroll in course'
		console.error('Error enrolling:', err)
		} finally {
			enrolling = false
		}
	}

	function handleStartLearning() {
		if (!course || lessonCount === 0) return
		
		// Find the first lesson from metadata
		const firstLesson = sortedLessons.find(lesson => lesson.order === 1) || sortedLessons[0]
		if (firstLesson) {
			navigate(`/courses/${courseId}/learn/${firstLesson.id}`)
		}
	}

	function formatDuration(duration: string): string {
		return duration || 'Self-paced'
	}

	function formatPrice(course: Course): string {
		if (course.level === 'free') return 'Free'
		if (course.price && course.currency) {
			return `${course.currency.toUpperCase()} ${course.price}`
		}
		return 'Premium'
	}

	function lessonKind(lesson: LessonMetadata): 'lesson' | 'video' | 'quiz' {
		if (lesson.type === 'quiz' || lesson.hasQuiz) return 'quiz'
		if (lesson.type === 'video') return 'video'
		return 'lesson'
	}

	function lessonKindLabel(lesson: LessonMetadata): string {
		const kind = lessonKind(lesson)
		return kind === 'quiz' ? 'Quiz' : kind === 'video' ? 'Video' : 'Lesson'
	}

</script>

<svelte:head>
	<title>{course?.title || 'Course'} - Open-EDU</title>
	<meta name="description" content={course?.description || 'Open-EDU Course'} />
</svelte:head>

{#if loading}
	<div class="flex justify-center items-center min-h-[50vh]">
		<Loading />
	</div>
{:else if error}
	<div class="container mx-auto px-4 py-8">
		<Card>
			<CardContent class="p-8 text-center">
				<h2 class="text-2xl font-bold text-destructive mb-4">Error</h2>
				<p class="text-muted-foreground mb-6">{error}</p>
				<Button onclick={() => navigate('/courses')}>
					Back to Courses
				</Button>
			</CardContent>
		</Card>
	</div>
{:else if !course}
	<div class="container mx-auto px-4 py-8">
		<Card>
			<CardContent class="p-8 text-center">
				<h2 class="text-2xl font-bold text-foreground mb-4">Course Not Found</h2>
				<p class="text-muted-foreground mb-6">The course you're looking for doesn't exist.</p>
				<Button onclick={() => navigate('/courses')}>
					Back to Courses
				</Button>
			</CardContent>
		</Card>
	</div>
{:else}
	<div class="container mx-auto px-4 py-8">
		<!-- Breadcrumb -->
		<DynamicBreadcrumb 
			items={[
				{ label: 'Courses', href: '/courses' },
				{ label: course.title, current: true }
			]} 
		/>
		
		<!-- Course Header -->
		<section class="mb-10 overflow-hidden rounded-2xl border bg-card shadow-sm">
			<div class="grid lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
				<div class="relative min-h-56 overflow-hidden bg-muted lg:min-h-full">
					{#if course.thumbnail && !thumbnailFailed}
						<img
							src={course.thumbnail}
							alt={course.title}
							class="absolute inset-0 h-full w-full object-cover"
							onerror={() => thumbnailFailed = true}
						/>
					{:else}
						<div class="absolute inset-0 flex flex-col justify-between bg-gradient-to-br from-primary via-primary/85 to-violet-700 p-6 text-primary-foreground">
							<div class="flex size-12 items-center justify-center rounded-xl bg-background/15 ring-1 ring-inset ring-white/20">
								<BookOpen class="size-6" aria-hidden="true" />
							</div>
							<div>
								<p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">Open-EDU</p>
								<p class="mt-2 text-xl font-semibold leading-tight">{course.category || 'Learning journey'}</p>
							</div>
						</div>
					{/if}
				</div>

				<div class="flex min-w-0 flex-col p-6 sm:p-8 lg:p-10">
					<div class="flex flex-wrap gap-2">
						<Badge variant="secondary">{course.category}</Badge>
						<Badge variant="outline" class="bg-secondary/30">{course.difficulty}</Badge>
						{#if course.isFeatured}
							<Badge class="bg-accent text-accent-foreground">Featured</Badge>
						{/if}
					</div>

					<h1 class="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-[2.6rem] lg:leading-tight">{course.title}</h1>
					<p class="mt-4 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">{course.description}</p>

					<div class="mt-6 grid gap-3 sm:grid-cols-3">
						<div class="flex min-w-0 items-center gap-3 rounded-lg bg-muted/60 px-3 py-3">
							<User class="size-4 shrink-0 text-primary" aria-hidden="true" />
							<div class="min-w-0"><p class="text-xs text-muted-foreground">Instructor</p><p class="truncate text-sm font-medium text-foreground">{course.instructor}</p></div>
						</div>
						<div class="flex min-w-0 items-center gap-3 rounded-lg bg-muted/60 px-3 py-3">
							<Clock class="size-4 shrink-0 text-primary" aria-hidden="true" />
							<div class="min-w-0"><p class="text-xs text-muted-foreground">Pace</p><p class="truncate text-sm font-medium text-foreground">{formatDuration(course.duration)}</p></div>
						</div>
						<div class="flex min-w-0 items-center gap-3 rounded-lg bg-muted/60 px-3 py-3">
							<Users class="size-4 shrink-0 text-primary" aria-hidden="true" />
							<div class="min-w-0"><p class="text-xs text-muted-foreground">Learners</p><p class="truncate text-sm font-medium text-foreground">{course.enrolled} enrolled</p></div>
						</div>
					</div>

					{#if course.rating > 0}
						<div class="mt-5 flex items-center gap-2 text-sm">
							<div class="flex items-center" aria-label={`${course.rating.toFixed(1)} out of 5 stars`}>
								{#each Array(5) as _, i (i)}
									<Star class="size-4 {i < Math.floor(course.rating) ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted'}" aria-hidden="true" />
								{/each}
							</div>
							<span class="font-medium text-foreground">{course.rating.toFixed(1)}</span>
							<span class="text-muted-foreground">({course.ratingCount} reviews)</span>
						</div>
					{/if}

					<div class="mt-6 flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
						<div><p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Course access</p><p class="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">{formatPrice(course)}</p></div>
						<div class="flex flex-col gap-2 sm:flex-row">
							{#if canEditCourse}
								<Button variant="outline" class="w-full sm:w-auto" onclick={() => navigate(`/admin/courses/${courseId}`)}><Edit class="mr-2 size-4" />Edit Course</Button>
							{/if}
							{#if !authState.user}
								<Button size="lg" class="w-full sm:w-auto" onclick={() => navigate('/auth/login')}>Sign In to Enroll</Button>
							{:else if canEnroll}
								<Button size="lg" class="w-full sm:w-auto" onclick={handleEnroll} disabled={enrolling}>{enrolling ? 'Enrolling...' : 'Enroll Now'}</Button>
							{:else if canStartLearning}
								<Button size="lg" class="w-full sm:w-auto" onclick={handleStartLearning}>Continue Learning</Button>
							{:else if isEnrolled}
								<Button variant="outline" class="w-full sm:w-auto" disabled>Already Enrolled</Button>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</section>

		<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
			<!-- Main Content -->
			<div class="lg:col-span-2">
				<!-- Learning Outcomes -->
				{#if course.learningOutcomes?.length}
					<Card class="mb-8 gap-0 overflow-hidden py-0">
						<CardHeader class="border-b bg-muted/30 py-5 sm:py-6">
							<div class="flex items-start justify-between gap-4">
								<div><CardTitle>What You'll Learn</CardTitle><CardDescription class="mt-1">Skills and outcomes you will build throughout this course.</CardDescription></div>
								<Badge variant="secondary">{course.learningOutcomes.length} outcomes</Badge>
							</div>
						</CardHeader>
						<CardContent class="p-4 sm:p-6">
							<ul class="grid gap-3 sm:grid-cols-2">
							{#each course.learningOutcomes as outcome (outcome)}
								<li class="flex items-start gap-3 rounded-xl border bg-background/60 p-4">
									<span class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Check class="size-3.5" strokeWidth={3} aria-hidden="true" /></span>
									<span class="text-sm leading-6 text-foreground">{outcome}</span>
								</li>
							{/each}
							</ul>
						</CardContent>
					</Card>
				{/if}

				<!-- Course Curriculum -->
				{#if lessonCount > 0}
					<Card class="mb-8 gap-0 overflow-hidden py-0">
						<CardHeader class="border-b bg-muted/30 py-5 sm:py-6">
							<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
								<div><CardTitle>Course Curriculum</CardTitle><CardDescription class="mt-1">Follow the lessons in order and complete the included knowledge checks.</CardDescription></div>
								<div class="flex flex-wrap gap-2"><Badge variant="secondary">{lessonCount} lesson{lessonCount !== 1 ? 's' : ''}</Badge>{#if course.totalQuizzes ?? course.quizzesMetadata?.length}<Badge variant="outline">{course.totalQuizzes ?? course.quizzesMetadata?.length} quiz{(course.totalQuizzes ?? course.quizzesMetadata?.length) !== 1 ? 'zes' : ''}</Badge>{/if}</div>
							</div>
						</CardHeader>
						<CardContent class="p-3 sm:p-4">
							<div class="divide-y rounded-xl border bg-background">
							{#each sortedLessons as lesson (lesson.id)}
								<div class="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-4">
									<div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{lesson.order || sortedLessons.indexOf(lesson) + 1}</div>
									<div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-2"><h4 class="font-semibold text-foreground">{lesson.title}</h4><Badge variant={lessonKind(lesson) === 'quiz' ? 'default' : 'outline'} class={lessonKind(lesson) === 'video' ? 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300' : ''}>{#if lessonKind(lesson) === 'quiz'}<CircleHelp class="size-3" />{:else if lessonKind(lesson) === 'video'}<PlayCircle class="size-3" />{:else}<FileText class="size-3" />{/if}{lessonKindLabel(lesson)}</Badge>{#if lesson.isRequired}<Badge variant="outline" class="border-destructive/30 bg-destructive/10 text-destructive">Required</Badge>{/if}</div>{#if lesson.description}<p class="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{lesson.description}</p>{/if}</div>
									<div class="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">{#if lesson.duration}<span class="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1"><Clock class="size-3" aria-hidden="true" />{lesson.duration} min</span>{/if}</div>
								</div>
							{/each}
							</div>
						</CardContent>
					</Card>
				{/if}
			</div>

			<!-- Sidebar -->
			{#if course.modules?.length || course.schedule?.length}
				<Card class="mb-6 gap-0 overflow-hidden py-0 lg:col-span-2">
					<CardHeader class="border-b bg-muted/30 py-5 sm:py-6"><CardTitle>Weekly schedule</CardTitle><CardDescription>Modules and upcoming academic activities</CardDescription></CardHeader>
					<CardContent class="space-y-3 p-4 sm:p-6">
						{#each (course.modules ?? []).slice().sort((a,b) => a.number-b.number) as module}
							<div class="rounded border p-3"><h3 class="font-medium">Week {module.number}: {module.title}</h3><p class="text-sm text-muted-foreground">{module.startDate} – {module.endDate}</p>{#if module.objectives.length}<ul class="list-disc pl-5 text-sm">{#each module.objectives as objective}<li>{objective}</li>{/each}</ul>{/if}<p class="text-sm">{module.resources.length} resource(s)</p></div>
						{/each}
						{#each (course.schedule ?? []).slice().sort((a,b) => a.date.localeCompare(b.date)) as activity}<div class="flex flex-col gap-2 border-b py-3 text-sm last:border-0 sm:flex-row sm:items-center sm:justify-between"><div class="flex min-w-0 items-center gap-2">{#if activity.type === 'assignment'}<ClipboardCheck class="size-4 shrink-0 text-primary" aria-hidden="true" />{:else if activity.type === 'exam'}<CircleHelp class="size-4 shrink-0 text-primary" aria-hidden="true" />{:else}<CalendarDays class="size-4 shrink-0 text-primary" aria-hidden="true" />{/if}<span class="truncate font-medium text-foreground">{activity.title}</span><Badge variant={activity.type === 'exam' ? 'default' : activity.type === 'assignment' ? 'secondary' : 'outline'} class="capitalize">{activity.type}</Badge></div><time class="shrink-0 text-muted-foreground">{activity.dueAt ?? activity.date}</time></div>{/each}
					</CardContent>
				</Card>
			{/if}

			<!-- Sidebar -->
			<div class="lg:col-span-1">
				<!-- Course Information -->
				<Card class="mb-6">
					<CardHeader>
						<CardTitle>Course Details</CardTitle>
					</CardHeader>
					<CardContent class="space-y-4">
						<div class="flex justify-between items-center">
							<span class="text-muted-foreground">Level:</span>
							<span class="font-medium text-foreground capitalize">{course.level}</span>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-muted-foreground">Duration:</span>
							<span class="font-medium text-foreground">{formatDuration(course.duration)}</span>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-muted-foreground">Lessons:</span>
							<span class="font-medium text-foreground">{lessonCount}</span>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-muted-foreground">Enrolled:</span>
							<span class="font-medium text-foreground">{course.enrolled}</span>
						</div>
						{#if course.prerequisites?.length}
							<div>
								<span class="text-muted-foreground block mb-2">Prerequisites:</span>
								<ul class="text-sm space-y-1">
								{#each course.prerequisites as prereq (prereq)}
									<li class="flex items-start gap-2">
										<span class="w-1.5 h-1.5 bg-muted-foreground rounded-full mt-2 shrink-0"></span>
										<span class="text-foreground">{prereq}</span>
									</li>
								{/each}
								</ul>
							</div>
						{/if}
					</CardContent>
				</Card>

				<!-- Tags -->
				{#if course.tags?.length}
					<Card>
						<CardHeader>
							<CardTitle>Tags</CardTitle>
						</CardHeader>
						<CardContent>
							<div class="flex flex-wrap gap-2">
							{#each course.tags as tag (tag)}
								<span class="px-3 py-1 bg-muted text-foreground text-sm rounded-full">
									{tag}
								</span>
							{/each}
							</div>
						</CardContent>
					</Card>
				{/if}
			</div>
		</div>

		<!-- Enrollment Error -->
		{#if error}
			<div class="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
				<div class="flex items-start gap-3">
					<svg class="w-5 h-5 text-destructive mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<div>
						<h3 class="text-sm font-medium text-destructive">Error</h3>
						<p class="text-sm text-destructive mt-1">{error}</p>
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}
