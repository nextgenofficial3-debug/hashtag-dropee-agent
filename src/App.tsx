import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AgentLayout from "@/components/layout/AgentLayout";
import DashboardPage from "@/pages/agent/DashboardPage";
import OrdersPage from "@/pages/agent/OrdersPage";
import ActiveDeliveryPage from "@/pages/agent/ActiveDeliveryPage";
import CompleteDeliveryPage from "@/pages/agent/CompleteDeliveryPage";
import EarningsPage from "@/pages/agent/EarningsPage";
import ProfilePage from "@/pages/agent/ProfilePage";
import NotificationsPage from "@/pages/agent/NotificationsPage";
import ReceiptPage from "@/pages/agent/ReceiptPage";
import NewOrderPage from "@/pages/agent/NewOrderPage";
import DeliveryHistoryPage from "@/pages/agent/DeliveryHistoryPage";
import CustomersPage from "@/pages/agent/CustomersPage";
import VendorsPage from "@/pages/agent/VendorsPage";
import ExternalOrdersPage from "@/pages/agent/ExternalOrdersPage";
import LoginPage from "@/pages/auth/LoginPage";
import AuthCallbackHandler from "@/pages/auth/AuthCallbackHandler";
import InstallPage from "@/pages/InstallPage";
import NotFound from "./pages/NotFound";
import OrderDetailPage from "@/pages/agent/OrderDetailPage";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isAgent, loading, authError, signOut } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm animate-pulse">Syncing agent profile...</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="glass rounded-2xl border border-destructive/20 p-8 max-w-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <span className="text-2xl text-destructive">⚠️</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">Sync Error</h2>
            <p className="text-sm text-muted-foreground">{authError}</p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full h-11 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Retry Sync
            </button>
            <button
              onClick={signOut}
              className="w-full h-11 rounded-xl bg-secondary text-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth/login" replace />;
  if (!isAgent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="glass rounded-2xl border border-border p-8 max-w-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-xl bg-destructive/15 flex items-center justify-center mx-auto">
            <span className="text-3xl">🚫</span>
          </div>
          <h2 className="text-lg font-bold text-foreground">Not an Agent</h2>
          <p className="text-sm text-muted-foreground">
            Your account <span className="font-medium text-foreground">{user.email}</span> does not
            have delivery agent access. Contact your admin to get assigned.
          </p>
          <button
            onClick={signOut}
            className="w-full h-11 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isAgent, loading, authError } = useAuth();
  if (loading) return null;
  // If there is an auth error, allow showing the login page/public content
  if (authError) return <>{children}</>;
  if (user && isAgent) return <Navigate to="/agent/dashboard" replace />;
  return <>{children}</>;
}


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Navigate to="/agent/dashboard" replace />
                </ProtectedRoute>
              } 
            />
            <Route path="/install" element={<InstallPage />} />
            <Route path="/auth/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/auth/signup" element={<Navigate to="/auth/login" replace />} />
            <Route path="/auth/callback" element={<AuthCallbackHandler />} />
            <Route
              path="/agent"
              element={
                <ProtectedRoute>
                  <AgentLayout />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="orders/:orderId" element={<OrderDetailPage />} />
              <Route path="active-delivery" element={<ActiveDeliveryPage />} />
              <Route path="complete-delivery" element={<CompleteDeliveryPage />} />
              <Route path="earnings" element={<EarningsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="receipt/:orderId" element={<ReceiptPage />} />
              <Route path="new-order" element={<NewOrderPage />} />
              <Route path="history" element={<DeliveryHistoryPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="vendors" element={<VendorsPage />} />
              <Route path="external-orders" element={<ExternalOrdersPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
