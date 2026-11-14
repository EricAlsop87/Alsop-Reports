/**
 * Play a subtle, pleasant notification chime using Web Audio API.
 * Uses two harmonious sine tones (D5 = 587.33Hz, A5 = 880Hz) with smooth decay.
 * Does not require external audio files or network requests.
 * 
 * Includes an audio context singleton and user-interaction unlock
 * to comply with modern browser autoplay policies.
 */

let sharedAudioContext: AudioContext | null = null
let hasUnlocked = false

/**
 * Lazily get or create a shared AudioContext singleton.
 * Reusing a single AudioContext avoids Chrome's 6-context hardware limit.
 */
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext

    if (!AudioContextClass) return null

    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      sharedAudioContext = new AudioContextClass()
    }
    return sharedAudioContext
  } catch (err) {
    console.warn('[sound] Failed to initialize AudioContext:', err)
    return null
  }
}

/**
 * Initialize user-interaction listeners to unlock audio playback.
 * Browsers require a user gesture (click, tap, key) before unmuting AudioContext.
 */
export function initAudioUnlock(): void {
  if (typeof window === 'undefined' || hasUnlocked) return

  const unlock = () => {
    try {
      const ctx = getAudioContext()
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().then(() => {
          hasUnlocked = true
        }).catch(() => {})
      } else if (ctx && ctx.state === 'running') {
        hasUnlocked = true
      }
    } catch {}

    window.removeEventListener('click', unlock, true)
    window.removeEventListener('keydown', unlock, true)
    window.removeEventListener('touchstart', unlock, true)
  }

  window.addEventListener('click', unlock, true)
  window.addEventListener('keydown', unlock, true)
  window.addEventListener('touchstart', unlock, true)
}

// Auto-attach unlock listeners when module loads in browser
if (typeof window !== 'undefined') {
  initAudioUnlock()
}

/**
 * Play the notification chime.
 */
export function playNotificationSound(): void {
  if (typeof window === 'undefined') return

  try {
    const ctx = getAudioContext()
    if (!ctx) return

    // If suspended, try to resume
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

    const now = ctx.currentTime

    // Tone 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(587.33, now)
    gain1.gain.setValueAtTime(0.15, now)
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.35)

    // Tone 2: 880 Hz (A5) slightly delayed
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(880, now + 0.08)
    gain2.gain.setValueAtTime(0.18, now + 0.08)
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.45)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.08)
    osc2.stop(now + 0.45)
  } catch (err) {
    console.warn('[sound] Could not play notification sound:', err)
  }
}
