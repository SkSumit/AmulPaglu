import { useEffect, useRef, useState } from 'react'

/**
 * Animated count-up number component.
 * Eases from 0 to `to` over `duration` ms using a cubic ease-out curve.
 */
export function CountUp({ to, duration = 1200 }: { to: number; duration?: number }) {
  const [val, setVal] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (started.current || to === 0) return
    started.current = true
    const start = performance.now()
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setVal(Math.round(eased * to))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [to, duration])

  return <>{val}</>
}
