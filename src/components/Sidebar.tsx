import { useEffect, useRef, useState } from 'react'
import {
  Eye, EyeOff, ChevronDown, KeyRound, ExternalLink, Cpu, Flame, Rows3, AlignLeft,
  Languages, GraduationCap, RotateCcw, History, Trash2, FileText, X, CheckCircle2, Zap,
} from 'lucide-react'
import { GROQ_MODELS, type AnalysisSettings } from '../lib/groq'
import DocLenseLogo from './DocLenseLogo'
import type { HistoryEntry } from '../lib/history'

interface SidebarProps {
  open: boolean
  onClose: () => void
  apiKey: string
  setApiKey: (v: string) => void
  saveKey: boolean
  setSaveKey: (v: boolean) => void
  revealKey: boolean
  setRevealKey: (v: boolean) => void
  keyFromEnv: boolean
  settings: AnalysisSettings
  updateSettings: (patch: Partial<AnalysisSettings>) => void
  onResetSettings: () => void
  history: HistoryEntry[]
  onClearHistory: () => void
  onPickHistory: (entry: HistoryEntry) => void
  disabled?: boolean
}

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Dutch', 'Hindi', 'Chinese (Simplified)', 'Japanese', 'Korean', 'Arabic']

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 px-1 text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-text-dark-soft/80">
      <span className="h-px w-3 bg-current opacity-50" />{children}
    </p>
  )
}

export default function Sidebar(props: SidebarProps) {
  const {
    open, onClose, apiKey, setApiKey, saveKey, setSaveKey, revealKey, setRevealKey, keyFromEnv,
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

  const keyChip = keyFromEnv
    ? { text: 'Loaded from environment', tone: 'gold' }
    : apiKey.trim()
      ? { text: 'Key saved locally', tone: 'green' }
      : { text: 'Key required to generate', tone: 'red' }

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

          {/* ---------- API KEY ---------- */}
          <section className="space-y-3">
            <SectionLabel>Groq API Key</SectionLabel>
            <div className={`rounded-2xl border p-3.5 transition ${apiKey.trim() || keyFromEnv ? 'border-emerald-400/25 bg-emerald-400/[0.06]' : 'border-gold-dark/30 bg-gold-dark/[0.06]'}`}>
              <label htmlFor="groq-key" className="flex items-center justify-between gap-2 text-xs font-bold text-text-dark">
                <span className="inline-flex items-center gap-1.5"><KeyRound size={13} className="text-gold-dark" />{keyFromEnv ? 'Environment key active' : 'Your Groq key'}</span>
                <span className="inline-flex items-center gap-1 font-sans text-[10px] font-bold uppercase tracking-wide">
                  {keyChip.tone === 'green' && <><CheckCircle2 size={11} className="text-emerald-400" /><span className="text-emerald-400">Saved</span></>}
                  {keyChip.tone === 'gold' && <span className="text-gold-dark">env</span>}
                  {keyChip.tone === 'red' && <span className="text-[#ffb3a0]">Required</span>}
                </span>
              </label>
              <div className="relative mt-2">
                <input
                  id="groq-key"
                  type={revealKey ? 'text' : 'password'}
                  value={apiKey}
                  disabled={disabled}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={keyFromEnv ? 'Using VITE_GROQ_API_KEY' : 'gsk_paste_your_key_here'}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-xl border border-white/12 bg-black/30 py-2.5 pl-3 pr-11 font-mono text-[12px] text-text-dark placeholder-text-dark-soft/40 outline-none transition focus:border-gold-dark/60 focus:ring-2 focus:ring-gold-dark/20 disabled:opacity-60"
                />
                <button type="button" onClick={() => setRevealKey(!revealKey)} aria-label={revealKey ? 'Hide key' : 'Show key'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-text-dark-soft transition hover:bg-white/10 hover:text-text-dark">
                  {revealKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-text-dark-soft">
                  <button
                    role="switch"
                    aria-checked={saveKey}
                    aria-label="Remember API key on this device"
                    onClick={() => setSaveKey(!saveKey)}
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${saveKey ? 'bg-emerald-500' : 'bg-white/15'}`}
                  >
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${saveKey ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                  Remember on this device
                </div>
                <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold text-gold-dark underline-offset-2 transition hover:text-gold hover:underline">Get a free key<ExternalLink size={10} /></a>
              </div>
            </div>
          </section>

          {/* ---------- MODEL ---------- */}
          <section className="space-y-2.5">
            <SectionLabel>Model</SectionLabel>
            <div className="relative">
              <Cpu size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-persimmon-dark" />
              <select
                value={settings.model}
                disabled={disabled}
                onChange={e => updateSettings({ model: e.target.value })}
                aria-label="Groq model"
                className="w-full appearance-none rounded-xl border border-white/12 bg-black/30 py-2.5 pl-10 pr-9 text-[13px] font-semibold text-text-dark outline-none transition focus:border-persimmon-dark/60 focus:ring-2 focus:ring-persimmon-dark/20 disabled:opacity-60"
              >
                {GROQ_MODELS.map(m => <option key={m.id} value={m.id} className="bg-panel-dark text-text-dark">{m.label}</option>)}
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-dark-soft" />
            </div>
            <p className="px-1 text-[10.5px] font-medium text-text-dark-soft/80">{GROQ_MODELS.find(m => m.id === settings.model)?.note}</p>
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
                  {LANGUAGES.map(l => <option key={l} value={l} className="bg-panel-dark">{l}</option>)}
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
              <SectionLabel><History size={11} className="-ml-4 mr-0.5 inline" />Recent analyses</SectionLabel>
              {history.length > 0 && (
                <button onClick={onClearHistory} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-text-dark-soft/70 transition hover:text-[#ffb3a0]"><Trash2 size={11} />Clear</button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/12 px-3 py-3 text-center text-[11px] font-medium text-text-dark-soft/70">Your last analyses will appear here.</p>
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
          <p className="flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-dark-soft/60"><Zap size={11} className="text-gold-dark" />Powered by Groq · open-weight models</p>
        </div>
      </aside>
    </>
  )
}
