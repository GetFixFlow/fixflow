import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

const BASE_TITLE = 'FixFlow'
const heading = (root: HTMLElement) => {
  const shown = Array.from(root.querySelectorAll('h1')).find((h1) => getComputedStyle(h1).display !== 'none') // not the one only a printout has
  return shown?.textContent?.trim() || ''
}

/**
 * A page change in a single-page app is silent to a screen reader, and the browser tab would be called "FixFlow" on every
 * screen. This keeps the tab named after the heading of the page being shown (a page draws its heading once its data has
 * arrived, so it follows the heading rather than guessing when), and after each navigation says the page aloud (a polite
 * live region) and puts the keyboard at the top of the page, so that the next Tab starts at its content, not in the menu.
 */
export function RouteAnnouncer() {
  const { pathname } = useLocation()
  const [heard, setHeard] = useState('')
  const shown = useRef(pathname) // the page the layout first drew: the browser announces that one when it loads

  // The tab title follows the heading.
  useEffect(() => {
    const main = document.getElementById('main')
    if (!main) return
    const sync = () => {
      const text = heading(main)
      document.title = text ? `${text} · ${BASE_TITLE}` : BASE_TITLE
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(main, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [])

  // After a navigation: say the page and start the keyboard at its top.
  useEffect(() => {
    if (shown.current === pathname) return
    shown.current = pathname
    const main = document.getElementById('main')
    if (!main) return
    main.focus({ preventScroll: true })
    let said = false
    const say = () => {
      const text = heading(main)
      if (said || !text) return
      said = true
      setHeard(text)
    }
    say()
    const observer = new MutationObserver(say)
    observer.observe(main, { childList: true, subtree: true, characterData: true })
    const giveUp = window.setTimeout(() => observer.disconnect(), 5000)
    return () => {
      observer.disconnect()
      window.clearTimeout(giveUp)
    }
  }, [pathname])

  return <div role="status" aria-live="polite" className="sr-only">{heard}</div>
}
