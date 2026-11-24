import { describe, expect, it } from 'vitest'
import { formatDeadline, reminderKinds, reminderKey } from '../../../netlify/functions/_lib/reminders.mjs'

describe('reminder timing', () => {
  const now = new Date('2026-01-01T00:00:00.000Z')
  it('schedules the configured windows', () => {
    expect(reminderKinds('2026-01-04T00:00:00.000Z', now)).toEqual(['assignment-3d'])
    expect(reminderKinds('2026-01-02T00:00:00.000Z', now)).toEqual(['deadline-1d'])
    expect(reminderKinds('2025-12-31T00:00:00.000Z', now)).toEqual(['overdue-1d'])
  })
  it('invalidates completed work and changed deadlines', () => {
    expect(reminderKinds('2026-01-02T00:00:00.000Z', now, true)).toEqual([])
    expect(reminderKey('u', 'assignment', 'a', 'deadline-1d', '2026-01-02T00:00:00Z')).not.toBe(reminderKey('u', 'assignment', 'a', 'deadline-1d', '2026-01-03T00:00:00Z'))
  })
  it('formats deadlines in the configured timezone', () => {
    expect(formatDeadline('2026-01-02T00:00:00.000Z', 'America/Halifax')).toContain('Jan')
    expect(() => formatDeadline('2026-01-02T00:00:00.000Z', 'Invalid/Zone')).toThrow()
  })
})
