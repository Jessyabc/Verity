/** Local-only preferences until profile sync exists. */

const KEY_WEEKEND = 'verity.research.weekends'

export function getResearchWeekendsEnabled(): boolean {
  try {
    return localStorage.getItem(KEY_WEEKEND) === 'true'
  } catch {
    return false
  }
}

export function setResearchWeekendsEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY_WEEKEND, on ? 'true' : 'false')
  } catch {
    /* ignore */
  }
}
