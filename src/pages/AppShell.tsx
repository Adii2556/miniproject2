import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Menu, Moon, Sun, CloudUpload, FileText, FileType2, X, Eye, Trash2, Sparkles, Zap,
  AlertTriangle, KeyRound, Check, ListChecks, Tags, Gauge, FileQuestion, AlignLeft,
  Send, Eraser, ArrowRight, Loader2, CircleAlert, BookOpenText, Lock, ChevronRight,
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import ResultsView, { StatsGrid, GeneratedStamp } from '../components/ResultsView'
import QuizCard from '../components/QuizCard'
import DocumentReader from '../components/DocumentReader'
import CitationChips from '../components/CitationChips'
import DocLenseLogo from '../components/DocLenseLogo'
import { useTheme } from '../lib/useTheme'
import { FileSafetyError, validatePdfSignature, validatePlainText } from '../lib/fileSecurity'
import { computeStats, extractKeywords, type DocStats } from '../lib/stats'
import {
  callGroq, askGroq, FriendlyError, GROQ_MODELS, normalizeSettings,
  type AnalysisSettings, type AnalysisResult, type AnalysisSection, type AnalysisProgress,
} from '../lib/groq'
import { SAMPLE_DOCS } from '../lib/samples'
import { clearHistory, clearLegacySensitiveStorage, loadHistory, saveHistoryEntry, type HistoryEntry } from '../lib/history'
import { buildDownloadText, downloadTextFile, type GeneratedMap } from '../lib/analysis'
import { inspectDocumentSafety } from '../lib/documentSecurity'
import { createTextDocument, stableDocumentId, type Citation, type DocumentModel } from '../lib/document'
import type { OcrProgress } from '../lib/ocr'

const LS_SETTINGS = 'doclense.settings.v1'
const MAX_FILE_MB = 15
const CHAT_LIMIT = 2000

const DEFAULT_SETTINGS: AnalysisSettings = {
  model: 'llama-3.3-70b-versatile',
  temperature: 0.7,
  maxTokens: 3072,
  summaryStyle: 'concise',
  language: 'English',
  readingLevel: 'professional',
  analysisMode: 'sampled',
  maxChunks: 8,
  quizDifficulty: 'adaptive',
}

type SectionKey = 'summary' | 'keyPoints' | 'keywords' | 'sentiment' | 'quiz'
const SECTION_KEYS: SectionKey[] = ['summary', 'keyPoints', 'keywords', 'sentiment', 'quiz']

interface UploadedDoc extends DocumentModel {
  sizeBytes: number
  firstPageDataUrl: string | null
  stats: DocStats
  hasInstructionLikeContent: boolean
  ocrApplied?: boolean
}

interface PendingOcr {
  file: File
  buffer: ArrayBuffer
  documentId: string
  pageCount: number
  firstPageDataUrl: string | null
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  evidenceStatus?: 'verified' | 'uncertain' | 'unavailable'
  isError?: boolean
}

interface UploadErrorState {
  title: string
  detail: string
}

interface Toast {
  id: number
  message: string
  tone: 'ok' | 'error'
}

function loadStoredSettings(): AnalysisSettings {
  try {
    const raw = localStorage.getItem(LS_SETTINGS)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<AnalysisSettings>
    return normalizeSettings({ ...DEFAULT_SETTINGS, ...parsed })
  } catch {
    return DEFAULT_SETTINGS
  }
}

const UPLOAD_STAGES = ['Validating file…', 'Reading document…', 'Extracting text…', 'Computing statistics…']
const GEN_STAGES = ['Reading the document…', 'Drafting your summary…', 'Extracting keywords…', 'Gauging sentiment…', 'Writing quiz questions…', 'Polishing the details…']
const SUGGESTIONS = ['What is the main argument of this document?', 'Who is the intended audience?', 'What are the strongest counterarguments or risks?']

export default function AppShell() {
  const { theme, toggleTheme } = useTheme()

  // ---------- sidebar / key / settings ----------
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [revealKey, setRevealKey] = useState(false)
  const [settings, setSettings] = useState<AnalysisSettings>(loadStoredSettings)

  useEffect(() => {
    clearLegacySensitiveStorage()
  }, [])

  useEffect(() => {
    try { localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)) } catch { /* ignore */ }
  }, [settings])

  const updateSettings = useCallback((patch: Partial<AnalysisSettings>) => setSettings(current => normalizeSettings({ ...current, ...patch })), [])

  const canUseGroq = apiKey.trim().length > 0

  // ---------- document state ----------
  const [uploaded, setUploaded] = useState<UploadedDoc | null>(null)
  const [documents, setDocuments] = useState<UploadedDoc[]>([])
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploadStage, setUploadStage] = useState(0)
  const [uploadError, setUploadError] = useState<UploadErrorState | null>(null)
  const [pendingOcr, setPendingOcr] = useState<PendingOcr | null>(null)
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [highlightKeywords, setHighlightKeywords] = useState(true)
  const [readerOpen, setReaderOpen] = useState(false)
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null)

  // ---------- analysis state ----------
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({ summary: true, keyPoints: true, keywords: true, sentiment: true, quiz: true })
  const [generating, setGenerating] = useState(false)
  const [genStage, setGenStage] = useState(0)
  const [result, setResult] = useState<Partial<AnalysisResult> | null>(null)
  const [generated, setGenerated] = useState<GeneratedMap>({ summary: false, keyPoints: false, keywords: false, sentiment: false, quiz: false })
  const [showResults, setShowResults] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null)

  // ---------- chat about the doc ----------
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [askLoading, setAskLoading] = useState(false)

  // ---------- history / toasts ----------
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory())
  const [toasts, setToasts] = useState<Toast[]>([])
  const workspaceStats = useMemo(() => computeStats(documents.map(document => document.fullText).join('\n\n')), [documents])

  const mainRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const generationAbortRef = useRef<AbortController | null>(null)
  const fileAbortRef = useRef<AbortController | null>(null)
  const questionAbortRef = useRef<AbortController | null>(null)
  const toastId = useRef(0)

  const pushToast = useCallback((message: string, tone: Toast['tone'] = 'ok') => {
    const id = ++toastId.current
    setToasts(t => [...t.slice(-2), { id, message, tone }])
    window.setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3600)
  }, [])

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
    pushToast('Settings reset to defaults')
  }, [pushToast])

  useEffect(() => () => {
    generationAbortRef.current?.abort()
    fileAbortRef.current?.abort()
    questionAbortRef.current?.abort()
  }, [])

  // ---------- stage cycling ----------
  useEffect(() => {
    if (!uploading) return
    const t = window.setInterval(() => setUploadStage(s => Math.min(s + 1, UPLOAD_STAGES.length - 1)), 750)
    return () => window.clearInterval(t)
  }, [uploading])

  useEffect(() => {
    if (!generating) return
    const t = window.setInterval(() => setGenStage(s => Math.min(s + 1, GEN_STAGES.length - 1)), 1500)
    return () => window.clearInterval(t)
  }, [generating])

  // pin results to the TOP (never auto-scroll to bottom after generation)
  const pinToTop = useCallback(() => {
    const el = mainRef.current
    if (el) el.scrollTo({ top: 0, behavior: 'auto' })
    window.scrollTo(0, 0)
  }, [])

  // ---------- ingest pipeline ----------
  const ingestDocument = useCallback((documentModel: DocumentModel, sizeBytes: number, firstPageDataUrl: string | null, replaceWorkspace = false, ocrApplied = false) => {
    const stats = computeStats(documentModel.fullText)
    const safety = inspectDocumentSafety(documentModel.fullText)
    const next: UploadedDoc = { ...documentModel, sizeBytes, firstPageDataUrl, stats, hasInstructionLikeContent: safety.hasInstructionLikeContent, ocrApplied }
    setUploaded(next)
    setDocuments(current => replaceWorkspace ? [next] : [...current.filter(document => document.id !== next.id), next].slice(-6))
    setResult(null)
    setShowResults(false)
    setGenError(null)
    setMessages([])
    setUploadError(null)
    setPendingOcr(null)
    setOcrProgress(null)
  }, [])

  const processFile = useCallback(async (file: File, documentOrdinal = documents.length) => {
    setUploadError(null)
    const ext = file.name.toLowerCase().split('.').pop() ?? ''
    const kind: 'PDF' | 'TEXT' = ext === 'pdf' ? 'PDF' : 'TEXT'
    if (!['pdf', 'txt', 'md', 'text'].includes(ext)) {
      setUploadError({ title: `Unsupported file type “.${ext}”`, detail: 'DocLense reads PDF and plain-text files only. If you have a Word document or a scan, export it to PDF first (File → Export), then drop it back in.' })
      return
    }
    if (file.size === 0) {
      setUploadError({ title: 'That file is empty', detail: 'This file has zero bytes — there is nothing inside to analyze. Try re-downloading or re-exporting it.' })
      return
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setUploadError({ title: 'File is too large', detail: `This file is ${(file.size / (1024 * 1024)).toFixed(1)} MB. DocLense handles up to ${MAX_FILE_MB} MB — try a shorter document or trim the PDF.` })
      return
    }

    fileAbortRef.current?.abort()
    const controller = new AbortController()
    fileAbortRef.current = controller
    setUploadStage(0)
    setUploading(file.name)
    try {
      if (kind === 'PDF') {
        await validatePdfSignature(file)
        const buffer = await file.arrayBuffer()
        const { extractPdf } = await import('../lib/pdfExtract')
        const documentId = stableDocumentId(file.name, documentOrdinal)
        const { text, pageTexts, pageCount, firstPageDataUrl } = await extractPdf(buffer, controller.signal, documentId, file.name)
        if (text.replace(/\s/g, '').length < 30) {
          setPendingOcr({ file, buffer, documentId, pageCount, firstPageDataUrl })
          setUploadError({ title: 'This PDF appears to be scanned', detail: `Found ${pageCount} image-only page${pageCount === 1 ? '' : 's'}. You can run bounded English OCR locally on up to 10 pages. The packaged OCR engine runs in this browser; document pixels are not sent to an OCR service. OCR text may contain mistakes.`, })
          return
        }
        const documentModel: DocumentModel = { id: documentId, fileName: file.name, kind, fullText: text.trim(), blocks: pageTexts.map((pageText, index) => ({ id: `${documentId}:p${index + 1}`, documentId, documentName: file.name, label: `${file.name} · Page ${index + 1}`, pageNumber: index + 1, text: pageText })), pageCount }
        ingestDocument(documentModel, file.size, firstPageDataUrl)
      } else {
        const text = validatePlainText(await file.text())
        if (!text.trim()) {
          setUploadError({ title: 'That file is empty', detail: 'The file opened fine, but it contains only whitespace — nothing to analyze. Paste the content into a new .txt file and try again.' })
          return
        }
        ingestDocument(createTextDocument(text, file.name, stableDocumentId(file.name, documentOrdinal)), file.size, null)
      }
      pushToast('Document loaded — stats computed')
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown file-processing error')
      if (error.name === 'AbortError') return
      if (error instanceof FileSafetyError || error.name === 'PdfSafetyError') {
        setUploadError({ title: 'This file was stopped for safety', detail: error.message })
      } else {
        setUploadError({ title: 'Could not read this file', detail: kind === 'PDF' ? 'The PDF may be corrupt, password-protected, or malformed. Try opening it in a PDF viewer, re-saving it, and dropping it again.' : 'The text file could not be decoded. Make sure it is UTF-8 plain text.', })
      }
    } finally {
      if (fileAbortRef.current === controller) {
        fileAbortRef.current = null
        setUploading(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
  }, [documents.length, ingestDocument, pushToast])

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const availableSlots = Math.max(0, 6 - documents.length)
    const selected = Array.from(files).slice(0, availableSlots)
    if (selected.length === 0) {
      setUploadError({ title: 'Workspace limit reached', detail: 'DocLense supports up to six documents in one workspace. Remove one before adding another.' })
      return
    }
    for (const [index, file] of selected.entries()) await processFile(file, documents.length + index)
    if (selected.length > 1) pushToast(`${selected.length} documents added to the workspace`)
    if (Array.from(files).length > selected.length) pushToast('Workspace capped at six documents', 'error')
  }, [documents.length, processFile, pushToast])

  const runPendingOcr = useCallback(async () => {
    if (!pendingOcr) return
    fileAbortRef.current?.abort()
    const controller = new AbortController()
    fileAbortRef.current = controller
    setUploading(`OCR · ${pendingOcr.file.name}`)
    setUploadError(null)
    setOcrProgress({ page: 0, totalPages: Math.min(pendingOcr.pageCount, 10), stage: 'Preparing OCR…', percent: 0 })
    try {
      const { extractScannedPdfText } = await import('../lib/ocr')
      const result = await extractScannedPdfText(pendingOcr.buffer, controller.signal, setOcrProgress)
      const fullText = result.pageTexts.join('\n\n').trim()
      if (fullText.replace(/\s/g, '').length < 20) {
        setUploadError({ title: 'OCR found too little readable text', detail: 'The scan may be low contrast, handwritten, rotated, or use an unsupported language. Try a clearer export or run dedicated OCR software.' })
        return
      }
      const model: DocumentModel = {
        id: pendingOcr.documentId,
        fileName: pendingOcr.file.name,
        kind: 'PDF',
        fullText,
        pageCount: pendingOcr.pageCount,
        blocks: result.pageTexts.map((text, index) => ({ id: `${pendingOcr.documentId}:p${index + 1}`, documentId: pendingOcr.documentId, documentName: pendingOcr.file.name, label: `${pendingOcr.file.name} · OCR page ${index + 1}`, pageNumber: index + 1, text })),
      }
      ingestDocument(model, pendingOcr.file.size, pendingOcr.firstPageDataUrl, false, true)
      pushToast(result.limited ? `OCR complete for the first ${result.processedPages} pages; later pages were not processed` : 'Local OCR complete; review the extracted text for errors')
    } catch (error) {
      if ((error as Error).name === 'AbortError') return
      setUploadError({ title: 'OCR could not finish', detail: error instanceof Error ? error.message : 'The local OCR worker failed. Try a shorter or clearer scan.' })
    } finally {
      if (fileAbortRef.current === controller) {
        fileAbortRef.current = null
        setUploading(null)
      }
    }
  }, [ingestDocument, pendingOcr, pushToast])

  const loadSample = useCallback((id: string) => {
    const sample = SAMPLE_DOCS.find(s => s.id === id)
    if (!sample) return
    setUploadError(null)
    ingestDocument(createTextDocument(sample.text, sample.fileName, stableDocumentId(sample.fileName, documents.length)), new Blob([sample.text]).size, null)
    pushToast('Sample loaded')
  }, [documents.length, ingestDocument, pushToast])

  const loadFromHistory = useCallback((entry: HistoryEntry) => {
    ingestDocument(createTextDocument(entry.text, entry.fileName, stableDocumentId(entry.fileName)), new Blob([entry.text]).size, null, true)
    pushToast('Loaded from your recents')
    setSidebarOpen(false)
  }, [ingestDocument, pushToast])

  const resetDocument = useCallback(() => {
    generationAbortRef.current?.abort()
    questionAbortRef.current?.abort()
    setUploaded(null)
    setDocuments([])
    setResult(null)
    setShowResults(false)
    setGenError(null)
    setMessages([])
    setUploadError(null)
    setPendingOcr(null)
    setOcrProgress(null)
    setActiveCitation(null)
    pinToTop()
  }, [pinToTop])

  // ---------- generate ----------
  const selectedCount = SECTION_KEYS.filter(k => sections[k]).length

  const generate = useCallback(async () => {
    if (!uploaded || generating) return
    const chosen = SECTION_KEYS.filter(k => sections[k])
    if (chosen.length === 0) {
      pushToast('Pick at least one thing to generate', 'error')
      return
    }
    if (!canUseGroq) {
      pushToast('Add your Groq API key first — it is in the sidebar', 'error')
      setSidebarOpen(true)
      return
    }
    setGenStage(0)
    setGenerating(true)
    setGenError(null)
    setAnalysisProgress(null)
    generationAbortRef.current?.abort()
    const controller = new AbortController()
    generationAbortRef.current = controller
    try {
      const res = await callGroq(apiKey, settings, chosen as AnalysisSection[], documents, controller.signal, setAnalysisProgress)
      const gen: GeneratedMap = {
        summary: chosen.includes('summary'),
        keyPoints: chosen.includes('keyPoints'),
        keywords: chosen.includes('keywords'),
        sentiment: chosen.includes('sentiment'),
        quiz: chosen.includes('quiz'),
      }
      setResult(res)
      setGenerated(gen)
      setShowResults(true)
      pinToTop()
      // fire the tiny toast a beat later so it doesn't fight the jump
      window.setTimeout(() => pushToast('Analysis complete'), 150)
      setHistory(saveHistoryEntry({
        fileName: uploaded.fileName,
        kind: uploaded.kind,
        pageCount: uploaded.pageCount,
        words: uploaded.stats.words,
        title: res.title ?? uploaded.fileName.replace(/\.[^.]+$/, ''),
        oneLiner: res.oneLiner ?? '',
        sentimentLabel: res.sentiment?.label,
        text: uploaded.fullText,
      }))
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const message = err instanceof FriendlyError ? err.message : 'Something unexpected went wrong. Please try again.'
      setGenError(message)
      pushToast(message, 'error')
    } finally {
      if (generationAbortRef.current === controller) {
        generationAbortRef.current = null
        setGenerating(false)
        setAnalysisProgress(null)
      }
    }
  }, [uploaded, documents, generating, sections, canUseGroq, apiKey, settings, pinToTop, pushToast])

  // ---------- chat ----------
  const askQuestion = useCallback(async (question: string) => {
    const q = question.trim()
    if (!q || !uploaded || askLoading) return
    if (!canUseGroq) {
      pushToast('Add your Groq API key in the sidebar first', 'error')
      setSidebarOpen(true)
      return
    }
    const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }))
    setMessages(m => [...m, { id: `u-${Date.now()}`, role: 'user', content: q }])
    setDraft('')
    setAskLoading(true)
    questionAbortRef.current?.abort()
    const controller = new AbortController()
    questionAbortRef.current = controller
    try {
      const answer = await askGroq(apiKey, settings, documents, history, q, controller.signal)
      setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: answer.text, citations: answer.citations, evidenceStatus: answer.evidenceStatus }])
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const message = err instanceof FriendlyError ? err.message : 'Something went wrong. Please try again.'
      setMessages(m => [...m, { id: `e-${Date.now()}`, role: 'assistant', content: message, isError: true }])
    } finally {
      if (questionAbortRef.current === controller) {
        questionAbortRef.current = null
        setAskLoading(false)
      }
    }
  }, [uploaded, documents, askLoading, canUseGroq, apiKey, settings, messages, pushToast])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [messages.length, askLoading])

  // ---------- keyboard shortcuts ----------
  const downloadReport = useCallback(() => {
    if (!uploaded || !result) return
    const names = documents.map(document => document.fileName)
    downloadTextFile(uploaded.fileName, buildDownloadText(names, result, workspaceStats, generated))
    pushToast('Summary downloaded as .txt')
  }, [uploaded, documents, result, generated, pushToast, workspaceStats])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'g') { e.preventDefault(); generate() }
      else if (k === 'd') { e.preventDefault(); downloadReport() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [generate, downloadReport])

  // drag and drop on the dropzone
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    void processFiles(e.dataTransfer.files)
  }, [processFiles])

  const anyGenerated = result !== null
  const kwForReader = generated.keywords && result?.keywords?.length ? result.keywords : extractKeywords(documents.map(document => document.fullText).join('\n\n'))
  const openCitation = useCallback((citation: Citation) => {
    setActiveCitation(citation)
    setReaderOpen(true)
  }, [])
  const removeDocument = useCallback((documentId: string) => {
    const next = documents.filter(document => document.id !== documentId)
    setDocuments(next)
    setUploaded(next.at(-1) ?? null)
    setResult(null)
    setShowResults(false)
    setMessages([])
    setActiveCitation(null)
  }, [documents])

  return (
    <div className="flex h-screen w-full overflow-hidden bg-paper-grain font-sans text-ink dark:bg-moss-night-deep dark:text-text-dark">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        apiKey={apiKey}
        setApiKey={setApiKey}
        revealKey={revealKey}
        setRevealKey={setRevealKey}
        settings={settings}
        updateSettings={updateSettings}
        onResetSettings={resetSettings}
        history={history}
        onClearHistory={() => { clearHistory(); setHistory([]); pushToast('Recent analyses cleared') }}
        onPickHistory={loadFromHistory}
        disabled={generating || uploading !== null}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ===== top bar ===== */}
        <header className="z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-moss/15 bg-cream/80 px-3 backdrop-blur-md dark:border-white/10 dark:bg-panel-dark/80 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button onClick={() => setSidebarOpen(true)} className="rounded-xl p-2 text-ink-soft transition hover:bg-moss-mist hover:text-moss-deep dark:text-text-dark-soft dark:hover:bg-white/5 dark:hover:text-text-dark lg:hidden" aria-label="Open settings">
              <Menu size={19} />
            </button>
            <nav className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-ink-soft dark:text-text-dark-soft" aria-label="Breadcrumb">
              <Link to="/" className="hidden transition hover:text-moss-deep dark:hover:text-text-dark sm:inline">DocLense</Link>
              <ChevronRight size={12} className="hidden sm:inline" />
              <span className="truncate text-moss-deep dark:text-gold-dark">Analysis Studio</span>
              {uploaded && <><ChevronRight size={12} /><span className="max-w-[140px] truncate font-normal text-ink dark:text-text-dark-soft">{uploaded.fileName}</span></>}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="hidden items-center gap-1.5 rounded-full border border-moss/25 bg-moss-mist px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-moss-deep md:inline-flex dark:border-persimmon-dark/30 dark:bg-persimmon-dark/10 dark:text-persimmon-dark"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{GROQ_MODELS.find(m => m.id === settings.model)?.label}</span>
            <Link to="/docs" className="rounded-xl px-3 py-2 text-[12px] font-bold text-ink-soft transition hover:bg-moss-mist hover:text-moss-deep dark:text-text-dark-soft dark:hover:bg-white/5 dark:hover:text-text-dark">Docs</Link>
            <button onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} className="rounded-xl p-2 text-ink-soft transition hover:bg-moss-mist hover:text-moss-deep dark:text-text-dark-soft dark:hover:bg-white/5 dark:hover:text-text-dark">
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>

        {/* ===== scrollable workspace ===== */}
        <main id="main-content" tabIndex={-1} ref={mainRef} className="relative flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-4xl space-y-4 px-3 pb-14 pt-4 sm:px-6 sm:pt-5">

            {/* ===================== RESULTS (pinned to the very top) ===================== */}
            {uploaded && showResults && anyGenerated && (
              <div key="results" className="space-y-4">
                <GeneratedStamp />
                <ResultsView fileNames={documents.map(document => document.fileName)} stats={workspaceStats} result={result!} generated={generated} onToast={(m) => pushToast(m)} onOpenCitation={openCitation} />
                {generated.quiz && result?.quiz && <QuizCard quiz={result.quiz} onToast={(m) => pushToast(m)} onOpenCitation={openCitation} />}
                <div className="flex items-center gap-3 px-1 pt-1 text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-soft/70 dark:text-text-dark-soft/60">
                  <span className="h-px flex-1 bg-moss/20 dark:bg-white/10" />
                  Document &amp; chat
                  <span className="h-px flex-1 bg-moss/20 dark:bg-white/10" />
                </div>
              </div>
            )}

            {/* ===================== STATS (after results, or right under upload) ===================== */}
            {uploaded && showResults && anyGenerated && <StatsGrid stats={workspaceStats} />}

            {/* ===================== UPLOAD ERROR ===================== */}
            <AnimatePresence>
              {uploadError && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} role="alert" className="flex gap-3.5 rounded-3xl border-2 border-persimmon/50 bg-persimmon-mist p-4 sm:p-5 dark:border-persimmon-dark/40 dark:bg-persimmon-dark/10">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-persimmon text-cream dark:bg-persimmon-dark dark:text-[#2b1206]"><AlertTriangle size={20} strokeWidth={2.2} /></div>
                  <div className="min-w-0">
                    <p className="font-display text-base font-extrabold text-[#8a2c0d] dark:text-persimmon-dark">{uploadError.title}</p>
                    <p className="mt-1 font-body text-[14px] leading-relaxed text-[#6e3418] dark:text-text-dark-soft">{uploadError.detail}</p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {pendingOcr && <button onClick={() => void runPendingOcr()} className="inline-flex items-center gap-1.5 rounded-xl bg-moss px-3 py-2 font-sans text-[11.5px] font-extrabold uppercase tracking-wide text-cream transition hover:bg-moss-deep dark:bg-persimmon-dark dark:text-[#2b1206]"><BookOpenText size={13} />Run local OCR</button>}
                      <button onClick={() => { setUploadError(null); setPendingOcr(null); fileInputRef.current?.click() }} className="inline-flex items-center gap-1.5 rounded-xl border border-persimmon/50 px-3 py-1.5 font-sans text-[11.5px] font-extrabold uppercase tracking-wide text-[#8a2c0d] transition hover:bg-persimmon hover:text-cream dark:border-persimmon-dark/40 dark:text-persimmon-dark dark:hover:bg-persimmon-dark dark:hover:text-[#2b1206]">Try a different file <ArrowRight size={12} strokeWidth={3} /></button>
                    </div>
                  </div>
                  <button onClick={() => setUploadError(null)} className="ml-auto h-fit rounded-lg p-1.5 text-[#8a2c0d] transition hover:bg-persimmon/20 dark:text-persimmon-dark" aria-label="Dismiss"><X size={16} /></button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ===================== UPLOADING OVERLAY ===================== */}
            {uploading ? (
              <section className="rounded-[2rem] border-2 border-dashed border-moss/40 bg-cream p-10 text-center shadow-sm dark:border-persimmon-dark/35 dark:bg-panel-dark">
                <div className="mx-auto flex h-16 w-16 items-center justify-center">
                  <Loader2 className="animate-spin text-moss dark:text-persimmon-dark" size={44} strokeWidth={2.2} />
                </div>
                <p className="mt-4 font-display text-xl font-extrabold text-ink dark:text-text-dark">Processing “{uploading.length > 42 ? uploading.slice(0, 40) + '…' : uploading}”</p>
                <p className="mt-1.5 font-mono text-xs font-semibold text-persimmon dark:text-persimmon-dark">{ocrProgress?.stage ?? UPLOAD_STAGES[uploadStage]}</p>
                <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-moss-mist dark:bg-white/10">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-persimmon via-gold to-moss" animate={{ width: `${ocrProgress?.percent ?? ((uploadStage + 1) / UPLOAD_STAGES.length) * 100}%` }} transition={{ ease: 'easeOut', duration: 0.5 }} />
                </div>
                <button type="button" onClick={() => fileAbortRef.current?.abort()} className="mt-4 rounded-xl border border-moss/25 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-moss-deep transition hover:bg-moss-mist dark:border-white/15 dark:text-text-dark dark:hover:bg-white/5">Cancel processing</button>
              </section>

            ) : !uploaded ? (
              /* ===================== DROPZONE (front and center) ===================== */
              <section
                role="button"
                tabIndex={0}
                aria-label="Upload PDF or text files"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                className={`group relative cursor-pointer overflow-hidden rounded-[2rem] border-[2.5px] border-dashed p-8 text-center shadow-sm transition-all duration-300 sm:p-12 ${dragActive ? 'scale-[1.015] border-persimmon bg-persimmon-mist/60 shadow-xl dark:border-persimmon-dark dark:bg-persimmon-dark/10' : 'border-moss/35 bg-cream/85 hover:border-moss hover:bg-cream hover:shadow-lg dark:border-white/15 dark:bg-panel-dark dark:hover:border-persimmon-dark/50'} focus-visible:outline-persimmon`}
              >
                <input ref={fileInputRef} type="file" multiple accept=".pdf,.txt,.md,.text,application/pdf,text/plain" className="hidden" onChange={(e) => { if (e.target.files?.length) void processFiles(e.target.files) }} />
                <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-moss-mist/60 blur-3xl transition dark:bg-moss/10" />
                <div className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-persimmon-mist/70 blur-3xl transition dark:bg-persimmon-dark/5" />
                <div className="relative">
                  <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }} className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-moss text-cream shadow-[0_6px_0_#0e4740] dark:bg-persimmon-dark dark:text-[#2b1206] dark:shadow-[0_6px_0_#b4532a]">
                    <CloudUpload size={38} strokeWidth={2} />
                  </motion.div>
                  <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-ink dark:text-text-dark sm:text-4xl">{dragActive ? 'Release to add documents' : 'Build your evidence workspace'}</h1>
                  <p className="mx-auto mt-2 max-w-md font-body text-[15px] leading-relaxed text-ink-soft dark:text-text-dark-soft">Add up to six PDF or text files, {MAX_FILE_MB} MB each. Extraction stays in this tab; selected source excerpts are sent to Groq only when you analyze or ask a question.</p>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                    <span className="inline-flex items-center gap-2 rounded-2xl bg-moss px-5 py-3 font-sans text-sm font-extrabold text-cream shadow-[0_3px_0_#0e4740] transition group-hover:bg-moss-deep dark:bg-persimmon-dark dark:text-[#2b1206] dark:shadow-[0_3px_0_#b4532a]"><FileText size={17} />Browse files</span>
                    <span className="inline-flex items-center gap-2 rounded-2xl border-2 border-moss/30 px-5 py-[10px] font-sans text-sm font-bold text-moss-deep dark:border-white/15 dark:text-text-dark"><Sparkles size={15} />or pick a sample below</span>
                  </div>
                  <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-soft/90 dark:text-text-dark-soft/80"><Lock size={11} />Keys and documents stay in memory and clear on reload.</p>
                </div>
              </section>
            ) : null}

            {/* ===================== SAMPLE CHIPS (only with dropzone) ===================== */}
            {!uploaded && !uploading && (
              <section aria-label="Sample documents">
                <p className="mb-2 px-1 text-[10.5px] font-extrabold uppercase tracking-[0.2em] text-ink-soft/80 dark:text-text-dark-soft/70">Try a sample</p>
                <div className="flex gap-2 overflow-x-auto pb-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {SAMPLE_DOCS.map(sample => {
                    const Icon = sample.icon
                    return (
                      <button key={sample.id} onClick={() => loadSample(sample.id)} title={sample.description} className="flex w-56 shrink-0 items-start gap-2.5 rounded-2xl border border-moss/20 bg-cream p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-moss/45 hover:shadow-md dark:border-white/10 dark:bg-panel-dark dark:hover:border-persimmon-dark/40">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-moss-mist text-moss-deep dark:bg-white/8 dark:text-gold-dark"><Icon size={17} /></span>
                        <span className="min-w-0">
                          <span className="block truncate text-[11.5px] font-extrabold text-ink dark:text-text-dark">{sample.title}</span>
                          <span className="mt-0.5 block text-[9.5px] font-semibold uppercase tracking-wide text-ink-soft/80 dark:text-text-dark-soft/70">{sample.badge}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ===================== FILE CARD + CONFIG ===================== */}
            {uploaded && !uploading && (
              <>
                {/* stats stay above the uploader before generating; after generating they render at top */}
                {!(showResults && anyGenerated) && <StatsGrid stats={workspaceStats} />}

                {documents.length > 1 && (
                  <section aria-label="Documents in workspace" className="rounded-2xl border border-moss/20 bg-cream/70 p-3 dark:border-white/10 dark:bg-panel-dark/70">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mr-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-soft dark:text-text-dark-soft">{documents.length} sources</span>
                      {documents.map(document => (
                        <span key={document.id} className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-xl border border-moss/20 bg-paper px-2.5 py-1.5 text-[11px] font-bold text-ink dark:border-white/10 dark:bg-white/5 dark:text-text-dark">
                          <FileText size={12} className="shrink-0 text-moss dark:text-gold-dark" />
                          <span className="truncate">{document.fileName}</span>
                          <button type="button" onClick={() => removeDocument(document.id)} className="rounded p-0.5 text-ink-soft hover:bg-persimmon-mist hover:text-persimmon dark:text-text-dark-soft" aria-label={`Remove ${document.fileName}`}><X size={11} /></button>
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                <section className="overflow-hidden rounded-3xl border border-moss/25 bg-cream shadow-sm dark:border-white/10 dark:bg-panel-dark">
                  <div className="flex items-center gap-4 p-4 sm:p-5">
                    {uploaded.firstPageDataUrl ? (
                      <img src={uploaded.firstPageDataUrl} alt="First page of the PDF" className="h-24 w-[72px] shrink-0 rounded-xl border border-moss/30 object-cover object-top shadow-md" />
                    ) : (
                      <div className="flex h-24 w-[72px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-moss/30 bg-moss-mist text-moss-deep shadow-md dark:border-white/12 dark:bg-white/5 dark:text-gold-dark">
                        <FileType2 size={26} strokeWidth={1.8} />
                        <span className="font-mono text-[9px] font-bold uppercase tracking-widest">{uploaded.kind}</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-[15px] font-bold text-ink dark:text-text-dark" title={uploaded.fileName}>{uploaded.fileName}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-semibold text-ink-soft dark:text-text-dark-soft">
                        <span className="inline-flex items-center gap-1 rounded-md bg-moss-mist px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider text-moss-deep dark:bg-white/8 dark:text-gold-dark">{uploaded.kind}</span>
                        {uploaded.ocrApplied && <span className="rounded-md border border-gold/35 bg-gold/10 px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider text-[#73500f] dark:text-gold-dark">OCR · verify text</span>}
                        <span>{(uploaded.sizeBytes / 1024).toFixed(0)} KB</span>
                        {uploaded.pageCount !== null && <span>· {uploaded.pageCount} page{uploaded.pageCount === 1 ? '' : 's'}</span>}
                        <span>· {uploaded.stats.words.toLocaleString()} words</span>
                        <span>· ~{uploaded.stats.readingTimeLabel} read</span>
                      </div>
                      {uploaded.hasInstructionLikeContent && (
                        <p role="status" className="mt-2 flex items-start gap-1.5 rounded-lg border border-gold/40 bg-[#fdf6dd] px-2.5 py-2 text-[10.5px] font-semibold leading-relaxed text-[#7a5410] dark:border-gold-dark/25 dark:bg-gold-dark/10 dark:text-gold-dark">
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" />This document contains instruction-like text. DocLense will treat it as source material, but verify important results against the original.
                        </p>
                      )}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <button onClick={() => { setActiveCitation(null); setReaderOpen(true) }} className="inline-flex items-center gap-1.5 rounded-xl border border-moss/30 px-3 py-1.5 text-[11px] font-bold text-moss-deep transition hover:bg-moss-mist dark:border-white/15 dark:text-text-dark dark:hover:bg-white/5"><Eye size={13} />Open evidence reader</button>
                        <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl border border-moss/30 px-3 py-1.5 text-[11px] font-bold text-moss-deep transition hover:bg-moss-mist dark:border-white/15 dark:text-text-dark dark:hover:bg-white/5"><CloudUpload size={13} />Add documents</button>
                        <button onClick={resetDocument} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold text-ink-soft transition hover:bg-persimmon-mist hover:text-persimmon dark:text-text-dark-soft dark:hover:bg-persimmon-dark/10 dark:hover:text-persimmon-dark"><Trash2 size={13} />Clear workspace</button>
                        <input ref={fileInputRef} type="file" multiple accept=".pdf,.txt,.md,.text,application/pdf,text/plain" className="hidden" onChange={(e) => { if (e.target.files?.length) void processFiles(e.target.files) }} />
                      </div>
                    </div>
                  </div>

                  {/* ---- what to generate: checkbox grid ---- */}
                  <div className="border-t border-moss/15 bg-paper-deep/50 p-4 dark:border-white/10 dark:bg-black/15 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-sans text-[11px] font-extrabold uppercase tracking-[0.2em] text-ink dark:text-text-dark">What should DocLense generate?</p>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setSections({ summary: true, keyPoints: true, keywords: true, sentiment: true, quiz: true })} className="rounded-lg px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide text-moss-deep transition hover:bg-moss-mist dark:text-gold-dark dark:hover:bg-white/5">Select all</button>
                        <span className="text-ink-soft/50 dark:text-white/20">·</span>
                        <button onClick={() => setSections({ summary: true, keyPoints: false, keywords: false, sentiment: false, quiz: false })} className="rounded-lg px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide text-moss-deep transition hover:bg-moss-mist dark:text-gold-dark dark:hover:bg-white/5">Summary only</button>
                        <span className="text-ink-soft/50 dark:text-white/20">·</span>
                        <button onClick={() => setSections({ summary: false, keyPoints: false, keywords: false, sentiment: false, quiz: false })} className="rounded-lg px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide text-ink-soft transition hover:bg-moss-mist dark:text-text-dark-soft dark:hover:bg-white/5">None</button>
                      </div>
                    </div>

                    <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {([
                        { key: 'summary', icon: AlignLeft, label: 'Summary', sub: 'Plus suggested title' },
                        { key: 'keyPoints', icon: ListChecks, label: 'Key Points', sub: '5–7 takeaways' },
                        { key: 'keywords', icon: Tags, label: 'Keywords', sub: 'Topics & terms' },
                        { key: 'sentiment', icon: Gauge, label: 'Sentiment', sub: 'Tone & polarity' },
                        { key: 'quiz', icon: FileQuestion, label: 'Quiz', sub: 'Scored in seconds' },
                      ] as const).map(({ key, icon: Icon, label, sub }) => {
                        const checked = sections[key]
                        return (
                          <button
                            key={key}
                            role="checkbox"
                            aria-checked={checked}
                            disabled={generating}
                            onClick={() => setSections(s => ({ ...s, [key]: !s[key] }))}
                            className={`relative rounded-2xl border p-3 pb-2.5 text-left transition disabled:opacity-60 ${checked ? 'border-moss bg-moss-mist/80 shadow-inner dark:border-persimmon-dark/60 dark:bg-persimmon-dark/10' : 'border-moss/20 bg-cream hover:border-moss/45 dark:border-white/12 dark:bg-panel-dark-2 dark:hover:border-white/25'}`}
                          >
                            <span className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-md border-2 transition ${checked ? 'border-moss bg-moss text-cream dark:border-persimmon-dark dark:bg-persimmon-dark dark:text-[#2b1206]' : 'border-ink/20 bg-transparent dark:border-white/25'}`}>{checked && <Check size={12} strokeWidth={4} />}</span>
                            <Icon size={19} strokeWidth={2.1} className={checked ? 'text-moss-deep dark:text-persimmon-dark' : 'text-ink-soft dark:text-text-dark-soft'} />
                            <span className="mt-1.5 block text-[12px] font-extrabold leading-tight text-ink dark:text-text-dark">{label}</span>
                            <span className="mt-0.5 block text-[9px] font-semibold leading-tight text-ink-soft/85 dark:text-text-dark-soft/75">{sub}</span>
                          </button>
                        )
                      })}
                    </div>

                    {/* ---- generate row ---- */}
                    <div className="mt-3.5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-ink-soft dark:text-text-dark-soft"><span className="font-extrabold text-moss-deep dark:text-gold-dark">{selectedCount} of 5</span> insights · {settings.analysisMode} mode · {settings.maxChunks}-chunk budget · ≤{Math.ceil(settings.maxChunks / 2) + 2} Groq requests</p>
                        {!canUseGroq && (
                          <button onClick={() => setSidebarOpen(true)} className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#a33a10] underline decoration-persimmon/50 underline-offset-2 transition hover:text-persimmon dark:text-persimmon-dark"><KeyRound size={11} />No Groq key yet — add one in the sidebar, it takes 20 seconds<ArrowRight size={11} /></button>
                        )}
                      </div>
                      <button
                        onClick={generating ? () => generationAbortRef.current?.abort() : generate}
                        disabled={!generating && selectedCount === 0}
                        className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-persimmon px-6 py-4 font-sans text-[15px] font-extrabold text-cream shadow-[0_4px_0_#b93a17] transition hover:bg-persimmon-soft active:translate-y-0.5 active:shadow-[0_2px_0_#b93a17] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-persimmon-dark dark:text-[#2b1206] dark:shadow-[0_4px_0_#b4532a]"
                      >
                        {generating ? (
                          <><X size={18} />Cancel <span className="font-mono text-[11px] font-semibold text-cream/85 dark:text-[#2b1206]/75">{analysisProgress?.label ?? GEN_STAGES[genStage]}</span></>
                        ) : (
                          <><Zap size={18} strokeWidth={2.5} />{anyGenerated ? 'Regenerate' : 'Generate analysis'}<kbd className="rounded-md border border-cream/40 bg-black/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-cream/95 dark:border-[#2b1206]/30 dark:text-[#2b1206]">G</kbd></>
                        )}
                      </button>
                    </div>
                    {generating && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-moss-mist dark:bg-white/10"><motion.div className="h-full rounded-full bg-gradient-to-r from-persimmon via-gold to-moss" animate={{ width: `${analysisProgress && analysisProgress.total > 0 ? Math.max(8, (analysisProgress.completed / analysisProgress.total) * 85 + (analysisProgress.phase === 'synthesizing' ? 10 : 0)) : ((genStage + 1) / GEN_STAGES.length) * 100}%` }} transition={{ ease: 'easeOut', duration: 0.6 }} /></div>
                    )}
                    {genError && (
                      <div role="alert" className="mt-3 flex items-start gap-2 rounded-2xl border border-persimmon/40 bg-persimmon-mist px-3.5 py-2.5 text-[12.5px] font-semibold leading-snug text-[#8a2c0d] dark:border-persimmon-dark/35 dark:bg-persimmon-dark/10 dark:text-persimmon-dark"><CircleAlert size={15} className="mt-0.5 shrink-0" />{genError}</div>
                    )}
                  </div>
                </section>

                {/* ===================== CHAT ===================== */}
                <section className="overflow-hidden rounded-3xl border border-moss/25 bg-cream shadow-sm dark:border-white/10 dark:bg-panel-dark">
                  <div className="flex items-center justify-between gap-2 border-b border-moss/15 px-4 py-3 dark:border-white/10 sm:px-5">
                    <div className="flex items-center gap-2">
                      <DocLenseLogo size={26} />
                      <div>
                        <p className="font-display text-[13.5px] font-extrabold leading-none text-ink dark:text-text-dark">Ask DocLense</p>
                        <p className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-widest text-ink-soft/80 dark:text-text-dark-soft/70">Grounded across {documents.length} {documents.length === 1 ? 'document' : 'documents'}</p>
                      </div>
                    </div>
                    {messages.length > 0 && (
                      <button onClick={() => setMessages([])} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-ink-soft transition hover:bg-moss-mist hover:text-moss-deep dark:text-text-dark-soft dark:hover:bg-white/5 dark:hover:text-text-dark"><Eraser size={12} />Clear chat</button>
                    )}
                  </div>

                  <div className="max-h-96 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
                    {messages.length === 0 ? (
                      <div className="py-2 text-center">
                        <BookOpenText size={30} strokeWidth={1.6} className="mx-auto text-moss/60 dark:text-persimmon-dark/70" />
                        <p className="mt-2 font-body text-[14px] italic text-ink-soft dark:text-text-dark-soft">Questions about this document? Go ahead — DocLense has read it.</p>
                        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                          {SUGGESTIONS.map(s => (
                            <button key={s} onClick={() => askQuestion(s)} className="rounded-full border border-moss/25 bg-moss-mist/60 px-3 py-1.5 text-[11px] font-semibold text-moss-deep transition hover:border-moss hover:bg-moss-mist dark:border-white/12 dark:bg-white/5 dark:text-text-dark-soft dark:hover:border-persimmon-dark/40 dark:hover:text-gold-dark">{s}</button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      messages.map(m => (
                        <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                          {m.role === 'assistant' && <DocLenseLogo size={26} className="mt-1 shrink-0" />}
                          <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 font-body text-[14px] leading-relaxed shadow-sm sm:max-w-[78%] ${m.role === 'user' ? 'rounded-tr-md bg-moss text-cream dark:bg-persimmon-dark dark:text-[#2b1206]' : m.isError ? 'rounded-tl-md border border-persimmon/45 bg-persimmon-mist text-[#8a2c0d] dark:border-persimmon-dark/40 dark:bg-persimmon-dark/10 dark:text-persimmon-dark' : 'rounded-tl-md border border-moss/20 bg-paper text-ink dark:border-white/10 dark:bg-panel-dark-2 dark:text-text-dark/95'}`}>
                            <p className="whitespace-pre-wrap">{m.content}</p>
                            {m.role === 'assistant' && m.citations?.length ? <CitationChips citations={m.citations} onOpen={openCitation} className="mt-2" /> : null}
                            {m.role === 'assistant' && m.evidenceStatus === 'unavailable' ? <p className="mt-2 text-[10.5px] font-bold uppercase tracking-wider text-ink-soft dark:text-text-dark-soft">No verified source evidence</p> : null}
                          </div>
                        </div>
                      ))
                    )}
                    {askLoading && (
                      <div className="flex gap-2">
                        <DocLenseLogo size={26} className="mt-1 shrink-0" />
                        <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-moss/20 bg-paper px-4 py-3 dark:border-white/10 dark:bg-panel-dark-2" aria-label="DocLense is thinking">
                          {[0, 1, 2].map(i => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-moss/70 dark:bg-persimmon-dark" style={{ animationDelay: `${i * 0.16}s` }} />)}
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <form onSubmit={(e) => { e.preventDefault(); askQuestion(draft) }} className="flex items-center gap-2 border-t border-moss/15 p-3 dark:border-white/10">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      maxLength={CHAT_LIMIT}
                      placeholder="Ask across the selected documents…"
                      aria-label="Ask a question about the selected documents"
                      className="min-w-0 flex-1 rounded-2xl border border-moss/25 bg-paper px-4 py-3 font-body text-[14.5px] text-ink outline-none transition placeholder:text-ink-soft/60 focus:border-moss focus:ring-2 focus:ring-moss/20 dark:border-white/12 dark:bg-white/5 dark:text-text-dark dark:placeholder:text-text-dark-soft/50 dark:focus:border-persimmon-dark/60 dark:focus:ring-persimmon-dark/15"
                    />
                    <button type={askLoading ? 'button' : 'submit'} onClick={askLoading ? () => questionAbortRef.current?.abort() : undefined} disabled={!askLoading && !draft.trim()} aria-label={askLoading ? 'Cancel question' : 'Send question'} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-moss text-cream shadow-[0_3px_0_#0e4740] transition hover:bg-moss-deep disabled:cursor-not-allowed disabled:opacity-50 dark:bg-persimmon-dark dark:text-[#2b1206] dark:shadow-[0_3px_0_#b4532a]">
                      {askLoading ? <X size={18} /> : <Send size={18} strokeWidth={2.2} />}
                    </button>
                  </form>
                </section>
              </>
            )}
          </div>
        </main>
      </div>

      {/* ===== toasts ===== */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,360px)] flex-col gap-2" aria-live="polite">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div key={toast.id} layout initial={{ opacity: 0, x: 60, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 40 }} className={`pointer-events-auto flex items-start gap-2.5 rounded-2xl border p-3 text-[12.5px] font-semibold leading-snug shadow-xl backdrop-blur ${toast.tone === 'error' ? 'border-persimmon/45 bg-[#fdf0e9]/95 text-[#8a2c0d] dark:border-persimmon-dark/40 dark:bg-[#33150c]/95 dark:text-persimmon-dark' : 'border-moss/30 bg-cream/95 text-moss-deep dark:border-emerald-500/25 dark:bg-[#0f2620]/95 dark:text-emerald-300'}`}>
              {toast.tone === 'error' ? <CircleAlert size={16} className="mt-0.5 shrink-0" /> : <Check size={16} strokeWidth={3} className="mt-0.5 shrink-0" />}
              <span>{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <DocumentReader
        documents={documents}
        open={readerOpen}
        activeCitation={activeCitation}
        keywords={kwForReader}
        highlightKeywords={highlightKeywords}
        onToggleKeywords={() => setHighlightKeywords(value => !value)}
        onClose={() => { setReaderOpen(false); setActiveCitation(null) }}
      />
    </div>
  )
}
