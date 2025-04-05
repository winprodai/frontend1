"use client"

import { useState, useEffect } from "react"
import { Menu } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"

interface HeaderProps {
  onMenuClick: () => void
}

const Header = ({ onMenuClick }: HeaderProps) => {
  const [showSearch, setShowSearch] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    // Check authentication status when component mounts
    const checkAuth = async () => {
      setIsAuthLoading(true)
      try {
        const { data } = await supabase.auth.getSession()
        setIsLoggedIn(!!data.session || localStorage.getItem("mockUser") !== null)
      } catch (error) {
        console.error("Auth check error:", error)
      } finally {
        setIsAuthLoading(false)
      }
    }

    checkAuth()

    // Set up auth state listener
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session || localStorage.getItem("mockUser") !== null)
      setIsAuthLoading(false)
    })

    return () => {
      authListener?.subscription.unsubscribe()
    }
  }, [])

  return (
    <>
      {/* Mobile Search Overlay */}
      {showSearch && <div className="fixed inset-0 bg-black/20 z-30 md:hidden" onClick={() => setShowSearch(false)} />}

      <header className="fixed top-0 right-0 left-0 z-20 bg-black/80 backdrop-blur-sm lg:hidden">
        {/* Main Header */}
        <div className="h-16 bg-black/95 border-b border-white/10 w-full">
          <div className="h-full px-4 md:px-6 flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center">
              <button
                onClick={onMenuClick}
                className="lg:hidden p-2 text-white hover:text-primary transition-colors"
                aria-label="Open menu"
              >
                <Menu size={24} />
              </button>
            </div>

            {!isAuthLoading && !isLoggedIn && (
              <div className="flex items-center gap-4">
                <Link to="/login" className="text-white hover:text-primary transition-colors">
                  Login
                </Link>
                <button
                  onClick={() => navigate("/register")}
                  className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Get Started
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  )
}

export default Header

