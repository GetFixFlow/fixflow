import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { useDialogA11y } from '../useDialogA11y'

function Panel() {
  const [open, setOpen] = useState(false)
  const ref = useDialogA11y<HTMLDivElement>(open, () => setOpen(false))
  return (
    <div>
      <button onClick={() => setOpen(true)}>open it</button>
      {open && (
        <div ref={ref} role="dialog" aria-modal="true" aria-label="A panel">
          <button>first</button>
          <button>last</button>
        </div>
      )}
      <button>outside</button>
    </div>
  )
}

describe('useDialogA11y: a hand-made panel for the keyboard', () => {
  it('moves the keyboard into the panel when it opens, and back to what opened it when it closes', async () => {
    render(<Panel />)
    const opener = screen.getByRole('button', { name: 'open it' })
    await userEvent.click(opener)
    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('keeps Tab inside the panel, going round from the last control to the first and back', async () => {
    render(<Panel />)
    await userEvent.click(screen.getByRole('button', { name: 'open it' }))

    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'last' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'last' })).toHaveFocus()
  })
})
