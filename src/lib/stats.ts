export interface DocStats {
  words: number
  characters: number
  charactersNoSpaces: number
  sentences: number
  paragraphs: number
  readingMinutes: number // float
  avgWordsPerSentence: number
  lexiconDiversity: number // type-token ratio 0..1
  readingTimeLabel: string
}

export function computeStats(raw: string): DocStats {
  const text = raw.replace(/\r\n/g, '\n').trim()
  const wordsArr = text ? text.split(/\s+/).filter(Boolean) : []
  const words = wordsArr.length
  const characters = text.length
  const charactersNoSpaces = text.replace(/\s/g, '').length
  const sentences = text ? (text.match(/[^.!?\n]+[.!?]+(?=\s|$)|[^.!?\n]+$/g) ?? [text]).filter(s => s.trim().length > 0).length : 0
  const paragraphs = text ? text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length : 0
  const readingMinutes = words / 225
  const avgWordsPerSentence = sentences > 0 ? words / sentences : words
  const lexiconDiversity = words > 0 ? new Set(wordsArr.map(w => w.toLowerCase().replace(/[^a-z0-9'-]/gi, ''))).size / words : 0

  const totalSec = Math.round(readingMinutes * 60)
  const readingTimeLabel = totalSec < 60 ? `${Math.max(1, totalSec)} sec` : `${Math.floor(totalSec / 60)} min ${totalSec % 60 ? `${totalSec % 60}s` : ''}`.trim()

  return {
    words,
    characters,
    charactersNoSpaces,
    sentences,
    paragraphs,
    readingMinutes,
    avgWordsPerSentence,
    lexiconDiversity,
    readingTimeLabel,
  }
}

const STOPWORDS = new Set(
  ('a,an,the,and,or,but,if,then,else,for,of,at,by,from,in,into,on,off,over,under,to,with,about,as,into,like,up,so,than,too,very,can,will,just,should,now,is,are,was,were,be,been,being,have,has,had,do,does,did,doing,would,could,ought,i,you,he,she,it,we,they,them,his,her,its,our,their,this,that,these,those,there,here,what,which,who,whom,how,when,where,why,all,each,every,some,any,no,not,only,own,same,such,also,may,much,more,most,other,into,upon,without,within,across,however,therefore,thus,hence,yet,still,again,once').split(',')
)

/** Deterministic frequency-based keyword extraction (TF-ish), used as fallback and for highlighting. */
export function extractKeywords(raw: string, limit = 10): string[] {
  const words = raw.toLowerCase().match(/[a-z][a-z0-9'-]{2,}/g) ?? []
  const freq = new Map<string, number>()
  for (const w of words) {
    if (STOPWORDS.has(w)) continue
    freq.set(w, (freq.get(w) ?? 0) + 1)
  }
  // bonus for appearing in first 15% of doc (titles/themes)
  const head = raw.slice(0, Math.floor(raw.length * 0.15)).toLowerCase()
  for (const w of head.match(/[a-z][a-z0-9'-]{2,}/g) ?? []) {
    if (!STOPWORDS.has(w) && freq.has(w)) freq.set(w, (freq.get(w) ?? 0) + 1.5)
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w)
}

export function highlightMatches(text: string, keywords: string[]): Array<{ text: string; highlight: boolean }> {
  if (!keywords.length || !text) return [{ text, highlight: false }]
  const escaped = keywords
    .filter(k => k.trim().length > 2)
    .map(k => k.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length)
  if (!escaped.length) return [{ text, highlight: false }]
  const re = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi')
  const parts: Array<{ text: string; highlight: boolean }> = []
  let last = 0
  for (const match of text.matchAll(re)) {
    const idx = match.index ?? 0
    if (idx > last) parts.push({ text: text.slice(last, idx), highlight: false })
    parts.push({ text: match[0], highlight: true })
    last = idx + match[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), highlight: false })
  return parts
}
