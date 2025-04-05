"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { User, CreditCard, Lock, ChevronRight, Crown, LogOut, Check, ArrowRight, Shield } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../contexts/AuthContext"

interface BillingHistoryItem {
  id: string
  date: string
  amount: number
  status: "paid" | "failed" | "pending"
  description: string
}

interface PaymentMethod {
  id: string
  brand: string
  last4: string
  exp_month: number
  exp_year: number
  is_default: boolean
}

interface Subscription {
  id: string
  status: string
  plan: string
  current_period_end: string
  cancel_at_period_end: boolean
}

const Account = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<"personal" | "billing" | "security">("personal")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [details, setDetails] = useState(null);
  const { customerData } = useAuth()
  console.log(customerData)
  useEffect(() => {
    const verifyAndUpdateSubscription = async () => {
      try {
        if (!sessionId) {
          throw new Error('No session ID provided');
        }

        console.log('Verifying session:', sessionId);

        // 1. First try the endpoint to see what we're working with
        const debugResponse = await fetch(`http://localhost:8080/api/payments/stripe/verify?session_id=${sessionId}`);
        const debugData = await debugResponse.json();
        console.log('Debug session data:', debugData);
        setDetails(debugData);

        if (!debugResponse.ok) {
          throw new Error(`Debug failed: ${debugData.error || 'Unknown error'}`);
        }

        // 2. Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw new Error('User not authenticated');

        // 3. Alternative approach: Verify the payment status directly
        // Instead of relying on backend processing, update based on session data
        if (debugData.payment_status === 'paid') {
          // Try to extract subscription data from debug info
          const subscriptionId = debugData.subscription_value;
          const customerId = debugData.customer_value;

          if (!subscriptionId || !customerId) {
            throw new Error('Missing subscription or customer ID in session');
          }

          // Assume monthly plan if we can't determine from session
          const planType = debugData.metadata?.interval || 'monthly';

          // Get current date plus 30 days as fallback for period end
          const fallbackPeriodEnd = new Date();
          fallbackPeriodEnd.setDate(fallbackPeriodEnd.getDate() + 30);

          // First check if subscription exists
          const { data: existingSub, error: fetchError1 } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('stripe_subscription_id', subscriptionId)
            .maybeSingle();

          if (fetchError1) throw fetchError1;

          if (existingSub) {
            // Update existing record
            const { error: updateError } = await supabase
              .from('subscriptions')
              .update({
                user_id: user.id,
                stripe_customer_id: customerId,
                plan_id: planType,
                status: 'active',
                current_period_end: new Date(fallbackPeriodEnd).toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('stripe_subscription_id', subscriptionId);

            if (updateError) throw updateError;
          } else {
            // Insert new record
            const { error: insertError } = await supabase
              .from('subscriptions')
              .insert({
                user_id: user.id,
                stripe_subscription_id: subscriptionId,
                stripe_customer_id: customerId,
                plan_id: planType,
                status: 'active',
                current_period_end: new Date(fallbackPeriodEnd).toISOString(),
                updated_at: new Date().toISOString()
              });

            if (insertError) throw insertError;
          }

          // Get current date
          const currentDate = new Date();

          // Calculate end date (30 days for monthly, 365 days for yearly)
          const endDate = new Date(currentDate);
          if (planType === 'yearly') {
            endDate.setFullYear(endDate.getFullYear() + 1);
          } else {
            endDate.setDate(endDate.getDate() + 30);
          }

          // Check if customer record exists
          const { data: existingCustomer, error: customerCheckError } = await supabase
            .from('customers')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (customerCheckError) {
            console.error('Error checking for customer:', customerCheckError);
            throw customerCheckError;
          }

          // Prepare the subscription data update
          const updatedSubscriptionData = {
            plan: planType === 'yearly' ? 'pro_yearly' : 'pro_monthly',
            startDate: new Date().toISOString(),
            endDate: endDate.toISOString(),
            autoRenew: true,
            paymentMethod: 'stripe',
          };

          // Validate subscription_status value
          const subscriptionStatus = debugData.payment_status === 'paid' ? 'active' : 'inactive';
          const subscriptionTier = planType === 'yearly' ? 'pro_yearly' : 'pro_monthly';

          // Update or insert customer record
          if (existingCustomer) {
            // Update existing customer
            const { data: updatedCustomer, error: updateCustomerError } = await supabase
              .from('customers')
              .update({
                subscription_status: subscriptionStatus, // Ensure this is valid
                subscription_tier: subscriptionTier,
                subscription_data: updatedSubscriptionData,
              })
              .eq('user_id', user.id)
              .select()
              .single(); // Ensure the query returns a single object

            if (updateCustomerError) {
              console.error('Error updating customer:', updateCustomerError);
            }
            console.log('success:', updatedCustomer);
            // Send welcome email
            if (updatedCustomer?.email || updatedCustomer?.full_name || updatedCustomer?.subscription_tier) {
              const response = await fetch("http://localhost:8080/api/emails/transaction", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  email: updatedCustomer?.email,
                  name: updatedCustomer?.full_name,
                  plan: updatedCustomer?.subscription_tier,
                  amount: updatedCustomer?.subscription_tier == "pro_yearly" ? "$25" : "$49"

                }),
              });
            }

          } else {
            // Insert new customer record
            const { error: insertCustomerError } = await supabase
              .from('customers')
              .insert({
                user_id: user.id,
                subscription_status: subscriptionStatus,
                subscription_tier: subscriptionTier,
                subscription_data: updatedSubscriptionData,
                created_at: new Date().toISOString(),
              });

            if (insertCustomerError) {
              console.error('Error creating customer record:', insertCustomerError);
              throw insertCustomerError;
            }
            console.log('New customer record created successfully');
          }

          navigate('/dashboard');
          setLoading(false);
        } else {
          throw new Error(`Payment not completed. Status: ${debugData.payment_status}`);
        }

      } catch (err) {
        console.error('Subscription update error:', err);
        setLoading(false);
      }
    };

    verifyAndUpdateSubscription();
  }, [sessionId, navigate]);

  // console.log("this is details", details)
  // User data state
  const [formData, setFormData] = useState({
    fullName: "John 11",
    email: "john11@gmail.com",
    notifications: {
      marketing: true,
      security: true,
      updates: false,
    },
  })


  useEffect(() => {

  }, [])
  // Subscription and payment data
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [billingHistory, setBillingHistory] = useState<BillingHistoryItem[]>([])
  const [loadingPayment, setLoadingPayment] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [paymentMethodToDelete, setPaymentMethodToDelete] = useState<string | null>(null)

  const handleDeletePaymentMethod = (paymentMethodId: string) => {
    setPaymentMethodToDelete(paymentMethodId)
    setShowDeleteConfirmation(true)
  }

  const confirmDeletePaymentMethod = async () => {
    if (!paymentMethodToDelete) return

    try {
      // In a real implementation, you would call your API to delete the payment method
      // const response = await fetch(`/api/payment-methods/${paymentMethodToDelete}`, {
      //   method: 'DELETE',
      // });

      // For now, we'll just update the state
      setPaymentMethods([])
      setShowDeleteConfirmation(false)
      setPaymentMethodToDelete(null)

      alert("Payment method deleted successfully!")
    } catch (error) {
      console.error("Error deleting payment method:", error)
      alert("Failed to delete payment method. Please try again later.")
    }
  }

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          // Get profile data from profiles table
          const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single()

          setFormData({
            ...formData,
            fullName: profileData?.full_name || user.user_metadata?.full_name || "John 11",
            email: user.email || "john11@gmail.com",
            notifications: {
              ...formData.notifications,
            },
          })
        }
      } catch (error) {
        console.error("Error fetching user data:", error)
      }
    }

    fetchUserData()
  }, [])

  const handleNotificationChange = (key: keyof typeof formData.notifications) => {
    setFormData((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: !prev.notifications[key],
      },
    }))
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      // Get current form data
      const form = e.target as HTMLFormElement
      const currentPassword = form.elements.namedItem("currentPassword") as HTMLInputElement
      const newPassword = form.elements.namedItem("newPassword") as HTMLInputElement
      const confirmPassword = form.elements.namedItem("confirmPassword") as HTMLInputElement

      // Validate passwords
      if (newPassword.value !== confirmPassword.value) {
        throw new Error("New passwords don't match")
      }

      // Update password via Supabase
      const { error } = await supabase.auth.updateUser({
        password: newPassword.value,
      })

      if (error) throw error

      setSuccess(true)
      // Reset form
      form.reset()
    } catch (error) {
      console.error("Error updating password:", error)
      alert(error.message || "Failed to update password")
    } finally {
      setLoading(false)
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  const handleUpdatePaymentMethod = () => {
    // Open Stripe payment update modal
    setShowPaymentModal(true)
  }

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error("Sign out error:", error)
    }
    navigate("/login")
  }

  // Payment update modal
  const PaymentUpdateModal = () => {
    if (!showPaymentModal) return null

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-md w-full">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Update Payment Method</h3>
            <button onClick={() => setShowPaymentModal(false)} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>

          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              Your payment information will be securely processed by our payment provider.
            </p>

            {/* Stripe Elements would go here in a real implementation */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
                <input
                  type="text"
                  placeholder="4242 4242 4242 4242"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                  <input
                    type="text"
                    placeholder="MM/YY"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CVC</label>
                  <input
                    type="text"
                    placeholder="123"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setShowPaymentModal(false)}
              className="mr-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                // In a real implementation, this would submit the payment info to Stripe
                // For now, we'll simulate adding the payment method
                const cardNumberInput = document.querySelector(
                  'input[placeholder="4242 4242 4242 4242"]',
                ) as HTMLInputElement
                const expiryInput = document.querySelector('input[placeholder="MM/YY"]') as HTMLInputElement

                if (cardNumberInput && expiryInput) {
                  const cardNumber = cardNumberInput.value || "4242 4242 4242 4242"
                  const expiry = expiryInput.value || "12/25"

                  // Extract last 4 digits
                  const last4 = cardNumber.slice(-4)
                  // Extract month and year
                  const [expMonth, expYear] = expiry.split("/")

                  // Update payment methods state
                  setPaymentMethods([
                    {
                      id: "pm_" + Date.now(),
                      brand: "visa",
                      last4: last4,
                      exp_month: Number.parseInt(expMonth) || 12,
                      exp_year: Number.parseInt("20" + (expYear || "25")),
                      is_default: true,
                    },
                  ])

                  alert("Payment method updated successfully!")
                  setShowPaymentModal(false)
                }
              }}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg"
            >
              Update Payment Method
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Settings</h1>
          <p className="text-gray-600">Manage your account settings and preferences</p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-12 gap-8">
          {/* Sidebar */}
          <div className="col-span-12 lg:col-span-3">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <User size={20} className="text-orange-500" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{formData.fullName}</div>
                    <div className="text-sm text-gray-500">{formData.email}</div>
                  </div>
                </div>
              </div>

              <div className="p-2">
                <button
                  onClick={() => setActiveTab("personal")}
                  className={`w-full flex items-center justify-between px-4 py-2 rounded-lg text-sm ${activeTab === "personal" ? "bg-orange-100 text-orange-500" : "text-gray-600 hover:bg-gray-50"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <User size={18} />
                    <span>Personal Info</span>
                  </div>
                  <ChevronRight size={16} />
                </button>

                <button
                  onClick={() => setActiveTab("billing")}
                  className={`w-full flex items-center justify-between px-4 py-2 rounded-lg text-sm ${activeTab === "billing" ? "bg-orange-100 text-orange-500" : "text-gray-600 hover:bg-gray-50"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard size={18} />
                    <span>Billing & Plan</span>
                  </div>
                  <ChevronRight size={16} />
                </button>

                <button
                  onClick={() => setActiveTab("security")}
                  className={`w-full flex items-center justify-between px-4 py-2 rounded-lg text-sm ${activeTab === "security" ? "bg-orange-100 text-orange-500" : "text-gray-600 hover:bg-gray-50"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Lock size={18} />
                    <span>Security</span>
                  </div>
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut size={18} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="col-span-12 lg:col-span-9 space-y-6">
            {/* Current Plan Overview */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Crown size={20} className="text-[#FFD700]" />
                    <h2 className="text-lg font-semibold text-gray-900">Current Plan</h2>
                  </div>
                  <p className="text-gray-600 mb-4">
                    {customerData?.subscription_status === "active"
                      ? "You are currently on the Pro plan"
                      : "You are currently on the Free plan"}
                  </p>
                </div>
                {(customerData?.subscription_status !== "active") && (
                  <button
                    onClick={() => navigate("/pricing")}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    Upgrade to Pro
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </div>

            {activeTab === "personal" && (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-200">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                      <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700">
                        {formData.fullName}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                      <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-blue-50 text-gray-700">
                        {formData.email}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h3>
                  <div className="space-y-4">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.notifications.marketing}
                        onChange={() => handleNotificationChange("marketing")}
                        className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                      />
                      <span className="text-gray-700">Marketing emails about new features and updates</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.notifications.security}
                        onChange={() => handleNotificationChange("security")}
                        className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                      />
                      <span className="text-gray-700">Security alerts and notifications</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.notifications.updates}
                        onChange={() => handleNotificationChange("updates")}
                        className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                      />
                      <span className="text-gray-700">Product updates and announcements</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "billing" && (
              <div className="space-y-6">
                {/* Billing Information */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Method</h3>
                  {loadingPayment ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
                    </div>
                  ) : paymentMethods.length > 0 ? (
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="flex items-center gap-4">
                        <CreditCard size={24} className="text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">Visa ending in {paymentMethods[0].last4}</p>
                          <p className="text-sm text-gray-500">
                            Expires {paymentMethods[0].exp_month}/{paymentMethods[0].exp_year}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleDeletePaymentMethod(paymentMethods[0].id)}
                          className="text-red-500 hover:text-red-600 font-medium"
                        >
                          Delete
                        </button>
                        <button
                          onClick={handleUpdatePaymentMethod}
                          className="text-orange-500 hover:text-orange-600 font-medium"
                        >
                          Update
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-500 mb-4">No payment method on file</p>
                      <button
                        onClick={handleUpdatePaymentMethod}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        Add Payment Method
                      </button>
                    </div>
                  )}
                </div>

                {/* Billing History */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Billing History</h3>
                  {loadingPayment ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
                    </div>
                  ) : (
                    <div>
                      {customerData?.subscription_status === "active" ? (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="text-left border-b border-gray-200">
                                <th className="pb-3 text-sm font-medium text-gray-500">Date</th>
                                <th className="pb-3 text-sm font-medium text-gray-500">Description</th>
                                <th className="pb-3 text-sm font-medium text-gray-500">Amount</th>
                                <th className="pb-3 text-sm font-medium text-gray-500">Status</th>
                                {/* <th className="pb-3 text-sm font-medium text-gray-500">Invoice</th> */}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              <tr>
                                <td className="py-4 text-sm text-gray-900">
                                  {new Date(customerData?.subscription_data?.startDate).toLocaleDateString()}
                                </td>
                                <td className="py-4">
                                  <span
                                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${customerData?.subscription_status === "active"
                                      ? "bg-green-100 text-green-800"
                                      : customerData?.subscription_status === "inactive"
                                        ? "bg-red-100 text-red-800"
                                        : "bg-yellow-100 text-yellow-800"
                                      }`}
                                  >
                                    {customerData?.subscription_tier
                                      ? customerData.subscription_tier.charAt(0).toUpperCase() + customerData.subscription_tier.slice(1)
                                      : "N/A"}
                                  </span>
                                </td>
                                <td className="py-4 text-sm text-gray-900">
                                  {customerData.subscription_tier == "pro_yearly" ? "$25" : "$49"}
                                </td>
                                <td className="py-4 text-sm text-gray-900">
                                  {customerData.subscription_status}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                      ) : (
                        <div className="text-center py-8">
                          <p className="text-gray-500 mb-2">No billing history available</p>
                          <p className="text-sm text-gray-400">
                            Your payment history will appear here once you make a payment
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div className="space-y-6">
                {/* Password Change */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield size={20} className="text-orange-500" />
                    <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>
                  </div>
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                      <input
                        type="password"
                        name="currentPassword"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                      <input
                        type="password"
                        name="newPassword"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                      <input
                        type="password"
                        name="confirmPassword"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {loading ? (
                        "Updating..."
                      ) : success ? (
                        <>
                          <Check size={16} />
                          Updated Successfully
                        </>
                      ) : (
                        "Update Password"
                      )}
                    </button>
                  </form>
                </div>

                {/* Two-Factor Authentication */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Two-Factor Authentication</h3>
                      <p className="text-gray-600">Add an extra layer of security to your account</p>
                    </div>
                    <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                      Enable 2FA
                    </button>
                  </div>
                </div>

                {/* Active Sessions */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Sessions</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <Shield size={20} className="text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Current Session</p>
                          <p className="text-sm text-gray-500">Last active: Just now</p>
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                        Active
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Update Modal */}
      <PaymentUpdateModal />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Delete Payment Method</h3>
              <p className="text-gray-600 mt-2">
                Are you sure you want to delete this payment method? This action cannot be undone.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirmation(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeletePaymentMethod}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-16 border-t border-gray-200 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-center text-gray-500 text-sm">© 2025 WinProd AI. All rights reserved.</p>
          <div className="flex justify-center space-x-6 mt-4">
            <a href="/privacy" className="text-sm text-gray-500 hover:text-gray-700">
              Privacy
            </a>
            <a href="/terms" className="text-sm text-gray-500 hover:text-gray-700">
              Terms
            </a>
            <a href="/getting-started" className="text-sm text-gray-500 hover:text-gray-700">
              Getting Started
            </a>
            <a href="/faq" className="text-sm text-gray-500 hover:text-gray-700">
              FAQ
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Account

