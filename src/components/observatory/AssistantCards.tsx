import { Braces, Check, Clipboard, Lightbulb, TriangleAlert } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Markdown from 'react-markdown'
import type { Components } from 'react-markdown'
import { createLowlight } from 'lowlight'
import c from 'highlight.js/lib/languages/c'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import xml from 'highlight.js/lib/languages/xml'
import type { CodeReference, Diagnosis } from './contracts'

const highlighter = createLowlight({ c, java, javascript, python, sql, xml })
type HighlightNode = ReturnType<typeof highlighter.highlight>['children'][number]

function highlightNodes(nodes: HighlightNode[]): ReactNode {
  return nodes.map((node, index) => {
    if (node.type === 'text') return node.value
    if (node.type !== 'element') return null
    const classes = node.properties.className
    return <span className={Array.isArray(classes) ? classes.join(' ') : undefined} key={index}>{highlightNodes(node.children)}</span>
  })
}

function CodeBlock({ source, language, lineLabel }: { source: string; language: string; lineLabel?: string }) {
  const [copy, setCopy] = useState<'done' | 'failed'>()
  const formatted = useMemo(() => source.length <= 12_000 && highlighter.registered(language)
    ? highlightNodes(highlighter.highlight(language, source).children) : source, [language, source])
  return <div className="lvo-code">
    <div className="lvo-code-bar">
      <span>{language === 'text' ? '纯文本' : language.toUpperCase()}{lineLabel && ` · ${lineLabel}`}</span>
      <button type="button" className="lvo-text" aria-label="复制代码" onClick={async () => {
        try { await navigator.clipboard.writeText(source); setCopy('done') }
        catch { setCopy('failed') }
      }}>{copy === 'done' ? <Check size={15} aria-hidden /> : <Clipboard size={15} aria-hidden />}{copy === 'done' ? '已复制' : '复制'}</button>
    </div>
    <span className="lvo-sr-only" role="status">{copy === 'done' ? '代码已复制' : ''}</span>
    {copy === 'failed' && <p className="lvo-error" role="alert">复制失败，可选中代码手动复制。</p>}
    <pre tabIndex={0} aria-label="代码内容"><code>{formatted}</code></pre>
  </div>
}

const markdownComponents: Components = {
  pre({ node }) {
    const code = node?.children.find(child => child.type === 'element' && child.tagName === 'code')
    if (!code || code.type !== 'element') return null
    const names = code.properties.className
    const language = Array.isArray(names) ? names.map(String).find(name => name.startsWith('language-'))?.slice(9) : undefined
    const source = code.children.map(child => child.type === 'text' ? child.value : '').join('').replace(/\n$/, '')
    return <CodeBlock source={source} language={language || 'text'} />
  },
}

export function AssistantMarkdown({ text }: { text: string }) {
  return <div className="lvo-markdown"><Markdown skipHtml disallowedElements={['img']} components={markdownComponents}>{text}</Markdown></div>
}

export function CodeReferenceCard({ reference, onRemove }: { reference: CodeReference; onRemove?: () => void }) {
  const id = useId()
  const end = reference.start_line + reference.source.split('\n').length - 1
  return <section className="lvo-structured lvo-reference" aria-labelledby={id}>
    <header><span className="lvo-card-icon"><Braces size={16} aria-hidden /></span><h3 id={id}>代码片段引用</h3>
      {onRemove && <button type="button" className="lvo-text" onClick={onRemove}>移除</button>}</header>
    <CodeBlock source={reference.source} language={reference.language}
      lineLabel={end > reference.start_line ? `第 ${reference.start_line}–${end} 行` : `第 ${end} 行`} />
    {reference.truncated && <p className="lvo-card-note">已截取报错附近的代码。</p>}
  </section>
}

export function DiagnosisCard({ diagnosis }: { diagnosis: Diagnosis }) {
  const id = useId()
  const [revealed, setRevealed] = useState(0)
  const allVisible = revealed === diagnosis.hints.length
  return <section className="lvo-structured lvo-diagnosis" aria-labelledby={`${id}-title`}>
    <header><span className="lvo-card-icon"><TriangleAlert size={16} aria-hidden /></span><h3 id={`${id}-title`}>报错诊断</h3>
      {diagnosis.line !== undefined && <span className="lvo-line-tag">第 {diagnosis.line} 行{diagnosis.column ? ` · 第 ${diagnosis.column} 列` : ''}</span>}
    </header>
    <div className="lvo-diagnosis-body"><strong>{diagnosis.title}</strong><p>{diagnosis.explanation}</p></div>
    {diagnosis.hints.length > 0 && <div className="lvo-hints">
      <div id={`${id}-hints`} aria-live="polite">
        {revealed > 0 && <ol>{diagnosis.hints.slice(0, revealed).map((hint, index) => <li key={index}>{hint}</li>)}</ol>}
      </div>
      <button type="button" className="lvo-text" aria-controls={`${id}-hints`} onClick={() => setRevealed(value => allVisible ? 0 : value + 1)}>
        <Lightbulb size={16} aria-hidden /> {allVisible ? '收起提示' : `展开提示 ${revealed + 1}`}<span className="lvo-hint-count" aria-hidden>{revealed}/{diagnosis.hints.length}</span>
      </button>
    </div>}
  </section>
}
