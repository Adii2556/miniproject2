import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Menu, Moon, Sun, CloudUpload, FileText, FileType2, X, Eye, Trash2, Sparkles, Zap,
  AlertTriangle, KeyRound, Check, ListChecks, Tags, Gauge, FileQuestion, AlignLeft,
  Send, Eraser, ArrowRight, Loader2, CircleAlert, BookOpenText, Lock, ChevronRight,
  ScanText, Layers, Plus,
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import ResultsView, { StatsGrid, GeneratedStamp } from '../components/ResultsView'
import QuizCard from '../components/QuizCard'
import DocLenseLogo from '../components/DocLenseLogo'
import CitationChips from '../components/CitationChips'
import DocumentReader from '../components/DocumentReader'
import { useTheme } from '../lib/useTheme'
import { FileSafetyError, validatePdfSignature, validatePlainText } from '../lib/fileSecurity'
import { computeStats, extractKeywords, type DocStats } from '../lib/stats'
import {
  callGroq, askGroq, FriendlyError, GROQ_MODELS, normalizeSettings,
  type AnalysisSettings, type AnalysisResult, type AnalysisSection, type AnalysisProgress,
} from '../lib/groq'
import {
  createTextDocument,
  createPdfDocument,
  type Citation,
  type DocumentModel,
} from '../lib/document'
import { extractPdf, PdfValidationError } from '../lib/pdfExtract'
import { performBoundedOcr, type OcrProgress } from '../lib/ocr'
import { SAMPLE_DOCS } from '../lib/samples'
import {
  clearHistory,
  clearLegacySensitiveStorage,
  loadHistory,
  saveHistoryEntry,
  type HistoryEntry,
} from '../lib/history'
import { buildDownloadText, downloadTextFile, type GeneratedMap } from '../lib/analysis'
import { inspectDocumentSafety } from '../lib/documentSecurity'

const LS_SETTINGS = 'doclense.settings.v1'
const MAX_FILE_MB = 15
const CHAT_LIMIT = 2000

const DEFAULT_SETTINGS: AnalysisSettings = {
  model: 'llama-3.3-70b-versatile',
  temperature: 0.2,
  maxTokens: 3072,
  summaryStyle: 'concise',
  language: 'English',
  readingLevel: 'professional',
  coverageMode: 'sampled',
  quizDifficulty: 'medium',
}

type SectionKey = 'summary' | 'keyPoints' | 'keywords' | 'sentiment' | 'quiz'
const SECTION_KEYS: SectionKey[] = ['summary', 'keyPoints', 'keywords', 'sentiment', 'quiz']

export interface UploadedDoc extends DocumentModel {
  sizeBytes: number
  firstPageDataUrl: string | null
  stats: DocStats
  hasInstructionLikeContent: boolean
  isScanned?: boolean
  originalBuffer?: ArrayBuffer
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  confidence?: 'high' | 'medium' | 'low' | 'unverified'
  isError?: boolean
}

interface UploadErrorState {
  title: string
  detail: string
  isScannedNotice?: boolean
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
const GEN_STAGES = ['Reading document structure…', 'Extracting source evidence…', 'Verifying facts & citations…', 'Formulating takeaways…', 'Gauging sentiment…', 'Synthesizing report…']
const SUGGESTIONS = [
  'What is the core argument or thesis?',
  'What are the strongest risks or counterarguments?',
  'What are the concrete action items or conclusions?',
]

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
    try {
      localStorage.setItem(LS_SETTINGS, JSON.stringify(settings))
    } catch {
      // Storage restricted
    }
  }, [settings])

  const updateSettings = useCallback((patch: Partial<AnalysisSettings>) => {
    setSettings(current => normalizeSettings({ ...current, ...patch }))
  }, [])

  const canUseGroq = apiKey.trim().length > 0

  // ---------- document state (multi-doc support) ----------
  const [documents, setDocuments] = useState<UploadedDoc[]>([])
  const [activeDocIndex, setActiveDocIndex] = useState<number>(0)
  const uploaded = documents[activeDocIndex] ?? null

  const [uploading, setUploading] = useState<string | null>(null)
  const [uploadStage, setUploadStage] = useState(0)
  const [uploadError, setUploadError] = useState<UploadErrorState | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [highlightKeywords, setHighlightKeywords] = useState(true)
  const [readerOpen, setReaderOpen] = useState(false)
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null)

  // ---------- OCR state for scanned PDFs ----------
  const [ocrRunning, setOcrRunning] = useState(false)
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null)

  // ---------- analysis state ----------
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({
    summary: true,
    keyPoints: true,
    keywords: true,
    sentiment: true,
    quiz: true,
  })
  const [generating, setGenerating] = useState(false)
  const [genStage, setGenStage] = useState(0)
  const [result, setResult] = useState<Partial<AnalysisResult> | null>(null)
  const [generated, setGenerated] = useState<GeneratedMap>({
    summary: false,
    keyPoints: false,
    keywords: false,
    sentiment: false,
    quiz: false,
  })
  const [showResults, setShowResults] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null)
  const [multiDocCompareMode, setMultiDocCompareMode] = useState(false)

  // ---------- chat about the doc ----------
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [askLoading, setAskLoading] = useState(false)

  // ---------- history / toasts ----------
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory())
  const [toasts, setToasts] = useState<Toast[]>([])

  const mainRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const multiFileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const generationAbortRef = useRef<AbortController | null>(null)
  const fileAbortRef = useRef<AbortController | null>(null)
  const ocrAbortRef = useRef<AbortController | null>(null)
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
    ocrAbortRef.current?.abort()
    questionAbortRef.current?.abort()
  }, [])

  // Stage animation timers
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

  const pinToTop = useCallback(() => {
    const el = mainRef.current
    if (el) el.scrollTo({ top: 0, behavior: 'auto' })
    window.scrollTo(0, 0)
  }, [])

  // ---------- Ingest pipeline ----------
  const ingestDocument = useCallback((
    doc: DocumentModel,
    sizeBytes: number,
    firstPageDataUrl: string | null,
    isScanned = false,
    originalBuffer?: ArrayBuffer,
    append = false,
  ) => {
    const stats = computeStats(doc.fullText)
    const safety = inspectDocumentSafety(doc.fullText)
    const uploadedDoc: UploadedDoc = {
      ...doc,
      sizeBytes,
      firstPageDataUrl,
      stats,
      hasInstructionLikeContent: safety.hasInstructionLikeContent,
      isScanned,
      originalBuffer,
    }

    if (append) {
      setDocuments(prev => [...prev, uploadedDoc])
      setActiveDocIndex(prev => prev)
      pushToast(`Added "${doc.fileName}" to analysis session`)
    } else {
      setDocuments([uploadedDoc])
      setActiveDocIndex(0)
      setResult(null)
      setShowResults(false)
      setGenError(null)
      setMessages([])
      setUploadError(null)
      setActiveCitation(null)
      pushToast('Document loaded — verified structures computed')
    }
  }, [pushToast])

  const processFile = useCallback(async (file: File, append = false) => {
    setUploadError(null)
    const ext = file.name.toLowerCase().split('.').pop() ?? ''
    const kind: 'PDF' | 'TEXT' = ext === 'pdf' ? 'PDF' : 'TEXT'

    if (!['pdf', 'txt', 'md', 'text'].includes(ext)) {
      setUploadError({
        title: `Unsupported file type “.${ext}”`,
        detail: 'DocLense reads PDF, Markdown, and plain-text files only. Please export other formats to PDF first.',
      })
      return
    }
    if (file.size === 0) {
      setUploadError({
        title: 'That file is empty',
        detail: 'The file contains 0 bytes. Re-download or re-save the document and try again.',
      })
      return
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setUploadError({
        title: 'File is too large',
        detail: `This file is ${(file.size / (1024 * 1024)).toFixed(1)} MB. DocLense accepts up to ${MAX_FILE_MB} MB for high-performance in-browser analysis.`,
      })
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
        const docId = `doc-${Date.now()}`
        const { text, blocks, pageCount, firstPageDataUrl, isScanned } = await extractPdf(buffer, controller.signal, docId)

        if (isScanned) {
          // Bounded OCR prompt
          const scannedDoc = createPdfDocument(file.name, ['[Scanned page content pending OCR]'], docId, true)
          ingestDocument(scannedDoc, file.size, firstPageDataUrl, true, buffer, append)
          setUploadError({
            title: 'Scanned PDF Detected',
            detail: `Found ${pageCount} page${pageCount > 1 ? 's' : ''}, but this document consists of scanned images without embedded text. Would you like DocLense to run safe, bounded Vision OCR?`,
            isScannedNotice: true,
          })
          return
        }

        const docModel: DocumentModel = {
          id: docId,
          fileName: file.name,
          kind: 'PDF',
          fullText: text,
          blocks,
          pageCount,
        }
        ingestDocument(docModel, file.size, firstPageDataUrl, false, buffer, append)
      } else {
        const rawText = validatePlainText(await file.text())
        if (!rawText.trim()) {
          setUploadError({
            title: 'File contains only whitespace',
            detail: 'The document opened fine but has no readable text. Paste text into a new file and try again.',
          })
          return
        }
        const docId = `doc-${Date.now()}`
        const docModel = createTextDocument(rawText, file.name, docId)
        ingestDocument(docModel, file.size, null, false, undefined, append)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown file-processing error')
      if (error.name === 'AbortError') return

      if (error instanceof PdfValidationError || error instanceof FileSafetyError) {
        setUploadError({
          title: 'Document Validation Notice',
          detail: error.message,
        })
      } else {
        setUploadError({
          title: 'Could not read this file',
          detail: kind === 'PDF'
            ? 'The PDF may be malformed or encrypted. Try re-saving it in a standard viewer and drop it again.'
            : 'The text file could not be decoded. Ensure UTF-8 plain text encoding.',
        })
      }
    } finally {
      if (fileAbortRef.current === controller) {
        fileAbortRef.current = null
        setUploading(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        if (multiFileInputRef.current) multiFileInputRef.current.value = ''
      }
    }
  }, [ingestDocument])

  // Trigger safe bounded OCR on scanned PDF
  const triggerOcr = useCallback(async () => {
    if (!uploaded || !uploaded.originalBuffer || !uploaded.pageCount) return
    if (!canUseGroq) {
      pushToast('Add your Groq API key in the sidebar to enable Vision OCR', 'error')
      setSidebarOpen(true)
      return
    }

    setOcrRunning(true)
    setOcrProgress({ currentPage: 0, totalPages: Math.min(uploaded.pageCount, 5), status: 'Initializing Vision OCR engine…' })
    setUploadError(null)

    ocrAbortRef.current?.abort()
    const controller = new AbortController()
    ocrAbortRef.current = controller

    try {
      const ocrResult = await performBoundedOcr(
        uploaded.originalBuffer,
        uploaded.pageCount,
        apiKey,
        controller.signal,
        setOcrProgress,
        uploaded.id,
      )

      const updatedDoc: DocumentModel = {
        ...uploaded,
        fullText: ocrResult.text,
        blocks: ocrResult.blocks,
        isOcr: true,
      }
      ingestDocument(updatedDoc, uploaded.sizeBytes, uploaded.firstPageDataUrl, false, uploaded.originalBuffer, false)
      pushToast('Vision OCR complete: ' + ocrResult.accuracyNote)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      pushToast('OCR processing failed: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error')
    } finally {
      setOcrRunning(false)
      setOcrProgress(null)
    }
  }, [uploaded, canUseGroq, apiKey, ingestDocument, pushToast])

  const loadSample = useCallback((id: string) => {
    const sample = SAMPLE_DOCS.find(s => s.id === id)
    if (!sample) return
    setUploadError(null)
    const docModel = createTextDocument(sample.text, sample.fileName, `sample-${sample.id}`)
    ingestDocument(docModel, new Blob([sample.text]).size, null, false, undefined, false)
    pushToast(`Sample "${sample.title}" loaded`)
  }, [ingestDocument, pushToast])

  const loadFromHistory = useCallback((entry: HistoryEntry) => {
    ingestDocument(entry.document, new Blob([entry.document.fullText]).size, null, false, undefined, false)
    pushToast('Loaded from recents')
    setSidebarOpen(false)
  }, [ingestDocument, pushToast])

  const resetAllDocuments = useCallback(() => {
    generationAbortRef.current?.abort()
    questionAbortRef.current?.abort()
    ocrAbortRef.current?.abort()
    setDocuments([])
    setActiveDocIndex(0)
    setResult(null)
    setShowResults(false)
    setGenError(null)
    setMessages([])
    setUploadError(null)
    setActiveCitation(null)
    setAnalysisProgress(null)
    pinToTop()
  }, [pinToTop])

  const removeDocument = useCallback((index: number) => {
    setDocuments(prev => {
      const next = prev.filter((_, i) => i !== index)
      return next
    })
    setActiveDocIndex(prev => Math.max(0, Math.min(prev, documents.length - 2)))
    if (documents.length <= 1) {
      resetAllDocuments()
    }
  }, [documents.length, resetAllDocuments])

  // ---------- Generate Analysis ----------
  const selectedCount = SECTION_KEYS.filter(k => sections[k]).length

  const generate = useCallback(async () => {
    if (documents.length === 0 || generating) return
    const chosen = SECTION_KEYS.filter(k => sections[k])
    if (chosen.length === 0) {
      pushToast('Pick at least one insight to generate', 'error')
      return
    }
    if (!canUseGroq) {
      pushToast('Add your Groq API key in the sidebar to generate analysis', 'error')
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

    // Determine target documents for single vs multi-doc comparative analysis
    const targetDocs: UploadedDoc[] = multiDocCompareMode && documents.length > 1
      ? documents
      : [documents[activeDocIndex]]

    try {
      const res = await callGroq(
        apiKey,
        settings,
        chosen as AnalysisSection[],
        targetDocs,
        controller.signal,
        setAnalysisProgress,
      )

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
      setTimeout(() => pushToast('Evidence-grounded analysis complete'), 150)

      const primaryDoc = targetDocs[0]
      setHistory(saveHistoryEntry({
        fileName: targetDocs.length > 1 ? `Multi-Doc (${targetDocs.length} files)` : primaryDoc.fileName,
        kind: primaryDoc.kind,
        pageCount: primaryDoc.pageCount,
        words: primaryDoc.stats.words,
        title: res.title ?? primaryDoc.fileName.replace(/\.[^.]+$/, ''),
        oneLiner: res.oneLiner ?? '',
        sentimentLabel: res.sentiment?.label,
        document: primaryDoc,
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
  }, [documents, activeDocIndex, multiDocCompareMode, generating, sections, canUseGroq, apiKey, settings, pinToTop, pushToast])

  // ---------- Grounded Chat Q&A ----------
  const askQuestion = useCallback(async (question: string) => {
    const q = question.trim()
    if (!q || documents.length === 0 || askLoading) return
    if (!canUseGroq) {
      pushToast('Add your Groq API key in the sidebar first', 'error')
      setSidebarOpen(true)
      return
    }

    const historyMessages = messages.slice(-6).map(m => ({ role: m.role, content: m.content }))
    setMessages(m => [...m, { id: `u-${Date.now()}`, role: 'user', content: q }])
    setDraft('')
    setAskLoading(true)

    questionAbortRef.current?.abort()
    const controller = new AbortController()
    questionAbortRef.current = controller

    const targetDocs: DocumentModel[] = multiDocCompareMode && documents.length > 1
      ? documents
      : [documents[activeDocIndex]]

    try {
      const answer = await askGroq(apiKey, settings, targetDocs, historyMessages, q, controller.signal)
      setMessages(m => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: answer.text,
          citations: answer.citations,
          confidence: answer.confidence,
        },
      ])
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
  }, [documents, activeDocIndex, multiDocCompareMode, askLoading, canUseGroq, apiKey, settings, messages, pushToast])

  const openCitation = useCallback((citation: Citation) => {
    // If citation is from a specific document in multi-doc mode, switch to it
    if (citation.docId) {
      const foundIdx = documents.findIndex(d => d.id === citation.docId)
      if (foundIdx !== -1) setActiveDocIndex(foundIdx)
    }
    setActiveCitation(citation)
    setReaderOpen(true)
  }, [documents])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [messages.length, askLoading])

  // ---------- Keyboard shortcuts ----------
  const downloadReport = useCallback(() => {
    if (!uploaded || !result) return
    downloadTextFile(uploaded.fileName, buildDownloadText(uploaded.fileName, result, uploaded.stats, generated))
    pushToast('Summary downloaded as .txt')
  }, [uploaded, result, generated, pushToast])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'g') { e.preventDefault(); void generate() }
      else if (k === 'd') { e.preventDefault(); downloadReport() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [generate, downloadReport])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void processFile(file, false)
  }, [processFile])

  const anyGenerated = result !== null
  const kwForReader = generated.keywords && result?.keywords?.length
    ? result.keywords
    : extractKeywords(uploaded?.fullText ?? '')

  const progressPercent = !analysisProgress
    ? ((genStage + 1) / GEN_STAGES.length) * 100
    : analysisProgress.phase === 'mapping'
      ? Math.max(8, (analysisProgress.completed / Math.max(1, analysisProgress.total)) * 72)
      : analysisProgress.phase === 'synthesizing'
        ? (analysisProgress.completed > 0 ? 100 : 86)
        : 50

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
        disabled={generating || uploading !== null || ocrRunning}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ===== Top Bar ===== */}
        <header className="z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-moss/15 bg-cream/80 px-3 backdrop-blur-md dark:border-white/10 dark:bg-panel-dark/80 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl p-2 text-ink-soft transition hover:bg-moss-mist hover:text-moss-deep dark:text-text-dark-soft dark:hover:bg-white/5 dark:hover:text-text-dark lg:hidden"
              aria-label="Open settings"
            >
              <Menu size={19} />
            </button>
            <nav className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-ink-soft dark:text-text-dark-soft" aria-label="Breadcrumb">
              <Link to="/" className="hidden transition hover:text-moss-deep dark:hover:text-text-dark sm:inline">DocLense</Link>
              <ChevronRight size={12} className="hidden sm:inline" />
              <span className="truncate text-emerald-800 dark:text-emerald-400 font-bold">Document Intelligence Studio</span>
              {uploaded && (
                <>
                  <ChevronRight size={12} />
                  <span className="max-w-[140px] truncate font-normal text-ink dark:text-text-dark-soft">
                    {uploaded.fileName}
                  </span>
                </>
              )}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 md:inline-flex dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {GROQ_MODELS.find(m => m.id === settings.model)?.label}
            </span>
            <Link to="/docs" className="rounded-xl px-3 py-2 text-[12px] font-bold text-ink-soft transition hover:bg-moss-mist hover:text-moss-deep dark:text-text-dark-soft dark:hover:bg-white/5 dark:hover:text-text-dark">
              Docs
            </Link>
            <button
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="rounded-xl p-2 text-ink-soft transition hover:bg-moss-mist hover:text-moss-deep dark:text-text-dark-soft dark:hover:bg-white/5 dark:hover:text-text-dark"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>

        {/* ===== Workspace ===== */}
        <main ref={mainRef} className="relative flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-4xl space-y-4 px-3 pb-14 pt-4 sm:px-6 sm:pt-5">

            {/* ===================== MULTI-DOCUMENT TAB BAR ===================== */}
            {documents.length > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-700/20 bg-emerald-50/50 p-2 dark:border-emerald-500/20 dark:bg-emerald-950/20">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="px-2 text-[11px] font-extrabold uppercase tracking-wider text-emerald-900 dark:text-emerald-300 flex items-center gap-1">
                    <Layers size={13} /> Active Docs:
                  </span>
                  {documents.map((doc, idx) => (
                    <div
                      key={doc.id || idx}
                      className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                        activeDocIndex === idx
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                          : 'border-moss/20 bg-cream text-ink hover:border-moss/40 dark:border-white/10 dark:bg-panel-dark dark:text-text-dark'
                      }`}
                      onClick={() => setActiveDocIndex(idx)}
                    >
                      <FileText size={12} />
                      <span className="truncate max-w-[120px]">{doc.fileName}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeDocument(idx) }}
                        className="rounded hover:bg-black/20 p-0.5"
                        title="Remove document"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => multiFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-xl border border-dashed border-emerald-600/40 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100/60 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                  >
                    <Plus size={12} /> Add Doc
                  </button>
                  <input
                    ref={multiFileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md,.text,application/pdf,text/plain"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void processFile(f, true) }}
                  />
                </div>

                <label className="flex items-center gap-2 px-2 text-xs font-bold text-emerald-900 dark:text-emerald-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={multiDocCompareMode}
                    onChange={e => setMultiDocCompareMode(e.target.checked)}
                    className="rounded border-emerald-600 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Compare &amp; Synthesize All ({documents.length})</span>
                </label>
              </div>
            )}

            {/* ===================== RESULTS (pinned to top) ===================== */}
            {uploaded && showResults && anyGenerated && (
              <div key="results" className="space-y-4">
                <GeneratedStamp />
                <ResultsView
                  fileName={multiDocCompareMode && documents.length > 1 ? `Multi-Document Comparison (${documents.length} files)` : uploaded.fileName}
                  stats={uploaded.stats}
                  result={result!}
                  generated={generated}
                  onToast={pushToast}
                  onOpenCitation={openCitation}
                />
                {generated.quiz && result?.quiz && <QuizCard quiz={result.quiz} onToast={pushToast} />}
                <div className="flex items-center gap-3 px-1 pt-1 text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-soft/70 dark:text-text-dark-soft/60">
                  <span className="h-px flex-1 bg-moss/20 dark:bg-white/10" />
                  Document Evidence &amp; Verification Chat
                  <span className="h-px flex-1 bg-moss/20 dark:bg-white/10" />
                </div>
              </div>
            )}

            {/* ===================== STATS ===================== */}
            {uploaded && showResults && anyGenerated && <StatsGrid stats={uploaded.stats} />}

            {/* ===================== UPLOAD ERROR / OCR NOTICE ===================== */}
            <AnimatePresence>
              {uploadError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  role="alert"
                  className={`flex gap-3.5 rounded-3xl border-2 p-4 sm:p-5 ${
                    uploadError.isScannedNotice
                      ? 'border-indigo-400 bg-indigo-50/90 dark:border-indigo-500/40 dark:bg-indigo-950/30'
                      : 'border-persimmon/50 bg-persimmon-mist dark:border-persimmon-dark/40 dark:bg-persimmon-dark/10'
                  }`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                    uploadError.isScannedNotice
                      ? 'bg-indigo-600 text-white'
                      : 'bg-persimmon text-cream dark:bg-persimmon-dark dark:text-[#2b1206]'
                  }`}>
                    {uploadError.isScannedNotice ? <ScanText size={20} /> : <AlertTriangle size={20} strokeWidth={2.2} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`font-display text-base font-extrabold ${uploadError.isScannedNotice ? 'text-indigo-950 dark:text-indigo-200' : 'text-[#8a2c0d] dark:text-persimmon-dark'}`}>
                      {uploadError.title}
                    </p>
                    <p className={`mt-1 font-body text-[14px] leading-relaxed ${uploadError.isScannedNotice ? 'text-indigo-900 dark:text-indigo-300' : 'text-[#6e3418] dark:text-text-dark-soft'}`}>
                      {uploadError.detail}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {uploadError.isScannedNotice ? (
                        <button
                          onClick={triggerOcr}
                          disabled={ocrRunning}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-700 px-4 py-2 font-sans text-xs font-extrabold text-white shadow transition hover:bg-indigo-800 disabled:opacity-50"
                        >
                          <ScanText size={14} /> Run Vision OCR (First 5 Pages)
                        </button>
                      ) : null}
                      <button
                        onClick={() => { setUploadError(null); fileInputRef.current?.click() }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-current px-3 py-1.5 font-sans text-[11.5px] font-extrabold uppercase tracking-wide transition hover:opacity-80"
                      >
                        Choose another file <ArrowRight size={12} strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                  <button onClick={() => setUploadError(null)} className="ml-auto h-fit rounded-lg p-1.5 hover:bg-black/5" aria-label="Dismiss">
                    <X size={16} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ===================== OCR PROGRESS OVERLAY ===================== */}
            {ocrRunning && ocrProgress && (
              <section className="rounded-[2rem] border-2 border-indigo-400 bg-indigo-50/90 p-8 text-center shadow-lg dark:border-indigo-500/40 dark:bg-panel-dark">
                <div className="mx-auto flex h-14 w-14 items-center justify-center">
                  <Loader2 className="animate-spin text-indigo-700 dark:text-indigo-400" size={38} strokeWidth={2.4} />
                </div>
                <h3 className="mt-3 font-display text-lg font-bold text-indigo-950 dark:text-indigo-200">
                  Performing Bounded Vision OCR
                </h3>
                <p className="mt-1 font-mono text-xs font-semibold text-indigo-800 dark:text-indigo-300">
                  {ocrProgress.status} (Page {ocrProgress.currentPage} of {ocrProgress.totalPages})
                </p>
                <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-indigo-200 dark:bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-indigo-600"
                    animate={{ width: `${(ocrProgress.currentPage / ocrProgress.totalPages) * 100}%` }}
                    transition={{ ease: 'easeOut', duration: 0.5 }}
                  />
                </div>
              </section>
            )}

            {/* ===================== UPLOADING OVERLAY ===================== */}
            {uploading ? (
              <section className="rounded-[2rem] border-2 border-dashed border-moss/40 bg-cream p-10 text-center shadow-sm dark:border-persimmon-dark/35 dark:bg-panel-dark">
                <div className="mx-auto flex h-16 w-16 items-center justify-center">
                  <Loader2 className="animate-spin text-emerald-700 dark:text-emerald-400" size={44} strokeWidth={2.2} />
                </div>
                <p className="mt-4 font-display text-xl font-extrabold text-ink dark:text-text-dark">
                  Processing “{uploading.length > 42 ? uploading.slice(0, 40) + '…' : uploading}”
                </p>
                <p className="mt-1.5 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  {UPLOAD_STAGES[uploadStage]}
                </p>
                <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-moss-mist dark:bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-amber-500 to-emerald-700"
                    animate={{ width: `${((uploadStage + 1) / UPLOAD_STAGES.length) * 100}%` }}
                    transition={{ ease: 'easeOut', duration: 0.5 }}
                  />
                </div>
              </section>
            ) : !uploaded ? (
              /* ===================== DROPZONE ===================== */
              <section
                role="button"
                tabIndex={0}
                aria-label="Upload a PDF, Markdown or TXT file"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                className={`group relative cursor-pointer overflow-hidden rounded-[2rem] border-[2.5px] border-dashed p-8 text-center shadow-sm transition-all duration-300 sm:p-12 ${
                  dragActive
                    ? 'scale-[1.015] border-emerald-600 bg-emerald-50/70 shadow-xl dark:border-emerald-500 dark:bg-emerald-950/20'
                    : 'border-moss/35 bg-cream/85 hover:border-emerald-600 hover:bg-cream hover:shadow-lg dark:border-white/15 dark:bg-panel-dark dark:hover:border-emerald-500/50'
                } focus-visible:outline-emerald-600`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,.text,application/pdf,text/plain"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void processFile(f, false) }}
                />
                <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-moss-mist/60 blur-3xl transition dark:bg-moss/10" />
                <div className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-emerald-100/70 blur-3xl transition dark:bg-emerald-950/20" />
                <div className="relative">
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                    className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-800 text-cream shadow-[0_6px_0_#064e3b] dark:bg-emerald-600 dark:text-emerald-950 dark:shadow-[0_6px_0_#065f46]"
                  >
                    <CloudUpload size={38} strokeWidth={2} />
                  </motion.div>
                  <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-ink dark:text-text-dark sm:text-4xl">
                    {dragActive ? 'Drop file to inspect' : 'Drop your document here'}
                  </h1>
                  <p className="mx-auto mt-2 max-w-md font-body text-[15px] leading-relaxed text-ink-soft dark:text-text-dark-soft">
                    PDF, TXT, or Markdown up to {MAX_FILE_MB} MB. Parsed locally in your browser with structured source blocks and verifiable citations.
                  </p>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                    <span className="inline-flex items-center gap-2 rounded-2xl bg-emerald-800 px-5 py-3 font-sans text-sm font-extrabold text-cream shadow-[0_3px_0_#064e3b] transition group-hover:bg-emerald-900 dark:bg-emerald-600 dark:text-emerald-950 dark:shadow-[0_3px_0_#065f46]">
                      <FileText size={17} /> Browse files
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-2xl border-2 border-moss/30 px-5 py-[10px] font-sans text-sm font-bold text-moss-deep dark:border-white/15 dark:text-text-dark">
                      <Sparkles size={15} /> or pick a sample below
                    </span>
                  </div>
                  <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-soft/90 dark:text-text-dark-soft/80">
                    <Lock size={11} /> Ephemeral in-tab memory. Data is sent only to Groq when you request analysis.
                  </p>
                </div>
              </section>
            ) : null}

            {/* ===================== SAMPLE CHIPS ===================== */}
            {!uploaded && !uploading && (
              <section aria-label="Sample documents">
                <p className="mb-2 px-1 text-[10.5px] font-extrabold uppercase tracking-[0.2em] text-ink-soft/80 dark:text-text-dark-soft/70">
                  Try a sample document
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {SAMPLE_DOCS.map(sample => {
                    const Icon = sample.icon
                    return (
                      <button
                        key={sample.id}
                        onClick={() => loadSample(sample.id)}
                        title={sample.description}
                        className="flex w-56 shrink-0 items-start gap-2.5 rounded-2xl border border-moss/20 bg-cream p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-moss/45 hover:shadow-md dark:border-white/10 dark:bg-panel-dark dark:hover:border-emerald-500/40"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-moss-mist text-moss-deep dark:bg-white/8 dark:text-emerald-400">
                          <Icon size={17} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[11.5px] font-extrabold text-ink dark:text-text-dark">
                            {sample.title}
                          </span>
                          <span className="mt-0.5 block text-[9.5px] font-semibold uppercase tracking-wide text-ink-soft/80 dark:text-text-dark-soft/70">
                            {sample.badge}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ===================== FILE CARD + ANALYSIS CONTROLS ===================== */}
            {uploaded && !uploading && (
              <>
                {!(showResults && anyGenerated) && <StatsGrid stats={uploaded.stats} />}

                <section className="overflow-hidden rounded-3xl border border-moss/25 bg-cream shadow-sm dark:border-white/10 dark:bg-panel-dark">
                  <div className="flex items-center gap-4 p-4 sm:p-5">
                    {uploaded.firstPageDataUrl ? (
                      <img
                        src={uploaded.firstPageDataUrl}
                        alt="First page of the PDF"
                        className="h-24 w-[72px] shrink-0 rounded-xl border border-moss/30 object-cover object-top shadow-md"
                      />
                    ) : (
                      <div className="flex h-24 w-[72px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-moss/30 bg-moss-mist text-moss-deep shadow-md dark:border-white/12 dark:bg-white/5 dark:text-emerald-400">
                        <FileType2 size={26} strokeWidth={1.8} />
                        <span className="font-mono text-[9px] font-bold uppercase tracking-widest">{uploaded.kind}</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-display text-[15px] font-bold text-ink dark:text-text-dark" title={uploaded.fileName}>
                          {uploaded.fileName}
                        </p>
                        {uploaded.isOcr && (
                          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-extrabold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                            OCR
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-semibold text-ink-soft dark:text-text-dark-soft">
                        <span className="inline-flex items-center gap-1 rounded-md bg-moss-mist px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider text-moss-deep dark:bg-white/8 dark:text-emerald-400">
                          {uploaded.kind}
                        </span>
                        <span>{(uploaded.sizeBytes / 1024).toFixed(0)} KB</span>
                        {uploaded.pageCount !== null && (
                          <span>· {uploaded.pageCount} page{uploaded.pageCount === 1 ? '' : 's'}</span>
                        )}
                        <span>· {uploaded.stats.words.toLocaleString()} words</span>
                        <span>· ~{uploaded.stats.readingTimeLabel} read</span>
                        <span>· {uploaded.blocks.length} verifiable source section{uploaded.blocks.length === 1 ? '' : 's'}</span>
                      </div>

                      {uploaded.hasInstructionLikeContent && (
                        <p role="status" className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-400/40 bg-amber-50 px-2.5 py-2 text-[10.5px] font-semibold leading-relaxed text-amber-900 dark:border-amber-400/25 dark:bg-amber-950/20 dark:text-amber-200">
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                          DocLense prompt protection: Source contains instruction-like phrases. Content is strictly demarcated as untrusted quoted evidence.
                        </p>
                      )}

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => { setActiveCitation(null); setReaderOpen(true) }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-moss/30 px-3 py-1.5 text-[11px] font-bold text-moss-deep transition hover:bg-moss-mist dark:border-white/15 dark:text-text-dark dark:hover:bg-white/5"
                        >
                          <Eye size={13} /> View source reader
                        </button>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-moss/30 px-3 py-1.5 text-[11px] font-bold text-moss-deep transition hover:bg-moss-mist dark:border-white/15 dark:text-text-dark dark:hover:bg-white/5"
                        >
                          <CloudUpload size={13} /> Replace
                        </button>
                        <button
                          onClick={() => multiFileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600/30 px-3 py-1.5 text-[11px] font-bold text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                        >
                          <Plus size={13} /> Add another document
                        </button>
                        <button
                          onClick={resetAllDocuments}
                          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold text-ink-soft transition hover:bg-persimmon-mist hover:text-persimmon dark:text-text-dark-soft dark:hover:bg-persimmon-dark/10 dark:hover:text-persimmon-dark"
                        >
                          <Trash2 size={13} /> Clear
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ---- Section Checkbox Selector ---- */}
                  <div className="border-t border-moss/15 bg-paper-deep/50 p-4 dark:border-white/10 dark:bg-black/15 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-sans text-[11px] font-extrabold uppercase tracking-[0.2em] text-ink dark:text-text-dark">
                        What should DocLense generate?
                      </p>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSections({ summary: true, keyPoints: true, keywords: true, sentiment: true, quiz: true })}
                          className="rounded-lg px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide text-emerald-800 transition hover:bg-moss-mist dark:text-emerald-400 dark:hover:bg-white/5"
                        >
                          Select all
                        </button>
                        <span className="text-ink-soft/50 dark:text-white/20">·</span>
                        <button
                          onClick={() => setSections({ summary: true, keyPoints: false, keywords: false, sentiment: false, quiz: false })}
                          className="rounded-lg px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide text-emerald-800 transition hover:bg-moss-mist dark:text-emerald-400 dark:hover:bg-white/5"
                        >
                          Summary only
                        </button>
                        <span className="text-ink-soft/50 dark:text-white/20">·</span>
                        <button
                          onClick={() => setSections({ summary: false, keyPoints: false, keywords: false, sentiment: false, quiz: false })}
                          className="rounded-lg px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide text-ink-soft transition hover:bg-moss-mist dark:text-text-dark-soft dark:hover:bg-white/5"
                        >
                          None
                        </button>
                      </div>
                    </div>

                    <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {([
                        { key: 'summary', icon: AlignLeft, label: 'Summary', sub: 'Evidence-grounded' },
                        { key: 'keyPoints', icon: ListChecks, label: 'Key Points', sub: 'With page citations' },
                        { key: 'keywords', icon: Tags, label: 'Keywords', sub: 'Topics & terms' },
                        { key: 'sentiment', icon: Gauge, label: 'Sentiment', sub: 'Tone & polarity' },
                        { key: 'quiz', icon: FileQuestion, label: 'Quiz', sub: 'Grounded questions' },
                      ] as const).map(({ key, icon: Icon, label, sub }) => {
                        const checked = sections[key]
                        return (
                          <button
                            key={key}
                            role="checkbox"
                            aria-checked={checked}
                            disabled={generating}
                            onClick={() => setSections(s => ({ ...s, [key]: !s[key] }))}
                            className={`relative rounded-2xl border p-3 pb-2.5 text-left transition disabled:opacity-60 ${
                              checked
                                ? 'border-emerald-600 bg-emerald-50/80 shadow-inner dark:border-emerald-500 dark:bg-emerald-950/20'
                                : 'border-moss/20 bg-cream hover:border-moss/45 dark:border-white/12 dark:bg-panel-dark-2 dark:hover:border-white/25'
                            }`}
                          >
                            <span className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-md border-2 transition ${
                              checked
                                ? 'border-emerald-700 bg-emerald-700 text-cream dark:border-emerald-500 dark:bg-emerald-500 dark:text-emerald-950'
                                : 'border-ink/20 bg-transparent dark:border-white/25'
                            }`}>
                              {checked && <Check size={12} strokeWidth={4} />}
                            </span>
                            <Icon size={19} strokeWidth={2.1} className={checked ? 'text-emerald-800 dark:text-emerald-400' : 'text-ink-soft dark:text-text-dark-soft'} />
                            <span className="mt-1.5 block text-[12px] font-extrabold leading-tight text-ink dark:text-text-dark">{label}</span>
                            <span className="mt-0.5 block text-[9px] font-semibold leading-tight text-ink-soft/85 dark:text-text-dark-soft/75">{sub}</span>
                          </button>
                        )
                      })}
                    </div>

                    {/* ---- Generate Button Row ---- */}
                    <div className="mt-3.5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-ink-soft dark:text-text-dark-soft">
                          <span className="font-extrabold text-emerald-800 dark:text-emerald-400">{selectedCount} of 5</span> selected · {settings.coverageMode === 'complete' ? '100% full coverage' : 'sampled coverage'} · {settings.model.split('/').pop()}
                        </p>
                        {!canUseGroq && (
                          <button
                            onClick={() => setSidebarOpen(true)}
                            className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 underline decoration-amber-500/50 underline-offset-2 transition hover:text-amber-800 dark:text-amber-300"
                          >
                            <KeyRound size={11} /> Add your Groq API key in the sidebar <ArrowRight size={11} />
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          if (generating) generationAbortRef.current?.abort()
                          else void generate()
                        }}
                        disabled={selectedCount === 0}
                        aria-label={generating ? 'Cancel analysis' : 'Generate analysis'}
                        className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-800 px-6 py-4 font-sans text-[15px] font-extrabold text-cream shadow-[0_4px_0_#064e3b] transition hover:bg-emerald-900 active:translate-y-0.5 active:shadow-[0_2px_0_#064e3b] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-emerald-600 dark:text-emerald-950 dark:shadow-[0_4px_0_#065f46]"
                      >
                        {generating ? (
                          <>
                            <X size={18} /> Cancel <span className="font-mono text-[11px] font-semibold text-cream/90">{analysisProgress?.label ?? GEN_STAGES[genStage]}</span>
                          </>
                        ) : (
                          <>
                            <Zap size={18} strokeWidth={2.5} />
                            {anyGenerated ? 'Regenerate Analysis' : 'Generate Verified Analysis'}
                            <kbd className="rounded-md border border-cream/40 bg-black/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-cream/95">G</kbd>
                          </>
                        )}
                      </button>
                    </div>

                    {generating && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-moss-mist dark:bg-white/10">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-amber-500 to-emerald-700"
                          animate={{ width: `${progressPercent}%` }}
                          transition={{ ease: 'easeOut', duration: 0.6 }}
                        />
                      </div>
                    )}

                    {genError && (
                      <div role="alert" className="mt-3 flex items-start gap-2 rounded-2xl border border-persimmon/40 bg-persimmon-mist px-3.5 py-2.5 text-[12.5px] font-semibold leading-snug text-[#8a2c0d] dark:border-persimmon-dark/35 dark:bg-persimmon-dark/10 dark:text-persimmon-dark">
                        <CircleAlert size={15} className="mt-0.5 shrink-0" />
                        {genError}
                      </div>
                    )}
                  </div>
                </section>

                {/* ===================== CHAT WITH CITATIONS ===================== */}
                <section className="overflow-hidden rounded-3xl border border-moss/25 bg-cream shadow-sm dark:border-white/10 dark:bg-panel-dark">
                  <div className="flex items-center justify-between gap-2 border-b border-moss/15 px-4 py-3 dark:border-white/10 sm:px-5">
                    <div className="flex items-center gap-2">
                      <DocLenseLogo size={26} />
                      <div>
                        <p className="font-display text-[13.5px] font-extrabold leading-none text-ink dark:text-text-dark">
                          Ask DocLense
                        </p>
                        <p className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-widest text-ink-soft/80 dark:text-text-dark-soft/70">
                          BM25 Retrieval &amp; Verifiable Source Citations
                        </p>
                      </div>
                    </div>
                    {messages.length > 0 && (
                      <button
                        onClick={() => setMessages([])}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-ink-soft transition hover:bg-moss-mist hover:text-moss-deep dark:text-text-dark-soft dark:hover:bg-white/5 dark:hover:text-text-dark"
                      >
                        <Eraser size={12} /> Clear chat
                      </button>
                    )}
                  </div>

                  <div className="max-h-96 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
                    {messages.length === 0 ? (
                      <div className="py-2 text-center">
                        <BookOpenText size={30} strokeWidth={1.6} className="mx-auto text-emerald-800/60 dark:text-emerald-400/70" />
                        <p className="mt-2 font-body text-[14px] italic text-ink-soft dark:text-text-dark-soft">
                          Questions about {documents.length > 1 ? `these ${documents.length} documents` : 'this document'}? Every answer cites exact source evidence.
                        </p>
                        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                          {SUGGESTIONS.map(s => (
                            <button
                              key={s}
                              onClick={() => void askQuestion(s)}
                              className="rounded-full border border-moss/25 bg-moss-mist/60 px-3 py-1.5 text-[11px] font-semibold text-moss-deep transition hover:border-moss hover:bg-moss-mist dark:border-white/12 dark:bg-white/5 dark:text-text-dark-soft dark:hover:border-emerald-500/40 dark:hover:text-emerald-300"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      messages.map(m => (
                        <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                          {m.role === 'assistant' && <DocLenseLogo size={26} className="mt-1 shrink-0" />}
                          <div
                            className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 font-body text-[14px] leading-relaxed shadow-sm sm:max-w-[78%] ${
                              m.role === 'user'
                                ? 'rounded-tr-md bg-emerald-800 text-cream dark:bg-emerald-600 dark:text-emerald-950'
                                : m.isError
                                  ? 'rounded-tl-md border border-persimmon/45 bg-persimmon-mist text-[#8a2c0d] dark:border-persimmon-dark/40 dark:bg-persimmon-dark/10 dark:text-persimmon-dark'
                                  : 'rounded-tl-md border border-moss/20 bg-paper text-ink dark:border-white/10 dark:bg-panel-dark-2 dark:text-text-dark/95'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{m.content}</p>
                            {m.role === 'assistant' && m.citations && m.citations.length > 0 && (
                              <div className="mt-2 border-t border-moss/10 pt-2 dark:border-white/5">
                                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ink-soft dark:text-text-dark-soft">
                                  Sources:
                                </p>
                                <CitationChips citations={m.citations} onOpen={openCitation} />
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    {askLoading && (
                      <div className="flex gap-2">
                        <DocLenseLogo size={26} className="mt-1 shrink-0" />
                        <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-moss/20 bg-paper px-4 py-3 dark:border-white/10 dark:bg-panel-dark-2" aria-label="DocLense is retrieving evidence">
                          {[0, 1, 2].map(i => (
                            <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-emerald-700 dark:bg-emerald-400" style={{ animationDelay: `${i * 0.16}s` }} />
                          ))}
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <form onSubmit={(e) => { e.preventDefault(); void askQuestion(draft) }} className="flex items-center gap-2 border-t border-moss/15 p-3 dark:border-white/10">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      maxLength={CHAT_LIMIT}
                      placeholder="Ask anything about this document…"
                      aria-label="Ask a question about the document"
                      className="min-w-0 flex-1 rounded-2xl border border-moss/25 bg-paper px-4 py-3 font-body text-[14.5px] text-ink outline-none transition placeholder:text-ink-soft/60 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-white/12 dark:bg-white/5 dark:text-text-dark dark:placeholder:text-text-dark-soft/50 dark:focus:border-emerald-500/60"
                    />
                    <button
                      type="submit"
                      disabled={askLoading || !draft.trim()}
                      aria-label="Send question"
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-800 text-cream shadow-[0_3px_0_#064e3b] transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:text-emerald-950 dark:shadow-[0_3px_0_#065f46]"
                    >
                      <Send size={18} strokeWidth={2.2} />
                    </button>
                  </form>
                </section>
              </>
            )}
          </div>
        </main>
      </div>

      {/* ===== Toasts ===== */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(92vw,360px)] flex-col gap-2" aria-live="polite">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 60, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              className={`pointer-events-auto flex items-start gap-2.5 rounded-2xl border p-3 text-[12.5px] font-semibold leading-snug shadow-xl backdrop-blur ${
                toast.tone === 'error'
                  ? 'border-persimmon/45 bg-[#fdf0e9]/95 text-[#8a2c0d] dark:border-persimmon-dark/40 dark:bg-[#33150c]/95 dark:text-persimmon-dark'
                  : 'border-emerald-600/30 bg-cream/95 text-emerald-900 dark:border-emerald-500/25 dark:bg-[#0f2620]/95 dark:text-emerald-300'
              }`}
            >
              {toast.tone === 'error' ? (
                <CircleAlert size={16} className="mt-0.5 shrink-0" />
              ) : (
                <Check size={16} strokeWidth={3} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              )}
              <span>{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ===== Document Reader ===== */}
      {uploaded ? (
        <DocumentReader
          document={uploaded}
          open={readerOpen}
          activeCitation={activeCitation}
          keywords={kwForReader}
          highlightKeywords={highlightKeywords}
          onToggleKeywords={() => setHighlightKeywords(v => !v)}
          onClose={() => setReaderOpen(false)}
        />
      ) : null}
    </div>
  )
}
