"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom"
import { AuthProvider } from "./contexts/AuthContext"
import Sidebar from "./components/Sidebar"
import AdminLayout from "./components/AdminLayout"
import Dashboard from "./pages/Dashboard"
import Ebooks from "./pages/Ebooks"
import Support from "./pages/Support"
import FAQ from "./pages/FAQ"
import Privacy from "./pages/Privacy"
import Terms from "./pages/Terms"
import Register from "./pages/Register"
import Login from "./pages/Login"
import Account from "./pages/Account"
import Pricing from "./pages/Pricing"
import ProductDetails from "./pages/ProductDetails"
import SavedProducts from "./pages/SavedProducts"
import Home from "./pages/Home"
import Footer from "./components/Footer"
import AdminDashboard from "./pages/admin/Dashboard"
import AdminProducts from "./pages/admin/Products"
import AdminUsers from "./pages/admin/Users"
import AdminCustomers from "./pages/admin/Customers"
import AdminAddons from "./pages/admin/Addons"
import AdminLogin from "./pages/admin/Login"
import AuthCallback from "./pages/auth/Callback"
import Header from "./components/Header"
import { supabase } from "./lib/supabase"
import NotFound from "./pages/NotFound"
import AuthLoader from "./components/AuthLoader"
import AdminRegister from "./pages/admin/Register"
import { checkIsAdmin } from "./lib/utils"
import AdminEmailTemplates from "./pages/admin/EmailTemplates"
import AdminEmailMarketing from "./pages/admin/EmailMarketing"

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchUser() {
      try {
        setIsLoading(true)
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()

        if (error) {
          console.error("Error fetching user:", error)
          setIsAuthenticated(false)
        } else {
          setIsAuthenticated(!!user)
        }
      } catch (error) {
        console.error("Unexpected error:", error)
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUser()
  }, [])

  if (isLoading) {
    return <AuthLoader />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false)
  const navigate = useNavigate()
  const [authLoader, setAuthLoader] = useState(true)
  useEffect(() => {
    const checkInitial = async () => {
      try {
        setAuthLoader(true)

        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.user) {
          setAuthLoader(false)
          return
        }

        const sessionUserId = session.user.id

        const isAdmin = await checkIsAdmin(sessionUserId)

        if (isAdmin) {
          setIsAdmin(true)
        } else {
          setIsAdmin(false)
        }
      } catch (error) {
        console.error("Error checking admin status:", error)
      } finally {
        setAuthLoader(false)
      }
    }

    checkInitial()
  }, [])

  if (authLoader) {
    return <AuthLoader />
  } else if (!isAdmin) {
    return <Navigate to="/admin/login" replace />
  }

  return <>{children}</>
}

function App() {
  const [isLogin, setIsLogin] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  useEffect(() => {
    const fetchUser = async () => {
      setIsCheckingAuth(true)
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()

      if (!user) {
        setIsLogin(false)
      } else {
        setIsLogin(true)
      }
      setIsCheckingAuth(false)
    }
    fetchUser()
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLogin(!!session?.user)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  // Add a function to check Pro status on app initialization
  useEffect(() => {
    const checkProStatus = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          const { data: customer, error } = await supabase
            .from("customers")
            .select("subscription_tier, subscription_status")
            .eq("user_id", user.id)
            .single()

          if (!error && customer) {
            if (
              customer.subscription_tier === "pro" ||
              customer.subscription_tier === "admin" ||
              customer.subscription_status === "active"
            ) {
              localStorage.setItem("isPro", "true")
              console.log("Setting isPro to true in App initialization")
            }
          }
        }
      } catch (error) {
        console.error("Error checking Pro status on app init:", error)
      }
    }

    checkProStatus()
  }, [])

  if (isCheckingAuth) {
    return <AuthLoader />
  }

  // Update the routing logic to make dashboard the home page for authenticated users
  // and make terms and other pages public

  // First, update the non-authenticated routes section to include public pages
  if (!isLogin) {
    return (
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            {/* Make these pages public */}
            <Route path="/faq" element={<FAQ />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            {/* Add product details route for non-authenticated users */}
            <Route path="/product/:id" element={<ProductDetails />} />
            <Route path="/admin">
              <Route index element={<AdminLogin />} />
              <Route path="login" element={<AdminLogin />} />
              <Route path="register" element={<AdminRegister />} />
            </Route>
            <Route path="*" element={<Login />} />
          </Routes>
        </Router>
      </AuthProvider>
    )
  }

  // Then, update the authenticated routes to redirect from home to dashboard
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Redirect from home to dashboard for authenticated users */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* OAuth Callback Route */}
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Admin Routes */}
          <Route path="/admin">
            <Route
              index
              element={
                <ProtectedAdminRoute>
                  <AdminLayout>
                    <AdminDashboard />
                  </AdminLayout>
                </ProtectedAdminRoute>
              }
            />
            <Route path="login" element={<AdminLogin />} />
            <Route path="register" element={<AdminRegister />} />
            <Route
              path="products"
              element={
                <ProtectedAdminRoute>
                  <AdminLayout>
                    <AdminProducts />
                  </AdminLayout>
                </ProtectedAdminRoute>
              }
            />
            <Route
              path="addons"
              element={
                <ProtectedAdminRoute>
                  <AdminLayout>
                    <AdminAddons />
                  </AdminLayout>
                </ProtectedAdminRoute>
              }
            />
            <Route
              path="users"
              element={
                <ProtectedAdminRoute>
                  <AdminLayout>
                    <AdminUsers />
                  </AdminLayout>
                </ProtectedAdminRoute>
              }
            />
            <Route
              path="customers"
              element={
                <ProtectedAdminRoute>
                  <AdminLayout>
                    <AdminCustomers />
                  </AdminLayout>
                </ProtectedAdminRoute>
              }
            />
            <Route
              path="email-templates"
              element={
                <ProtectedAdminRoute>
                  <AdminLayout>
                    <AdminEmailTemplates />
                  </AdminLayout>
                </ProtectedAdminRoute>
              }
            />
            <Route
              path="email-marketing"
              element={
                <ProtectedAdminRoute>
                  <AdminLayout>
                    <AdminEmailMarketing />
                  </AdminLayout>
                </ProtectedAdminRoute>
              }
            />
          </Route>

          {/* Auth Routes */}
          <Route
            path="/register"
            element={
              <ProtectedRoute>
                <div className="min-h-screen bg-gray-50">
                  <Header onMenuClick={toggleSidebar} />
                  <Sidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    onOpen={() => setSidebarOpen(true)}
                  />
                  <div className="lg:ml-64 pt-16 lg:pt-0">
                    {" "}
                    {/* Added pt-16 for mobile header spacing */}
                    <main className="p-4 md:p-6">
                      <Dashboard />
                    </main>
                    <Footer />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/login"
            element={
              <ProtectedRoute>
                <div className="min-h-screen bg-gray-50">
                  <Header onMenuClick={toggleSidebar} />
                  <Sidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    onOpen={() => setSidebarOpen(true)}
                  />
                  <div className="lg:ml-64 pt-16 lg:pt-0">
                    {" "}
                    {/* Added pt-16 for mobile header spacing */}
                    <main className="p-4 md:p-6">
                      <Dashboard />
                    </main>
                    <Footer />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />

          <Route path="/pricing" element={<Pricing />} />

          {/* Public Routes - Make these accessible to everyone */}
          <Route path="/faq" element={<FAQ />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />

          {/* Product Details Route - Removed ProtectedRoute wrapper */}
          <Route
            path="/product/:id"
            element={
              <div className="min-h-screen bg-gray-50">
                <Header onMenuClick={toggleSidebar} />
                <Sidebar
                  isOpen={sidebarOpen}
                  onClose={() => setSidebarOpen(false)}
                  onOpen={() => setSidebarOpen(true)}
                />
                <div className="lg:ml-64 pt-16 lg:pt-0">
                  {" "}
                  {/* Added pt-16 for mobile header spacing */}
                  <main>
                    <ProductDetails />
                  </main>
                  <Footer />
                </div>
              </div>
            }
          />

          {/* Protected Routes */}
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <div className="min-h-screen bg-gray-50">
                  <Header onMenuClick={toggleSidebar} />
                  <Sidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    onOpen={() => setSidebarOpen(true)}
                  />
                  <div className="lg:ml-64 pt-16 lg:pt-0">
                    {" "}
                    {/* Added pt-16 for mobile header spacing */}
                    <main className="p-4 md:p-6">
                      <Account />
                    </main>
                    <Footer />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div className="min-h-screen bg-gray-50">
                  <Header onMenuClick={toggleSidebar} />
                  <Sidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    onOpen={() => setSidebarOpen(true)}
                  />
                  <div className="lg:ml-64 pt-16 lg:pt-0">
                    {" "}
                    {/* Added pt-16 for mobile header spacing */}
                    <main className="p-4 md:p-6">
                      <Dashboard />
                    </main>
                    <Footer />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/saved-products"
            element={
              <ProtectedRoute>
                <div className="min-h-screen bg-gray-50">
                  <Header onMenuClick={toggleSidebar} />
                  <Sidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    onOpen={() => setSidebarOpen(true)}
                  />
                  <div className="lg:ml-64 pt-16 lg:pt-0">
                    {" "}
                    {/* Added pt-16 for mobile header spacing */}
                    <main className="p-4 md:p-6">
                      <SavedProducts />
                    </main>
                    <Footer />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />

          <Route
            path="/ebooks"
            element={
              <ProtectedRoute>
                <div className="min-h-screen bg-gray-50">
                  <Header onMenuClick={toggleSidebar} />
                  <Sidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    onOpen={() => setSidebarOpen(true)}
                  />
                  <div className="lg:ml-64 pt-16 lg:pt-0">
                    {" "}
                    {/* Added pt-16 for mobile header spacing */}
                    <main className="p-4 md:p-6">
                      <Ebooks />
                    </main>
                    <Footer />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/support"
            element={
              <ProtectedRoute>
                <div className="min-h-screen bg-gray-50">
                  <Header onMenuClick={toggleSidebar} />
                  <Sidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    onOpen={() => setSidebarOpen(true)}
                  />
                  <div className="lg:ml-64 pt-16 lg:pt-0">
                    {" "}
                    {/* Added pt-16 for mobile header spacing */}
                    <main className="p-4 md:p-6">
                      <Support />
                    </main>
                    <Footer />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App

