import { useNavigate } from 'react-router-dom'
import { VendorTable } from '../components/vendors/VendorTable'

export function Vendors() {
  const navigate = useNavigate()
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Vendor Management</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Import and manage vendors · Rule-based eligibility: Comp=MPN, Catg≠FRS/TOB/SEA, Status=ACT, YTD&gt;$0
        </p>
      </div>
      <VendorTable onViewNegotiation={(id) => navigate(`/negotiations/${id}`)} />
    </div>
  )
}
