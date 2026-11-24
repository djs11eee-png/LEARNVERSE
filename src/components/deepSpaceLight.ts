import { discWidth, singularity } from './deepSpacePhysics'
import type { SpaceView } from './deepSpacePhysics'

export const lightSources = { sky: '/art/atlas/deep-sky.webp', disk: '/art/atlas/accretion.webp' }
const skyAspect = 1672 / 941

export function skyFrame(v: SpaceView) {
  const width = Math.max(v.width * 1.24, v.height * skyAspect * 1.18) * (.94 + Math.sqrt(v.zoom) * .08)
  const height = width / skyAspect
  return {
    width,
    height,
    x: (v.width - width) * (.50 + .22 * Math.tanh((v.x - 2110) / 1450)),
    y: (v.height - height) * (.54 + .26 * Math.tanh((v.y - 1480) / 900)),
  }
}

const vertex = `attribute vec2 point;
void main(){ gl_Position = vec4(point,0.,1.); }`

const fragment = `precision highp float;
uniform vec2 viewport, raster, center;
uniform vec4 frame;
uniform float width, clock, flare;
uniform sampler2D sky, disk;
void main(){
  vec2 screen = vec2(gl_FragCoord.x/raster.x, 1.-gl_FragCoord.y/raster.y);
  vec2 p = screen * viewport;
  vec2 delta = p - center;
  float r = length(delta) / width;
  vec2 dir = delta / max(length(delta), .001);
  // Inverse thin-lens mapping stretches background starlight around the event horizon.
  float bend = min(.30, .017 / max(r, .025)) * exp(-r * 1.65);
  vec2 uv = (p - dir * bend * width - frame.xy) / frame.zw;
  vec3 rawSky = texture2D(sky, clamp(uv, .001, .999)).rgb;

  // Harmonize the deep sky with LEARNVERSE's obsidian slate-teal observatory palette.
  float luma = dot(rawSky, vec3(.299, .587, .114));
  vec3 cooled = mix(vec3(luma), rawSky, .68) * vec3(.86, .95, 1.04);
  vec2 vig = (screen - vec2(.5, .48)) * vec2(1.15, 1.05);
  float glow = exp(-dot(vig, vig) * 1.85);
  vec3 observatoryBase = mix(vec3(.024, .036, .056), vec3(.048, .082, .106), glow);
  vec3 color = observatoryBase + cooled * .88;

  // Subtle gravitational rim light around the uncharted singularity.
  float horizonRing = exp(-pow((r - .16) * 11., 2.)) * .11;
  color += vec3(.58, .76, .74) * horizonRing;

  vec2 local = delta / width;
  vec2 plate = local * vec2(1., 1.5) + vec2(.496, .518);
  if (plate.x > 0. && plate.x < 1. && plate.y > 0. && plate.y < 1.) {
    vec4 gas = texture2D(disk, plate);
    float az = atan(local.y, local.x);
    float stream = az * 3. + r * 28. - clock * (.66 + .12 / (.2 + r));
    vec2 tangent = vec2(-sin(az), cos(az) * .46);
    vec4 filament = texture2D(disk, clamp(plate + tangent * .004 * sin(stream), .001, .999));
    vec3 rawEmission = mix(gas.rgb, filament.rgb, .38) * (.94 + .05 * sin(stream) + flare * .28);
    // Soften raw orange saturation slightly toward warm observatory gold + cool outer feather.
    float emitLuma = dot(rawEmission, vec3(.299, .587, .114));
    vec3 emission = mix(vec3(emitLuma) * vec3(.98, .92, .84), rawEmission, .78);
    float edgeFade = smoothstep(.52, .22, length((plate - vec2(.5)) * vec2(1.02, 1.1)));
    color = mix(color, emission, gas.a * (.62 + .38 * edgeFade));
  }

  // Blend outer edges quietly into global --bg (#080c12).
  float vignette = smoothstep(1.08, .28, length(screen - vec2(.5)));
  color = mix(vec3(.027, .043, .067), color, .48 + .52 * vignette);
  gl_FragColor = vec4(color, 1.);
}`

/** This pass owns two source textures and one fullscreen triangle. Meteors and
 * foreground links stay on separate transparent planes and never distort. */
export function makeLightPass(canvas: HTMLCanvasElement, sky: HTMLImageElement, disk: HTMLImageElement) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' })
  if (!gl) return null
  const program = gl.createProgram()
  if (!program) return null
  const shaders: WebGLShader[] = []
  const textures: WebGLTexture[] = []
  const buffer = gl.createBuffer()
  function dispose() {
    textures.forEach(t => gl!.deleteTexture(t))
    shaders.forEach(s => gl!.deleteShader(s))
    gl!.deleteBuffer(buffer)
    gl!.deleteProgram(program)
  }
  for (const [kind, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
    const shader = gl.createShader(kind)
    if (!shader) { dispose(); return null }
    shaders.push(shader)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { dispose(); return null }
    gl.attachShader(program, shader)
  }
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { dispose(); return null }
  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'point')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
  for (const [unit, image] of [sky, disk].entries()) {
    const texture = gl.createTexture()
    if (!texture) { dispose(); return null }
    textures.push(texture)
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    gl.uniform1i(gl.getUniformLocation(program, unit ? 'disk' : 'sky'), unit)
  }
  const loc = (name: string) => gl.getUniformLocation(program, name)
  const viewport = loc('viewport'), raster = loc('raster'), center = loc('center'), frame = loc('frame')
  const width = loc('width'), clock = loc('clock'), flare = loc('flare')
  return { dispose, draw(v: SpaceView, time: number, intensity: number) {
    const f = skyFrame(v)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.uniform2f(viewport, v.width, v.height)
    gl.uniform2f(raster, canvas.width, canvas.height)
    gl.uniform2f(center, (singularity.x-v.x)*v.zoom+v.width/2, (singularity.y-v.y)*v.zoom+v.height/2)
    gl.uniform4f(frame, f.x, f.y, f.width, f.height)
    gl.uniform1f(width, discWidth*v.zoom)
    gl.uniform1f(clock, time)
    gl.uniform1f(flare, intensity)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  } }
}
