import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { asButton, onActivate } from '../a11y'

function Counter() {
  const [n, setN] = useState(0)
  return (
    <div>
      <div {...asButton(() => setN((v) => v + 1))} aria-label="count">{n}</div>
      <div role="group">
        <div tabIndex={0} onKeyDown={onActivate(() => setN(100))}>
          <input aria-label="typing" />
        </div>
      </div>
    </div>
  )
}

describe('a clickable <div> for the keyboard', () => {
  it('is reached by Tab, announced as a button, and works with Enter and Space as with a click', async () => {
    render(<Counter />)
    const button = screen.getByRole('button', { name: 'count' })

    await userEvent.tab()
    expect(button).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    await userEvent.click(button)
    expect(button).toHaveTextContent('3')
  })

  it('does not take a key pressed in something inside it', async () => {
    render(<Counter />)
    await userEvent.click(screen.getByRole('textbox', { name: 'typing' }))
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')

    expect(screen.getByRole('button', { name: 'count' })).toHaveTextContent(/^0$/)
  })
})
