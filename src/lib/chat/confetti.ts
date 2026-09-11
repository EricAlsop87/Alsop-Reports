'use client'

/**
 * Lightweight, zero-dependency canvas confetti effect for celebratory chat interactions.
 */
export function triggerConfetti(originX = 0.5, originY = 0.6) {
  if (typeof window === 'undefined') return

  const canvas = document.createElement('canvas')
  canvas.style.position = 'fixed'
  canvas.style.top = '0'
  canvas.style.left = '0'
  canvas.style.width = '100vw'
  canvas.style.height = '100vh'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '99999'
  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    document.body.removeChild(canvas)
    return
  }

  const dpr = window.devicePixelRatio || 1
  canvas.width = window.innerWidth * dpr
  canvas.height = window.innerHeight * dpr
  ctx.scale(dpr, dpr)

  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f43f5e']
  const particleCount = 65
  const particles: Array<{
    x: number
    y: number
    vx: number
    vy: number
    size: number
    color: string
    rotation: number
    vRotation: number
    alpha: number
  }> = []

  const startX = window.innerWidth * originX
  const startY = window.innerHeight * originY

  for (let i = 0; i < particleCount; i++) {
    const angle = (Math.random() * Math.PI * 2)
    const speed = 4 + Math.random() * 8
    particles.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      size: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      vRotation: (Math.random() - 0.5) * 12,
      alpha: 1,
    })
  }

  let animationFrame: number
  const startTime = performance.now()

  function render(time: number) {
    const elapsed = time - startTime
    ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight)

    let alive = false
    for (const p of particles) {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.25 // Gravity
      p.vx *= 0.98 // Air resistance
      p.rotation += p.vRotation
      p.alpha = Math.max(0, 1 - elapsed / 1800)

      if (p.alpha > 0.01) {
        alive = true
        ctx!.save()
        ctx!.translate(p.x, p.y)
        ctx!.rotate((p.rotation * Math.PI) / 180)
        ctx!.globalAlpha = p.alpha
        ctx!.fillStyle = p.color
        ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        ctx!.restore()
      }
    }

    if (alive && elapsed < 2000) {
      animationFrame = requestAnimationFrame(render)
    } else {
      cancelAnimationFrame(animationFrame)
      if (document.body.contains(canvas)) {
        document.body.removeChild(canvas)
      }
    }
  }

  animationFrame = requestAnimationFrame(render)
}
