import { useEffect, useRef } from 'react'
import {
  ChevronDown, Flame, Rows3, AlignLeft,
  Languages, GraduationCap, RotateCcw, History, Trash2, FileText, X, Zap,
  ScanSearch, BrainCircuit,
} from 'lucide-react'
import { SUPPORTED_LANGUAGES, type AnalysisSettings } from '../lib/groq'
import DocLenseLogo from './DocLenseLogo'
import ProviderSettings from './ProviderSettings'
import type { ModelMetadata, ProviderId, ProviderMode, ProviderStatus } from '../lib/aiProviders'
import type { HistoryEntry } from '../lib/history'

interface SidebarProps {
  open: boolean
  onClose: () => void
  providerMode: ProviderMode
  setProviderMode: (mode: ProviderMode) => void
  activeProvider: ProviderId
  setActiveProvider: (provider: ProviderId) => void
  providerPriority: ProviderId[]
  setProviderPriority: (priority: ProviderId[]) => void
  providerKeys: Record<ProviderId, string>
  setProviderKey: (provider: ProviderId, key: string) => void
  providerModels: Record<ProviderId, string>
  setProviderModel: (provider: ProviderId, model: string) => void
  modelCatalogs: Partial<Record<ProviderId, ModelMetadata[]>>
  providerStatuses: Record<ProviderId, ProviderStatus>
  providerErrors: Partial<Record<ProviderId, string>>
  providerConsents: Record<ProviderId, boolean>
  setProviderConsent: (provider: ProviderId, consent: boolean) => void
  onConnectProvider: (provider: ProviderId, refresh?: boolean) => void
  onTestProvider: (provider: ProviderId) => void
  settings: AnalysisSettings
  updateSettings: (patch: Partial<AnalysisSettings>) => void
  onResetSettings: () => void
  history: HistoryEntry[]
  onClearHistory: () => void
  onPickHistory: (entry: HistoryEntry) => void
  disabled?: boolean
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 px-1 text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-text-dark-soft/80">
      <span className="h-px w-3 bg-current opacity-50" />{children}
    </p>
  )
}

export default function Sidebar(props: SidebarProps) {
  const {
    open, onClose, providerMode, setProviderMode, activeProvider, setActiveProvider,
    providerPriority, setProviderPriority, providerKeys, setProviderKey, providerModels,
    setProviderModel, modelCatalogs, providerStatuses, providerErrors, providerConsents,
    setProviderConsent, onConnectProvider, onTestProvider,
    settings, updateSettings, onResetSettings, history, onClearHistory, onPickHistory, disabled,
  } = props
  const tempPct = ((settings.temperature - 0) / 1.2) * 100
  const tokensPct = ((settings.maxTokens - 256) / (4096 - 256)) * 100
  const tempHint = settings.temperature <= 0.35 ? 'Precise & literal' : settings.temperature <= 0.75 ? 'Balanced creativity' : 'Loose & imaginative'
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return (
    <>
      {/* overlay for mobile */}
      <div
        className={`fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        ref={panelRef}
        className={`fixed inset-y-0 left-0 z-50 flex w-[330px] shrink-0 flex-col border-r border-white/10 bg-moss-night-deep text-text-dark transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-[320px] lg:translate-x-0 ${open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}
        aria-label="Analysis settings"
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <DocLenseLogo size={32} />
            <div>
              <p className="font-display text-lg font-bold leading-none text-text-dark">DocLense</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-dark-soft/80">Analysis Studio</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-text-dark-soft transition hover:bg-white/5 hover:text-text-dark lg:hidden" aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        {/* scrollable body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">

          <ProviderSettings
            mode={providerMode}
            onModeChange={setProviderMode}
            activeProvider={activeProvider}
            onActiveProviderChange={setActiveProvider}
            priority={providerPriority}
            onPriorityChange={setProviderPriority}
            keys={providerKeys}
            onKeyChange={setProviderKey}
            models={providerModels}
            onModelChange={setProviderModel}
            catalogs={modelCatalogs}
            statuses={providerStatuses}
            errors={providerErrors}
            consents={providerConsents}
            onConsentChange={setProviderConsent}
            onConnect={onConnectProvider}
            onTest={onTestProvider}
            disabled={disabled}
          />

          {/* ---------- COVERAGE & BUDGET ---------- */}
          <section className="space-y-2.5">
            <SectionLabel><ScanSearch size={11} className="-ml-4 mr-0.5 inline" />Document coverage</SectionLabel>
            <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-white/10 bg-black/25 p-1.5" role="radiogroup" aria-label="Analysis coverage mode">
              {([['sampled', 'Sampled'], ['complete', 'Complete']] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={settings.analysisMode === value}
                  disabled={disabled}
                  onClick={() => updateSettings({ analysisMode: value, maxChunks: value === 'complete' ? Math.max(settings.maxChunks, 24) : Math.min(settings.maxChunks, 12) })}
                  className={`rounded-xl px-2 py-2 text-[11.5px] font-bold transition ${settings.analysisMode === value ? 'bg-persimmon-dark text-[#2b1206] shadow' : 'text-text-dark-soft hover:bg-white/5 hover:text-text-dark'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="px-1 text-[10.5px] font-medium leading-relaxed text-text-dark-soft/80">{settings.analysisMode === 'complete' ? 'Includes every extracted chunk if it fits the explicit budget.' : 'Samples evenly across every document for lower latency and API use.'}</p>
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-dark-soft">Chunk budget</span>
              <span className="rounded-lg border border-gold-dark/25 bg-gold-dark/10 px-2 py-0.5 font-mono text-[11px] font-bold text-gold-dark">{settings.maxChunks} · ≤{Math.ceil(settings.maxChunks / 2) + 2} requests</span>
            </div>
            <input
              type="range"
              min={2}
              max={40}
              step={2}
              value={settings.maxChunks}
              disabled={disabled}
              onChange={event => updateSettings({ maxChunks: Number(event.target.value) })}
              aria-label="Maximum document chunks"
              className="doclense-range w-full"
              style={{ ['--fill' as string]: `${((settings.maxChunks - 2) / 38) * 100}%` }}
            />
          </section>

          {/* ---------- TEMPERATURE ---------- */}
          <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <SectionLabel><Flame size={11} className="-ml-4 mr-0.5 inline" />Temperature</SectionLabel>
              <span className="rounded-lg border border-persimmon-dark/30 bg-persimmon-dark/10 px-2 py-0.5 font-mono text-[11px] font-bold text-persimmon-dark">{settings.temperature.toFixed(2)}</span>
            </div>
            <input
              type="range" min={0} max={1.2} step={0.05} value={settings.temperature} disabled={disabled}
              onChange={e => updateSettings({ temperature: Number(e.target.value) })}
              aria-label="Temperature"
              className="doclense-range w-full"
              style={{ ['--fill' as string]: `${tempPct}%` }}
            />
            <div className="flex items-center justify-between px-1 text-[10px] font-semibold text-text-dark-soft/75">
              <span>0.0 · Precise</span>
              <span className="italic text-gold-dark/90">{tempHint}</span>
              <span>1.2 · Wild</span>
            </div>
          </section>

          {/* ---------- MAX TOKENS ---------- */}
          <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <SectionLabel><Rows3 size={11} className="-ml-4 mr-0.5 inline" />Max tokens</SectionLabel>
              <span className="rounded-lg border border-persimmon-dark/30 bg-persimmon-dark/10 px-2 py-0.5 font-mono text-[11px] font-bold text-persimmon-dark">{settings.maxTokens.toLocaleString()}</span>
            </div>
            <input
              type="range" min={256} max={4096} step={128} value={settings.maxTokens} disabled={disabled}
              onChange={e => updateSettings({ maxTokens: Number(e.target.value) })}
              aria-label="Max tokens"
              className="doclense-range w-full"
              style={{ ['--fill' as string]: `${tokensPct}%` }}
            />
            <div className="flex items-center justify-between px-1 text-[10px] font-semibold text-text-dark-soft/75"><span>256</span><span>2,048</span><span>4,096</span></div>
          </section>

          {/* ---------- SUMMARY STYLE ---------- */}
          <section className="space-y-2">
            <SectionLabel><AlignLeft size={11} className="-ml-4 mr-0.5 inline" />Summary style</SectionLabel>
            <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-white/10 bg-black/25 p-1.5" role="radiogroup" aria-label="Summary style">
              {([['concise', 'Concise'], ['detailed', 'Detailed'], ['bullets', 'Bullets']] as const).map(([value, label]) => (
                <button
                  key={value}
                  role="radio"
                  aria-checked={settings.summaryStyle === value}
                  disabled={disabled}
                  onClick={() => updateSettings({ summaryStyle: value })}
                  className={`rounded-xl px-2 py-2 text-[11.5px] font-bold transition ${settings.summaryStyle === value ? 'bg-persimmon-dark text-[#2b1206] shadow' : 'text-text-dark-soft hover:bg-white/5 hover:text-text-dark'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <SectionLabel><BrainCircuit size={11} className="-ml-4 mr-0.5 inline" />Quiz difficulty</SectionLabel>
            <div className="relative">
              <select
                value={settings.quizDifficulty}
                disabled={disabled}
                onChange={event => updateSettings({ quizDifficulty: event.target.value as AnalysisSettings['quizDifficulty'] })}
                aria-label="Quiz difficulty"
                className="w-full appearance-none rounded-xl border border-white/12 bg-black/30 py-2.5 pl-3 pr-8 text-[12px] font-semibold text-text-dark outline-none focus:border-persimmon-dark/60 disabled:opacity-60"
              >
                <option value="adaptive" className="bg-panel-dark">Adaptive mix</option>
                <option value="easy" className="bg-panel-dark">Easy</option>
                <option value="medium" className="bg-panel-dark">Medium</option>
                <option value="hard" className="bg-panel-dark">Hard</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dark-soft" />
            </div>
          </section>

          {/* ---------- LANGUAGE & LEVEL ---------- */}
          <div className="grid grid-cols-5 gap-2">
            <section className="col-span-3 space-y-2">
              <SectionLabel><Languages size={11} className="-ml-4 mr-0.5 inline" />Language</SectionLabel>
              <div className="relative">
                <select
                  value={settings.language}
                  disabled={disabled}
                  onChange={e => updateSettings({ language: e.target.value })}
                  aria-label="Output language"
                  className="w-full appearance-none rounded-xl border border-white/12 bg-black/30 py-2.5 pl-3 pr-8 text-[12px] font-semibold text-text-dark outline-none focus:border-persimmon-dark/60 disabled:opacity-60"
                >
                  {SUPPORTED_LANGUAGES.map(language => <option key={language} value={language} className="bg-panel-dark">{language}</option>)}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dark-soft" />
              </div>
            </section>
            <section className="col-span-2 space-y-2">
              <SectionLabel><GraduationCap size={11} className="-ml-4 mr-0.5 inline" />Level</SectionLabel>
              <div className="relative">
                <select
                  value={settings.readingLevel}
                  disabled={disabled}
                  onChange={e => updateSettings({ readingLevel: e.target.value as AnalysisSettings['readingLevel'] })}
                  aria-label="Reading level"
                  className="w-full appearance-none rounded-xl border border-white/12 bg-black/30 py-2.5 pl-3 pr-8 text-[12px] font-semibold text-text-dark outline-none focus:border-persimmon-dark/60 disabled:opacity-60"
                >
                  <option value="plain" className="bg-panel-dark">Plain</option>
                  <option value="professional" className="bg-panel-dark">Pro</option>
                  <option value="academic" className="bg-panel-dark">Academic</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dark-soft" />
              </div>
            </section>
          </div>

          <button onClick={onResetSettings} disabled={disabled} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/12 py-2 text-[11px] font-bold uppercase tracking-wider text-text-dark-soft transition hover:border-white/25 hover:text-text-dark disabled:opacity-50">
            <RotateCcw size={12} /> Reset to defaults
          </button>

          {/* ---------- RECENT ANALYSES ---------- */}
          <section className="space-y-2.5 border-t border-white/10 pt-5">
            <div className="flex items-center justify-between px-1">
              <SectionLabel><History size={11} className="-ml-4 mr-0.5 inline" />This tab's analyses</SectionLabel>
              {history.length > 0 && (
                <button onClick={onClearHistory} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-text-dark-soft/70 transition hover:text-[#ffb3a0]"><Trash2 size={11} />Clear</button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/12 px-3 py-3 text-center text-[11px] font-medium text-text-dark-soft/70">Analyses from this tab will appear here and clear when you reload.</p>
            ) : (
              <ul className="space-y-1.5">
                {history.slice(0, 5).map(entry => (
                  <li key={entry.id}>
                    <button onClick={() => onPickHistory(entry)} title={`Re-analyze ${entry.fileName}`} className="group flex w-full items-center gap-2.5 rounded-xl border border-transparent px-2 py-2 text-left transition hover:border-white/10 hover:bg-white/5">
                      <FileText size={14} className="shrink-0 text-text-dark-soft/70 transition group-hover:text-gold-dark" />
                      <span className="min-w-0">
                        <span className="block truncate text-[11.5px] font-semibold text-text-dark/90">{entry.title}</span>
                        <span className="mt-0.5 block text-[9.5px] font-medium text-text-dark-soft/70">{entry.fileName} · {entry.words.toLocaleString()} words{entry.sentimentLabel ? ` · ${entry.sentimentLabel}` : ''}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* footer badge */}
        <div className="border-t border-white/10 px-5 py-3">
          <p className="flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-dark-soft/60"><Zap size={11} className="text-gold-dark" />Provider-flexible · evidence checked</p>
        </div>
      </aside>
    </>
  )
}
