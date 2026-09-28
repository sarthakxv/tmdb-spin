type Spin = { get: () => number }

let context: AudioContext | null = null
let noise: AudioBuffer | null = null
let active: { stop: () => void } | null = null

function getContext() {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") return null
  if (!context) context = new AudioContext()
  if (context.state === "suspended") void context.resume()
  if (!noise) noise = makeNoise(context)
  return context
}

function makeNoise(ctx: AudioContext) {
  const length = ctx.sampleRate * 2
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let brown = 0
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1
    brown = (brown + 0.02 * white) / 1.02
    data[i] = Math.max(-1, Math.min(1, brown * 3.4))
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
  const buffer = noise
  if (!buffer) return
  const t = ctx.currentTime
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = "bandpass"
  filter.frequency.value = pitch
  filter.Q.value = body ? 0.6 : 1.4
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(Math.max(intensity, 0.0001), t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + decay)
  source.connect(filter)
  filter.connect(gain)
  gain.connect(destination)
  source.start(t)
  source.stop(t + decay + 0.03)

  if (!body) return
  const thump = ctx.createOscillator()
  thump.type = "sine"
  thump.frequency.setValueAtTime(Math.max(70, pitch * 0.12), t)
  thump.frequency.exponentialRampToValueAtTime(42, t + decay)
  const thumpGain = ctx.createGain()
  thumpGain.gain.setValueAtTime(Math.max(intensity * 0.7, 0.0001), t)
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, t + decay * 1.8)
  thump.connect(thumpGain)
  thumpGain.connect(destination)
  thump.start(t)
  thump.stop(t + decay * 1.8 + 0.02)
}

export function latchReel() {
  const ctx = getContext()
  if (!ctx || !noise) return
  clack(ctx, ctx.destination, 0.16, 920, 0.07, true)
}

export function followReel(rotation: Spin, count: number) {
  const ctx = getContext()
  if (!ctx || !noise || count < 2) return () => {}
  active?.stop()

  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, ctx.currentTime)
  master.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 0.08)
  master.connect(ctx.destination)

  const motor = ctx.createBufferSource()
  motor.buffer = noise
  motor.loop = true
  const lowpass = ctx.createBiquadFilter()
  lowpass.type = "lowpass"
  lowpass.frequency.value = 240
  const motorGain = ctx.createGain()
  motorGain.gain.value = 0.03
  motor.connect(lowpass)
  lowpass.connect(motorGain)
  motorGain.connect(master)
  motor.start()

  const hiss = ctx.createBufferSource()
  hiss.buffer = noise
  hiss.loop = true
  const highpass = ctx.createBiquadFilter()
  highpass.type = "highpass"
  highpass.frequency.value = 1800
  const hissGain = ctx.createGain()
  hissGain.gain.value = 0.0001
  hiss.connect(highpass)
  highpass.connect(hissGain)
  hissGain.connect(master)
  hiss.start()

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
    motorGain.gain.setTargetAtTime(0.018 + speed * 0.05, now, 0.05)
    lowpass.frequency.setTargetAtTime(160 + speed * 380, now, 0.06)
    motor.playbackRate.setTargetAtTime(0.7 + speed * 0.8, now, 0.08)
    hissGain.gain.setTargetAtTime(0.004 + speed * 0.028, now, 0.05)
    carried += delta
    const minGap = speed > 0.72 ? 0.03 : speed > 0.38 ? 0.048 : 0.02
    if (carried >= step && now - lastTick >= minGap) {
      carried %= step
      lastTick = now
      const heavy = 1 - speed
      clack(ctx, master, 0.03 + heavy * 0.07, 480 + speed * 1400, 0.024 + heavy * 0.05, speed < 0.45)
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
    hiss.stop(now + 0.28)
    if (performance.now() - started > 240) clack(ctx, ctx.destination, 0.11, 160, 0.16, true)
    if (active?.stop === stop) active = null
  }
  active = { stop }
  return stop
}
