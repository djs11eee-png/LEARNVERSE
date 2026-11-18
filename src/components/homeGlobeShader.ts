const vertex = `#version 300 es
out vec2 disk;
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0;
  disk = vec2(corner.x, -corner.y);
  gl_Position = vec4(corner, 0.0, 1.0);
}`

// Inverse orthographic projection of the rotating equirectangular atlas.
const fragment = `#version 300 es
precision highp float;
in vec2 disk;
uniform sampler2D atlas;
uniform float longitude;
out vec4 color;
void main() {
  float radius = length(disk);
  float coverage = 1.0 - smoothstep(1.0 - fwidth(radius), 1.0, radius);
  if (coverage <= 0.0) { color = vec4(0.0); return; }
  float z = sqrt(max(0.0, 1.0 - dot(disk, disk)));
  float x = disk.x * cos(0.15) - disk.y * sin(0.15);
  float y = -disk.x * sin(0.15) - disk.y * cos(0.15);
  float latitude = radians(24.0);
  float lat = asin(clamp(y * cos(latitude) + z * sin(latitude), -1.0, 1.0));
  float lon = atan(x, z * cos(latitude) - y * sin(latitude)) + longitude;
  vec2 uv = vec2(0.5 + lon / 6.28318530718, 0.5 - lat / 3.14159265359);
  float light = 0.047 + 0.97 * pow(max(0.0, dot(vec3(disk,z), vec3(-0.79,-0.47,0.35))), 0.79);
  float rim = pow(1.0 - z, 4.7) * (0.1 + 0.9 * max(0.0, dot(disk, vec2(-0.82,-0.49))));
  color = vec4(texture(atlas, uv).rgb * light + rim * vec3(121.0,177.0,207.0) / 255.0, coverage);
}`

export function createGlobeShader(canvas: HTMLCanvasElement, atlas: HTMLImageElement, size: number) {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, premultipliedAlpha: false, powerPreference: 'low-power' })
  if (!gl) return
  const program = gl.createProgram()
  const texture = gl.createTexture()
  function dispose() {
    gl!.deleteTexture(texture)
    gl!.deleteProgram(program)
    gl!.getExtension('WEBGL_lose_context')?.loseContext()
  }
  if (!program || !texture) { dispose(); return }
  for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
    const shader = gl.createShader(type)
    if (!shader) { dispose(); return }
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    gl.attachShader(program, shader)
    gl.deleteShader(shader)
  }
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { dispose(); return }
  canvas.width = canvas.height = size
  gl.viewport(0, 0, size, size)
  gl.useProgram(program)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, atlas)
  gl.generateMipmap(gl.TEXTURE_2D)
  const longitude = gl.getUniformLocation(program, 'longitude')
  return {
    draw(degrees: number) {
      gl.uniform1f(longitude, degrees * Math.PI / 180)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    dispose,
  }
}
