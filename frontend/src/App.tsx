import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { Dashboard } from './pages/Dashboard'
import { Vendors } from './pages/Vendors'
import { Negotiations } from './pages/Negotiations'
import { NegotiationDetail } from './pages/NegotiationDetail'
import { ABTesting } from './pages/ABTesting'
import { Workflow } from './pages/Workflow'
import { Architecture } from './pages/Architecture'
import { Settings } from './pages/Settings'
import { useLocation } from 'react-router-dom'

const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  '/': { title: 'Dashboard', subtitle: 'Autonomous Vendor Negotiations' },
  '/vendors': { title: 'Vendors', subtitle: 'Manage and filter vendor list' },
  '/negotiations': { title: 'Negotiations', subtitle: 'Track active negotiations' },
  '/ab-testing': { title: 'A/B Testing & RL', subtitle: 'UCB1 multi-armed bandit strategy selection' },
  '/workflow': { title: 'Workflow', subtitle: 'End-to-end negotiation workflow — click any component to see rich details' },
  '/architecture': { title: 'Architecture', subtitle: 'End-to-end system architecture — Azure services, data flows & design decisions' },
  '/settings': { title: 'Settings', subtitle: 'Model, system prompts & agent personality' },
}

export default function App() {
  const location = useLocation()
  const [wsConnected, setWsConnected] = useState(false)

  const path = location.pathname
  const isDetailPage = path.startsWith('/negotiations/') && path.length > '/negotiations/'.length
  const meta = isDetailPage
    ? { title: 'Negotiation Detail', subtitle: 'Email thread & workflow' }
    : PAGE_TITLES[path] ?? { title: 'ABC NegoAgent' }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title={meta.title}
          subtitle={meta.subtitle}
          wsConnected={wsConnected}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<Dashboard setWsConnected={setWsConnected} setPending={() => {}} />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route path="/negotiations" element={<Negotiations />} />
            <Route path="/negotiations/:id" element={<NegotiationDetail />} />
            <Route path="/ab-testing" element={<ABTesting />} />
            <Route path="/workflow" element={<Workflow />} />
            <Route path="/architecture" element={<Architecture />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
