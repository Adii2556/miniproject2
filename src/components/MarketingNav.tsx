import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, Moon, Sun, ArrowRight, X } from 'lucide-react'
import DocentLogo from './DocentLogo'
import { useTheme } from '../lib/useTheme'

const LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'How it works', href: '/#how' },
  { label: 'Docs', href: '/docs' },
]

export default function MarketingNav() {
  const { theme, toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const go = (href: string) => {
    setOpen(false)
    if (href.startsWith('/#')) {
      const id = href.slice(2)
      if (location.pathname !== '/') {
        navigate('/', { state: { scrollTo: id } })
      } else {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    } else {
      navigate(href)
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[#175e541f] bg-paper/85 backdrop-blur-xl dark:border-white/10 dark:bg-moss-night-deep/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label="Docent home">
          <DocentLogo size={36} />
          <span className="font-display text-[1.45rem] font-bold tracking-tight text-ink dark:text-text-dark">Docent</span>
          <span className="mt-1 hidden rounded-full border border-persimmon/40 bg-persimmon-mist px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-widest text-persimmon dark:border-persimmon-dark/40 dark:bg-persimmon-dark/10 dark:text-persimmon-dark sm:inline-block">Groq-powered</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {LINKS.map(l => (
            <button key={l.label} onClick={() => go(l.href)} className="rounded-lg px-3.5 py-2 font-sans text-sm font-semibold text-ink-soft transition hover:bg-moss-mist hover:text-moss-deep dark:text-text-dark-soft dark:hover:bg-white/5 dark:hover:text-text-dark">
              {l.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <button onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} className="rounded-xl p-2.5 text-ink-soft transition hover:bg-moss-mist hover:text-moss-deep dark:text-text-dark-soft dark:hover:bg-white/5 dark:hover:text-text-dark">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link to="/app" className="hidden items-center gap-1.5 rounded-xl bg-moss px-4 py-2.5 font-sans text-sm font-bold text-cream shadow-[0_2px_0_#0e4740] transition hover:bg-moss-deep sm:inline-flex dark:bg-persimmon-dark dark:text-[#2b1206] dark:shadow-[0_2px_0_#b4532a] dark:hover:bg-persimmon">
            Open Studio <ArrowRight size={15} strokeWidth={2.5} />
          </Link>
          <button className="rounded-xl p-2.5 text-ink-soft md:hidden dark:text-text-dark-soft" onClick={() => setOpen(v => !v)} aria-label="Toggle menu" aria-expanded={open}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[#175e541f] bg-paper px-4 pb-5 pt-2 dark:border-white/10 dark:bg-moss-night-deep md:hidden">
          {LINKS.map(l => (
            <button key={l.label} onClick={() => go(l.href)} className="block w-full rounded-xl px-4 py-3 text-left font-sans text-base font-semibold text-ink hover:bg-moss-mist dark:text-text-dark dark:hover:bg-white/5">
              {l.label}
            </button>
          ))}
          <Link to="/app" onClick={() => setOpen(false)} className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-moss px-4 py-3 font-sans font-bold text-cream dark:bg-persimmon-dark dark:text-[#2b1206]">
            Open Studio <ArrowRight size={16} />
          </Link>
        </div>
      )}
    </header>
  )
}
