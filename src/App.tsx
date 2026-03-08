import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AgentLayout from "@/components/layout/AgentLayout";
import DashboardPage from "@/pages/agent/DashboardPage";
import OrdersPage from "@/pages/agent/OrdersPage";
import ActiveDeliveryPage from "@/pages/agent/ActiveDeliveryPage";
import CompleteDeliveryPage from "@/pages/agent/CompleteDeliveryPage";
import EarningsPage from "@/pages/agent/EarningsPage";
import ProfilePage from "@/pages/agent/ProfilePage";
import NotificationsPage from "@/pages/agent/NotificationsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/agent/dashboard" replace />} />
          <Route path="/agent" element={<AgentLayout />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="active-delivery" element={<ActiveDeliveryPage />} />
            <Route path="complete-delivery" element={<CompleteDeliveryPage />} />
            <Route path="earnings" element={<EarningsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
