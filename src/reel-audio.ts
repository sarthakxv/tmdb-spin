type Spin = { get: () => number }

let context: AudioContext | null = null
let brown: AudioBuffer | null = null
let white: AudioBuffer | null = null
let active: { stop: () => void } | null = null
let muted = false

export function setMuted(value: boolean) {
  muted = value
  if (value) active?.stop()
}

export function isMuted() {
  return muted
}

/** Max pawl clicks per second — the old 30+/sec rate is what smeared into white noise. */
const MAX_TICK_RATE = 14
const MIN_GAP = 1 / MAX_TICK_RATE

function getContext() {
  if (muted || typeof window === "undefined" || typeof AudioContext === "undefined") return null
  if (!context) context = new AudioContext()
  if (context.state === "suspended") void context.resume()
  if (!brown) brown = makeBrown(context)
  if (!white) white = makeWhite(context)
  return context
}

function makeBrown(ctx: AudioContext) {
  const length = ctx.sampleRate * 2
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < length; i++) {
    const sample = Math.random() * 2 - 1
    last = (last + 0.02 * sample) / 1.02
    data[i] = Math.max(-1, Math.min(1, last * 3.4))
  }
  return buffer
}

function makeWhite(ctx: AudioContext) {
  const length = ctx.sampleRate * 1
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

function clack(
  ctx: AudioContext,
  destination: AudioNode,
  intensity: number,
  pitch: number,
  decay: number,
  body: boolean,
) {
  if (!white) return
  const t = ctx.currentTime

  // Pawl snap: short bright transient, like a ratchet tooth slipping past.
  const snapSource = ctx.createBufferSource()
  snapSource.buffer = white
  snapSource.playbackRate.value = 0.9 + Math.random() * 0.25
  const snapFilter = ctx.createBiquadFilter()
  snapFilter.type = "highpass"
  snapFilter.frequency.value = 2400 + Math.random() * 900
  const snapGain = ctx.createGain()
  const snapDecay = 0.016 + Math.random() * 0.006
  snapGain.gain.setValueAtTime(Math.max(intensity * 0.55, 0.0001), t)
  snapGain.gain.exponentialRampToValueAtTime(0.0001, t + snapDecay)
  snapSource.connect(snapFilter)
  snapFilter.connect(snapGain)
  snapGain.connect(destination)
  snapSource.start(t)
  snapSource.stop(t + snapDecay + 0.03)

  // Wooden knock: the body of the click, band-passed burst.
  const knockSource = ctx.createBufferSource()
  knockSource.buffer = white
  knockSource.playbackRate.value = 0.85 + Math.random() * 0.3
  const knockFilter = ctx.createBiquadFilter()
  knockFilter.type = "bandpass"
  knockFilter.frequency.value = pitch
  knockFilter.Q.value = body ? 1.1 : 1.6
  const knockGain = ctx.createGain()
  knockGain.gain.setValueAtTime(Math.max(intensity, 0.0001), t)
  knockGain.gain.exponentialRampToValueAtTime(0.0001, t + decay)
  knockSource.connect(knockFilter)
  knockFilter.connect(knockGain)
  knockGain.connect(destination)
  knockSource.start(t)
  knockSource.stop(t + decay + 0.03)

  if (!body) return
  // Low thud for weight on the slower tail clicks.
  const thump = ctx.createOscillator()
  thump.type = "sine"
  thump.frequency.setValueAtTime(105 + Math.random() * 15, t)
  thump.frequency.exponentialRampToValueAtTime(52, t + decay)
  const thumpGain = ctx.createGain()
  thumpGain.gain.setValueAtTime(Math.max(intensity * 0.55, 0.0001), t)
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, t + decay * 1.6)
  thump.connect(thumpGain)
  thumpGain.connect(destination)
  thump.start(t)
  thump.stop(t + decay * 1.6 + 0.02)
}

export function primeReel() {
  getContext()
}

export function missReel() {
  const ctx = getContext()
  if (!ctx) return
  const t = ctx.currentTime
  const tone = (when: number, from: number, to: number, level: number, duration: number) => {
    const osc = ctx.createOscillator()
    osc.type = "triangle"
    osc.frequency.setValueAtTime(from, when)
    osc.frequency.exponentialRampToValueAtTime(to, when + duration)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(level, when)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(when)
    osc.stop(when + duration + 0.02)
  }
  tone(t, 196, 110, 0.08, 0.16)
  tone(t + 0.18, 146, 82, 0.07, 0.22)
}

export function latchReel() {
  const ctx = getContext()
  if (!ctx || !white) return
  clack(ctx, ctx.destination, 0.16, 340, 0.09, true)
}

export function followReel(rotation: Spin, count: number) {
  const ctx = getContext()
  if (!ctx || !brown || !white || count < 2) return () => {}
  active?.stop()

  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, ctx.currentTime)
  master.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 0.08)
  master.connect(ctx.destination)

  // Quiet low rumble only — the old broadband hiss is what turned fast spins to noise.
  const motor = ctx.createBufferSource()
  motor.buffer = brown
  motor.loop = true
  const lowpass = ctx.createBiquadFilter()
  lowpass.type = "lowpass"
  lowpass.frequency.value = 170
  const motorGain = ctx.createGain()
  motorGain.gain.value = 0.012
  motor.connect(lowpass)
  lowpass.connect(motorGain)
  motorGain.connect(master)
  motor.start()

  const air = ctx.createBufferSource()
  air.buffer = brown
  air.loop = true
  air.playbackRate.value = 1.6
  const airFilter = ctx.createBiquadFilter()
  airFilter.type = "highpass"
  airFilter.frequency.value = 4200
  const airGain = ctx.createGain()
  airGain.gain.value = 0.0001
  air.connect(airFilter)
  airFilter.connect(airGain)
  airGain.connect(master)
  air.start()

  const step = 360 / count
  let last = rotation.get()
  let carried = 0
  let lastTick = 0
  let frame = 0
  let stopped = false
  const started = performance.now()

  const track = () => {
    if (stopped) return
    const angle = rotation.get()
    const delta = Math.abs(angle - last)
    last = angle
    const speed = Math.min(1, delta / 8)
    const now = ctx.currentTime
    motorGain.gain.setTargetAtTime(0.01 + speed * 0.02, now, 0.06)
    lowpass.frequency.setTargetAtTime(140 + speed * 220, now, 0.08)
    motor.playbackRate.setTargetAtTime(0.6 + speed * 0.5, now, 0.09)
    airGain.gain.setTargetAtTime(0.0008 + speed * 0.003, now, 0.08)
    carried += delta
    // Time-throttled pawl: never faster than MAX_TICK_RATE, louder + woodier as it slows.
    if (carried >= step && now - lastTick >= MIN_GAP) {
      carried %= step
      lastTick = now
      const heavy = 1 - speed
      const jitter = (Math.random() - 0.5) * 70
      clack(
        ctx,
        master,
        0.05 + heavy * 0.09,
        300 + jitter + speed * 200,
        0.055 + heavy * 0.045,
        speed < 0.75,
      )
    } else if (carried >= step * 4) {
      // Spinning faster than the pawl can follow: drop queued cards instead of bursting.
      carried %= step
    }
    frame = requestAnimationFrame(track)
  }
  frame = requestAnimationFrame(track)

  const stop = () => {
    if (stopped) return
    stopped = true
    cancelAnimationFrame(frame)
    const now = ctx.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now)
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
    motor.stop(now + 0.28)
    air.stop(now + 0.28)
    if (performance.now() - started > 240) clack(ctx, ctx.destination, 0.11, 150, 0.16, true)
    if (active?.stop === stop) active = null
  }
  active = { stop }
  return stop
}
