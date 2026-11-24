import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, BarChart3, ChevronDown, Code2, ListChecks,
  FlaskConical, Orbit, PackageOpen, Pause, Play, RotateCcw, Shuffle, SkipBack, SkipForward,
} from 'lucide-react';
import { algorithms, projects, questions, traceBinarySearch, traceBubbleSort } from '../data/lab';
import { ThemeSelect } from '../components/ThemeSelect';
import { CodeWorkbench } from '../components/CodeWorkbench';
import { useStation } from '../components/observatory/StationProvider';
import type { RunLanguage } from '../code/runner';
import { Link } from 'react-router-dom';
import { earnDaily, dailyKey } from '../cards/rewards';
import { usePackStation } from '../cards/usePackStation';
import '../cards/vault.css';
import './lab.css';

type Algorithm = keyof typeof algorithms;

const labSamples = {
  python: { label: 'Python', code: '# print 把括号里的文字显示在下方。\nprint("你好，LEARNVERSE")\n' },
  javascript: { label: 'JavaScript', code: '// console.log 显示计算结果。\nconst score = 12;\nconsole.log(score * 2);\n' },
  sql: { label: 'SQL', code: '-- SELECT 在结果里显示这个计算。\nSELECT 12 * 2 AS result;\n' },
  html: { label: 'HTML / CSS', code: '<h1>我的学习计划</h1>\n<p>今天先写一个小程序。</p>\n<style>\n  h1 { color: #275c50; }\n</style>\n' },
  c: { label: 'C · Windows 本机', code: '#include <stdio.h>\n\nint main(void) {\n    printf("Hello, LEARNVERSE!\\n");\n    return 0;\n}\n' },
  java: { label: 'Java · Windows 本机', code: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, LEARNVERSE!");\n    }\n}\n' },
} satisfies Partial<Record<RunLanguage, { label: string; code: string }>>;

function FreePractice() {
  const observatory = useStation();
  const [language, setLanguage] = useState<keyof typeof labSamples>('python');
  const sample = labSamples[language];
  return (
    <section className="lab-free-practice" id="lab-code" aria-labelledby="lab-free-title">
      <div className="lab-free-copy">
        <h2 id="lab-free-title">自由练习</h2>
        <p>选一门语言，改一行示例，再运行代码。你可以在编辑器下方查看结果。</p>
        <ThemeSelect compact label="编程语言" value={language} onChange={(value) => setLanguage(value as keyof typeof labSamples)}
          options={Object.entries(labSamples).map(([value, { label }]) => ({ value, label }))} />
        <details className="lab-setup">
          <summary>需要安装什么？</summary>
          <ul>
            <li>Python、JavaScript、SQL 和 HTML/CSS 预览只需要现代浏览器。第一次运行 Python 会先加载运行环境。</li>
            <li>在 Windows 上从项目目录双击 <strong>安装并启动实验室.cmd</strong>。它会检查并安装缺少的 Node.js、MSYS2 GCC 与 Java JDK，再打开本机实验室。</li>
            <li>C 和 Java 在本机执行，只运行你自己编写或确认来源的代码。手机上仍可以编辑与查看参考解法。</li>
          </ul>
        </details>
      </div>
      <CodeWorkbench
        title="代码编辑器"
        draftKey="lab/free"
        language={language}
        starter={sample.code}
        stdin={language === 'python' ? '' : undefined}
        onAskAboutError={(issue, opener) => observatory.askAboutError(issue, opener, { courseId: 'lab', lessonId: `free-${language}` })}
      />
    </section>
  );
}

function generateInput(algorithm: Algorithm) {
  const pool = Array.from({ length: 89 }, (_, index) => index + 10);
  const values = Array.from({ length: 7 }, () => pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  if (algorithm === 'binary') values.sort((left, right) => left - right);
  return values;
}

function AlgorithmBench() {
  const observatory = useStation();
  const [algorithm, setAlgorithm] = useState<Algorithm>('bubble');
  const [input, setInput] = useState(algorithms.bubble.sample);
  const [target, setTarget] = useState(79);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const config = algorithms[algorithm];
  const frames = useMemo(() => algorithm === 'bubble' ? traceBubbleSort(input) : traceBinarySearch(input, target), [algorithm, input, target]);
  const lastStep = frames.length - 1;
  const frame = frames[step];
  const currentStep = `第 ${step + 1} 步，共 ${frames.length} 步`;

  useEffect(() => {
    if (!playing || step >= lastStep) return;
    const timer = window.setTimeout(() => {
      setStep(step + 1);
      if (step + 1 === lastStep) setPlaying(false);
    }, 660);
    return () => window.clearTimeout(timer);
  }, [lastStep, playing, step]);

  function selectStep(nextStep: number) {
    setPlaying(false);
    setStep(Math.max(0, Math.min(lastStep, nextStep)));
  }

  function changeAlgorithm(next: Algorithm) {
    selectStep(0);
    setAlgorithm(next);
    setInput(algorithms[next].sample);
    setTarget(79);
  }

  function shuffle() {
    const values = generateInput(algorithm);
    selectStep(0);
    setInput(values);
    if (algorithm === 'binary') setTarget(values[5]);
  }

  return (
    <section className="lab-workspace" id="lab-algorithms" aria-label="算法演示与代码编辑">
      <article className="lab-panel lab-bench">
        <div className="lab-panel-header">
          <h2><BarChart3 size={17} aria-hidden="true" /> 算法演示</h2>
          <button className="lab-icon-button" type="button" aria-label="随机生成新数据" title="随机生成新数据" onClick={shuffle}><Shuffle size={16} aria-hidden="true" /></button>
        </div>
        <div className="lab-simulator-config">
          <ThemeSelect compact label="算法" value={algorithm} onChange={(value) => changeAlgorithm(value as Algorithm)} options={[
            { value: 'bubble', label: algorithms.bubble.title }, { value: 'binary', label: algorithms.binary.title },
          ]} />
          {algorithm === 'binary' && (
            <ThemeSelect compact label="目标值" value={String(target)} onChange={(value) => { selectStep(0); setTarget(Number(value)); }} options={[
              ...input.map((value) => ({ value: String(value), label: String(value) })), { value: '99', label: '99（不在数组中）' },
            ]} />
          )}
          <span className="lab-complexity">{config.complexity}</span>
        </div>
        <div className="lab-chart" role="img" aria-label={`数组当前值为 ${frame.values.join('、')}`}>
          {frame.values.map((value, index) => (
            <div
              className="lab-column"
              key={index}
              aria-hidden="true"
              data-active={frame.active.includes(index)}
              data-confirmed={frame.confirmed.includes(index)}
              data-removed={frame.range ? !frame.range.includes(index) : false}
            >
              <div className="lab-bar" style={{ height: value + '%' }}>
                <span>{value}</span>
              </div>
              <span className="lab-array-index">{index}</span>
            </div>
          ))}
        </div>
        <p className="lab-frame-message" role="status">{frame.message}</p>
        <div className="lab-timeline">
          <input
            type="range"
            min={0}
            max={lastStep}
            value={step}
            aria-label="演示进度"
            aria-valuetext={currentStep}
            onChange={(event) => selectStep(Number(event.target.value))}
          />
          <span aria-hidden="true">{currentStep}</span>
        </div>
        <div className="lab-controls" role="group" aria-label="演示控制">
          <button className="lab-icon-button" type="button" aria-label="重置演示" title="重置演示" onClick={() => selectStep(0)}><RotateCcw size={15} aria-hidden="true" /></button>
          <button className="lab-icon-button" type="button" aria-label="上一步" title="上一步" disabled={step === 0} onClick={() => selectStep(step - 1)}><SkipBack size={15} aria-hidden="true" /></button>
          <button
            className="lab-primary lab-play"
            type="button"
            onClick={() => {
              if (step === lastStep) setStep(0);
              setPlaying(!playing);
            }}
          >
            {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
            {playing ? '暂停' : step === lastStep ? '重播' : '播放'}
          </button>
          <button className="lab-icon-button" type="button" aria-label="下一步" title="下一步" disabled={step === lastStep} onClick={() => selectStep(step + 1)}><SkipForward size={15} aria-hidden="true" /></button>
        </div>
      </article>
      <article className="lab-panel lab-editor">
        <CodeWorkbench
          title={`${config.title}示例`}
          draftKey={`lab/${algorithm}`}
          language="javascript"
          starter={`${config.code}\n\nconsole.log(${algorithm === 'bubble' ? 'bubbleSort([6, 2, 8, 1])' : 'binarySearch([12, 35, 64, 79], 79)'});\n`}
          onAskAboutError={(issue, opener) => observatory.askAboutError(issue, opener, { courseId: 'lab', lessonId: `algorithm-${algorithm}` })}
        />
      </article>
    </section>
  );
}

function KnowledgeCheck({ onPerfect, earned }: { onPerfect: () => void; earned: boolean }) {
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number>();
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(0);
  const question = questions[index];

  return (
    <section className="lab-panel lab-quiz" id="lab-quiz" aria-labelledby="lab-quiz-title">
      <div className="lab-panel-header">
        <h2 id="lab-quiz-title"><FlaskConical size={17} aria-hidden="true" /> 知识自测</h2>
        {question && <span className="lab-complexity">{index + 1} / {questions.length}</span>}
      </div>
      <p>{earned ? '今日挑战补给已发放。' : '每日挑战 · 全部答对，可领今天的知识补给包。'}</p>
      {question ? (
        <form onSubmit={(event) => {
          event.preventDefault();
          if (checked) {
            if (index === questions.length - 1 && correct === questions.length) onPerfect();
            setIndex(index + 1);
            setChoice(undefined);
            setChecked(false);
          } else if (choice !== undefined) {
            setChecked(true);
            if (choice === question.answer) setCorrect(correct + 1);
          }
        }}>
          <fieldset disabled={checked}>
            <legend>{question.prompt}</legend>
            {question.options.map((option, optionIndex) => (
              <label className="lab-choice" key={option} data-correct={checked && question.answer === optionIndex}>
                <input type="radio" name="lab-answer" checked={choice === optionIndex} onChange={() => setChoice(optionIndex)} />
                <span>{option}</span>
              </label>
            ))}
          </fieldset>
          {checked && <p className="lab-quiz-feedback" role="status"><strong>{choice === question.answer ? '答对了。' : '答错了。'}</strong>{question.explanation}</p>}
          <button className="lab-primary" type="submit" disabled={choice === undefined}>
            {checked ? index === questions.length - 1 ? '查看结果' : '下一题' : '提交答案'}
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </form>
      ) : (
        <div className="lab-quiz-result">
          <p role="status">答对 <strong>{correct}</strong> 题，共 {questions.length} 题。</p>
          <button className="lab-quiet-button" type="button" onClick={() => { setIndex(0); setCorrect(0); }}>
            <RotateCcw size={15} aria-hidden="true" /> 再做一次
          </button>
        </div>
      )}
    </section>
  );
}

export function Lab() {
  const station = usePackStation(true);
  return (
    <div className="lab-page">
      <header className="lab-intro" data-enter>
        <div className="lab-moon" aria-hidden="true"><img src="/art/near-moon.webp" alt="" /></div>
        <div className="lab-intro-copy">
          <span className="lab-kicker" lang="en">LEARNVERSE / LAB</span>
          <h1>学习<em>实验室</em></h1>
          <p><span>写一段程序，</span><span>运行并查看结果，</span><span>也可以单步观察算法。</span></p>
        </div>
      </header>
      <nav className="lab-directory" aria-label="实验室导航">
        <a href="#lab-code"><Code2 size={17} aria-hidden="true" />打开代码编辑器</a>
        <a href="#lab-algorithms"><BarChart3 size={17} aria-hidden="true" />算法演示</a>
        <a href="#lab-quiz"><ListChecks size={17} aria-hidden="true" />知识自测</a>
        <a href="#lab-projects"><Orbit size={17} aria-hidden="true" />实战练习</a>
      </nav>
      <FreePractice />
      <AlgorithmBench />
      <div className="lab-workspace lab-practice">
        <KnowledgeCheck earned={station.earned.includes(dailyKey())} onPerfect={() => {
          const key = earnDaily();
          station.showPack(key);
        }} />
        <section className="lab-panel lab-projects" id="lab-projects" aria-labelledby="lab-projects-title">
          <div className="lab-panel-header">
            <h2 id="lab-projects-title"><Orbit size={17} aria-hidden="true" /> 实战练习</h2>
          </div>
          {projects.map((project) => (
            <details className="lab-project" key={project.title}>
              <summary>
                <span><small>{project.topic}</small><strong>{project.title}</strong></span>
                <ChevronDown size={17} aria-hidden="true" />
              </summary>
              <p>{project.description}</p>
              <ul>{project.checks.map((check) => <li key={check}>{check}</li>)}</ul>
            </details>
          ))}
        </section>
      </div>
      <div className="lab-supply">
        <PackageOpen size={24} aria-hidden="true" /><div><strong>知识补给包</strong><small>{station.pending.length ? station.pending.length + ' 个待拆封' : '完成章节或今日知识自测，可再领取一包。'}</small></div>
        {station.pending.length ? <button type="button" className="button button-light" onClick={() => station.showPack(station.pending[0])}>拆开补给包</button>
          : <Link className="button" to="/my-universe">查看图鉴 <ArrowRight size={15} /></Link>}
      </div>
      {station.stage}
    </div>
  );
}
