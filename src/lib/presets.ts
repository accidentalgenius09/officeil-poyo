import type { UserProfile } from '../types'
import { countWorkingDaysInMonth, DEFAULT_OFFICE_GOAL } from './attendance'

export type PolicyPresetId =
  | 'daily'
  | 'three_per_week'
  | 'two_per_week'
  | 'custom_12'

export type PolicyPreset = {
  id: PolicyPresetId
  label: string
  blurb: string
  apply: (year: number, month: number) => Partial<UserProfile>
}

export const POLICY_PRESETS: PolicyPreset[] = [
  {
    id: 'daily',
    label: 'Every working day',
    blurb: 'Goal = all weekdays minus leave & holidays',
    apply: () => ({ goDaily: true }),
  },
  {
    id: 'three_per_week',
    label: '3 days / week',
    blurb: 'About 12 office days per month',
    apply: () => ({ goDaily: false, officeDaysGoal: 12 }),
  },
  {
    id: 'two_per_week',
    label: '2 days / week',
    blurb: 'About 8 office days per month',
    apply: () => ({ goDaily: false, officeDaysGoal: 8 }),
  },
  {
    id: 'custom_12',
    label: 'Classic 12',
    blurb: `Fixed ${DEFAULT_OFFICE_GOAL}-day monthly target`,
    apply: () => ({ goDaily: false, officeDaysGoal: DEFAULT_OFFICE_GOAL }),
  },
]

export function presetWorkingDayHint(
  year: number,
  month: number,
  settingsWorkingDays: number = countWorkingDaysInMonth(year, month),
): string {
  return `${settingsWorkingDays} working days this month`
}
