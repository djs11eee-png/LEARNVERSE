import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Group, IcosahedronGeometry, LineBasicMaterial,
  LineLoop, Mesh, MeshBasicMaterial, PerspectiveCamera, Points, Scene, ShaderMaterial, Vector3, WebGLRenderer,
} from 'three'

const turn = 2 * Math.PI
const radialBands = [1.03, 1.37, 1.75, 2.04]

export function mountSpaceScene(container: HTMLElement, kind: 'intro' | 'hero') {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power' })
  if (!context) return
  const intro = kind === 'intro'
  const heroSection = intro ? null : container.closest('section')
  const renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true })
  const scene = new Scene()
  const system = new Group()
  scene.add(system)
  const camera = new PerspectiveCamera(intro ? 40 : 36, 1, 0.1, 50)
  const shellGeometry = new IcosahedronGeometry(intro ? .78 : .28, intro ? 2 : 1)
  const shellMaterial = new MeshBasicMaterial({
    color: intro ? 0xcfe5f9 : 0xdaedc1,
    transparent: true,
    opacity: intro ? .36 : .16,
    wireframe: true,
  })
  const shell = new Mesh(shellGeometry, shellMaterial)
  system.add(shell)

  const orbitMaterial = new LineBasicMaterial({
    color: intro ? 0x9cbde5 : 0xbad5a8,
    transparent: true,
    opacity: intro ? .27 : .11,
  })
  const ringGeometries: BufferGeometry[] = []
  const dots = new Float32Array(radialBands.length * 2 * 3)
  const rings = radialBands.map((radius, index) => {
    const inclination = intro ? .53 + index * .28 : .24 + index * .15
    const points = Array.from({ length: 96 }, (_, step) => {
      const angle = turn * step / 96
      return new Vector3(radius * Math.cos(angle), radius * Math.sin(angle) * Math.cos(inclination), radius * Math.sin(angle) * Math.sin(inclination))
    })
    const geometry = new BufferGeometry().setFromPoints(points)
    ringGeometries.push(geometry)
    system.add(new LineLoop(geometry, orbitMaterial))
    return { radius, inclination }
  })
  const dotsGeometry = new BufferGeometry()
  const dotPositions = new BufferAttribute(dots, 3)
  dotsGeometry.setAttribute('position', dotPositions)
  const glow = new ShaderMaterial({
    uniforms: { size: { value: 10 }, strength: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: `
      uniform float size;
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size;
      }
    `,
    fragmentShader: `
      uniform float strength;
      void main() {
        float radius = length(gl_PointCoord - 0.5);
        float halo = exp(-radius * 13.0) * 0.75;
        float core = 1.0 - smoothstep(0.07, 0.15, radius);
        gl_FragColor = vec4(vec3(0.83, 0.95, 0.78), (halo + core * 0.72) * strength);
      }
    `,
  })
  const movingDots = new Points(dotsGeometry, glow)
  movingDots.frustumCulled = false
  system.add(movingDots)

  let starGeometry: BufferGeometry | undefined
  let starMaterial: ShaderMaterial | undefined
  if (intro) {
    const stars = new Float32Array(260 * 3)
    for (let i = 0; i < stars.length; i++) {
      const sample = Math.sin((i + 23) * 78.233) * 43758.5453
      stars[i] = (sample - Math.floor(sample) - .5) * (i % 3 === 2 ? 16 : 22)
    }
    starGeometry = new BufferGeometry()
    starGeometry.setAttribute('position', new BufferAttribute(stars, 3))
    starMaterial = glow.clone()
    starMaterial.uniforms.size.value = 5
    starMaterial.uniforms.strength.value = .58
    scene.add(new Points(starGeometry, starMaterial))
  }

  const allowRatio = Math.min(window.devicePixelRatio, 1.5)
  renderer.setPixelRatio(allowRatio)
  glow.uniforms.size.value *= allowRatio
  canvas.setAttribute('aria-hidden', 'true')
  container.append(canvas)
  const resize = new ResizeObserver(() => {
    const width = container.clientWidth
    const height = container.clientHeight
    if (!width || !height) return
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
    resume()
  })
  let inView = true
  let frame = 0
  let lost = false
  let renderedAt = -Infinity
  let pointer = 0
  let lean = 0
  const origin = performance.now()
  const duration = intro ? 4900 : 1350

  function tick(now: number) {
    frame = 0
    if (lost || !inView || document.hidden) return
    const elapsed = now - origin
    const settling = Math.abs(pointer - lean) > .002
    const entering = elapsed < duration
    if (now - renderedAt >= 30 || (!entering && !settling)) {
      const t = Math.min(elapsed, duration) / 1000
      renderedAt = now
      camera.position.z = intro ? Math.max(5.45, 10.9 - t * 1.26) : 6.1
      lean = settling ? lean + (pointer - lean) * .24 : pointer
      system.rotation.z = intro ? -.65 + t * .09 : -.47 + Math.sin(t * .34) * .13
      system.rotation.y = Math.sin(t * .48) * (intro ? .35 : .22) + lean
      shell.rotation.y = t * .35
      shell.rotation.x = t * .18
      if (intro) {
        system.scale.setScalar(Math.min(1, .36 + t * .31))
        shellMaterial.opacity = Math.max(.03, .36 - Math.max(0, t - 2.2) * .15)
      }
      for (const [index, { radius, inclination }] of rings.entries()) {
        for (let point = 0; point < 2; point++) {
          const angle = turn * point / 2 + index * 2.1 + t * (.39 - index * .035)
          const offset = (index * 2 + point) * 3
          dots[offset] = radius * Math.cos(angle)
          dots[offset + 1] = radius * Math.sin(angle) * Math.cos(inclination)
          dots[offset + 2] = radius * Math.sin(angle) * Math.sin(inclination)
        }
      }
      dotPositions.needsUpdate = true
      renderer.render(scene, camera)
    }
    if (entering || settling) resume()
  }

  const visibility = new IntersectionObserver(([entry]) => {
    inView = Boolean(entry?.isIntersecting)
    resume()
  })
  function resume() {
    if (!lost && inView && !document.hidden && !frame) frame = requestAnimationFrame(tick)
  }
  function onContextLost() {
    lost = true
    canvas.hidden = true
    cancelAnimationFrame(frame)
  }
  function onPointerMove(event: PointerEvent) {
    if (event.pointerType !== 'mouse' || !heroSection) return
    const { left, width } = heroSection.getBoundingClientRect()
    pointer = ((event.clientX - left) / width - .5) * .28
    resume()
  }
  function onPointerLeave() {
    pointer = 0
    resume()
  }

  resize.observe(container)
  visibility.observe(container)
  document.addEventListener('visibilitychange', resume)
  canvas.addEventListener('webglcontextlost', onContextLost)
  heroSection?.addEventListener('pointermove', onPointerMove, { passive: true })
  heroSection?.addEventListener('pointerleave', onPointerLeave)
  resume()

  return () => {
    cancelAnimationFrame(frame)
    visibility.disconnect()
    resize.disconnect()
    document.removeEventListener('visibilitychange', resume)
    canvas.removeEventListener('webglcontextlost', onContextLost)
    heroSection?.removeEventListener('pointermove', onPointerMove)
    heroSection?.removeEventListener('pointerleave', onPointerLeave)
    shellGeometry.dispose()
    shellMaterial.dispose()
    for (const geometry of ringGeometries) geometry.dispose()
    orbitMaterial.dispose()
    dotsGeometry.dispose()
    glow.dispose()
    starGeometry?.dispose()
    starMaterial?.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    canvas.remove()
  }
}
