import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ThemeProvider, useTheme } from './ThemeContext'

// Helper component to consume theme context
function ThemeConsumer() {
  const { theme, toggleTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme-val">{theme}</span>
      <button onClick={toggleTheme}>Toggle</button>
    </div>
  )
}

describe('ThemeContext & ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
    vi.clearAllMocks()
  })

  it('defaults to prefers-color-scheme setting if no localstorage value exists', () => {
    // Mock matchMedia to match dark mode
    const matchMediaSpy = vi.fn().mockImplementation((query) => ({
      matches: query.includes('dark'),
      media: query,
    }))
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaSpy,
    })

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId('theme-val')).toHaveTextContent('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('uses stored theme in localStorage', () => {
    localStorage.setItem('amul-theme', 'light')
    
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId('theme-val')).toHaveTextContent('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('toggles theme correctly and persists in localstorage', () => {
    localStorage.setItem('amul-theme', 'light')

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )

    const button = screen.getByText('Toggle')
    expect(screen.getByTestId('theme-val')).toHaveTextContent('light')

    // Click toggle to change to dark
    act(() => {
      button.click()
    })

    expect(screen.getByTestId('theme-val')).toHaveTextContent('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('amul-theme')).toBe('dark')

    // Click toggle to change back to light
    act(() => {
      button.click()
    })

    expect(screen.getByTestId('theme-val')).toHaveTextContent('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('amul-theme')).toBe('light')
  })

  it('throws error if useTheme is used outside ThemeProvider', () => {
    // Suppress console.error output from expected React boundary error
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<ThemeConsumer />)).toThrow(
      'useTheme must be used inside <ThemeProvider>'
    )

    consoleErrorSpy.mockRestore()
  })
})
