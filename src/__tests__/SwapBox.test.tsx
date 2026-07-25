import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SwapBox from '../components/SwapBox'

// Mock WalletContext
vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    isConnected: true,
    address: '0x123',
    shortAddress: '0x123...abc',
  })
}))

// Mock Wagmi
vi.mock('wagmi', () => ({
  useReadContract: () => ({ data: 1000000000000000000n }),
  useWriteContract: () => ({ writeContract: vi.fn(), isPending: false }),
  useWaitForTransactionReceipt: () => ({ isLoading: false, isSuccess: false }),
  useBalance: () => ({ data: { value: 1000000000000000000n } })
}))

// Mock PriceChart
vi.mock('../components/PriceChart', () => ({
  default: () => <div data-testid="price-chart">Chart</div>
}))

describe('SwapBox', () => {
  it('renders correctly', () => {
    render(<SwapBox />)
    expect(screen.getByText('Mint & Burn')).toBeInTheDocument()
    expect(screen.getByTestId('price-chart')).toBeInTheDocument()
  })

  it('allows swapping between Mint and Burn modes', () => {
    render(<SwapBox />)
    
    // Default is Mint
    const mintButton = screen.getByRole('button', { name: /Mint/i })
    expect(mintButton).toBeInTheDocument()

    // Click the switch arrow
    const switchButton = screen.getByRole('button', { name: /↓/i })
    fireEvent.click(switchButton)

    // Should now be Burn
    const burnButton = screen.getByRole('button', { name: /Burn/i })
    expect(burnButton).toBeInTheDocument()
  })
})
