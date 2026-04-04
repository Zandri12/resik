import { Toaster } from 'sonner'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import OwnerLayout from './components/OwnerLayout'
import PermissionRoute from './components/PermissionRoute'
import Landing from './pages/Landing'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ContactAdmin from './pages/ContactAdmin'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import CustomerForm from './pages/CustomerForm'
import Orders from './pages/Orders'
import OrderForm from './pages/OrderForm'
import OrderDetail from './pages/OrderDetail'
import Expenses from './pages/Expenses'
import Settings from './pages/Settings'
import ServicePackages from './pages/ServicePackages'
import Users from './pages/Users'
import UserForm from './pages/UserForm'
import ReceiptPrint from './pages/ReceiptPrint'
import EmployeePerformance from './pages/EmployeePerformance'
import LandingContent from './pages/LandingContent'
import LandingContentDetail from './pages/LandingContentDetail'
import Profile from './pages/Profile'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-8 text-center font-body text-on-surface">Memuat...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            closeButton:
              '!left-auto !right-2 !top-2 !size-7 !rounded-md !bg-transparent !text-muted-foreground hover:!bg-muted hover:!text-foreground !border-0',
          },
        }}
      />
      <BrowserRouter>
        <div className="min-h-dvh min-w-0 overflow-x-clip">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/konten/:slug" element={<LandingContentDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/lupa-sandi" element={<ForgotPassword />} />
          <Route path="/hubungi-admin" element={<ContactAdmin />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <OwnerLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<PermissionRoute permission="dashboard"><Dashboard /></PermissionRoute>} />
            <Route path="orders" element={<PermissionRoute permission="orders"><Orders /></PermissionRoute>} />
            <Route path="orders/new" element={<PermissionRoute permission="orders"><OrderForm /></PermissionRoute>} />
            <Route path="orders/:id/print" element={<PermissionRoute permission="orders"><ReceiptPrint /></PermissionRoute>} />
            <Route path="orders/:id" element={<PermissionRoute permission="orders"><OrderDetail /></PermissionRoute>} />
            <Route path="layanan" element={<PermissionRoute permission="layanan"><ServicePackages /></PermissionRoute>} />
            <Route
              path="konten-landing"
              element={
                <PermissionRoute permission="landing_content">
                  <LandingContent />
                </PermissionRoute>
              }
            />
            <Route path="customers" element={<PermissionRoute permission="customers"><Customers /></PermissionRoute>} />
            <Route path="customers/new" element={<PermissionRoute permission="customers"><CustomerForm /></PermissionRoute>} />
            <Route path="customers/:id" element={<PermissionRoute permission="customers"><CustomerForm /></PermissionRoute>} />
            <Route path="expenses" element={<PermissionRoute permission="expenses"><Expenses /></PermissionRoute>} />
            <Route path="reports" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="kinerja-karyawan"
              element={
                <PermissionRoute permission="employee_performance">
                  <EmployeePerformance />
                </PermissionRoute>
              }
            />
            <Route path="settings" element={<PermissionRoute permission="settings"><Settings /></PermissionRoute>} />
            <Route path="profile" element={<Profile />} />
            <Route path="users" element={<PermissionRoute permission="users"><Users /></PermissionRoute>} />
            <Route path="users/new" element={<PermissionRoute permission="users.create"><UserForm /></PermissionRoute>} />
            <Route path="users/:id" element={<PermissionRoute permission="users.edit"><UserForm /></PermissionRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}
