"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { DollarSign, BarChart2, Factory, Video, FileText, Bookmark, X, Lock } from "lucide-react"

// Update PRODUCTS_PER_PAGE from 5 to 6
const PRODUCTS_PER_PAGE = 6
const MAX_PRODUCTS = 22 // Maximum number of products to load

const Home = () => {
  const navigate = useNavigate()
  const [products, setProducts] = useState<any>([])
  const [savedProducts, setSavedProducts] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [nextReleaseTime, setNextReleaseTime] = useState<Date | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const observer = useRef<IntersectionObserver | null>(null)
  const [userSubscription, setUserSubscription] = useState("free") // Default to free

  // Add customerData state to track subscription information
  const [customerData, setCustomerData] = useState<any>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Add a new state variable to track the total number of products loaded
  const [totalProductsLoaded, setTotalProductsLoaded] = useState(0)
  const [showCtaOverlay, setShowCtaOverlay] = useState(false)
  const [productReleaseTimes, setProductReleaseTimes] = useState<{
    [key: number]: { hours: number; minutes: number; seconds: number }
  }>({})
  const [forceProStatus, setForceProStatus] = useState(false)

  // Add this state near the top of the component with other state declarations
  const [scrolled, setScrolled] = useState(false)

  // Check if user is authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setIsAuthenticated(!!user)

      // If user is authenticated, check subscription status
      if (user) {
        try {
          const { data: customer } = await supabase.from("customers").select("*").eq("user_id", user.id).single()

          if (customer) {
            setCustomerData(customer)
            setUserSubscription(customer.subscription_tier)

            // If user is a pro member, always hide the CTA overlay
            if (customer.subscription_tier === "pro" || customer.subscription_status === "active") {
              setShowCtaOverlay(false)
              localStorage.setItem("isPro", "true")
            }
          }
        } catch (error) {
          console.error("Error fetching subscription status:", error)
        }
      }
    }

    checkAuth()
  }, [])

  // Update current time every second for accurate "released X time ago" labels
  // and update product release times
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())

      // Update all product release times
      const updatedTimes: { [key: number]: { hours: number; minutes: number; seconds: number } } = {}

      products.forEach((product: any) => {
        if (product.release_time && new Date(product.release_time) > new Date()) {
          const timeRemaining = calculateTimeRemaining(new Date(product.release_time))
          updatedTimes[product.id] = timeRemaining
        }
      })

      setProductReleaseTimes(updatedTimes)
    }, 1000)

    return () => clearInterval(timer)
  }, [products])

  // Update current time every second for accurate countdown
  // and countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())

      if (nextReleaseTime) {
        const difference = nextReleaseTime.getTime() - new Date().getTime()

        if (difference <= 0) {
          // Time's up, fetch the next release
          fetchNextRelease()
        }
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [nextReleaseTime])

  // Calculate time remaining between now and a target date
  const calculateTimeRemaining = (targetDate: Date) => {
    const now = new Date()
    const difference = targetDate.getTime() - now.getTime()

    const seconds = Math.floor((difference / 1000) % 60)
    const minutes = Math.floor((difference / (1000 * 60)) % 60)
    const hours = Math.floor((difference / (1000 * 60 * 60)) % 24)
    const days = Math.floor(difference / (1000 * 60 * 60 * 24))

    return { days, hours, minutes, seconds }
  }

  // Check if user is Pro
  const isPro = () => {
    // Check multiple sources to determine Pro status
    return (
      userSubscription === "pro" ||
      forceProStatus ||
      localStorage.getItem("isPro") === "true" ||
      (customerData && (customerData.subscription_tier === "pro" || customerData.subscription_status === "active"))
    )
  }

  // Update the fetchNextRelease function to get the soonest upcoming release
  const fetchNextRelease = async () => {
    try {
      // Fetch the next scheduled release (product with future release_time)
      const { data, error } = await supabase
        .from("products")
        .select("release_time")
        .gt("release_time", new Date().toISOString()) // Get products with release_time in the future
        .order("release_time", { ascending: true }) // Order by closest upcoming release
        .limit(1)

      if (error) throw error

      if (data && data.length > 0) {
        // Set the next release time to the soonest upcoming release
        setNextReleaseTime(new Date(data[0].release_time))
      } else {
        // If no scheduled releases, set a default 24h from now
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        setNextReleaseTime(tomorrow)
      }
    } catch (error) {
      console.error("Error fetching next release:", error)
    }
  }

  // Update the fetchProducts function to track total products loaded
  const fetchProducts = async () => {
    setLoading(true)
    try {
      // Fetch products with pagination - order by created_at to get recently added
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false })
        .range(0, PRODUCTS_PER_PAGE - 1)

      if (error) throw error

      // Fetch saved products for the current user
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data: savedData, error: savedError } = await supabase
          .from("saved_products")
          .select("product_id")
          .eq("user_id", user.id)

        if (!savedError && savedData) {
          setSavedProducts(new Set(savedData.map((item) => item.product_id)))
        }
      }

      // Initialize release times for upcoming products
      const initialTimes: { [key: number]: { hours: number; minutes: number; seconds: number } } = {}

      if (data) {
        data.forEach((product: any) => {
          if (product.release_time && new Date(product.release_time) > new Date()) {
            const timeRemaining = calculateTimeRemaining(new Date(product.release_time))
            initialTimes[product.id] = timeRemaining
          }
        })

        setProductReleaseTimes(initialTimes)
      }

      setProducts(data || [])
      setTotalProductsLoaded(data?.length || 0)
      setHasMore(data && data.length === PRODUCTS_PER_PAGE)
    } catch (error) {
      console.error("Error fetching products:", error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch initial products
  useEffect(() => {
    fetchProducts()
    fetchNextRelease()
  }, [])

  // Update the loadMoreProducts function to add a longer delay (1-2 seconds)
  const loadMoreProducts = async () => {
    if (loadingMore) return

    setLoadingMore(true)
    try {
      // Add a 2-second delay
      await new Promise((resolve) => setTimeout(resolve, 2000))

      const nextPage = page + 1
      const start = nextPage * PRODUCTS_PER_PAGE - PRODUCTS_PER_PAGE
      const end = nextPage * PRODUCTS_PER_PAGE - 1

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false })
        .range(start, end)

      if (error) throw error

      if (data && data.length > 0) {
        // Update release times for new products
        const newTimes = { ...productReleaseTimes }

        data.forEach((product: any) => {
          if (product.release_time && new Date(product.release_time) > new Date()) {
            const timeRemaining = calculateTimeRemaining(new Date(product.release_time))
            newTimes[product.id] = timeRemaining
          }
        })

        setProductReleaseTimes(newTimes)

        const newTotalLoaded = totalProductsLoaded + data.length
        setTotalProductsLoaded(newTotalLoaded)

        setProducts((prev) => [...prev, ...data])
        setPage(nextPage)

        // Check if we've reached 20 products to show CTA (only for unauthenticated users or non-pro users)
        if (newTotalLoaded >= 20 && (!isAuthenticated || !isPro())) {
          setShowCtaOverlay(true)
        }

        // Always allow loading more products up to MAX_PRODUCTS
        setHasMore(data.length === PRODUCTS_PER_PAGE && newTotalLoaded < MAX_PRODUCTS)
      } else {
        setHasMore(false)
      }
    } catch (error) {
      console.error("Error loading more products:", error)
    } finally {
      setLoadingMore(false)
    }
  }

  // Set up intersection observer for infinite scrolling
  const lastProductRef = useCallback(
    (node) => {
      if (loading || loadingMore) return

      if (observer.current) observer.current.disconnect()

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMoreProducts()
        }
      })

      if (node) observer.current.observe(node)
    },
    [loading, loadingMore, hasMore],
  )

  const toggleSaveProduct = async (productId: number, e: React.MouseEvent) => {
    e.stopPropagation()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      navigate("/login")
      return
    }

    if (savedProducts.has(productId)) {
      // Remove from saved products
      const { error } = await supabase
        .from("saved_products")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", productId)

      if (!error) {
        setSavedProducts((prev) => {
          const newSet = new Set(prev)
          newSet.delete(productId)
          return newSet
        })
      }
    } else {
      // Add to saved products
      const { error } = await supabase.from("saved_products").insert({ user_id: user.id, product_id: productId })

      if (!error) {
        setSavedProducts((prev) => new Set(prev).add(productId))
      }
    }
  }

  // Update the handleShowMeMoney function to redirect to register for non-authenticated users
  const handleShowMeMoney = (productId: number) => {
    // If user is not authenticated, always redirect to register
    if (!isAuthenticated) {
      navigate("/register")
      return
    }

    // For authenticated users, check if they are Pro
    const userIsPro = isPro()

    // If user is Pro, navigate to product details
    if (userIsPro) {
      navigate(`/product/${productId}`)
      return
    }

    // For non-Pro authenticated users, redirect to pricing
    navigate("/pricing")
  }

  // Format time ago
  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor((currentTime.getTime() - new Date(date).getTime()) / 1000)

    if (seconds < 60) return `${seconds} seconds ago`

    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`

    const days = Math.floor(hours / 24)
    return `${days} day${days !== 1 ? "s" : ""} ago`
  }

  // Calculate time remaining for countdown
  const getTimeRemaining = () => {
    if (!nextReleaseTime) return { hours: 0, minutes: 0, seconds: 0 }

    const total = nextReleaseTime.getTime() - currentTime.getTime()
    const seconds = Math.floor((total / 1000) % 60)
    const minutes = Math.floor((total / 1000 / 60) % 60)
    const hours = Math.floor(total / (1000 * 60 * 60))

    return { hours, minutes, seconds }
  }

  const timeRemaining = getTimeRemaining()

  // Update the useEffect that controls the CTA overlay to never show it for pro users
  useEffect(() => {
    // Only show CTA if user is not authenticated or not a pro member and we've loaded enough products
    if (totalProductsLoaded >= 20 && (!isAuthenticated || !isPro())) {
      setShowCtaOverlay(true)
    } else {
      setShowCtaOverlay(false)
    }
  }, [totalProductsLoaded, isAuthenticated, userSubscription])

  // Prevent body scrolling when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "auto"
    }

    return () => {
      document.body.style.overflow = "auto"
    }
  }, [mobileMenuOpen])

  // Helper function to check if a product is locked for free users
  const isProductLocked = (product: any) => {
    return (
      product.is_locked ||
      product.is_top_product ||
      product.auto_locked ||
      (product.release_time && new Date(product.release_time) > new Date())
    )
  }

  // Add this useEffect for scroll detection
  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled)
      }
    }

    window.addEventListener("scroll", handleScroll)

    // Check initial scroll position
    handleScroll()

    // Clean up
    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [scrolled])

  return (
    <div className="min-h-screen bg-[black]">
      {/* Main container that will define the content width */}
      <div className="mx-auto" style={{ maxWidth: "1280px" }}>
        {/* Navigation - Desktop and Mobile */}
        <nav
          className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
            scrolled ? "bg-black/80 backdrop-blur-sm shadow-md" : "bg-transparent"
          }`}
        >
          <div className="mx-auto px-4" style={{ maxWidth: "1280px" }}>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center">
                <img
                  src="https://i.postimg.cc/QxLkYX3X/Ecom-Degen-Logo.png"
                  alt="WinProd AI"
                  className="h-8 md:h-12 w-auto"
                />
                <span className="ml-2 text-lg md:text-2xl font-bold text-[white] font-sans">
                  <span>WIN</span>
                  <span className="text-[#FF8A00]">PROD</span>
                  <span> AI</span>
                </span>
              </div>

              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center gap-4">
                {isAuthenticated ? (
                  <button
                    onClick={() => navigate("/dashboard")}
                    className="text-[white] hover:text-[#FF8A00] transition-colors font-medium"
                  >
                    Dashboard
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => navigate("/login")}
                      className="text-[white] hover:text-[#FF8A00] transition-colors"
                    >
                      Login
                    </button>
                    <button
                      onClick={() => navigate("/register")}
                      className="bg-[#FF8A00] hover:bg-[#FF8A00]/90 text-white px-6 py-2 rounded-full transition-colors"
                    >
                      Get Started
                    </button>
                  </>
                )}
              </div>

              {/* Mobile Hamburger Menu */}
              <div className="md:hidden">
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Toggle menu"
                  className="flex items-center justify-center w-10 h-10 rounded-full"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-white"
                  >
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Mobile Menu Overlay - Full Screen */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 bg-[black] z-50 md:hidden">
            {/* Header with logo and close button */}
            <div className="flex justify-between items-center p-4">
              <div className="flex items-center">
                <img src="https://i.postimg.cc/QxLkYX3X/Ecom-Degen-Logo.png" alt="WinProd AI" className="h-8 w-auto" />
                <span className="ml-2 text-lg font-bold text-[white] font-sans">
                  <span>WIN</span>
                  <span className="text-[#FF8A00]">PROD</span>
                  <span> AI</span>
                </span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                className="w-8 h-8 flex items-center justify-center"
              >
                <X size={20} className="text-white" />
              </button>
            </div>

            {/* Menu content */}
            <div className="p-6 flex flex-col items-center mt-10">
              {isAuthenticated ? (
                <button
                  onClick={() => {
                    navigate("/dashboard")
                    setMobileMenuOpen(false)
                  }}
                  className="w-full bg-[#FF8A00] text-white py-3 rounded-full font-medium mb-4"
                >
                  Dashboard
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      navigate("/register")
                      setMobileMenuOpen(false)
                    }}
                    className="w-full bg-[#FF8A00] text-white py-3 rounded-full font-medium mb-4"
                  >
                    Get Started
                  </button>
                  <button
                    onClick={() => {
                      navigate("/login")
                      setMobileMenuOpen(false)
                    }}
                    className="text-white font-medium"
                  >
                    Log In
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <div className="pt-16 md:pt-24 pb-8 px-4">
          {/* Main Heading */}

          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-bold text-white mb-3 sm:mb-4 md:mb-6 leading-tight">
              Winning Products
              <br />
              <span className="text-primary">Curated by AI</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-400 mb-6 sm:mb-8 px-1 sm:px-2 max-w-2xl mx-auto">
              Stop wasting time on bad products. We curate the best new products every day using AI and real market
              data.
            </p>
          </div>

          {/* Countdown Timer */}
          {nextReleaseTime && (
            <div className="w-full bg-gradient-to-r from-black/60 via-primary/20 to-black/60 backdrop-blur-sm border-y border-white/10">
              <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-center">
                  <div className="flex items-center gap-2 text-white">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="lucide lucide-timer text-primary animate-pulse"
                    >
                      <line x1="10" x2="14" y1="2" y2="2"></line>
                      <line x1="12" x2="15" y1="14" y2="11"></line>
                      <circle cx="12" cy="14" r="8"></circle>
                    </svg>
                    <span className="text-sm sm:text-base font-medium">Next Winning Product Released In:</span>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 font-mono">
                    <div className="flex items-center gap-1">
                      <div className="bg-white/10 rounded px-2 py-1 min-w-[2.5rem]">
                        <span className="text-lg sm:text-xl font-bold text-[#FF8A00]">
                          {timeRemaining.hours.toString().padStart(2, "0")}
                        </span>
                      </div>
                      <span className="text-white/60 text-sm">h</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="bg-white/10 rounded px-2 py-1 min-w-[2.5rem]">
                        <span className="text-lg sm:text-xl font-bold text-[#FF8A00]">
                          {timeRemaining.minutes.toString().padStart(2, "0")}
                        </span>
                      </div>
                      <span className="text-white/60 text-sm">m</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="bg-white/10 rounded px-2 py-1 min-w-[2.5rem]">
                        <span className="text-lg sm:text-xl font-bold text-[#FF8A00]">
                          {timeRemaining.seconds.toString().padStart(2, "0")}
                        </span>
                      </div>
                      <span className="text-white/60 text-sm">s</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="">pt-6</div>

          {/* Products Grid - Responsive */}
          <div className="font-sans grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {products.length > 0 ? (
              products.slice(0, showCtaOverlay ? 20 : products.length).map((product: any, index: number) => {
                const isLastItem = index === (showCtaOverlay ? 19 : products.length - 1)
                const isComingSoon = product.release_time && new Date(product.release_time) > new Date()
                const productTime = productReleaseTimes[product.id]

                // Determine if this product is locked for the current user
                const isLockedForFree = isProductLocked(product)

                return (
                  <div
                    key={product.id}
                    ref={isLastItem ? lastProductRef : null}
                    className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 relative"
                  >
                    <div className="p-4 md:p-5">
                      {/* Mobile View - Full Width Image */}
                      <div className="md:hidden w-full aspect-square relative rounded-xl overflow-hidden mb-3">
                        <img
                          src={product.images ? product.images[0] : "/placeholder.svg"}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                        {/* Lock Overlay */}
                        {isLockedForFree && (
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
                          {isLockedForFree && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <Lock size={32} className="text-white" />
                              <span className="text-white text-sm ml-2">Pro members only</span>
                            </div>
                          )}
                        </div>

                        <div className="w-2/3">
                          <h3 className="font-sans font-medium text-[#111827] mb-1">{product.name}</h3>

                          {isComingSoon && productTime && !isPro() ? (
                            <p className="text-xs text-gray-500 mb-3">
                              Product Released in:{" "}
                              <span className="text-[#FF8A00]">
                                {productTime.hours}hr : {productTime.minutes}min : {productTime.seconds}sec
                              </span>
                            </p>
                          ) : (
                            <p className="text-xs text-gray-500 mb-3">
                              Posted{" "}
                              {Math.floor(
                                (Date.now() - new Date(product.created_at).getTime()) / (1000 * 60 * 60 * 24),
                              )}{" "}
                              day ago
                            </p>
                          )}

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
                                  <span className="text-xs text-gray-600">IMAGES</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 mt-4">
                            <button
                              onClick={() => handleShowMeMoney(product.id)}
                              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                isLockedForFree
                                  ? "bg-primary hover:bg-primary/90 text-white shadow-sm hover:shadow"
                                  : "bg-secondary hover:bg-secondary/90 text-white shadow-sm hover:shadow"
                              }`}
                            >
                              {isLockedForFree ? "Become a Pro to Unlock" : "Show Me The Money!"}
                            </button>

                            <button
                              onClick={(e) => toggleSaveProduct(product.id, e)}
                              className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200"
                            >
                              <Bookmark
                                size={18}
                                className={
                                  savedProducts.has(product.id) ? "fill-[#FF8A00] text-[#FF8A00]" : "text-gray-400"
                                }
                              />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Mobile View - Product Info Below Image */}
                      <div className="md:hidden">
                        <h3 className="font-sans font-medium text-[#111827] mb-1">{product.name}</h3>

                        {isComingSoon && productTime && !isPro() ? (
                          <p className="text-xs text-gray-500 mb-3">
                            Product Released in:{" "}
                            <span className="text-[#FF8A00]">
                              {productTime.hours}hr : {productTime.minutes}min : {productTime.seconds}sec
                            </span>
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500 mb-3">
                            Posted{" "}
                            {Math.floor((Date.now() - new Date(product.created_at).getTime()) / (1000 * 60 * 60 * 24))}{" "}
                            day ago
                          </p>
                        )}

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
                                <span className="text-xs text-gray-600">IMAGES</span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 mt-4">
                            <button
                              onClick={() => handleShowMeMoney(product.id)}
                              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                isLockedForFree
                                  ? "bg-primary hover:bg-primary/90 text-white shadow-sm hover:shadow"
                                  : "bg-secondary hover:bg-secondary/90 text-white shadow-sm hover:shadow"
                              }`}
                            >
                              {isLockedForFree ? "Become a Pro to Unlock" : "Show Me The Money!"}
                            </button>

                            <button
                              onClick={(e) => toggleSaveProduct(product.id, e)}
                              className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200"
                            >
                              <Bookmark
                                size={18}
                                className={
                                  savedProducts.has(product.id) ? "fill-[#FF8A00] text-[#FF8A00]" : "text-gray-400"
                                }
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="col-span-1 md:col-span-2 py-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-[#FF8A00] mx-auto mb-4"></div>
                <p className="text-gray-600">Loading Products...</p>
              </div>
            )}
          </div>
          {loadingMore && !showCtaOverlay && (
            <div className="col-span-1 md:col-span-2 py-6 flex justify-center items-center">
              <div className="relative">
                <div className="w-10 h-10 border-4 border-gray-200 rounded-full"></div>
                <div className="w-10 h-10 border-4 border-t-[#FF8A00] animate-spin rounded-full absolute top-0 left-0"></div>
              </div>
              <span className="ml-3 text-white font-medium">Loading more products...</span>
            </div>
          )}
        </div>
      </div>

      {/* CTA Overlay - positioned right above the footer */}
      {showCtaOverlay && (
        <div className="relative overflow-hidden bg-black">
          {/* Content */}
          <div className="relative z-10 mx-auto px-4 py-6 text-center">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-4">
              Our AI is adding winning products on a daily basis.
            </h2>
            <div className="flex flex-col items-center"></div>
            <div className="mx-auto max-w-2xl">
              <p className="text-sm md:text-lg font-bold text-[#FF8A00] mb-2 md:mb-3">
                Stop wasting money on bad products
              </p>
              <p className="text-xs md:text-base text-white mb-4 md:mb-6">
                Want to be a successful store owner? Get instant access to our AI-curated winning products list with
                detailed analytics and targeting data.
              </p>
              <button
                onClick={() => navigate("/register")}
                className="bg-secondary hover:bg-secondary/90 text-white px-6 py-2 md:px-8 md:py-3 rounded-md font-medium transition-colors text-sm md:text-lg"
              >
                Join Now! It's Free :)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer - completely outside the container for full width */}
      <footer className="bg-[#FF8A00] py-3 md:py-4 text-white w-full">
        <div className="mx-auto px-4 max-w-7xl">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-xs md:text-sm mb-2 md:mb-0">© 2025 WinProd AI. All rights reserved.</p>
            <div className="flex space-x-4 md:space-x-8">
              <a href="/privacy" className="text-xs md:text-sm hover:underline">
                PRIVACY
              </a>
              <a href="/terms" className="text-xs md:text-sm hover:underline">
                TERMS
              </a>
              <a href="/faq" className="text-xs md:text-sm hover:underline">
                FAQ
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Home

