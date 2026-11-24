import { ArrowRight, BookOpen, Check, ChevronDown, Compass, GraduationCap, Mountain, Telescope, Upload, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { courseSummaries } from '../data/courseCatalog'
import { domains, getLearningRoute, routeMapPath } from '../data/learning'
import { majorRoutes } from '../data/majorRoutes'
import { useProgress } from '../state/progress'
import { getStudentProfile, prepareStudentAvatar, updateStudentProfile } from '../state/studentProfile'
import type { StudentPath } from '../state/studentProfile'

const options = [
  { id: 'major', label: '计算机类专业', icon: GraduationCap },
  { id: 'interest', label: '跨专业 / 兴趣学习', icon: Telescope },
  { id: 'undecided', label: '还没想好', icon: Mountain },
] as const
const interests = [
  { id: 'programming', label: '写出我的第一个程序' },
  { id: 'web-development', label: '做一个自己的网页' },
  { id: 'ai', label: '试试大模型怎样理解文字' },
  { id: 'iot', label: '了解传感帧与物联网通信' },
  { id: 'robotics', label: '探索机器人与具身智能通信' },
  { id: 'algorithms', label: '让程序更快地找到答案' },
  { id: 'computer-science', label: '弄懂电脑怎样存储数据' },
  { id: 'software-engineering', label: '开发并测试一个软件项目' },
  { id: 'tools', label: '学会找出程序里的错误' },
]
const majorGroups = [...new Set(majorRoutes.map(major => major.group))]
function recommend(path: StudentPath | null, choice: string) {
  if (!path) return
  if (path === 'major') {
    return majorRoutes.find(item => item.id === choice)
  }
  const domain = domains.find(item => item.id === (path === 'undecided' ? 'programming' : choice))
  return getLearningRoute(domain?.routeId ?? null)
}

export function StudentWelcome({ mode, onClose }: { mode: 'route' | 'profile'; onClose: () => void }) {
  const { chooseRoute, activeRoute, hasUnsavedProgress } = useProgress()
  const [initial] = useState(getStudentProfile)
  const [path, setPath] = useState<StudentPath | null>(initial.path)
  const [majorChoice, setMajorChoice] = useState(initial.path === 'major' ? initial.choice : '')
  const [interestChoice, setInterestChoice] = useState(initial.path === 'interest' ? initial.choice : '')
  const [nickname, setNickname] = useState(initial.nickname)
  const [avatar, setAvatar] = useState(initial.avatar)
  const [processing, setProcessing] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [finished, setFinished] = useState(false)
  const [persisted, setPersisted] = useState(true)
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const uploadJob = useRef(0)
  const choice = path === 'major' ? majorChoice : path === 'interest' ? interestChoice : ''
  const result = recommend(path, choice)
  const firstCourse = result && courseSummaries.find(course => course.id === result.courseIds[0])
  const profileOnly = mode === 'profile'

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    heading.current?.focus({ preventScroll: true })
    return () => {
      uploadJob.current++
      element?.close()
    }
  }, [])
  useEffect(() => {
    if (finished) heading.current?.focus({ preventScroll: true })
  }, [finished])

  async function selectAvatar(file: File) {
    const job = ++uploadJob.current
    setAvatarError('')
    setProcessing(true)
    try {
      const next = await prepareStudentAvatar(file)
      if (uploadJob.current === job) setAvatar(next)
    } catch (error) {
      if (uploadJob.current === job) setAvatarError(error instanceof Error ? error.message : '图片读取失败，请重新选择。')
    } finally {
      if (uploadJob.current === job) setProcessing(false)
    }
  }

  function save(event: FormEvent) {
    event.preventDefault()
    if (processing || (!profileOnly && !result)) return
    const details = {
      ...(nickname.trim() !== initial.nickname && { nickname: nickname.trim() }),
      ...(avatar !== initial.avatar && { avatar }),
    }
    const saved = updateStudentProfile(profileOnly ? details : { ...details, path, choice, welcome: 'finished' })
    if (!profileOnly && result && activeRoute !== result.id) chooseRoute(result.id)
    setPersisted(saved)
    setFinished(true)
  }

  const profileFields = <div className="student-profile-fields">
    <label className="student-field">昵称
      <input maxLength={24} autoComplete="nickname" placeholder="你想用什么名字？" value={nickname} onChange={event => setNickname(event.target.value)} />
    </label>
    <div className="student-avatar-field">
      <span className="student-portrait">{avatar ? <img src={avatar} alt="头像预览" /> : <UserRound aria-hidden size={22} />}</span>
      <div>
        <label className="student-upload"><Upload size={15} aria-hidden /> 选择头像
          <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="选择头像" aria-describedby="student-image-types" onChange={event => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (file) void selectAvatar(file)
          }} />
        </label>
        {avatar && <button type="button" className="student-text-button" onClick={() => { uploadJob.current++; setProcessing(false); setAvatar(''); setAvatarError('') }}>移除头像</button>}
        <small id="student-image-types">JPG、PNG 或 WebP，最大 2 MB</small>
      </div>
    </div>
    {processing && <p role="status">正在处理图片…</p>}
    {avatarError && <p className="student-error" role="alert">{avatarError}</p>}
    <p className="student-privacy">个人资料保存在当前浏览器，共用这台设备的人也能看到。清除网站数据会删除本机资料。</p>
  </div>

  return <dialog className="student-dialog" ref={dialog} aria-labelledby="student-heading" onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="student-sheet">
      <header className="student-sheet-header">
        <span className="student-emblem">{finished ? <Check size={22} /> : profileOnly ? <UserRound size={22} /> : <Compass size={24} />}</span>
        <button type="button" className="icon-button" aria-label="关闭" onClick={onClose}><X size={17} /></button>
      </header>
      <h2 id="student-heading" tabIndex={-1} ref={heading}>{finished ? profileOnly ? '个人资料已更新' : '你的推荐路线' : profileOnly ? '个人资料' : '找到你的学习起点'}</h2>
      {finished ? <>
        {!profileOnly && result && <div className="student-recommendation">
          <h3>{result.title}</h3><p>{result.description}</p>
          {firstCourse && <div className="student-first-course"><BookOpen size={18} aria-hidden /><span><small>从这门课开始</small><strong>{firstCourse.title}</strong></span></div>}
        </div>}
        {profileOnly && <p className="student-intro-copy">{nickname.trim() ? '已保存你的昵称「' + nickname.trim() + '」。' : '你可以随时回来更改昵称和头像。'}</p>}
        {(!persisted || (!profileOnly && hasUnsavedProgress)) && <p className="student-error" role="status">浏览器暂时无法保存全部更改，当前页面仍可继续使用。</p>}
        <div className="student-actions">
          {!profileOnly && result ? <Link className="button button-light" to={routeMapPath(result)} onClick={onClose}>查看推荐路线 <ArrowRight size={16} /></Link> :
            <button className="button button-light" type="button" onClick={onClose}>完成 <Check size={16} /></button>}
        </div>
      </> : <form onSubmit={save}>
        {profileOnly ? profileFields : <>
          <p className="student-intro-copy">你的选择只保存在当前浏览器，用于推荐学习路线。也可以跳过，以后再选。</p>
          <fieldset className="student-paths"><legend>你的学习背景</legend>
            <div>{options.map(({ id, label, icon: Icon }) => <label key={id} className="student-path">
              <input type="radio" name="student-path" value={id} checked={path === id} onChange={() => setPath(id)} />
              <Icon size={18} aria-hidden /><span>{label}</span>
            </label>)}</div>
          </fieldset>
          {path === 'major' && <label className="student-field">选择所学专业
            <select value={majorChoice} required onChange={event => setMajorChoice(event.target.value)}>
              <option value="">请选择专业</option>
              {majorGroups.map(group => <optgroup key={group} label={group}>
                {majorRoutes.filter(major => major.group === group).map(major => <option key={major.id} value={major.id}>{major.title} · {major.english}</option>)}
              </optgroup>)}
            </select>
          </label>}
          {path === 'interest' && <label className="student-field">你想先做什么？
            <select value={interestChoice} required onChange={event => setInterestChoice(event.target.value)}>
              <option value="">请选择兴趣方向</option>{interests.map(interest => <option key={interest.id} value={interest.id}>{interest.label}</option>)}
            </select>
          </label>}
          {path === 'undecided' && <p className="student-hint">可以先从编程基础试起。以后也能在个人菜单里重新选择。</p>}
          <details className="student-optional"><summary>昵称与头像 <span>选填</span><ChevronDown size={15} /></summary>{profileFields}</details>
        </>}
        <div className="student-actions">
          {!profileOnly && initial.welcome === 'new' && !activeRoute
            ? <button type="button" className="student-text-button" onClick={() => { updateStudentProfile({ welcome: 'skipped' }); onClose() }}>跳过</button>
            : <button type="button" className="student-text-button" onClick={onClose}>返回</button>}
          <button type="submit" className="button button-light" disabled={processing || (!profileOnly && !result)}>{profileOnly ? '保存资料' : '设为我的路线'} <ArrowRight size={16} /></button>
        </div>
      </form>}
    </div>
  </dialog>
}
