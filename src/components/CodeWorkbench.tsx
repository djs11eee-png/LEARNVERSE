import { useEffect, useId, useRef, useState } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import { Check, Code2, Copy, Download, Play, RotateCcw, ShieldCheck, Sparkles, Square, Terminal } from 'lucide-react';
import { diagnosticHint } from '../code/diagnostics';
import { checkNativeRunner, isLocalLabOrigin, isNativeLanguage, runWithNativeSupport } from '../code/localRunner';
import { hasInlineScript } from '../code/preview';
import type { Diagnostic, RunLanguage, RunResult } from '../code/runner';
import { maxEditorLines, workbenchInputLimits } from '../code/runnerLimits';
import { draftFieldFits, useCodeDraft } from './useCodeDraft';
import './code-workbench.css';

interface CodeWorkbenchProps {
  language: RunLanguage;
  starter: string;
  stdin?: string;
  draftKey?: string;
  title?: string;
  expectedOutput?: string;
  caseLabels?: string[];
  runSuffix?: string;
  downloadName?: string;
  onVerificationChange?: (passed: boolean) => void;
  onPreviewRun?: () => void;
  onNativeAvailabilityChange?: (available: boolean) => void;
  onAskAboutError?: (issue: CodeWorkbenchIssue, trigger: HTMLButtonElement) => void;
}

interface PreviewLogEntry {
  level: 'log' | 'warn' | 'error';
  text: string;
}

export interface CodeWorkbenchIssue {
  language: RunLanguage;
  code: string;
  diagnostic: Diagnostic;
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

export const languageLabels: Record<RunLanguage, string> = {
  python: 'Python', javascript: 'JavaScript', sql: 'SQL', html: 'HTML', c: 'C', java: 'Java', text: '纯文本',
};

function downloadText(name: string, parts: BlobPart[]) {
  const url = URL.createObjectURL(new Blob(parts, { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function normalizeOutput(value: string) {
  return value.replace(/\r\n/g, '\n').trim();
}

function canCompareOutput(result: RunResult, expected: string | undefined): expected is string {
  return expected !== undefined && result.preview === undefined && result.diagnostics.every(({ severity }) => severity !== 'error');
}

function compareCases(labels: string[] | undefined, expected: string[], actual: string[]) {
  if (!labels || labels.length !== expected.length) return [];
  const namedLines = labels.every((label, index) => expected[index].startsWith(label + '：'));
  if (!namedLines && actual.length !== expected.length) return [];

  return labels.map((label, index) => {
    const line = namedLines ? actual.find((item) => item.startsWith(label + '：')) : actual[index];
    return { label, passed: line === expected[index] };
  });
}

function sameOutputLines(expected: string[], actual: string[]) {
  if (expected.length !== actual.length) return false;
  const sortedActual = [...actual].sort();
  return [...expected].sort().every((line, index) => line === sortedActual[index]);
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

function WorkbenchSession({ language, starter, stdin, draftKey, title = '代码编辑器', expectedOutput, caseLabels, runSuffix, downloadName, onVerificationChange, onPreviewRun, onNativeAvailabilityChange, onAskAboutError }: CodeWorkbenchProps) {
  const id = useId();
  const storageKey = draftKey ? `learnverse:code-draft:${language}:${draftKey}` : undefined;
  const draftStorage = useCodeDraft(storageKey, language, starter, stdin ?? '');
  const { draft } = draftStorage;
  const [execution, setExecution] = useState<Execution>({ kind: 'idle' });
  const [copyStatus, setCopyStatus] = useState<'copied' | 'unavailable'>();
  const [limitedField, setLimitedField] = useState<keyof Draft>();
  const [nativeStatus, setNativeStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const [probe, setProbe] = useState(0);
  const [previewMode, setPreviewMode] = useState<'auto' | 'static' | 'interactive'>('auto');
  const [previewRunId, setPreviewRunId] = useState(0);
  const [previewToken, setPreviewToken] = useState('');
  const [previewLogs, setPreviewLogs] = useState<PreviewLogEntry[]>([]);
  const verifiedDraft = useRef(draft);
  const source = useRef<HTMLTextAreaElement>(null);
  const lineNumbers = useRef<HTMLDivElement>(null);
  const previewFrame = useRef<HTMLIFrameElement>(null);
  const activeRun = useRef<AbortController | null>(null);

  const native = isNativeLanguage(language);
  const labOrigin = native && isLocalLabOrigin();
  const needsInput = native || (language === 'python' && (stdin !== undefined || draft.input !== '' || /\binput\s*\(/.test(draft.code)));
  const canRun = language !== 'text' && (!native || nativeStatus === 'available');
  const scriptDetected = language === 'html' && hasInlineScript(draft.code);
  const interactivePreview = language === 'html' && (previewMode === 'interactive' || (previewMode === 'auto' && scriptDetected));
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
  const comparable = result && !stale && canCompareOutput(result, expectedOutput);
  const matches = comparable && normalizeOutput(result.output) === normalizeOutput(expectedOutput);
  const expectedLines = comparable ? normalizeOutput(expectedOutput).split('\n') : [];
  const outputLines = comparable ? normalizeOutput(result.output).split('\n') : [];
  const firstMismatch = expectedLines.findIndex((line, index) => line !== outputLines[index]);
  const caseResults = compareCases(caseLabels, expectedLines, outputLines);
  const sameLines = comparable && !matches && sameOutputLines(expectedLines, outputLines);
  const extraLines = outputLines.length > expectedLines.length
    && (firstMismatch < 0 || (caseResults.length > 0 && caseResults.every(({ passed }) => passed)));

  useEffect(() => {
    if (!labOrigin) return;
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    void checkNativeRunner(language, controller.signal).then((available) => {
      window.clearTimeout(timeout);
      if (active) setNativeStatus(available ? 'available' : 'unavailable');
    });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [labOrigin, language, probe]);

  useEffect(() => {
    if (!native) return;
    onNativeAvailabilityChange?.(labOrigin && nativeStatus === 'available');
  }, [labOrigin, native, nativeStatus, onNativeAvailabilityChange]);

  useEffect(() => {
    if (!previewToken) return;
    function onPreviewMessage(event: MessageEvent<unknown>) {
      if (event.origin !== 'null' || event.source !== previewFrame.current?.contentWindow) return;
      if (!event.data || typeof event.data !== 'object') return;
      const data = event.data as Record<string, unknown>;
      if (data.kind !== 'learnverse-preview-log' || data.token !== previewToken) return;
      const level = data.level === 'error' || data.level === 'warn' ? data.level : 'log';
      const text = typeof data.text === 'string' ? data.text.slice(0, 600) : '';
      if (!text) return;
      setPreviewLogs((previous) => (previous.length >= 40 ? previous : [...previous, { level, text }]));
    }
    window.addEventListener('message', onPreviewMessage);
    return () => window.removeEventListener('message', onPreviewMessage);
  }, [previewToken]);

  useEffect(() => {
    if (verifiedDraft.current.code === draft.code && verifiedDraft.current.input === draft.input) return;
    verifiedDraft.current = draft;
    setCopyStatus(undefined);
    onVerificationChange?.(false);
  }, [draft, onVerificationChange]);

  useEffect(() => () => {
    activeRun.current?.abort();
    activeRun.current = null;
  }, []);

  const limits = workbenchInputLimits(language);

  function edit(field: keyof Draft, value: string) {
    const fits = draftFieldFits(field, value, limits);
    setLimitedField(fits ? undefined : field);
    if (fits) draftStorage.edit(field, value);
  }

  function checkPaste(field: keyof Draft, event: ClipboardEvent<HTMLTextAreaElement>) {
    const { value, selectionStart, selectionEnd } = event.currentTarget;
    const clipboard = event.clipboardData.getData('text/plain');
    if (clipboard.length <= limits[field] * 2) {
      const pasted = clipboard.replace(/\r\n?/g, '\n');
      const size = value.length - (selectionEnd - selectionStart) + pasted.length;
      if (size <= limits[field] && draftFieldFits(field, value.slice(0, selectionStart) + pasted + value.slice(selectionEnd), limits)) return;
    }
    event.preventDefault();
    setLimitedField(field);
  }

  function retryNative() {
    setNativeStatus('checking');
    setProbe((value) => value + 1);
  }

  async function execute(overrideInteractive?: boolean) {
    if (activeRun.current || !canRun) return;
    const code = runSuffix ? draft.code + '\n' + runSuffix : draft.code;
    if (runSuffix && !draftFieldFits('code', code, limits)) {
      setExecution({ kind: 'finished', draft, result: {
        output: '',
        diagnostics: [{ severity: 'error', message: '源代码加上自动检查脚本超过单次运行上限。请缩短源代码后重试。' }],
      } });
      onVerificationChange?.(false);
      return;
    }
    const useInteractive = language === 'html' ? (overrideInteractive ?? interactivePreview) : false;
    const nextToken = useInteractive ? [...crypto.getRandomValues(new Uint32Array(2))].join('.') : '';
    const controller = new AbortController();
    activeRun.current = controller;
    setExecution({ kind: 'running' });
    setPreviewLogs([]);
    setPreviewToken(nextToken);
    if (expectedOutput !== undefined) onVerificationChange?.(false);
    let next: RunResult;
    try {
      next = await runWithNativeSupport({
        language,
        code,
        stdin: draft.input,
        interactivePreview: useInteractive,
        previewToken: nextToken || undefined,
      }, controller.signal);
      if (runSuffix) {
        const diagnostics = next.diagnostics.map((diagnostic) => {
          if (diagnostic.line === undefined || diagnostic.line <= lines.length) return diagnostic;
          return { ...diagnostic, line: undefined, column: undefined };
        });
        next = { ...next, diagnostics };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '运行环境出现问题，请重试。';
      next = { output: '', diagnostics: [{ severity: 'error', message }] };
    }
    if (activeRun.current !== controller) return;
    activeRun.current = null;
    if (next.preview !== undefined) {
      setPreviewRunId((value) => value + 1);
      onPreviewRun?.();
    }
    setExecution({ kind: 'finished', draft, result: next });
    const latest = draftStorage.current.current;
    if (onVerificationChange && expectedOutput !== undefined && latest.code === draft.code && latest.input === draft.input) {
      onVerificationChange(canCompareOutput(next, expectedOutput)
        && normalizeOutput(next.output) === normalizeOutput(expectedOutput));
    }
  }

  function switchPreviewMode(mode: 'static' | 'interactive') {
    setPreviewMode(mode);
    if (result?.preview !== undefined && !running) {
      void execute(mode === 'interactive');
    }
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
    draftStorage.restore();
    setExecution({ kind: 'idle' });
    setPreviewMode('auto');
    setPreviewToken('');
    setPreviewLogs([]);
    setLimitedField(undefined);
    setCopyStatus(undefined);
    onVerificationChange?.(false);
    if (source.current) source.current.scrollTo(0, 0);
    syncLineNumbers(0);
  }

  function downloadCode() {
    if (downloadName) downloadText(downloadName, [draft.code]);
  }

  function downloadSavedDraft() {
    const parts = draftStorage.savedText();
    if (parts.length) downloadText('learnverse-原草稿.txt', parts);
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
          : result?.preview !== undefined
            ? (result.previewInteractive ? '同页交互预览已更新（受控沙箱：允许本页 DOM 交互，禁止联网与读取主站数据）。' : '静态预览已更新（已关闭脚本，仅检查结构与样式）。')
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
          {downloadName && <button type="button" onClick={downloadCode}><Download size={15} aria-hidden="true" /> {language === 'html' ? '下载 HTML' : '下载代码'}</button>}
          <button type="button" disabled={running || (!draftStorage.pending && !draftStorage.oversized && draft.code === starter && draft.input === (stdin ?? '') && !result && execution.kind === 'idle')} onClick={restore}>
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
          onPaste={(event) => checkPaste('code', event)}
          onChange={(event) => edit('code', event.currentTarget.value)}
          onKeyDown={handleShortcut}
          onScroll={(event) => syncLineNumbers(event.currentTarget.scrollTop)}
        />
      </div>
      <div className="code-workbench-editor-footer">
        <span>{lines.length} 行</span>
        {canRun && <span id={`${id}-shortcut`}>运行快捷键 <kbd>Ctrl / ⌘</kbd> + <kbd>Enter</kbd></span>}
      </div>
      <span className="code-workbench-sr-only" role="status">{copyStatus === 'copied' ? '代码已复制。' : ''}</span>
      {copyStatus === 'unavailable' && <p className="code-workbench-note" role="status">无法访问剪贴板，请手动选中并复制代码。</p>}
      {limitedField && <p className="code-workbench-note" role="status">
        {limitedField === 'code' ? `源代码最多 ${limits.code} 个字符和 ${maxEditorLines} 行。此次编辑未应用。` : `标准输入最多 ${limits.input} 个字符。此次编辑未应用。`}
      </p>}
      {draftStorage.oversized && <div className="code-workbench-notice">
        <p className="code-workbench-note" role="status">已保存的草稿超过编辑器上限，仍保留在浏览器中。可先下载原稿，再恢复示例。</p>
        <div className="code-workbench-actions"><button type="button" onClick={downloadSavedDraft}>下载原草稿</button></div>
      </div>}
      {draftStorage.pending && draftStorage.blocked ? <div className="code-workbench-notice">
        <p className="code-workbench-note" role="status">{draftStorage.conflict
          ? '草稿修改未保存。其他标签页修改了同一字段，请选择该字段要保留的版本。'
          : '草稿修改未保存，暂时保留在此编辑器。'}</p>
        <div className="code-workbench-actions">
          {draftStorage.conflict
            ? <>
              <button type="button" disabled={running} onClick={() => draftStorage.retry('use-saved')}>使用其他标签页的版本</button>
              <button type="button" disabled={running} onClick={() => draftStorage.retry('keep-mine')}>保存我的版本</button>
            </>
            : <button type="button" disabled={running} onClick={() => draftStorage.retry()}>重试保存草稿</button>}
        </div>
      </div> : draftStorage.synced && <p className="code-workbench-note" role="status">已同步其他标签页的草稿。同一字段以最后保存的版本为准。</p>}
      {!canRun && (
        <div className="code-workbench-notice">
          <p className="code-workbench-note" id={`${id}-availability`} role="status">
            {language === 'text' ? '可以在这里编辑或复制文本。'
              : labOrigin && nativeStatus === 'checking' ? '正在检查本地运行环境…'
                : '在 Windows 电脑上打开项目里的「安装并启动实验室.cmd」，再用它打开的地址运行。'}
          </p>
          {labOrigin && nativeStatus === 'unavailable'
            && <div className="code-workbench-actions"><button type="button" onClick={retryNative}>重新检测</button></div>}
        </div>
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
            onPaste={(event) => checkPaste('input', event)}
            onChange={(event) => edit('input', event.currentTarget.value)}
            onKeyDown={handleShortcut}
          />
        </div>
      )}
      {canRun && (
        <div className="code-workbench-output" role="group" aria-label="运行结果" data-state={stale ? 'stale' : errors.length ? 'error' : execution.kind}>
          <div className="code-workbench-output-title">
            <Terminal size={15} aria-hidden="true" />
            <strong>{language === 'html' ? '网页预览' : '运行结果'}</strong>
            {language === 'html' && (
              <div className="code-workbench-preview-mode" role="group" aria-label="网页预览模式">
                <button
                  type="button"
                  aria-pressed={!interactivePreview}
                  onClick={() => switchPreviewMode('static')}
                >
                  静态结构
                </button>
                <button
                  type="button"
                  aria-pressed={interactivePreview}
                  onClick={() => switchPreviewMode('interactive')}
                >
                  <ShieldCheck size={13} aria-hidden="true" /> 同页交互
                </button>
              </div>
            )}
          </div>
          <p className="code-workbench-note" role="status">{statusText}</p>
          {result?.preview !== undefined && (
            <iframe
              ref={previewFrame}
              key={`${previewRunId}-${result.previewInteractive ? 'interactive' : 'static'}`}
              sandbox={result.previewInteractive ? 'allow-scripts allow-forms' : ''}
              referrerPolicy="no-referrer"
              title="网页预览"
              srcDoc={result.preview}
            />
          )}
          {result?.previewInteractive && previewLogs.length > 0 && (
            <div className="code-workbench-preview-console" aria-label="页面控制台">
              <div className="code-workbench-preview-console-head">
                <strong>页面控制台</strong>
                <button type="button" onClick={() => setPreviewLogs([])}>清空</button>
              </div>
              <ul>
                {previewLogs.map((entry, index) => (
                  <li key={index} data-level={entry.level}>
                    <span>{entry.text}</span>
                    {entry.level === 'error' && diagnosticHint(entry.text) && (
                      <small className="code-workbench-diagnostic-hint">{diagnosticHint(entry.text)}</small>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result && result.preview === undefined && (result.output || !errors.length) && (
            <div className="code-workbench-result-field">
              <p id={`${id}-stdout`}>标准输出</p>
              <pre tabIndex={0} aria-labelledby={`${id}-stdout`}>{result.output || '（无输出）'}</pre>
            </div>
          )}
          <DiagnosticList items={errors} heading="错误" stale={stale} onJump={jumpToLine} />
          {onAskAboutError && errors[0] && !stale && execution.kind === 'finished' && (
            <button type="button" className="code-workbench-assistant" onClick={event =>
              onAskAboutError({ language, code: execution.draft.code, diagnostic: errors[0] }, event.currentTarget)}>
              <Sparkles size={16} aria-hidden /> 一键带错问小助手
            </button>
          )}
          <DiagnosticList items={warnings} heading="警告" stale={stale} onJump={jumpToLine} />
          {comparable && (
            <div className="code-workbench-comparison" data-matches={matches}>
              <p role="status">{matches ? '输出与预期一致。' : '输出与预期不同。'}</p>
              {caseResults.length > 0 && <ul className="code-workbench-case-results" aria-label="用例结果">
                {caseResults.map(({ label, passed }) => <li key={label}>
                  <span>{label}</span><strong data-passed={passed}>{passed ? '通过' : '未通过'}</strong>
                </li>)}
              </ul>}
              {!matches && <p className="code-workbench-note">{sameLines
                ? '完整输出校验未通过：用例顺序与预期不同。'
                : extraLines ? '完整输出校验未通过：包含多余的输出。'
                  : outputLines[firstMismatch] === undefined ? `缺少第 ${firstMismatch + 1} 行。` : `请先核对第 ${firstMismatch + 1} 行的值、顺序和格式。`}</p>}
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
