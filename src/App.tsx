import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { Layout } from "@/components/layout/Layout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

// Lazy Pages
const Landing = React.lazy(() => import("@/pages/Landing"));
const Login = React.lazy(() => import("@/pages/Login"));
const Signup = React.lazy(() => import("@/pages/Signup"));
const Dashboard = React.lazy(() => import("@/pages/Dashboard"));
const Explore = React.lazy(() => import("@/pages/Explore"));
const MyList = React.lazy(() => import("@/pages/MyList"));
const Leaderboard = React.lazy(() => import("@/pages/Leaderboard"));
const Profile = React.lazy(() => import("@/pages/Profile"));
const Suggest = React.lazy(() => import("@/pages/Suggest"));
const ResetPassword = React.lazy(() => import("@/pages/ResetPassword"));

// Lazy Admin Pages
const AdminOverview = React.lazy(() => import("@/pages/admin/AdminOverview"));
const AdminProducts = React.lazy(() => import("@/pages/admin/AdminProducts"));
const AdminUsers = React.lazy(() => import("@/pages/admin/AdminUsers"));
const AdminSuggestions = React.lazy(() => import("@/pages/admin/AdminSuggestions"));
const AdminScraper = React.lazy(() => import("@/pages/admin/AdminScraper"));
const AdminBadges = React.lazy(() => import("@/pages/admin/AdminBadges"));

function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-8">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-amul-red border-t-transparent" />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* User-facing layout (Navbar) */}
              <Route element={<Layout />}>
                <Route path="/" element={<Landing />} />

                {/* Protected user routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/explore"
                  element={
                    <ProtectedRoute>
                      <Explore />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/my-list"
                  element={
                    <ProtectedRoute>
                      <MyList />
                    </ProtectedRoute>
                  }
                />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/profile/:username" element={<Profile />} />
                <Route
                  path="/suggest"
                  element={
                    <ProtectedRoute>
                      <Suggest />
                    </ProtectedRoute>
                  }
                />
              </Route>

              {/* Admin routes (sidebar layout, protected + admin-only) */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <AdminLayout />
                    </AdminRoute>
                  </ProtectedRoute>
                }
              >
                <Route index element={<AdminOverview />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="suggestions" element={<AdminSuggestions />} />
                <Route path="scraper" element={<AdminScraper />} />
                <Route path="badges" element={<AdminBadges />} />
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}
