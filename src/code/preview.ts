const elements = new Set(`a abbr address article aside b bdi bdo blockquote br button caption cite code col colgroup data datalist dd del details dfn div dl dt em fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr i img input ins kbd label legend li main mark meter nav ol optgroup option output p pre progress q rp rt ruby s samp section select small span strong style sub summary sup table tbody td textarea th thead tfoot time tr u ul var wbr`.split(' '))
const attributes = new Set(`abbr alt checked class cols colspan datetime dir disabled for height hidden id label lang list max maxlength method min minlength multiple name open pattern placeholder readonly required reversed role rows rowspan scope selected size span start step style tabindex title translate type value width`.split(' '))
const inlineImage = /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[\da-z+/=]+$/i
const safeDataAttribute = /^data-[a-z][a-z0-9-]*$/
const allowedScriptTypes = new Set(['', 'text/javascript', 'application/javascript'])
const maxInlineImages = 8
const maxInlineImageCharacters = 96_000

export interface HtmlPreviewOptions {
  interactive?: boolean
  token?: string
}

export interface HtmlPreviewResult {
  sanitized: boolean
  preview: string
  interactive: boolean
  hasInlineScript: boolean
}

function displayMetadata(element: Element) {
  return element.localName === 'title' || (element.localName === 'meta' && (
    element.hasAttribute('charset') || element.getAttribute('name')?.toLowerCase() === 'viewport'
  ) && !element.hasAttribute('http-equiv'))
}

function isAllowedInlineScript(element: Element) {
  if (element.localName !== 'script') return false
  if (element.hasAttribute('src')) return false
  const scriptType = (element.getAttribute('type') ?? '').trim().toLowerCase()
  return allowedScriptTypes.has(scriptType)
}

function sanitizeStyleText(css: string) {
  let cleaned = css
  const hadImport = /@import\b/i.test(cleaned)
  const hadExternalUrl = /url\s*\(\s*['"]?\s*(?:https?:|\/\/)/i.test(cleaned)
  if (hadImport) cleaned = cleaned.replace(/@import\b[^;]*;?/gi, '')
  if (hadExternalUrl) cleaned = cleaned.replace(/url\s*\(\s*['"]?\s*(?:https?:|\/\/)[^)]*\)/gi, 'none')
  return { css: cleaned, changed: hadImport || hadExternalUrl }
}

function buildSandboxGuard(token: string) {
  return `<script>(()=>{const token=${JSON.stringify(token)};let count=0;const post=(level,args)=>{if(!token||!window.parent||window.parent===window||count>=40)return;count++;try{const text=args.map((v)=>{if(typeof v==='string')return v;try{return JSON.stringify(v);}catch{return String(v);}}).join(' ').slice(0,600);window.parent.postMessage({kind:'learnverse-preview-log',token,level,text},'*');}catch{}};for(const lv of ['log','info','warn','error']){const orig=console[lv];console[lv]=(...args)=>{post(lv==='info'?'log':lv,args);if(typeof orig==='function')orig.apply(console,args);};}window.addEventListener('error',(e)=>{post('error',[e.message||'页面脚本执行出错']);});window.addEventListener('unhandledrejection',(e)=>{post('error',[String(e.reason||'未处理的异步错误')]);});const block=(name)=>()=>{throw new Error(name+' 在受控预览沙箱中不可用。');};for(const k of ['fetch','XMLHttpRequest','WebSocket','EventSource','open','alert','confirm','prompt','print']){try{Object.defineProperty(window,k,{value:block(k),configurable:false,writable:false});}catch{}}if(navigator&&'sendBeacon' in navigator){try{Object.defineProperty(navigator,'sendBeacon',{value:()=>false,configurable:false});}catch{}}document.addEventListener('submit',(e)=>{if(!e.defaultPrevented)e.preventDefault();});})();</script>`
}

export function hasInlineScript(code: string) {
  return /<script(?:\s+[^>]*)?>[\s\S]*?<\/script>/i.test(code)
}

export function makeHtmlPreview(code: string, options: HtmlPreviewOptions = {}): HtmlPreviewResult {
  const interactive = Boolean(options.interactive)
  // A template is inert while we inspect it, so pasting markup cannot load anything.
  const template = document.createElement('template')
  template.innerHTML = code

  let sanitized = false
  let imageCount = 0
  let imageCharacters = 0
  let keptInlineScript = false

  for (const element of template.content.querySelectorAll('*')) {
    if (!template.content.contains(element)) continue
    if (element.namespaceURI !== 'http://www.w3.org/1999/xhtml') {
      element.remove()
      sanitized = true
      continue
    }

    if (element.localName === 'script') {
      if (interactive && isAllowedInlineScript(element)) {
        for (const attr of [...element.attributes]) {
          element.removeAttribute(attr.name)
          if (attr.name !== 'type') sanitized = true
        }
        keptInlineScript = true
        continue
      }
      element.remove()
      sanitized = true
      continue
    }

    if (!elements.has(element.localName)) {
      element.remove()
      if (!displayMetadata(element)) sanitized = true
      continue
    }

    if (element.localName === 'style' && element.textContent) {
      const cleaned = sanitizeStyleText(element.textContent)
      if (cleaned.changed) {
        element.textContent = cleaned.css
        sanitized = true
      }
    }

    let inlineSource = false
    for (const attr of [...element.attributes]) {
      if (element.localName === 'input' && attr.name === 'type' && /^(file|image)$/i.test(attr.value)) {
        element.setAttribute('type', 'text')
        sanitized = true
        continue
      }
      if (attributes.has(attr.name) || attr.name.startsWith('aria-') || safeDataAttribute.test(attr.name)) continue
      if (element.localName === 'a' && attr.name === 'href' && /^#[^\r\n]*$/.test(attr.value)) {
        // Relative anchors in srcdoc would otherwise resolve against the app's URL.
        element.setAttribute('href', `about:srcdoc${attr.value}`)
        continue
      }
      if (element.localName === 'img' && attr.name === 'src' && imageCount < maxInlineImages
        && imageCharacters + attr.value.length <= maxInlineImageCharacters && inlineImage.test(attr.value)) {
        imageCount++
        imageCharacters += attr.value.length
        inlineSource = true
        continue
      }
      element.removeAttribute(attr.name)
      sanitized = true
    }
    if (inlineSource) element.setAttribute('decoding', 'async')
  }

  const csp = interactive
    ? "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; frame-src 'none'; media-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'"
    : "default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'"
  const guard = interactive ? buildSandboxGuard(options.token ?? '') : ''

  return {
    sanitized,
    interactive,
    hasInlineScript: keptInlineScript,
    preview: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="viewport" content="width=device-width, initial-scale=1"><title>HTML 预览</title>${guard}</head><body>${template.innerHTML}</body></html>`,
  }
}
