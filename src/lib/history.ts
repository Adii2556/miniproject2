export interface HistoryEntry {
  id: string
  savedAt: number
  fileName: string
  pageCount: number | null
  words: number
  title: string
  oneLiner: string
  sentimentLabel?: string
  /** Truncated source text so a history entry can be re-loaded instantly. */
  text: string
}

const KEY = 'docent.history.v1'
const MAX_ENTRIES = 6
const MAX_TEXT = 30000

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as HistoryEntry[]
    return Array.isArray(parsed) ? parsed.filter(e => typeof e?.text === 'string') : []
  } catch {
    return []
  }
}

export function saveHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'savedAt'>): HistoryEntry[] {
  const list = loadHistory()
  const next: HistoryEntry = {
    ...entry,
    text: entry.text.slice(0, MAX_TEXT),
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    savedAt: Date.now(),
  }
  const deduped = list.filter(e => e.title !== next.title || e.fileName !== next.fileName)
  const updated = [next, ...deduped].slice(0, MAX_ENTRIES)
  try {
    localStorage.setItem(KEY, JSON.stringify(updated))
  } catch {
    while (updated.length > 1) {
      updated.pop()
      try { localStorage.setItem(KEY, JSON.stringify(updated)); break } catch { /* keep pruning */ }
    }
  }
  return updated
}

export function clearHistory(): void {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
