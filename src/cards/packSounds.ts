/**
 * Small synthesized cues for the pack ritual. Every cue is a few nodes that
 * disconnect themselves, stays well below the tear noise and is skipped
 * when the shared context is not running (sound off or no user gesture yet).
 */
type Cue = { ctx: AudioContext; at: number }

function noiseBuffer(ctx: AudioContext, seconds: number) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

function envelope(ctx: AudioContext, start: number, peak: number, attack: number, release: number) {
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + attack)
  gain.gain.exponentialRampToValueAtTime(.0001, start + attack + release)
  return gain
}

function tone({ ctx, at }: Cue, pitch: number, volume: number, release: number, type: OscillatorType = 'sine', bend = 1) {
  const osc = ctx.createOscillator()
  const gain = envelope(ctx, at, volume, .012, release)
  osc.type = type
  osc.frequency.setValueAtTime(pitch, at)
  if (bend !== 1) osc.frequency.exponentialRampToValueAtTime(pitch * bend, at + release)
  osc.connect(gain).connect(ctx.destination)
  osc.onended = () => { osc.disconnect(); gain.disconnect() }
  osc.start(at)
  osc.stop(at + release + .04)
}

function air({ ctx, at }: Cue, from: number, to: number, volume: number, length: number, q = .9) {
  const source = ctx.createBufferSource()
  const band = ctx.createBiquadFilter()
  const gain = envelope(ctx, at, volume, length * .35, length * .65)
  source.buffer = noiseBuffer(ctx, length + .05)
  band.type = 'bandpass'
  band.Q.value = q
  band.frequency.setValueAtTime(from, at)
  band.frequency.exponentialRampToValueAtTime(to, at + length)
  source.connect(band).connect(gain).connect(ctx.destination)
  source.onended = () => { source.disconnect(); band.disconnect(); gain.disconnect() }
  source.start(at)
  source.stop(at + length + .05)
}

function cue(ctx: AudioContext | null | undefined, delay = 0): Cue | undefined {
  if (!ctx || ctx.state !== 'running') return
  return { ctx, at: ctx.currentTime + delay }
}

export const packSounds = {
  /** The perforation gives way: a dry snap with a short paper body. */
  notch(ctx?: AudioContext | null) {
    const c = cue(ctx)
    if (!c) return
    air(c, 5200, 2600, .05, .045, 1.6)
    tone(c, 190, .028, .07, 'triangle', .6)
  },
  /** Pressure release as the capsule opens, then one soft card landing per slot. */
  deal(ctx: AudioContext | null | undefined, landings: number[]) {
    const c = cue(ctx)
    if (!c) return
    air(c, 420, 3200, .05, .5, .7)
    tone(c, 92, .035, .5, 'sine', .7)
    landings.forEach((delay, i) => {
      const land = cue(ctx, delay)
      if (!land) return
      air(land, 2400 - i * 120, 900, .03, .09, 1.2)
      tone(land, 523.25 * 2 ** ([0, 4, 7, 9, 12][i % 5] / 12), .009, .32)
    })
  },
  /** Lifting one card out of the spread. */
  lift(ctx?: AudioContext | null) {
    const c = cue(ctx)
    if (!c) return
    air(c, 900, 3800, .024, .2, .8)
  },
  /** A stiff card cutting the air as it turns over. */
  flip(ctx?: AudioContext | null) {
    const c = cue(ctx)
    if (!c) return
    air(c, 1500, 5200, .03, .16, 1.1)
    const tap = cue(ctx, .2)
    if (tap) tone(tap, 330, .012, .09, 'triangle', .8)
  },
  /** Gold arrival: low swell, a bright major chord and a shimmer tail. */
  gold(ctx?: AudioContext | null) {
    const c = cue(ctx)
    if (!c) return
    tone(c, 98, .04, .9, 'sine', 1.5)
    air(c, 300, 6000, .03, .7, .5)
    for (const [pitch, delay, volume] of [[784, .08, .03], [987.77, .14, .02], [1174.66, .2, .018], [1567.98, .28, .013]]) {
      const note = cue(ctx, delay)
      if (note) tone(note, pitch, volume, .8)
    }
    for (let i = 0; i < 7; i++) {
      const sparkle = cue(ctx, .34 + i * .055)
      if (sparkle) tone(sparkle, 2093 * 2 ** ((i * 5 % 12) / 12), .005, .22)
    }
  },
}
