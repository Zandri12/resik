import { useRef, useEffect, useState, type CSSProperties, type ElementType } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText as GSAPSplitText } from 'gsap/SplitText'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, GSAPSplitText, useGSAP)

type SplitHost = HTMLElement & { _rbsplitInstance?: GSAPSplitText | null }

/** `end` is exclusive — indices refer to **SplitText `chars` array**, not string offsets (prefer `shinySubstring`). */
export type ShinyCharRange = { start: number; end: number }

/** Uses text rebuilt from split char nodes so indices match GSAP output (not always === `text` prop). */
function collectShinyElementsBySubstring(chars: Element[], substring: string): HTMLElement[] {
  if (!substring || !chars.length) return []
  const splitPlain = chars.map((c) => c.textContent ?? '').join('')
  const subStart = splitPlain.indexOf(substring)
  if (subStart < 0) return []
  const subEnd = subStart + substring.length
  const out: HTMLElement[] = []
  let pos = 0
  for (const node of chars) {
    const raw = node.textContent ?? ''
    const len = raw.length
    const nodeStart = pos
    const nodeEnd = pos + len
    if (nodeEnd > subStart && nodeStart < subEnd) {
      out.push(node as HTMLElement)
    }
    pos += len
  }
  return out
}

type SplitTextProps = {
  text: string
  className?: string
  delay?: number
  duration?: number
  ease?: string
  splitType?: string
  from?: gsap.TweenVars
  to?: gsap.TweenVars
  threshold?: number
  rootMargin?: string
  textAlign?: CSSProperties['textAlign']
  tag?: ElementType
  onLetterAnimationComplete?: () => void
  /** Map shine to this exact slice of `text` (aligned with split char nodes). Prefer over `shinyCharRange`. */
  shinySubstring?: string
  /** Per-character gradient + looping shine (matches ShinyText-style sweep). */
  shinyCharRange?: ShinyCharRange
  shinyColor?: string
  shinyShineColor?: string
  shinySpread?: number
  /** Seconds for one 0→100 shine pass (like ShinyText `speed`). */
  shinySpeed?: number
}

export default function SplitText({
  text,
  className = 'inline-block',
  delay = 50,
  duration = 1.25,
  ease = 'power3.out',
  splitType = 'chars',
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  threshold = 0.1,
  rootMargin = '-100px',
  textAlign = 'center',
  tag: Tag = 'p',
  onLetterAnimationComplete,
  shinySubstring,
  shinyCharRange,
  shinyColor = '#5579a3',
  shinyShineColor = '#ffffff',
  shinySpread = 95,
  shinySpeed = 2,
}: SplitTextProps) {
  const ref = useRef<HTMLElement | null>(null)
  const animationCompletedRef = useRef(false)
  const onCompleteRef = useRef(onLetterAnimationComplete)
  const [fontsLoaded, setFontsLoaded] = useState(false)

  useEffect(() => {
    onCompleteRef.current = onLetterAnimationComplete
  }, [onLetterAnimationComplete])

  useEffect(() => {
    if (document.fonts.status === 'loaded') {
      setFontsLoaded(true)
    } else {
      void document.fonts.ready.then(() => {
        setFontsLoaded(true)
      })
    }
  }, [])

  useGSAP(
    () => {
      if (!ref.current || !text || !fontsLoaded) return
      if (animationCompletedRef.current) return
      const el = ref.current as SplitHost

      if (el._rbsplitInstance) {
        try {
          el._rbsplitInstance.revert()
        } catch {
          /* ignore */
        }
        el._rbsplitInstance = null
      }

      const startPct = (1 - threshold) * 100
      const marginMatch = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(rootMargin)
      const marginValue = marginMatch ? parseFloat(marginMatch[1]) : 0
      const marginUnit = marginMatch ? marginMatch[2] || 'px' : 'px'
      const sign =
        marginValue === 0
          ? ''
          : marginValue < 0
            ? `-=${Math.abs(marginValue)}${marginUnit}`
            : `+=${marginValue}${marginUnit}`
      const start = `top ${startPct}%${sign}`

      let targets: Element[] | undefined
      const assignTargets = (self: GSAPSplitText) => {
        if (splitType.includes('chars') && self.chars.length) targets = self.chars
        if (!targets && splitType.includes('words') && self.words.length) targets = self.words
        if (!targets && splitType.includes('lines') && self.lines.length) targets = self.lines
        if (!targets) targets = self.chars || self.words || self.lines
      }

      let shineTween: gsap.core.Tween | null = null

      const splitInstance = new GSAPSplitText(el, {
        type: splitType,
        smartWrap: true,
        autoSplit: splitType === 'lines',
        linesClass: 'split-line',
        wordsClass: 'split-word',
        charsClass: 'split-char',
        reduceWhiteSpace: false,
        onSplit: (self) => {
          assignTargets(self)
          const t = targets ?? []
          const shinyEls: HTMLElement[] = []

          const paintShiny = (he: HTMLElement) => {
            shinyEls.push(he)
            he.style.backgroundImage = `linear-gradient(${shinySpread}deg, ${shinyColor} 0%, ${shinyColor} 35%, ${shinyShineColor} 50%, ${shinyColor} 65%, ${shinyColor} 100%)`
            he.style.backgroundSize = '200% auto'
            he.style.webkitBackgroundClip = 'text'
            he.style.backgroundClip = 'text'
            he.style.webkitTextFillColor = 'transparent'
            he.style.color = 'transparent'
            he.style.backgroundPosition = '150% center'
          }

          if (splitType.includes('chars') && self.chars.length) {
            if (shinySubstring) {
              for (const he of collectShinyElementsBySubstring(self.chars, shinySubstring)) {
                paintShiny(he)
              }
            } else if (shinyCharRange) {
              const { start: s0, end: s1 } = shinyCharRange
              self.chars.forEach((node, i) => {
                if (i < s0 || i >= s1) return
                paintShiny(node as HTMLElement)
              })
            }
          }

          if (shinyEls.length) {
            const proxy = { p: 0 }
            shineTween = gsap.to(proxy, {
              p: 100,
              duration: shinySpeed,
              ease: 'none',
              repeat: -1,
              onUpdate: () => {
                const pos = `${150 - proxy.p * 2}% center`
                for (const he of shinyEls) {
                  he.style.backgroundPosition = pos
                }
              },
            })
          }

          return gsap.fromTo(
            t,
            { ...from },
            {
              ...to,
              duration,
              ease,
              stagger: delay / 1000,
              scrollTrigger: {
                trigger: el,
                start,
                once: true,
                fastScrollEnd: true,
                anticipatePin: 0.4,
              },
              onComplete: () => {
                animationCompletedRef.current = true
                onCompleteRef.current?.()
              },
              willChange: 'transform, opacity',
              force3D: true,
            }
          )
        },
      })
      el._rbsplitInstance = splitInstance

      return () => {
        shineTween?.kill()
        shineTween = null
        ScrollTrigger.getAll().forEach((st) => {
          if (st.trigger === el) st.kill()
        })
        try {
          splitInstance.revert()
        } catch {
          /* ignore */
        }
        el._rbsplitInstance = null
        animationCompletedRef.current = false
      }
    },
    {
      dependencies: [
        text,
        delay,
        duration,
        ease,
        splitType,
        JSON.stringify(from),
        JSON.stringify(to),
        threshold,
        rootMargin,
        fontsLoaded,
        shinySubstring ?? '',
        shinyCharRange ? `${shinyCharRange.start}-${shinyCharRange.end}` : '',
        shinyColor,
        shinyShineColor,
        shinySpread,
        shinySpeed,
      ],
      scope: ref,
    }
  )

  const style: CSSProperties = {
    textAlign,
    wordWrap: 'break-word',
    willChange: 'transform, opacity',
  }

  const classes = `split-parent overflow-hidden whitespace-normal ${className}`.trim()

  return (
    <Tag ref={ref as never} style={style} className={classes}>
      {text}
    </Tag>
  )
}
