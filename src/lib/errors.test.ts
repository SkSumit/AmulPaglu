import { describe, it, expect } from 'vitest'
import { friendlyError } from './errors'

describe('friendlyError utility', () => {
  it('maps raw backend errors to friendly messages', () => {
    // Auth errors
    expect(friendlyError('Invalid login credentials')).toContain('Wrong email or password')
    expect(friendlyError('Email not confirmed')).toContain('Wrong email or password')
    
    // Duplicate profile/username errors
    expect(friendlyError('username taken')).toContain("That username's taken")
    expect(friendlyError('duplicate username')).toContain("That username's taken")

    // Weak password
    expect(friendlyError('password should be at least 6 characters')).toContain('Your password is weaker')

    // Network / database errors
    expect(friendlyError('failed to fetch')).toContain("Can't reach the server")
    expect(friendlyError('rate limit exceeded')).toContain('Whoa, slow down!')
  })

  it('provides a cow-themed fallback for unrecognized errors', () => {
    // Unrecognized error
    const rawError = 'Some weird DB error occurred'
    const result = friendlyError(rawError)
    // The fallback matches one of the values in FALLBACKS
    expect(
      result.includes('cow') || 
      result.includes('butter') || 
      result.includes('dairy') || 
      result.includes('Amul') ||
      result.includes('churn')
    ).toBe(true)
  })

  it('provides a default fallback for null or empty input', () => {
    expect(friendlyError(null)).toBe('Something udderly went wrong 🐄 — please try again.')
    expect(friendlyError(undefined)).toBe('Something udderly went wrong 🐄 — please try again.')
  })
})
