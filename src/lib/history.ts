export interface HistoryEntry {
  id: string
  savedAt: number
  fileName: string
  kind: 'PDF' | 'TEXT'
  pageCount: number | null
  words: number
  title: string
  oneLiner: string
  sentimentLabel?: string
  /** Source text is kept in memory for this page session only. */
  text: string
}

const MAX_ENTRIES = 6
const LEGACY_STORAGE_KEYS = [
  'doclense.groq-key',
  'doclense.groq-key-saved',
  'doclense.history.v1',
] as const

let entries: HistoryEntry[] = []

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${entries.length}`
}

export function clearLegacySensitiveStorage(): void {
  try {
    for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key)
  } catch {
    // Storage may be blocked by the browser. The app no longer writes these keys.
  }
}

export function loadHistory(): HistoryEntry[] {
  return [...entries]
}

export function saveHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'savedAt'>): HistoryEntry[] {
  const next: HistoryEntry = {
    ...entry,
    id: createId(),
    savedAt: Date.now(),
  }
  const deduped = entries.filter(item => item.title !== next.title || item.fileName !== next.fileName)
  entries = [next, ...deduped].slice(0, MAX_ENTRIES)
  return [...entries]
}

export function clearHistory(): void {
  entries = []
}
