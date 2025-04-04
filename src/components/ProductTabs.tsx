"use client"

import type React from "react"

interface ProductTabsProps {
  setActiveTab: (tab: string) => void
  activeTab: string
}

const ProductTabs: React.FC<ProductTabsProps> = ({ setActiveTab, activeTab }) => {
  return (
    <div className="bg-[#FFF8EC] p-3 rounded-md mb-4">
      <p className="text-sm font-medium mb-2">Available info:</p>
      <div className="overflow-x-auto pb-2">
        <div className="flex space-x-4 min-w-max">
          <button
            onClick={() => setActiveTab("profit")}
            className={`flex items-center text-xs md:text-sm whitespace-nowrap ${activeTab === "profit" ? "text-[#FF8A00] font-medium" : "text-gray-700"}`}
          >
            <span className="mr-1">💰</span> PROFIT
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`text-xs md:text-sm whitespace-nowrap ${activeTab === "analytics" ? "text-[#FF8A00] font-medium" : "text-gray-700"}`}
          >
            ANALYTICS
          </button>
          <button
            onClick={() => setActiveTab("suppliers")}
            className={`text-xs md:text-sm whitespace-nowrap ${activeTab === "suppliers" ? "text-[#FF8A00] font-medium" : "text-gray-700"}`}
          >
            SUPPLIERS
          </button>
          <button
            onClick={() => setActiveTab("videos")}
            className={`flex items-center text-xs md:text-sm whitespace-nowrap ${activeTab === "videos" ? "text-[#FF8A00] font-medium" : "text-gray-700"}`}
          >
            <span className="mr-1">📹</span> VIDEOS
          </button>
          <button
            onClick={() => setActiveTab("description")}
            className={`text-xs md:text-sm whitespace-nowrap ${activeTab === "description" ? "text-[#FF8A00] font-medium" : "text-gray-700"}`}
          >
            DESCRIPTION
          </button>
          <button
            onClick={() => setActiveTab("images")}
            className={`text-xs md:text-sm whitespace-nowrap ${activeTab === "images" ? "text-[#FF8A00] font-medium" : "text-gray-700"}`}
          >
            IMAGES
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProductTabs

