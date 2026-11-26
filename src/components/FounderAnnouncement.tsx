import { ArrowUpRight, ChevronDown, ChevronUp, HeartHandshake, Megaphone, MessageCircle, Sparkles, Star, X } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { containTab, useStationDialog, useVisibleViewport } from './observatory/dialog'
import { useOptionalStation } from './observatory/StationProvider'
import './founder-announcement.css'

const COLLAPSE_STORAGE_KEY = 'learnverse.founder-notice.collapsed.v1'
export const FOUNDER_GITHUB_REPO_URL = 'https://github.com/djs11eee-png/LEARNVERSE'

function readCollapsedState(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeCollapsedState(collapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? '1' : '0')
  } catch {
    // Ignore restricted storage environments.
  }
}

function scrollToStarBanner() {
  const banner = document.getElementById('seoul-guardian')
  if (!banner) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  banner.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
  const cta = banner.querySelector<HTMLButtonElement>('.sg-star-cta')
  if (cta) {
    window.setTimeout(() => cta.focus({ preventScroll: true }), reduced ? 0 : 420)
  }
}

function FounderLetterContent({
  onTryVesper,
  onGoStar,
}: {
  onTryVesper: (event: MouseEvent<HTMLButtonElement>) => void
  onGoStar: () => void
}) {
  return (
    <>
      <div className="fn-letter-body">
        <p>
          哇哇哇！恭喜进入这个网站的同学，这是一个<strong>完全公益的网站</strong>！里面内置
          <strong>vesper助手</strong>，如果你有不懂的代码问题，可以直接结合课程卡住的代码一起打包交给她！
          <span className="fn-os-pill">（OS：token烧的是我的真金白银！！！）</span>
        </p>
        <p>
          由于本人只是一个大一生，如果网站有bug和不足的地方请多多包含！大佬们轻喷！
        </p>
        <p>
          唉，为了开发这个网站我是折腾很久，投入的精力和金钱都是实打实的！从第一次选服务器，搭建框架，部署到服务器，最后到正式上线！每天熬夜到两三点是常态，因为特别想早点上线，由于大学的课程耽误，有的时候直接中午不吃饭啦，赶回寝室直接开搞！
        </p>
        <p className="fn-plea">
          <Sparkles size={15} aria-hidden />
          <span>最后的最后跪求star！！！</span>
        </p>
      </div>

      <div className="fn-actions">
        <button type="button" className="fn-btn-star" onClick={onGoStar}>
          <Star size={16} aria-hidden />
          <span>一键点亮 Star 支持站长</span>
        </button>
        <button type="button" className="fn-btn-vesper" onClick={onTryVesper}>
          <MessageCircle size={16} aria-hidden />
          <span>体验 Vesper 助手</span>
        </button>
        <a
          className="fn-btn-repo"
          href={FOUNDER_GITHUB_REPO_URL}
          target="_blank"
          rel="noreferrer"
        >
          <span>GitHub 仓库</span>
          <ArrowUpRight size={15} aria-hidden />
        </a>
      </div>
    </>
  )
}

export function FounderAnnouncementPill({
  onOpen,
}: {
  onOpen: (opener: HTMLElement) => void
}) {
  return (
    <button
      type="button"
      className="fn-hero-pill"
      onClick={(event) => onOpen(event.currentTarget)}
    >
      <span className="fn-pill-dot" aria-hidden="true" />
      <span className="fn-pill-tag">首页公告</span>
      <span className="fn-pill-text">站长想说的话 · 公益建站与跪求 Star</span>
      <ArrowUpRight size={14} className="fn-pill-arrow" aria-hidden />
    </button>
  )
}

export function FounderAnnouncementDialog({
  opener,
  onClose,
}: {
  opener: HTMLElement | null
  onClose: () => void
}) {
  const station = useOptionalStation()
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const id = useId()
  const viewport = useVisibleViewport()
  useStationDialog(dialog, heading, opener)

  return (
    <dialog
      ref={dialog}
      style={viewport}
      className="fn-dialog"
      aria-labelledby={`${id}-title`}
      onKeyDown={containTab}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="fn-dialog-sheet">
        <header className="fn-dialog-head">
          <div className="fn-eyebrow">
            <span className="fn-eyebrow-lead">
              <span className="fn-beacon" aria-hidden="true" />
              <span lang="en">OBSERVATORY NOTICE</span>
            </span>
            <span className="fn-chip">
              <HeartHandshake size={12} aria-hidden />
              完全公益
            </span>
          </div>
          <button
            type="button"
            className="fn-close-btn"
            aria-label="关闭站长公告"
            onClick={onClose}
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <h2 id={`${id}-title`} ref={heading} tabIndex={-1} className="fn-dialog-title">
          <Megaphone size={20} aria-hidden />
          <span>站长想说的话</span>
        </h2>

        <FounderLetterContent
          onTryVesper={() => {
            onClose()
            window.setTimeout(() => {
              station?.openAssistant(opener)
            }, 0)
          }}
          onGoStar={() => {
            onClose()
            window.setTimeout(scrollToStarBanner, 40)
          }}
        />
      </div>
    </dialog>
  )
}

export function FounderAnnouncement() {
  const station = useOptionalStation()
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsedState)

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      writeCollapsedState(next)
      return next
    })
  }

  return (
    <section
      className={collapsed ? 'fn-card is-collapsed' : 'fn-card'}
      id="founder-announcement"
      aria-labelledby="founder-announcement-title"
    >
      <div className="fn-card-glow" aria-hidden="true" />

      <div className="fn-card-header">
        <div className="fn-header-left">
          <div className="fn-eyebrow">
            <span className="fn-eyebrow-lead">
              <span className="fn-beacon" aria-hidden="true" />
              <span>首页公告</span>
            </span>
            <span className="fn-chip">
              <HeartHandshake size={12} aria-hidden />
              完全公益
            </span>
            <span className="fn-chip is-freshman">大一站长手写</span>
          </div>
          <h2 id="founder-announcement-title" className="fn-title">
            <Megaphone size={20} aria-hidden />
            <span>站长想说的话</span>
          </h2>
        </div>

        <button
          type="button"
          className="fn-toggle-btn"
          aria-expanded={!collapsed}
          onClick={toggleCollapsed}
        >
          {collapsed ? (
            <>
              <span>展开公告</span>
              <ChevronDown size={15} aria-hidden />
            </>
          ) : (
            <>
              <span>收起</span>
              <ChevronUp size={15} aria-hidden />
            </>
          )}
        </button>
      </div>

      {collapsed ? (
        <p className="fn-collapsed-preview">
          完全公益的编程与 AI 学习站，内置 Vesper 助手陪你解 Bug —— 大一站长熬夜打磨，最后的最后跪求 Star！！！
        </p>
      ) : (
        <FounderLetterContent
          onTryVesper={(event) => station?.openAssistant(event.currentTarget)}
          onGoStar={scrollToStarBanner}
        />
      )}
    </section>
  )
}
