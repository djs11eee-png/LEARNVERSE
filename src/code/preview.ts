const elements = new Set(`a abbr address article aside b bdi bdo blockquote br button caption cite code col colgroup data datalist dd del details dfn div dl dt em fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr i img input ins kbd label legend li main mark meter nav ol optgroup option output p pre progress q rp rt ruby s samp section select small span strong style sub summary sup table tbody td textarea th thead tfoot time tr u ul var wbr`.split(' '))
const attributes = new Set(`abbr alt checked class cols colspan datetime dir disabled for height id label lang list max maxlength method min minlength multiple name open pattern placeholder readonly required reversed role rows rowspan scope selected size span start step style title translate type value width`.split(' '))

function displayMetadata(element: Element) {
  return element.localName === 'title' || (element.localName === 'meta' && (
    element.hasAttribute('charset') || element.getAttribute('name')?.toLowerCase() === 'viewport'
  ) && !element.hasAttribute('http-equiv'))
}

export function makeHtmlPreview(code: string) {
  // A template is inert while we inspect it, so pasting markup cannot load anything.
  const template = document.createElement('template')
  template.innerHTML = code

  let sanitized = false
  for (const element of template.content.querySelectorAll('*')) {
    if (element.namespaceURI !== 'http://www.w3.org/1999/xhtml') {
      element.remove()
      sanitized = true
      continue
    }

    if (!elements.has(element.localName)) {
      element.remove()
      if (!displayMetadata(element)) sanitized = true
      continue
    }

    for (const attr of [...element.attributes]) {
      if (element.localName === 'input' && attr.name === 'type' && /^(file|image)$/i.test(attr.value)) {
        element.setAttribute('type', 'text')
        sanitized = true
        continue
      }
      if (attributes.has(attr.name) || attr.name.startsWith('aria-')) continue
      if (element.localName === 'a' && attr.name === 'href' && /^#[^\r\n]*$/.test(attr.value)) {
        // Relative anchors in srcdoc would otherwise resolve against the app's URL.
        element.setAttribute('href', `about:srcdoc${attr.value}`)
        continue
      }
      if (element.localName === 'img' && attr.name === 'src' && /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[\da-z+/=]+$/i.test(attr.value)) continue
      element.removeAttribute(attr.name)
      sanitized = true
    }
  }

  return {
    sanitized,
    preview: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'"><meta name="viewport" content="width=device-width, initial-scale=1"><title>HTML 预览</title></head><body>${template.innerHTML}</body></html>`,
  }
}
