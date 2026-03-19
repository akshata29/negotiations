import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { Dashboard } from './pages/Dashboard'
import { Vendors } from './pages/Vendors'
import { Negotiations } from './pages/Negotiations'
import { NegotiationDetail } from './pages/NegotiationDetail'
import { ABTesting } from './pages/ABTesting'
import { useLocation } from 'react-router-dom'

const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  '/': { title: 'Dashboard', subtitle: 'Autonomous Vendor Negotiations' },
  '/vendors': { title: 'Vendors', subtitle: 'Manage and filter vendor list' },
  '/negotiations': { title: 'Negotiations', subtitle: 'Track active negotiations' },
  '/ab-testing': { title: 'A/B Testing & RL', subtitle: 'UCB1 multi-armed bandit strategy selection' },
}

export default function App() {
  const location = useLocation()
  const [wsConnected, setWsConnected] = useState(false)
  const [pendingApprovals, setPendingApprovals] = useState(0)

  const path = location.pathname
  const isDetailPage = path.startsWith('/negotiations/') && path.length > '/negotiations/'.length
  const meta = isDetailPage
    ? { title: 'Negotiation Detail', subtitle: 'Email thread & workflow' }
    : PAGE_TITLES[path] ?? { title: 'McLane NegoAgent' }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title={meta.title}
          subtitle={meta.subtitle}
          wsConnected={wsConnected}
          pendingApprovals={pendingApprovals}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<Dashboard setWsConnected={setWsConnected} setPending={setPendingApprovals} />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route path="/negotiations" element={<Negotiations />} />
            <Route path="/negotiations/:id" element={<NegotiationDetail />} />
            <Route path="/ab-testing" element={<ABTesting />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
