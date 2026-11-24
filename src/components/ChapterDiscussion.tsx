import { ArrowLeft, ArrowRight, CornerDownRight, MessageCircle, RefreshCw, Send } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useStudentProfile } from '../state/studentProfile'
import './chapter-discussion.css'

type Post = { id: number; name: string; body: string; created: string }
type ReplyPage = { replies: Post[]; olderRepliesBefore: number | null }
type Thread = Post & ReplyPage
type Listing = { threads: Thread[]; nextBefore: number | null }
type Draft = { name: string; body: string; id: string }

function submissionId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')
}

function readDraft(key: string): Draft {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null')
    if (typeof saved?.body === 'string' && typeof saved.name === 'string' && /^[a-f0-9]{32}$/.test(saved.id)) return saved
  } catch { /* Private browsing can disable storage. */ }
  return { name: '', body: '', id: submissionId() }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, signal: options?.signal ?? AbortSignal.timeout(12_000) })
  if (response.headers.get('Content-Type')?.includes('application/json')) {
    const value = await response.json()
    if (response.ok) return value as T
    if (typeof value?.error === 'string') throw new Error(value.error)
  }
  throw new Error('本站暂时无法连接讨论服务。')
}

function readableError(error: unknown) {
  return error instanceof Error && !(error instanceof TypeError) && !(error instanceof DOMException)
    ? error.message : '讨论服务连接中断，请重试。'
}

function Composer({ url, parent, onSent }: { url: string; parent: number | null; onSent: () => void }) {
  const { nickname } = useStudentProfile()
  const storageKey = 'learnverse.discussion.draft.' + url + '/' + (parent ?? 'new')
  const [draft, setDraft] = useState(() => readDraft(storageKey))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [storageUnavailable, setStorageUnavailable] = useState(false)
  const sending = useRef(false)

  function update(next: Draft) {
    setDraft(next)
    try {
      if (next.body || next.name) sessionStorage.setItem(storageKey, JSON.stringify(next))
      else sessionStorage.removeItem(storageKey)
      setStorageUnavailable(false)
    } catch { setStorageUnavailable(true) }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (sending.current || !draft.body.trim()) return
    sending.current = true
    setBusy(true)
    setError('')
    try {
      await request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, parent }) })
      update({ ...draft, body: '', id: submissionId() })
      onSent()
    } catch (reason) {
      setError(readableError(reason) + ' 输入内容仍保留在这里。')
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  return <form className="discussion-composer" onSubmit={submit}>
    <label className="discussion-body-label">
      {parent === null ? '发起讨论' : '写回复'}
      <textarea maxLength={1500} rows={parent === null ? 3 : 2} required value={draft.body} disabled={busy}
        placeholder={parent === null ? '分享你的想法、发现，或还没想通的地方……' : '接着聊聊你的想法……'}
        onChange={event => update({ ...draft, body: event.target.value, id: submissionId() })} />
    </label>
    <div className="discussion-compose-actions">
      <div className="discussion-author-field">
        <label className="discussion-name">公开署名
          <input maxLength={24} placeholder="访客（可选）" autoComplete="off" value={draft.name} disabled={busy}
            onChange={event => update({ ...draft, name: event.target.value, id: submissionId() })} />
        </label>
        {nickname && nickname !== draft.name && <button type="button" className="discussion-text-button" disabled={busy}
          onClick={() => update({ ...draft, name: nickname, id: submissionId() })}>用学员昵称</button>}
      </div>
      <button className="workspace-button workspace-primary" type="submit" disabled={busy || !draft.body.trim()}>
        <Send size={15} aria-hidden="true" />{busy ? '正在发布…' : parent === null ? '发布讨论' : '发布回复'}
      </button>
    </div>
    {storageUnavailable && <p role="status">此浏览器只能在当前页面保留草稿。</p>}
    {error && <p className="discussion-error" role="alert">{error}</p>}
  </form>
}

const shortDate = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })

function PostContent({ post }: { post: Post }) {
  return <>
    <div className="discussion-byline"><strong>{post.name}</strong><time dateTime={post.created}>{shortDate.format(new Date(post.created))}</time></div>
    <p className="discussion-post-body">{post.body}</p>
  </>
}

function Replies({ thread, url }: { thread: Thread; url: string }) {
  const [history, setHistory] = useState<ReplyPage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const page = history.at(-1) ?? thread
  async function earlier() {
    setLoading(true)
    setError('')
    try {
      const result = await request<ReplyPage>(url + '?thread=' + thread.id + '&before=' + page.olderRepliesBefore)
      setHistory(previous => [...previous, result])
    } catch (reason) { setError(readableError(reason)) }
    finally { setLoading(false) }
  }
  if (page.replies.length === 0) return null
  return <div className="discussion-reply-group">
    {(page.olderRepliesBefore || history.length > 0) && <div className="discussion-reply-pages">
      {page.olderRepliesBefore && <button type="button" className="discussion-text-button" disabled={loading} onClick={() => void earlier()}><ArrowLeft size={14} />更早回复</button>}
      {history.length > 0 && <button type="button" className="discussion-text-button" disabled={loading} onClick={() => { setError(''); setHistory(previous => previous.slice(0, -1)) }}>较新回复<ArrowRight size={14} /></button>}
      {loading && <span role="status">读取中…</span>}
      {error && <span role="alert">{error}</span>}
    </div>}
    <ol className="discussion-replies" aria-label={thread.name + ' 发起的讨论的回复'}>
      {page.replies.map(reply => <li key={reply.id}><PostContent post={reply} /></li>)}
    </ol>
  </div>
}

export function ChapterDiscussion({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const url = '/api/discussions/' + encodeURIComponent(courseId) + '/' + encodeURIComponent(lessonId)
  const [pages, setPages] = useState<number[]>([])
  const before = pages.at(-1)
  const [listing, setListing] = useState<Listing | null>(null)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  const [replying, setReplying] = useState<number | null>(null)
  const inFlight = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    try {
      const data = await request<Listing>(url + (before ? '?before=' + before : ''), {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]),
      })
      if (controller.signal.aborted) return
      setListing(data)
      setLoadError('')
    } catch (error) {
      if (!controller.signal.aborted) setLoadError(readableError(error))
    }
  }, [url, before])

  useEffect(() => {
    void refresh()
    const onVisible = () => { if (!document.hidden) void refresh() }
    const timer = window.setInterval(onVisible, 20_000)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      inFlight.current?.abort()
    }
  }, [refresh])

  function changePage(next: number[]) {
    inFlight.current?.abort()
    setPages(next)
    setReplying(null)
    setListing(null)
    setLoadError('')
  }

  function sent(reply: boolean) {
    setNotice(reply ? '回复已发布。' : '讨论已发布。')
    if (reply) setReplying(null)
    if (!reply && pages.length) changePage([])
    else void refresh()
  }

  return <section id="chapter-discussion" className="chapter-discussion" aria-labelledby="chapter-discussion-heading">
    <header className="discussion-heading">
      <h2 id="chapter-discussion-heading"><MessageCircle size={23} aria-hidden="true" />本章讨论</h2>
      <button className="discussion-text-button" type="button" onClick={() => void refresh()}><RefreshCw size={14} aria-hidden="true" />刷新讨论</button>
    </header>
    <p className="discussion-intro">发布后，访问本章的同学都能看到你的署名和内容。</p>
    <Composer url={url} parent={null} onSent={() => sent(false)} />
    <div className="discussion-notice" role="status">{notice}</div>
    {loadError && <p className="discussion-error" role="status">{loadError} 可点击「刷新讨论」重试。</p>}
    {!listing && !loadError && <p className="discussion-empty" role="status">正在读取讨论…</p>}
    {!loadError && listing?.threads.length === 0 && <p className="discussion-empty">本章还没有讨论。</p>}
    {listing && listing.threads.length > 0 && <ol className="discussion-threads" aria-label="本章话题">
      {listing.threads.map(thread => <li key={thread.id}>
        <PostContent post={thread} />
        <Replies url={url} thread={thread} />
        <button className="discussion-text-button" type="button" aria-expanded={replying === thread.id}
          onClick={() => { setNotice(''); setReplying(replying === thread.id ? null : thread.id) }}>
          <CornerDownRight size={15} aria-hidden="true" />{replying === thread.id ? '收起回复框' : '回复'}
        </button>
        {replying === thread.id && <Composer url={url} parent={thread.id} onSent={() => sent(true)} />}
      </li>)}
    </ol>}
    {(pages.length > 0 || listing?.nextBefore) && <nav className="discussion-pagination" aria-label="讨论分页">
      {pages.length > 0 && <button className="discussion-text-button" onClick={() => changePage(pages.slice(0, -1))}><ArrowLeft size={14} />较新讨论</button>}
      {listing?.nextBefore && <button className="discussion-text-button" onClick={() => changePage([...pages, listing.nextBefore!])}>更早讨论<ArrowRight size={14} /></button>}
    </nav>}
  </section>
}
