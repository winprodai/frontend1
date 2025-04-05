import { HelpCircle, ArrowRight } from "lucide-react"

const Support = () => {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Left Section - Expert Consultant */}
      <div className="p-6 lg:p-8">
        <div className="mb-8">
          <span className="text-gray-500 text-sm">Ecomhunt Consultant</span>
          <h1 className="text-2xl font-bold mt-1">1-On-1 Expert Consultant With Jack</h1>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 flex items-center gap-3 shadow-sm">
          <div className="text-primary">
            <HelpCircle size={24} />
          </div>
          <p className="text-gray-600">Expert support available for pro members only. Please upgrade</p>
        </div>

        <button className="bg-[#47D147] hover:bg-[#47D147]/90 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm">
          Upgrade to Pro <ArrowRight size={20} />
        </button>
      </div>
    </div>
  )
}

export default Support

