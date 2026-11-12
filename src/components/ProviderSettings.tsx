import { useMemo, useState } from 'react'
import {
  ArrowDown, ArrowUp, CheckCircle2, ChevronDown, CircleHelp, Eye, EyeOff,
  ExternalLink, KeyRound, Loader2, RefreshCw, Search, ShieldCheck, TestTube2,
} from 'lucide-react'
import {
  PROVIDERS,
  providerDefinition,
  type ModelMetadata,
  type ProviderId,
  type ProviderMode,
  type ProviderStatus,
} from '../lib/aiProviders'

interface ProviderSettingsProps {
  mode: ProviderMode
  onModeChange: (mode: ProviderMode) => void
  activeProvider: ProviderId
  onActiveProviderChange: (provider: ProviderId) => void
  priority: ProviderId[]
  onPriorityChange: (priority: ProviderId[]) => void
  keys: Record<ProviderId, string>
  onKeyChange: (provider: ProviderId, key: string) => void
  models: Record<ProviderId, string>
  onModelChange: (provider: ProviderId, model: string) => void
  catalogs: Partial<Record<ProviderId, ModelMetadata[]>>
  statuses: Record<ProviderId, ProviderStatus>
  errors: Partial<Record<ProviderId, string>>
  consents: Record<ProviderId, boolean>
  onConsentChange: (provider: ProviderId, consent: boolean) => void
  onConnect: (provider: ProviderId, refresh?: boolean) => void
  onTest: (provider: ProviderId) => void
  disabled?: boolean
}
function compatibilityLabel(model: ModelMetadata | undefined) {
  if (!model) return { label: 'Manual model ID · unverified', className: 'text-gold-dark' }
  if (model.compatibility === 'verified') return { label: 'Text/chat suitable', className: 'text-emerald-400' }
  if (model.compatibility === 'incompatible') return { label: 'Not suitable for document analysis', className: 'text-[#ffb3a0]' }
  return { label: 'Capability unverified', className: 'text-gold-dark' }
}
export default function ProviderSettings(props: ProviderSettingsProps) {
  const {
    mode, onModeChange, activeProvider, onActiveProviderChange, priority, onPriorityChange,
    keys, onKeyChange, models, onModelChange, catalogs, statuses, errors, consents,
    onConsentChange, onConnect, onTest, disabled,
  } = props
  const [reveal, setReveal] = useState<Record<ProviderId, boolean>>({ groq: false, nvidia: false, deepseek: false, openai: false })
  const provider = providerDefinition(activeProvider)
  const catalog = useMemo(() => catalogs[activeProvider] ?? [], [activeProvider, catalogs])
  const selectable = catalog.filter(model => model.compatibility !== 'incompatible')
  const selected = catalog.find(model => model.id === models[activeProvider])
  const indicator = compatibilityLabel(selected)
  const listId = `models-${activeProvider}`
  const connectionLabel = statuses[activeProvider] === 'ready' ? 'Connected' : statuses[activeProvider] === 'validating' ? 'Checking' : statuses[activeProvider] === 'error' ? 'Needs attention' : 'Not checked'
  const modelSummary = useMemo(() => {
    if (catalog.length === 0) return 'No cached catalog. Validate the key or enter a model ID manually.'
    const verified = catalog.filter(model => model.compatibility === 'verified').length
    const unverified = catalog.filter(model => model.compatibility === 'unverified').length
    return `${verified} suitable · ${unverified} unverified · ${catalog.length - verified - unverified} filtered`
  }, [catalog])

  const moveProvider = (id: ProviderId, direction: -1 | 1) => {
    const index = priority.indexOf(id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= priority.length) return
    const next = [...priority]
    ;[next[index], next[target]] = [next[target], next[index]]
    onPriorityChange(next)
  }

  return (
    <section className="space-y-3" aria-label="AI provider configuration">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-text-dark-soft/80">AI providers</p>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${statuses[activeProvider] === 'ready' ? 'text-emerald-400' : statuses[activeProvider] === 'error' ? 'text-[#ffb3a0]' : 'text-text-dark-soft'}`}>{connectionLabel}</span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-white/10 bg-black/25 p-1.5" role="radiogroup" aria-label="Provider operation mode">
        {([['manual', 'Manual'], ['automatic', 'Automatic']] as const).map(([value, label]) => (
          <button key={value} type="button" role="radio" aria-checked={mode === value} disabled={disabled} onClick={() => onModeChange(value)} className={`rounded-xl px-2 py-2 text-[11.5px] font-bold transition ${mode === value ? 'bg-persimmon-dark text-[#2b1206]' : 'text-text-dark-soft hover:bg-white/5 hover:text-text-dark'}`}>{label}</button>
        ))}
      </div>
      <p className="px-1 text-[10.5px] font-medium leading-relaxed text-text-dark-soft/80">{mode === 'automatic' ? 'Retries temporary failures, then follows the consented provider order below.' : 'Uses only the provider and model you select.'}</p>

      <div className="relative">
        <select value={activeProvider} disabled={disabled} onChange={event => onActiveProviderChange(event.target.value as ProviderId)} aria-label="AI provider" className="w-full appearance-none rounded-xl border border-white/12 bg-black/30 px-3 py-2.5 pr-9 text-[12.5px] font-bold text-text-dark outline-none focus:border-persimmon-dark/60">
          {PROVIDERS.map(item => <option key={item.id} value={item.id} className="bg-panel-dark">{item.label}</option>)}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-dark-soft" />
      </div>

      <div className={`rounded-2xl border p-3.5 ${statuses[activeProvider] === 'ready' ? 'border-emerald-400/25 bg-emerald-400/[0.06]' : 'border-gold-dark/30 bg-gold-dark/[0.06]'}`}>
        <label htmlFor={`${activeProvider}-key`} className="flex items-center justify-between gap-2 text-xs font-bold text-text-dark">
          <span className="inline-flex items-center gap-1.5"><KeyRound size={13} className="text-gold-dark" />{provider.shortLabel} API key</span>
          {statuses[activeProvider] === 'ready' ? <CheckCircle2 size={14} className="text-emerald-400" /> : statuses[activeProvider] === 'validating' ? <Loader2 size={14} className="animate-spin text-gold-dark" /> : null}
        </label>
        <div className="relative mt-2">
          <input id={`${activeProvider}-key`} type={reveal[activeProvider] ? 'text' : 'password'} value={keys[activeProvider]} disabled={disabled} onChange={event => onKeyChange(activeProvider, event.target.value)} onBlur={() => { if (keys[activeProvider].trim() && consents[activeProvider] && statuses[activeProvider] === 'idle') onConnect(activeProvider) }} placeholder={provider.keyPlaceholder} autoComplete="new-password" spellCheck={false} className="w-full rounded-xl border border-white/12 bg-black/30 py-2.5 pl-3 pr-11 font-mono text-[12px] text-text-dark placeholder:text-text-dark-soft/40 outline-none focus:border-gold-dark/60" />
          <button type="button" onClick={() => setReveal(value => ({ ...value, [activeProvider]: !value[activeProvider] }))} aria-label={reveal[activeProvider] ? 'Hide key' : 'Show key'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-text-dark-soft hover:bg-white/10 hover:text-text-dark">{reveal[activeProvider] ? <EyeOff size={15} /> : <Eye size={15} />}</button>
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <p className="text-[10px] font-medium text-text-dark-soft">Memory-only · cleared on reload</p>
          <a href={provider.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10.5px] font-bold text-gold-dark hover:underline">Get key<ExternalLink size={10} /></a>
        </div>
        <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl border border-white/10 bg-black/15 p-2.5 text-[10.5px] font-semibold leading-relaxed text-text-dark-soft">
          <input type="checkbox" checked={consents[activeProvider]} disabled={disabled} onChange={event => onConsentChange(activeProvider, event.target.checked)} className="mt-0.5 accent-[#ff8a5c]" />
          <span><strong className="text-text-dark">Allow API usage and document sharing.</strong> Model checks and analysis send requests to this provider and may consume quota or incur charges.</span>
        </label>
        {errors[activeProvider] ? <p role="alert" className="mt-2 text-[10.5px] font-semibold leading-relaxed text-[#ffb3a0]">{errors[activeProvider]}</p> : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={`${activeProvider}-model`} className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-text-dark-soft">Model</label>
          <button type="button" disabled={disabled || statuses[activeProvider] === 'validating' || !keys[activeProvider].trim() || !consents[activeProvider]} onClick={() => onConnect(activeProvider, true)} className="inline-flex items-center gap-1 text-[10px] font-bold text-gold-dark disabled:opacity-40"><RefreshCw size={11} />Refresh models</button>
        </div>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-persimmon-dark" />
          <input id={`${activeProvider}-model`} list={listId} value={models[activeProvider]} disabled={disabled} onChange={event => onModelChange(activeProvider, event.target.value)} placeholder="Search or enter a model ID" className="w-full rounded-xl border border-white/12 bg-black/30 py-2.5 pl-9 pr-3 text-[12px] font-semibold text-text-dark outline-none focus:border-persimmon-dark/60" />
          <datalist id={listId}>{selectable.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}</datalist>
        </div>
        <div className="flex items-start justify-between gap-2 px-1">
          <div>
            <p className={`text-[10.5px] font-bold ${indicator.className}`}>{indicator.label}</p>
            <p className="mt-0.5 text-[9.5px] leading-relaxed text-text-dark-soft/75">{selected?.contextWindow ? `${selected.contextWindow.toLocaleString()} context` : 'Context limit not reported'}{selected?.maxOutputTokens ? ` · ${selected.maxOutputTokens.toLocaleString()} max output` : ''}</p>
          </div>
          <button type="button" disabled={disabled || !keys[activeProvider].trim() || !models[activeProvider].trim() || !consents[activeProvider]} onClick={() => onTest(activeProvider)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/12 px-2 py-1 text-[9.5px] font-bold text-text-dark-soft hover:text-text-dark disabled:opacity-40"><TestTube2 size={11} />Test</button>
        </div>
        <p className="px-1 text-[9.5px] leading-relaxed text-text-dark-soft/70">{modelSummary}</p>
      </div>

      {mode === 'automatic' ? (
        <div className="space-y-2 border-t border-white/10 pt-3">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-text-dark-soft"><ShieldCheck size={12} />Fallback priority</div>
          <ol className="space-y-1.5">
            {priority.map((id, index) => {
              const ready = Boolean(keys[id].trim() && models[id].trim() && consents[id])
              return <li key={id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-2.5 py-2">
                <span className="w-4 font-mono text-[10px] text-text-dark-soft">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-text-dark">{providerDefinition(id).shortLabel}</span>
                <span className={`text-[9px] font-bold uppercase ${ready ? 'text-emerald-400' : 'text-text-dark-soft/60'}`}>{ready ? 'Ready' : 'Skipped'}</span>
                <button type="button" disabled={index === 0 || disabled} onClick={() => moveProvider(id, -1)} aria-label={`Move ${id} up`} className="p-1 text-text-dark-soft disabled:opacity-25"><ArrowUp size={11} /></button>
                <button type="button" disabled={index === priority.length - 1 || disabled} onClick={() => moveProvider(id, 1)} aria-label={`Move ${id} down`} className="p-1 text-text-dark-soft disabled:opacity-25"><ArrowDown size={11} /></button>
              </li>
            })}
          </ol>
          <p className="flex items-start gap-1.5 text-[9.5px] leading-relaxed text-text-dark-soft/70"><CircleHelp size={11} className="mt-0.5 shrink-0" />Only providers with a key, model, and explicit usage consent participate.</p>
        </div>
      ) : null}
    </section>
  )
}

