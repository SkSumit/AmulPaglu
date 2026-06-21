import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getDisplayProductName(name: string) {
  return name
    .replace(/\s*\|\s*pack\s+of\s*\d+.*$/i, '')
    .replace(/\s*\|\s*pack\b.*$/i, '')
    .replace(/\s*\|\s*\d+(?:\.\d+)?\s*(ml|l|g|kg)\b.*$/i, '')
    .replace(/\s*\bpack\s+of\s*\d+\b.*$/i, '')
    .replace(/\s*\b(?:\d+(?:\.\d+)?\s*(?:ml|l|g|kg))\b.*$/i, '')
    .replace(/[\s,;:|\-\/]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
