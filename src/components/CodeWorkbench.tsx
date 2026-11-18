import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Check, Code2, Copy, Play, RotateCcw, Square, Terminal } from 'lucide-react';
import { checkNativeRunner, isNativeLanguage, runWithNativeSupport } from '../code/localRunner';
import type { Diagnostic, RunLanguage, RunResult } from '../code/runner';
import './code-workbench.css';

interface CodeWorkbenchProps {
  language: RunLanguage;
  starter: string;
  stdin?: string;
  draftKey?: string;
  title?: string;
  expectedOutput?: string;
}

interface Draft {
  code: string;
  input: string;
}

type Execution = { kind: 'idle' | 'running' | 'stopped' } | {
  kind: 'finished';
  draft: Draft;
  result: RunResult;
};

const languageLabels: Record<RunLanguage, string> = {
  python: 'Python', javascript: 'JavaScript', sql: 'SQL', html: 'HTML', c: 'C', java: 'Java', text: '纯文本',
};

function readDraft(storageKey: string | undefined, fallback: Draft): Draft {
  if (storageKey) {
    try {
      const saved: Partial<Draft> | null = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
      if (typeof saved?.code === 'string' && typeof saved.input === 'string') {
        return { code: saved.code, input: saved.input };
      }
    } catch {
      // Drafts still work for the current visit when storage is unavailable.
    }
  }
  return fallback;
}

function normalizeOutput(value: string) {
  return value.replace(/\r\n/g, '\n').trim();
}

function diagnosticHint(message: string) {
  if (/NameError|ReferenceError|cannot find symbol|undeclared/i.test(message)) return '程序找不到这个名字。检查拼写、大小写，以及前面有没有定义它。';
  if (/IndentationError|TabError/i.test(message)) return '检查每行开头的空格，同一块代码要对齐。冒号后的新代码块需要缩进。';
  if (/SyntaxError|unexpected token|expected .+ before/i.test(message)) return '检查报告的这一行和上一行，看看引号、括号或分隔符是否配对。';
  if (/EOFError|输入已用完/i.test(message)) return '程序还在读输入。运行前在「标准输入」框补上它需要的行。';
  if (/ValueError.*invalid literal for int/i.test(message)) return 'int() 需要整数形式的文字，例如 25。先检查输入是不是空白、小数或其他文字。';
  if (/ZeroDivisionError|division by zero/i.test(message)) return '除数是 0。先检查来自哪里，再决定怎么处理这一种输入。';
  if (/TypeError/i.test(message)) return '当前操作碰到了不合适的值。先检查它是数字、文字，还是其他类型。';
  if (/unused variable|never used/i.test(message)) return '这个变量定义了却没有使用。检查是不是写错了名字，或者这行其实可以省略。';
  return '';
}

function DiagnosticList({ items, heading, stale, onJump }: {
  items: Diagnostic[];
  heading: string;
  stale: boolean;
  onJump: (line: number, column?: number) => void;
}) {
  if (!items.length) return null;
  const severity = items[0].severity;
  const hasJump = !stale && items.some(({ line }) => line !== undefined);
  return (
    <div className="code-workbench-diagnostics" data-severity={severity}>
      <p><strong>{heading}</strong></p>
      {severity === 'warning' && <p className="code-workbench-diagnostic-hint">有警告时仍可能看到输出或预览。</p>}
      {hasJump && <p className="code-workbench-diagnostic-hint">点击行号可以跳到源代码。</p>}
      <ul>
        {items.map(({ message, line, column }, index) => {
          const location = line === undefined ? '' : `第 ${line} 行${column === undefined ? '' : `，第 ${column} 列`}`;
          const hint = diagnosticHint(message);
          return (
            <li key={index}>
              {line !== undefined && (stale
                ? <span className="code-workbench-location">{location}</span>
                : <button className="code-workbench-location" type="button" onClick={() => onJump(line, column)}>{location}</button>)}
              <span className="code-workbench-diagnostic-message">{message}</span>
              {hint && <small className="code-workbench-diagnostic-hint">{hint}</small>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function WorkbenchSession({ language, starter, stdin, draftKey, title = '代码编辑器', expectedOutput }: CodeWorkbenchProps) {
  const id = useId();
  const storageKey = draftKey ? `learnverse:code-draft:${language}:${draftKey}` : undefined;
  const initialDraft = { code: starter, input: stdin ?? '' };
  const [draft, setDraft] = useState(() => readDraft(storageKey, initialDraft));
  const [execution, setExecution] = useState<Execution>({ kind: 'idle' });
  const [copyStatus, setCopyStatus] = useState<'copied' | 'unavailable'>();
  const [nativeStatus, setNativeStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const source = useRef<HTMLTextAreaElement>(null);
  const lineNumbers = useRef<HTMLDivElement>(null);
  const activeRun = useRef<AbortController | null>(null);

  const native = isNativeLanguage(language);
  const needsInput = native || (language === 'python' && (stdin !== undefined || draft.input !== '' || /\binput\s*\(/.test(draft.code)));
  const canRun = language !== 'text' && (!native || nativeStatus === 'available');
  const running = execution.kind === 'running';
  const result = execution.kind === 'finished' ? execution.result : undefined;
  const stale = execution.kind === 'finished' && (execution.draft.code !== draft.code || execution.draft.input !== draft.input);
  const errors = result?.diagnostics.filter(({ severity }) => severity === 'error') ?? [];
  const warnings = result?.diagnostics.filter(({ severity }) => severity === 'warning') ?? [];
  const lines = draft.code.split(/\r\n?|\n/);
  const affectedLines = new Map<number, Diagnostic['severity']>();
  if (!stale) {
    for (const { line, severity } of [...warnings, ...errors]) {
      if (line !== undefined) affectedLines.set(line, severity);
    }
  }
  const comparable = result && !errors.length && expectedOutput !== undefined && result.preview === undefined;
  const matches = comparable && normalizeOutput(result.output) === normalizeOutput(expectedOutput);

  useEffect(() => {
    if (!isNativeLanguage(language)) return;
    const controller = new AbortController();
    void checkNativeRunner(language, controller.signal).then(
      (available) => {
        if (!controller.signal.aborted) setNativeStatus(available ? 'available' : 'unavailable');
      },
      () => {
        if (!controller.signal.aborted) setNativeStatus('unavailable');
      },
    );
    return () => controller.abort();
  }, [language]);

  useEffect(() => () => {
    activeRun.current?.abort();
    activeRun.current = null;
  }, []);

  function edit(next: Draft) {
    setDraft(next);
    setCopyStatus(undefined);
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // The editor remains usable when storage is unavailable.
    }
  }

  async function execute() {
    if (activeRun.current || !canRun) return;
    const controller = new AbortController();
    activeRun.current = controller;
    setExecution({ kind: 'running' });
    let next: RunResult;
    try {
      next = await runWithNativeSupport({ language, code: draft.code, stdin: draft.input }, controller.signal);
    } catch (error) {
      const message = error instanceof Error ? error.message : '运行环境出现问题，请重试。';
      next = { output: '', diagnostics: [{ severity: 'error', message }] };
    }
    if (activeRun.current !== controller) return;
    activeRun.current = null;
    setExecution({ kind: 'finished', draft, result: next });
  }

  function stop() {
    const controller = activeRun.current;
    if (!controller) return;
    activeRun.current = null;
    controller.abort();
    setExecution({ kind: 'stopped' });
  }

  function handleShortcut(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((!event.ctrlKey && !event.metaKey) || event.key !== 'Enter' || event.nativeEvent.isComposing || !canRun) return;
    event.preventDefault();
    if (!event.repeat) void execute();
  }

  function syncLineNumbers(scrollTop: number) {
    if (lineNumbers.current) lineNumbers.current.style.transform = `translateY(${-scrollTop}px)`;
  }

  function restore() {
    setDraft(initialDraft);
    setExecution({ kind: 'idle' });
    setCopyStatus(undefined);
    if (source.current) source.current.scrollTo(0, 0);
    syncLineNumbers(0);
    if (!storageKey) return;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Storage is optional.
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(draft.code);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('unavailable');
    }
  }

  function jumpToLine(line: number, column = 1) {
    const editor = source.current;
    if (!editor) return;
    const lineIndex = Math.max(0, Math.min(lines.length - 1, line - 1));
    const columnIndex = Math.max(0, Math.min(lines[lineIndex].length, column - 1));
    const lineStart = lines.slice(0, lineIndex).reduce((offset, text) => offset + text.length + 1, 0);
    const caret = lineStart + columnIndex;
    editor.focus();
    editor.setSelectionRange(caret, caret);

    const style = getComputedStyle(editor);
    const rowHeight = parseFloat(style.lineHeight);
    const rowTop = lineIndex * rowHeight + parseFloat(style.paddingTop);
    if (rowTop < editor.scrollTop || rowTop + rowHeight > editor.scrollTop + editor.clientHeight) {
      editor.scrollTop = rowTop - (editor.clientHeight - rowHeight) / 2;
    }
    const prefix = lines[lineIndex].slice(0, columnIndex).replace(/\t/g, ' '.repeat(Number(style.tabSize)));
    const caretLeft = parseFloat(style.paddingLeft) + prefix.length * parseFloat(style.fontSize) * 0.6;
    if (caretLeft < editor.scrollLeft || caretLeft >= editor.scrollLeft + editor.clientWidth - 16) {
      editor.scrollLeft = Math.max(0, caretLeft - editor.clientWidth / 2);
    }
    syncLineNumbers(editor.scrollTop);
  }

  const statusText = stale ? '代码或输入已修改。以下是上次运行的结果。'
    : running ? '正在运行…'
      : execution.kind === 'stopped' ? '已停止运行。'
        : errors.length ? '运行出错。'
          : result?.preview !== undefined ? '预览已更新。'
            : result ? '运行完成。' : '运行后在这里查看结果。';

  return (
    <section className="code-workbench" aria-labelledby={`${id}-title`}>
      <header className="code-workbench-header">
        <div className="code-workbench-title">
          <Code2 size={17} aria-hidden="true" />
          <strong id={`${id}-title`}>{title}</strong>
          <span className="code-workbench-language">{languageLabels[language]}</span>
        </div>
        <div className="code-workbench-actions">
          <button type="button" onClick={() => void copyCode()}>
            {copyStatus === 'copied' ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
            {copyStatus === 'copied' ? '已复制' : '复制代码'}
          </button>
          <button type="button" disabled={running || (draft.code === starter && draft.input === stdin && !result && execution.kind === 'idle')} onClick={restore}>
            <RotateCcw size={15} aria-hidden="true" /> 恢复示例
          </button>
          {canRun && (
            <button
              type="button"
              className="code-workbench-run"
              onClick={running ? stop : () => void execute()}
              aria-keyshortcuts={running ? undefined : 'Control+Enter Meta+Enter'}
              title={running ? undefined : 'Ctrl / ⌘ + Enter'}
            >
              {running ? <Square size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
              {running ? '停止运行' : language === 'html' ? '预览网页' : '运行代码'}
            </button>
          )}
        </div>
      </header>
      <div className="code-workbench-editor">
        <div className="code-workbench-gutter" aria-hidden="true">
          <div ref={lineNumbers}>
            {lines.map((_, index) => <span key={index} data-severity={affectedLines.get(index + 1)}>{index + 1}</span>)}
          </div>
        </div>
        <textarea
          ref={source}
          value={draft.code}
          aria-label="源代码"
          aria-describedby={canRun ? `${id}-shortcut` : `${id}-availability`}
          readOnly={running}
          rows={9}
          wrap="off"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          onChange={(event) => edit({ ...draft, code: event.currentTarget.value })}
          onKeyDown={handleShortcut}
          onScroll={(event) => syncLineNumbers(event.currentTarget.scrollTop)}
        />
      </div>
      <span className="code-workbench-sr-only" role="status">{copyStatus === 'copied' ? '代码已复制。' : ''}</span>
      {copyStatus === 'unavailable' && <p className="code-workbench-note" role="status">无法访问剪贴板，请手动选中并复制代码。</p>}
      {canRun && <span id={`${id}-shortcut`} className="code-workbench-sr-only">按 Ctrl 或 Command 加 Enter 运行。</span>}
      {!canRun && (
        <p className="code-workbench-note" id={`${id}-availability`} role="status">
          {language === 'text' ? '可以在这里编辑或复制文本。'
            : nativeStatus === 'checking' ? '正在检查本地运行环境…'
              : '在 Windows 电脑上打开项目里的「安装并启动实验室.cmd」，再用它打开的地址运行。'}
        </p>
      )}
      {canRun && needsInput && (
        <div className="code-workbench-stdin">
          <label htmlFor={`${id}-input`}>标准输入</label>
          <p id={`${id}-input-hint`}>{language === 'python' ? <>每次 <code>input()</code> 读取一行。运行前在这里输入。</> : '如果程序需要输入，请在运行前填在这里。'}</p>
          <textarea
            id={`${id}-input`}
            value={draft.input}
            aria-describedby={`${id}-input-hint`}
            readOnly={running}
            rows={2}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            onChange={(event) => edit({ ...draft, input: event.currentTarget.value })}
            onKeyDown={handleShortcut}
          />
        </div>
      )}
      {canRun && (
        <div className="code-workbench-output" role="group" aria-label="运行结果">
          <div className="code-workbench-output-title"><Terminal size={15} aria-hidden="true" /><strong>{language === 'html' ? '网页预览' : '运行结果'}</strong></div>
          <p className="code-workbench-note" role="status">{statusText}</p>
          {result?.preview !== undefined && <iframe sandbox="" referrerPolicy="no-referrer" title="网页预览" srcDoc={result.preview} />}
          {result && result.preview === undefined && (result.output || !errors.length) && (
            <div className="code-workbench-result-field">
              <p id={`${id}-stdout`}>标准输出</p>
              <pre tabIndex={0} aria-labelledby={`${id}-stdout`}>{result.output || '（无输出）'}</pre>
            </div>
          )}
          <DiagnosticList items={errors} heading="错误" stale={stale} onJump={jumpToLine} />
          <DiagnosticList items={warnings} heading="警告" stale={stale} onJump={jumpToLine} />
          {comparable && (
            <div className="code-workbench-comparison" data-matches={matches}>
              <p role="status">{matches ? '输出与预期一致。' : '输出与预期不同。'}</p>
              {!matches && <div className="code-workbench-result-field">
                <p id={`${id}-expected`}>预期输出</p>
                <pre tabIndex={0} aria-labelledby={`${id}-expected`}>{expectedOutput || '（无输出）'}</pre>
              </div>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function CodeWorkbench(props: CodeWorkbenchProps) {
  const sessionKey = JSON.stringify([props.language, props.draftKey ?? props.starter]);
  return <WorkbenchSession key={sessionKey} {...props} />;
}
