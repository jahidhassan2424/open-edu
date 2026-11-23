import { describe, expect, it, vi } from 'vitest'
const provider = vi.hoisted(() => ({ enabled: vi.fn(() => true), createNote: vi.fn().mockResolvedValue('n1'), getNote: vi.fn().mockResolvedValue(null), updateNote: vi.fn(), deleteNote: vi.fn(), getNotes: vi.fn().mockResolvedValue({ notes: [], total: 0, hasMore: false }), createBookmark: vi.fn().mockResolvedValue('b1'), getLessonBookmarks: vi.fn().mockResolvedValue([]), deleteBookmark: vi.fn(), createHighlight: vi.fn().mockResolvedValue('h1'), updateHighlight: vi.fn(), getLessonHighlights: vi.fn().mockResolvedValue([]), deleteHighlight: vi.fn(), getNoteStats: vi.fn().mockResolvedValue({}), saveReadingPosition: vi.fn(), loadReadingPosition: vi.fn().mockResolvedValue(null), deleteReadingPosition: vi.fn() }))
vi.mock('$lib/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({ collection: vi.fn(), doc: vi.fn(), query: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn(), startAfter: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(), addDoc: vi.fn(), updateDoc: vi.fn(), deleteDoc: vi.fn(), serverTimestamp: vi.fn() }))
vi.mock('./mongo-provider', () => ({ mongoProvider: provider }))
const { NotesService } = await import('./notes')
const positions = await import('./readingPosition')
describe('study tools MongoDB routing', () => {
  it('routes CRUD and reading position operations to provider', async () => {
    await NotesService.createNote({ userId: 'u', courseId: 'c', lessonId: 'l', content: 'x', position: 1, isPrivate: true })
    await NotesService.getNote('n1'); await NotesService.updateNote('n1', { content: 'y' }); await NotesService.deleteNote('n1')
    await NotesService.createBookmark({ userId: 'u', courseId: 'c', lessonId: 'l', position: 1 }); await NotesService.getLessonBookmarks('u', 'c', 'l'); await NotesService.deleteBookmark('b1')
    await NotesService.createHighlight({ userId: 'u', courseId: 'c', lessonId: 'l', text: 'x', startOffset: 0, endOffset: 1, color: 'yellow' }); await NotesService.getLessonHighlights('u', 'c', 'l'); await NotesService.updateHighlight('h1', { note: 'n' }); await NotesService.deleteHighlight('h1'); await NotesService.getNoteStats('u')
    await positions.saveReadingPosition({ userId: 'u', courseId: 'c', lessonId: 'l', scrollPercentage: 10, scrollTop: 4, activeHeadingId: null, sectionsCompleted: [], timeSpent: 1, lastPosition: 4 }); await positions.loadReadingPosition('u', 'l'); await positions.deleteReadingPosition('u', 'l')
    expect(provider.createNote).toHaveBeenCalled(); expect(provider.getNotes).not.toHaveBeenCalled(); expect(provider.deleteHighlight).toHaveBeenCalledWith('h1'); expect(provider.saveReadingPosition).toHaveBeenCalled()
  })
})
