"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "../lib/supabase"

interface AuthContextType {
  user: User | null
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  customerData: any
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [customerData, setCustomerData] = useState<any[] | null>([])

  useEffect(() => {
    // Check for mock admin session
    const mockAdmin = localStorage.getItem("mockAdmin")
    if (mockAdmin) {
      const adminData = JSON.parse(mockAdmin)
      setIsAdmin(adminData.isAdmin)
      return // Skip Supabase checks if mock admin is present
    }

    // Check current Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        checkAdminStatus(session.user)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        checkAdminStatus(session.user)
      } else {
        setIsAdmin(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function checkAdminStatus(user: User) {
    try {
      // Skip admin check if mock admin is present
      const mockAdmin = localStorage.getItem("mockAdmin")
      if (mockAdmin) {
        const adminData = JSON.parse(mockAdmin)
        setIsAdmin(adminData.isAdmin)

        // If mock admin is also a pro user, set pro status
        if (adminData.isAdmin || adminData.isPro) {
          localStorage.setItem("isPro", "true")
        }
        return
      }

      const { data: customer, error } = await supabase
        .from("customers")
        .select("subscription_tier")
        .eq("user_id", user.id)
        .maybeSingle()

      if (error) {
        console.error("Error checking admin status:", error)
        setIsAdmin(false)
        return
      }

      // Set admin status
      setIsAdmin(customer?.subscription_tier === "admin")

      // Also set pro status in localStorage for consistent access across components
      if (customer?.subscription_tier === "pro" || customer?.subscription_tier === "admin") {
        localStorage.setItem("isPro", "true")
      } else {
        localStorage.removeItem("isPro")
      }
    } catch (error) {
      console.error("Error checking admin status:", error)
      setIsAdmin(false)
    }
  }

  async function getCustomerData(id: any) {
    try {
      console.log("Fetching customer data for user:", id)

      const { data: customer, error } = await supabase.from("customers").select("*").eq("user_id", id).maybeSingle()

      if (error) {
        console.error("Error fetching customer:", error)
        return
      }

      console.log("Fetched customer data:", customer)

      // Set pro status based on subscription tier
      if (
        customer?.subscription_tier === "pro" ||
        customer?.subscription_tier === "admin" ||
        customer?.subscription_status === "active"
      ) {
        localStorage.setItem("isPro", "true")
        console.log("Setting isPro to true in localStorage")
      } else {
        localStorage.removeItem("isPro")
      }

      // Handle null cases properly
      setCustomerData(customer || null) // Ensure we set `null` instead of `[]`
    } catch (err) {
      console.error("Unexpected error fetching customer data:", err)
      setCustomerData(null) // Again, default to `null`
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw error
    }
  }

  async function signOut() {
    localStorage.removeItem("mockAdmin") // Clear mock admin session
    localStorage.removeItem("isPro") // Clear pro status
    setIsAdmin(false)
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw error
    }
  }

  useEffect(() => {
    console.log("User updated:", user) // Debug user updates
    if (user?.id) {
      console.log("Fetching customer data for:", user.id)
      getCustomerData(user.id)
    }
  }, [user])

  return (
    <AuthContext.Provider value={{ user, isAdmin, signIn, signOut, customerData }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

