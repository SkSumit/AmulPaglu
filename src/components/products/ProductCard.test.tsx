import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ProductCard } from './ProductCard'
import type { Product } from '@/types'

// Mock ProductImage
vi.mock('./ProductImage', () => ({
  ProductImage: () => <div data-testid="mocked-product-image">Product Image</div>
}))

const mockProduct: Product = {
  id: 'p-1',
  name: 'Amul Butter | 500g Pack',
  points: 4,
  category: 'Butter',
  rarity_label: 'Legendary',
  image_url: 'https://example.com/butter.png',
  approved: true,
  is_discontinued: false,
  created_at: '',
}

describe('ProductCard Component', () => {
  it('renders product details correctly', () => {
    render(
      <ProductCard
        product={mockProduct}
        userStatus={null}
        onAddToList={vi.fn()}
        onMarkAsTried={vi.fn()}
        onRemoveFromList={vi.fn()}
      />
    )

    // Name is cleaned up via getDisplayProductName
    expect(screen.getByText('Amul Butter')).toBeInTheDocument()
    expect(screen.getByText('Butter')).toBeInTheDocument()
    expect(screen.getByText('Legendary')).toBeInTheDocument()
    expect(screen.getByText('4 pts')).toBeInTheDocument()
    expect(screen.getByTestId('mocked-product-image')).toBeInTheDocument()
  })

  it('renders "On list" ribbon when userStatus is want_to_try', () => {
    render(
      <ProductCard
        product={mockProduct}
        userStatus="want_to_try"
        onAddToList={vi.fn()}
        onMarkAsTried={vi.fn()}
        onRemoveFromList={vi.fn()}
      />
    )

    expect(screen.getByText('On list')).toBeInTheDocument()
    expect(screen.getByText('Remove')).toBeInTheDocument()
    expect(screen.getByText('Tried it!')).toBeInTheDocument()
  })

  it('renders "Tried" ribbon when userStatus is tried', () => {
    render(
      <ProductCard
        product={mockProduct}
        userStatus="tried"
        triedAt="2026-07-01T12:00:00Z"
        onAddToList={vi.fn()}
        onMarkAsTried={vi.fn()}
        onRemoveFromList={vi.fn()}
      />
    )

    expect(screen.getAllByText('Tried').length).toBeGreaterThan(0)
    // Checks that the localized date is formatted (e.g. '1 Jul 2026')
    expect(screen.getByText(/Tried 1 Jul/)).toBeInTheDocument()
  })

  it('triggers onAddToList callback', () => {
    const onAddToListMock = vi.fn()
    render(
      <ProductCard
        product={mockProduct}
        userStatus={null}
        onAddToList={onAddToListMock}
        onMarkAsTried={vi.fn()}
        onRemoveFromList={vi.fn()}
      />
    )

    const addButton = screen.getByText('Add to List')
    act(() => {
      addButton.click()
    })

    expect(onAddToListMock).toHaveBeenCalled()
  })

  it('triggers onMarkAsTried callback', () => {
    const onMarkAsTriedMock = vi.fn()
    render(
      <ProductCard
        product={mockProduct}
        userStatus={null}
        onAddToList={vi.fn()}
        onMarkAsTried={onMarkAsTriedMock}
        onRemoveFromList={vi.fn()}
      />
    )

    const triedButton = screen.getByText('Tried it!')
    act(() => {
      triedButton.click()
    })

    expect(onMarkAsTriedMock).toHaveBeenCalled()
  })
})
