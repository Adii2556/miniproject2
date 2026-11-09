import type { DocumentModel } from './document'
import { createTextDocument } from './document'

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
  /** Structured document model preserving source blocks and page references */
  document: DocumentModel
}

const MAX_ENTRIES = 8
const LEGACY_STORAGE_KEYS = [
  'doclense.groq-key',
  'doclense.groq-key-saved',
  'doclense.history.v1',
  'docent.groq-key',
  'docent.groq-key-saved',
  'docent.history.v1',
  'arena_vid',
] as const

const LEGACY_SESSION_KEYS = [
  '__arena_rec',
  'doclense_session_cache',
] as const

let entries: HistoryEntry[] = []

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${entries.length}`
}

export function purgeLegacySensitiveStorage(): void {
  try {
    for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key)
    for (const key of LEGACY_SESSION_KEYS) sessionStorage.removeItem(key)
  } catch {
    // Storage may be blocked by the browser. The app no longer writes these keys.
  }
}

export const clearLegacySensitiveStorage = purgeLegacySensitiveStorage

export function loadHistory(): HistoryEntry[] {
  return [...entries]
}

export function saveHistoryEntry(
  entry: Omit<HistoryEntry, 'id' | 'savedAt' | 'kind' | 'text' | 'document'> & {
    kind?: 'PDF' | 'TEXT'
    text?: string
    document?: DocumentModel
  },
): HistoryEntry[] {
  const doc: DocumentModel = entry.document ?? createTextDocument(entry.text ?? '', entry.fileName)
  const next: HistoryEntry = {
    ...entry,
    id: createId(),
    savedAt: Date.now(),
    kind: entry.kind ?? doc.kind,
    text: entry.text ?? doc.fullText,
    document: doc,
  }
  const deduped = entries.filter(item => item.title !== next.title || item.fileName !== next.fileName)
  entries = [next, ...deduped].slice(0, MAX_ENTRIES)
  return [...entries]
}

export function clearHistory(): void {
  entries = []
}
