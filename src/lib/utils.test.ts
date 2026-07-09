import { describe, it, expect } from 'vitest'
import { cn, getDisplayProductName } from './utils'

describe('cn utility', () => {
  it('merges class names correctly', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2')
    expect(cn('class1', false && 'class2')).toBe('class1')
    expect(cn('p-4 bg-red-500', 'p-2')).toBe('bg-red-500 p-2') // twMerge handles overlapping padding
  })
})

describe('getDisplayProductName utility', () => {
  it('cleans up Amul product naming variations', () => {
    expect(getDisplayProductName('Amul Gold Milk | Pack of 4')).toBe('Amul Gold Milk')
    expect(getDisplayProductName('Amul Butter | 500g')).toBe('Amul Butter')
    expect(getDisplayProductName('Amul Taaza | 1L Tetrapack')).toBe('Amul Taaza')
    expect(getDisplayProductName('Amul Masti Dahi, Pack of 2, 400g')).toBe('Amul Masti Dahi')
    expect(getDisplayProductName('Pure Ghee 1 kg')).toBe('Pure Ghee')
    expect(getDisplayProductName('Simple Clean Name')).toBe('Simple Clean Name')
  })
})
