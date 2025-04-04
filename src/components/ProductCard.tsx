"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { DollarSign, BarChart2, Factory, Video, FileText, Image, Bookmark, Lock, Clock } from "lucide-react"

interface ProductCardProps {
  product: any
  isSaved: boolean
  toggleSaveProduct: (productId: number, e: React.MouseEvent) => void
  handleShowMeMoney: (productId: number) => void
  isPro: () => boolean
}

const ProductCard: React.FC<ProductCardProps> = ({ product, isSaved, toggleSaveProduct, handleShowMeMoney, isPro }) => {
  const navigate = useNavigate()
  const [isTimeUp, setIsTimeUp] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [savedProducts, setSavedProducts] = useState(new Set()) // Initialize savedProducts
  const [timeRemaining, setTimeRemaining] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  })

  useEffect(() => {
    let intervalId: any

    if (product.release_time) {
      const releaseDate = new Date(product.release_time)

      const updateTimer = () => {
        setCurrentTime(new Date())
        const timeLeft = releaseDate.getTime() - Date.now()

        if (timeLeft <= 0) {
          setIsTimeUp(true)
          clearInterval(intervalId)
          setTimeRemaining({ hours: 0, minutes: 0, seconds: 0 })
        } else {
          const hours = Math.floor((timeLeft / (1000 * 60 * 60)) % 24)
          const minutes = Math.floor((timeLeft / 1000 / 60) % 60)
          const seconds = Math.floor((timeLeft / 1000) % 60)
          setTimeRemaining({ hours, minutes, seconds })
        }
      }

      updateTimer() // Initial call to set the time
      intervalId = setInterval(updateTimer, 1000) // Update every second
    }

    return () => clearInterval(intervalId) // Clear interval on unmount
  }, [product.release_time])

  const showTimer = product.release_time && new Date(product.release_time) > new Date() && !isPro()

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 relative">
      <div className="p-4 md:p-5">
        {/* Mobile View - Full Width Image */}
        <div className="md:hidden w-full aspect-square relative rounded-xl overflow-hidden mb-3">
          <img
            src={product.images ? product.images[0] : "/placeholder.svg"}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          {/* Lock Overlay */}
          {product.is_locked && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Lock size={32} className="text-white" />
              <span className="text-white text-sm ml-2">Pro members only</span>
            </div>
          )}
        </div>

        {/* Desktop View - Side by Side Layout */}
        <div className="hidden md:flex items-start gap-4">
          <div className="w-1/3 aspect-square relative rounded-xl overflow-hidden">
            <img
              src={product.images ? product.images[0] : "/placeholder.svg"}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            {/* Lock Overlay */}
            {product.is_locked && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Lock size={32} className="text-white" />
                <span className="text-white text-sm ml-2">Pro members only</span>
              </div>
            )}
          </div>

          <div className="w-2/3">
            <h3 className="font-medium text-[#111827] mb-1">{product.name}</h3>

            <p className="text-xs text-gray-500 mb-3">
              Posted {Math.floor((Date.now() - new Date(product.created_at).getTime()) / (1000 * 60 * 60 * 24))} day ago
            </p>

            <div className="mb-3">
              <p className="text-xs text-gray-700 mb-2">Available info:</p>
              <div className="bg-[#FFF8EC] rounded-lg p-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex items-center gap-1">
                    <DollarSign size={14} className="text-gray-600" />
                    <span className="text-xs text-gray-600">PROFIT</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <BarChart2 size={14} className="text-gray-600" />
                    <span className="text-xs text-gray-600">ANALYTICS</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Factory size={14} className="text-gray-600" />
                    <span className="text-xs text-gray-600">SUPPLIERS</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Video size={14} className="text-gray-600" />
                    <span className="text-xs text-gray-600">VIDEOS</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText size={14} className="text-gray-600" />
                    <span className="text-xs text-gray-600">DESCRIPTION</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Image size={14} className="text-gray-600" />
                    <span className="text-xs text-gray-600">IMAGES</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
              {showTimer ? (
                <div className="bg-orange-100 rounded-full shadow-sm px-4 py-2 flex items-center justify-center">
                  <Clock size={16} className="text-gray-500 mr-2" />
                  <span className="text-sm font-medium text-gray-700 whitespace-nowrap mr-2">Available in:</span>
                  <div className="flex items-center">
                    <div className="bg-orange-100 rounded-full w-7 h-7 flex items-center justify-center mx-1">
                      <span className="text-sm font-bold text-orange-500">
                        {String(timeRemaining.hours).padStart(2, "0")}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 mr-2">Hours</span>
                  </div>
                  <div className="flex items-center">
                    <div className="bg-orange-100 rounded-full w-7 h-7 flex items-center justify-center mx-1">
                      <span className="text-sm font-bold text-orange-500">
                        {String(timeRemaining.minutes).padStart(2, "0")}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 mr-2">Minutes</span>
                  </div>
                  <div className="flex items-center">
                    <div className="bg-orange-100 rounded-full w-7 h-7 flex items-center justify-center mx-1">
                      <span className="text-sm font-bold text-orange-500">
                        {String(timeRemaining.seconds).padStart(2, "0")}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">Seconds</span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() =>
                    handleShowMeMoney(product.id, product.is_locked, product.is_top_product, product.auto_locked)
                  }
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    product.is_locked
                      ? "bg-primary hover:bg-primary/90 text-white shadow-sm hover:shadow"
                      : "bg-secondary hover:bg-secondary/90 text-white shadow-sm hover:shadow"
                  }`}
                >
                  Show Me The Money!
                </button>
              )}

              <button
                onClick={(e) => toggleSaveProduct(product.id, e)}
                className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200"
              >
                <Bookmark size={18} className={isSaved ? "fill-[#FF8A00] text-[#FF8A00]" : "text-gray-400"} />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile View - Product Info Below Image */}
        <div className="md:hidden">
          <h3 className="font-medium text-[#111827] mb-1">{product.name}</h3>

          <p className="text-xs text-gray-500 mb-3">
            Posted {Math.floor((Date.now() - new Date(product.created_at).getTime()) / (1000 * 60 * 60 * 24))} day ago
          </p>

          <div className="mb-3">
            <p className="text-xs text-gray-700 mb-2">Available info:</p>
            <div className="bg-[#FFF8EC] rounded-lg p-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="flex items-center gap-1">
                  <DollarSign size={14} className="text-gray-600" />
                  <span className="text-xs text-gray-600">PROFIT</span>
                </div>
                <div className="flex items-center gap-1">
                  <BarChart2 size={14} className="text-gray-600" />
                  <span className="text-xs text-gray-600">ANALYTICS</span>
                </div>
                <div className="flex items-center gap-1">
                  <Factory size={14} className="text-gray-600" />
                  <span className="text-xs text-gray-600">SUPPLIERS</span>
                </div>
                <div className="flex items-center gap-1">
                  <Video size={14} className="text-gray-600" />
                  <span className="text-xs text-gray-600">IMAGES</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-4">
            {showTimer ? (
              <div className="bg-orange-100 rounded-full shadow-sm px-4 py-2 flex items-center justify-center">
                <Clock size={16} className="text-gray-500 mr-2" />
                <span className="text-sm font-medium text-gray-700 whitespace-nowrap mr-2">Available in:</span>
                <div className="flex items-center">
                  <div className="bg-orange-100 rounded-full w-7 h-7 flex items-center justify-center mx-1">
                    <span className="text-sm font-bold text-orange-500">
                      {String(timeRemaining.hours).padStart(2, "0")}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 mr-2">Hours</span>
                </div>
                <div className="flex items-center">
                  <div className="bg-orange-100 rounded-full w-7 h-7 flex items-center justify-center mx-1">
                    <span className="text-sm font-bold text-orange-500">
                      {String(timeRemaining.minutes).padStart(2, "0")}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 mr-2">Minutes</span>
                </div>
                <div className="flex items-center">
                  <div className="bg-orange-100 rounded-full w-7 h-7 flex items-center justify-center mx-1">
                    <span className="text-sm font-bold text-orange-500">
                      {String(timeRemaining.seconds).padStart(2, "0")}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">Seconds</span>
                </div>
              </div>
            ) : (
              <button
                onClick={() =>
                  handleShowMeMoney(product.id, product.is_locked, product.is_top_product, product.auto_locked)
                }
                className="flex-1 py-2 rounded-full text-sm font-medium transition-all duration-200 bg-[#0F172A] hover:bg-[#1E293B] text-white"
              >
                {product.is_locked ? "Become a Pro to Unlock" : "Show Me The Money!"}
              </button>
            )}

            <button
              onClick={(e) => toggleSaveProduct(product.id, e)}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200"
            >
              <Bookmark size={18} className={isSaved ? "fill-[#FF8A00] text-[#FF8A00]" : "text-gray-400"} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductCard

