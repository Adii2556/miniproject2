const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

export const GROQ_MODELS = [
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile', note: 'Best quality · 280 t/s' },
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', note: 'Fastest · 560 t/s' },
  { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', note: 'Flagship open model' },
  { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B', note: 'Very fast · 1000 t/s' },
] as const

export interface AnalysisSettings {
  model: string
  temperature: number
  maxTokens: number
  summaryStyle: 'concise' | 'detailed' | 'bullets'
  language: string
  readingLevel: 'plain' | 'professional' | 'academic'
}

export interface QuizQuestion {
  question: string
  options: string[]
  answer: number // index
  explanation: string
}

export interface SentimentResult {
  label: 'Positive' | 'Neutral' | 'Negative' | 'Mixed'
  score: number // -100..100
  confidence: number // 0..100
  summary: string
  tones: string[]
}

export interface AnalysisResult {
  title: string
  summary: string
  keyPoints: string[]
  keywords: string[]
  sentiment: SentimentResult
  quiz: QuizQuestion[]
  oneLiner: string
  readingTimeNote?: string
}

export type AnalysisSection = 'summary' | 'keyPoints' | 'keywords' | 'sentiment' | 'quiz'

export class FriendlyError extends Error {
  code: 'NO_KEY' | 'AUTH' | 'RATE_LIMIT' | 'NETWORK' | 'BAD_JSON' | 'SERVER' | 'EMPTY' | 'TOO_BIG' | 'UNKNOWN'
  constructor(message: string, code: FriendlyError['code']) {
    super(message)
    this.code = code
  }
}

const MAX_INPUT_CHARS = 24000 // ~6k tokens of document context

function truncateDoc(text: string): string {
  const clean = text.trim()
  if (clean.length <= MAX_INPUT_CHARS) return clean
  const head = clean.slice(0, Math.floor(MAX_INPUT_CHARS * 0.72))
  const tail = clean.slice(Math.floor(clean.length * 0.15)).slice(-Math.floor(MAX_INPUT_CHARS * 0.28))
  return `${head}\n\n[… middle of document truncated for length …]\n\n${tail}`
}

function buildSystemPrompt(s: AnalysisSettings): string {
  const styleHint =
    s.summaryStyle === 'concise'
      ? 'Keep the summary tight: 3–4 sentences, no fluff.'
      : s.summaryStyle === 'bullets'
        ? 'Write the summary as 4–6 short bullet-point sentences joined by newlines, each starting with "• ".'
        : 'Write a thorough summary of 2–3 short paragraphs covering context, main arguments and conclusion.'
  const levelHint =
    s.readingLevel === 'plain'
      ? 'Use plain, friendly language a curious teenager could follow.'
      : s.readingLevel === 'academic'
        ? 'Use precise, scholarly language with domain terminology.'
        : 'Use clear professional language suited to coworkers.'
  return [
    'You are Docent, a meticulous document-analysis assistant.',
    `Write in ${s.language}. ${levelHint} ${styleHint}`,
    'Respond ONLY with a single valid JSON object — no markdown fences, no commentary before or after.',
    'The JSON object must have exactly this shape:',
    '{',
    '  "title": string,             // a compelling suggested title, max 12 words, no quotes inside',
    '  "oneLiner": string,          // a one-sentence "what is this about" hook, max 25 words',
    '  "summary": string,           // the summary per the style above',
    '  "keyPoints": string[],       // 5 to 7 crisp takeaways, each one sentence',
    '  "keywords": string[],        // 8 to 12 lowercase single/short-phrase keywords or topics',
    '  "sentiment": {',
    '    "label": "Positive" | "Neutral" | "Negative" | "Mixed",',
    '    "score": number,           // sentiment polarity -100 (very negative) to 100 (very positive)',
    '    "confidence": number,      // 0 to 100',
    '    "summary": string,         // one sentence explaining WHY the sentiment is what it is',
    '    "tones": string[]          // 2 to 4 adjectives describing the tone, e.g. ["hopeful","analytical"]',
    '  },',
    '  "quiz": [                    // exactly 10 multiple-choice questions grounded ONLY in the document',
    '    {',
    '      "question": string,',
    '      "options": [string, string, string, string],',
    '      "answer": number,        // 0-based index of the correct option',
    '      "explanation": string    // one short sentence, referencing the document',
    '    }',
    '  ]',
    '}',
    'Never invent facts that are not supported by the document. If the document is very short, still fill every field sensibly.',
  ].join('\n')
}

function buildSectionPrompt(sections: AnalysisSection[]): string {
  const fields: Record<AnalysisSection, string> = {
    summary: 'summary (plus the "title" and "oneLiner" fields, which always belong to the summary)',
    keyPoints: 'keyPoints',
    keywords: 'keywords',
    sentiment: 'sentiment',
    quiz: 'quiz',
  }
  return `Analyze the document and return a JSON object containing ONLY these requested fields: ${sections.map(s => fields[s]).join(', ')}. Omit everything else. Same JSON shapes as specified.`
}

function parseJsonLoose(content: string): unknown {
  let cleaned = content.trim()
  // strip markdown fences if the model added them anyway
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    // find the outermost {...} block
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1))
    }
    throw new FriendlyError('The model returned something that was not valid JSON. Try again, or lower the temperature.', 'BAD_JSON')
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : 0))
const asString = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v.trim() : fallback)
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const asStringArray = (v: unknown): string[] => asArray(v).filter(x => typeof x === 'string').map(x => (x as string).trim()).filter(Boolean)

function normalizeAnalysis(parsed: unknown, requested: AnalysisSection[]): Partial<AnalysisResult> {
  const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>
  const out: Partial<AnalysisResult> = {}

  if (requested.includes('summary')) {
    out.title = asString(obj.title, 'Untitled document')
    out.oneLiner = asString(obj.oneLiner, 'A document worth reading.')
    out.summary = asString(obj.summary, '').trim()
    if (!out.summary) throw new FriendlyError('The model came back with an empty summary. Please try again.', 'BAD_JSON')
  }

  if (requested.includes('keyPoints')) {
    out.keyPoints = asStringArray(obj.keyPoints).slice(0, 8)
    if (!out.keyPoints.length) throw new FriendlyError('The model returned no key points. Please try again.', 'BAD_JSON')
  }

  if (requested.includes('keywords')) {
    out.keywords = asStringArray(obj.keywords).map(k => k.toLowerCase()).slice(0, 14)
    if (!out.keywords.length) throw new FriendlyError('The model returned no keywords. Please try again.', 'BAD_JSON')
  }

  if (requested.includes('sentiment')) {
    const s = (obj.sentiment && typeof obj.sentiment === 'object' ? obj.sentiment : {}) as Record<string, unknown>
    const rawLabel = asString(s.label, 'Neutral')
    const label = (['Positive', 'Neutral', 'Negative', 'Mixed'] as const).find(l => l.toLowerCase() === rawLabel.toLowerCase()) ?? 'Neutral'
    out.sentiment = {
      label,
      score: clamp(Number(s.score), -100, 100),
      confidence: clamp(Number(s.confidence ?? 75), 0, 100),
      summary: asString(s.summary, 'The tone of the document appears even and measured.'),
      tones: asStringArray(s.tones).slice(0, 4),
    }
  }

  if (requested.includes('quiz')) {
    const quiz: QuizQuestion[] = []
    for (const q of asArray(obj.quiz)) {
      const qo = (q && typeof q === 'object' ? q : {}) as Record<string, unknown>
      const options = asStringArray(qo.options).slice(0, 4)
      if (options.length < 2) continue
      const answer = clamp(Math.round(Number(qo.answer)), 0, options.length - 1)
      quiz.push({
        question: asString(qo.question, 'Question'),
        options,
        answer,
        explanation: asString(qo.explanation, ''),
      })
      if (quiz.length === 10) break
    }
    if (!quiz.length) throw new FriendlyError('The model returned an empty quiz. Please try again.', 'BAD_JSON')
    out.quiz = quiz
  }

  return out
}

export async function callGroq(apiKey: string, settings: AnalysisSettings, sections: AnalysisSection[], docText: string, signal?: AbortSignal): Promise<Partial<AnalysisResult> & { rawText: string }> {
  const key = apiKey.trim()
  if (!key) {
    throw new FriendlyError('Your Groq API key is missing. Add it in the sidebar (or set VITE_GROQ_API_KEY in a .env file) and try again.', 'NO_KEY')
  }
  if (!docText.trim()) {
    throw new FriendlyError('The document appears to be empty — there is nothing to analyze yet.', 'EMPTY')
  }

  const system = buildSystemPrompt(settings)
  const user = `${buildSectionPrompt(sections)}\n\n--- DOCUMENT START ---\n${truncateDoc(docText)}\n--- DOCUMENT END ---`

  let response: Response
  try {
    response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: settings.model,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
        top_p: 0.95,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal,
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new FriendlyError('Could not reach Groq — check your internet connection and try again.', 'NETWORK')
  }

  if (!response.ok) {
    let detail = ''
    try {
      const errJson = (await response.json()) as { error?: { message?: string } }
      detail = errJson?.error?.message ?? ''
    } catch {
      detail = await response.text().catch(() => '')
    }
    if (response.status === 401 || response.status === 403) {
      throw new FriendlyError('Groq rejected your API key (401). Double-check it at console.groq.com → API Keys — it may be expired or mistyped.', 'AUTH')
    }
    if (response.status === 429) {
      throw new FriendlyError('Rate limit reached for this model on Groq. Wait a moment, or switch to Llama 3.1 8B Instant in the sidebar.', 'RATE_LIMIT')
    }
    if (response.status >= 500) {
      throw new FriendlyError('Groq is having a moment (server error). Try again in a few seconds.', 'SERVER')
    }
    throw new FriendlyError(detail ? `Groq error ${response.status}: ${detail}` : `Groq returned an unexpected error (${response.status}). Try adjusting the model or max tokens.`, 'UNKNOWN')
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { completion_tokens?: number; prompt_tokens?: number; total_tokens?: number }
  }
  const content = data?.choices?.[0]?.message?.content ?? ''
  if (!content.trim()) {
    throw new FriendlyError('Groq returned an empty response. Try raising Max tokens in the sidebar.', 'BAD_JSON')
  }

  const parsed = parseJsonLoose(content)
  const normalized = normalizeAnalysis(parsed, sections)
  return { ...normalized, rawText: content }
}

export async function askGroq(apiKey: string, settings: AnalysisSettings, docText: string, history: Array<{ role: 'user' | 'assistant'; content: string }>, question: string, signal?: AbortSignal): Promise<string> {
  const key = apiKey.trim()
  if (!key) {
    throw new FriendlyError('Your Groq API key is missing. Add it in the sidebar before asking questions.', 'NO_KEY')
  }
  const system = [
    'You are Docent, a warm, precise document assistant.',
    `The user has uploaded a document. Answer strictly from it; if the answer is not in the document, say so briefly instead of inventing. Reply in ${settings.language}, in short paragraphs with occasional "- " bullet lines. Keep answers under 180 words.`,
    '--- DOCUMENT START ---',
    truncateDoc(docText),
    '--- DOCUMENT END ---',
  ].join('\n')

  let response: Response
  try {
    response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: settings.model,
        temperature: settings.temperature,
        max_tokens: Math.min(settings.maxTokens, 1024),
        messages: [
          { role: 'system', content: system },
          ...history.slice(-6).map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: question },
        ],
      }),
      signal,
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new FriendlyError('Could not reach Groq — check your connection and try again.', 'NETWORK')
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new FriendlyError('Groq rejected your API key (401). Re-check it in the sidebar.', 'AUTH')
    if (response.status === 429) throw new FriendlyError('Rate limit reached. Wait a few seconds and ask again.', 'RATE_LIMIT')
    throw new FriendlyError(`Groq returned an error (${response.status}). Please try again.`, 'UNKNOWN')
  }
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const answer = data?.choices?.[0]?.message?.content?.trim()
  if (!answer) throw new FriendlyError('Groq returned an empty answer. Please try again.', 'BAD_JSON')
  return answer
}
