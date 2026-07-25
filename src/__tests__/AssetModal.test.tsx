import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AssetModal from '../components/AssetModal'
import { CRYPTO_TOKENS, ASSETS } from '../data/assets'

describe('AssetModal', () => {
  it('renders correctly in pay mode', () => {
    const handleClose = vi.fn()
    const handleSelect = vi.fn()

    render(
      <AssetModal 
        mode="pay" 
        onClose={handleClose} 
        onSelect={handleSelect} 
      />
    )

    expect(screen.getByText('Select Pay Token')).toBeInTheDocument()
    expect(screen.getByText('Crypto Tokens')).toBeInTheDocument()
    
    // Check if C2FLR is in the list
    expect(screen.getByText('C2FLR')).toBeInTheDocument()
  })

  it('filters assets based on search query', () => {
    const handleClose = vi.fn()
    const handleSelect = vi.fn()

    render(
      <AssetModal 
        mode="receive" 
        onClose={handleClose} 
        onSelect={handleSelect} 
      />
    )

    const searchInput = screen.getByPlaceholderText('Search assets...')
    fireEvent.change(searchInput, { target: { value: 'Gold' } })

    expect(screen.getByText('Gold')).toBeInTheDocument()
    expect(screen.queryByText('Euro')).not.toBeInTheDocument()
  })

  it('calls onSelect and onClose when an asset is clicked', () => {
    const handleClose = vi.fn()
    const handleSelect = vi.fn()

    render(
      <AssetModal 
        mode="pay" 
        onClose={handleClose} 
        onSelect={handleSelect} 
      />
    )

    const c2flrItem = screen.getByText('C2FLR')
    fireEvent.click(c2flrItem)

    expect(handleSelect).toHaveBeenCalledWith(CRYPTO_TOKENS[0])
    expect(handleClose).toHaveBeenCalled()
  })
})
