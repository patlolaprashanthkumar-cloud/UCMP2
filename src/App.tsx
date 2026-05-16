import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { LandingPage } from './pages/public/LandingPage';
import { PricingPage } from './pages/public/PricingPage';
import { FunnelPage } from './pages/public/FunnelPage';
import { LeaderboardPage } from './pages/public/LeaderboardPage';
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { DashboardHome } from './pages/dashboard/DashboardHome';
import { AffiliateLinks } from './pages/dashboard/AffiliateLinks';
import { ResellerProducts } from './pages/dashboard/ResellerProducts';
import { VendorProducts } from './pages/dashboard/VendorProducts';
import { VendorOrders } from './pages/dashboard/VendorOrders';
import { WalletPage } from './pages/dashboard/WalletPage';
import { KYCPage } from './pages/dashboard/KYCPage';
import { ReferralsPage } from './pages/dashboard/ReferralsPage';
import { ChallengesPage } from './pages/dashboard/ChallengesPage';
import { SaasDashboard } from './pages/dashboard/SaasDashboard';
import { AdminUsers } from './pages/dashboard/admin/AdminUsers';
import { AdminCommissions } from './pages/dashboard/admin/AdminCommissions';
import { AdminKYC } from './pages/dashboard/admin/AdminKYC';
import { AdminWithdrawals } from './pages/dashboard/admin/AdminWithdrawals';
import { AdminTenants } from './pages/dashboard/admin/AdminTenants';
import { AdminAnalytics } from './pages/dashboard/admin/AdminAnalytics';
import { ProductsPage } from './pages/dashboard/ProductsPage';

function AuthRedirect({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="/affiliate-landing" element={<FunnelPage />} />
      <Route path="/reseller-landing" element={<FunnelPage />} />
      <Route path="/saas-landing" element={<FunnelPage />} />
      <Route path="/join" element={<Navigate to="/signup" replace />} />

      <Route path="/login" element={<AuthRedirect><LoginPage /></AuthRedirect>} />
      <Route path="/signup" element={<AuthRedirect><SignupPage /></AuthRedirect>} />

      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardHome />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="links" element={<AffiliateLinks />} />
        <Route path="resell" element={<ResellerProducts />} />
        <Route path="my-products" element={<VendorProducts />} />
        <Route path="orders" element={<VendorOrders />} />
        <Route path="my-orders" element={<AffiliateLinks />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="kyc" element={<KYCPage />} />
        <Route path="referrals" element={<ReferralsPage />} />
        <Route path="challenges" element={<ChallengesPage />} />
        <Route path="saas" element={<SaasDashboard />} />
        <Route path="admin/users" element={<AdminUsers />} />
        <Route path="admin/commissions" element={<AdminCommissions />} />
        <Route path="admin/kyc" element={<AdminKYC />} />
        <Route path="admin/withdrawals" element={<AdminWithdrawals />} />
        <Route path="admin/tenants" element={<AdminTenants />} />
        <Route path="admin/analytics" element={<AdminAnalytics />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
