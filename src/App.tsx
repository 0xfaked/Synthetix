import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from './wagmi'
import { WalletProvider } from './context/WalletContext'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Trade from './pages/Trade'
import Markets from './pages/Markets'
import Portfolio from './pages/Portfolio'
import Stake from './pages/Stake'

const queryClient = new QueryClient()

export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <BrowserRouter>
            <Navbar />
            <main className="page-wrapper">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/trade" element={<Trade />} />
                <Route path="/markets" element={<Markets />} />
                <Route path="/portfolio" element={<Portfolio />} />
                <Route path="/stake" element={<Stake />} />
              </Routes>
              <Footer />
            </main>
          </BrowserRouter>
        </WalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
