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
import { PortalProfilePage } from './pages/dashboard/PortalProfilePage';
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
import { AdminBilling } from './pages/dashboard/admin/AdminBilling';
import { ProductsPage } from './pages/dashboard/ProductsPage';
import { StoreLayout } from './pages/store/StoreLayout';
import { StoreCatalogPage } from './pages/store/StoreCatalogPage';
import { StoreProductPage } from './pages/store/StoreProductPage';
import { StoreCartPage } from './pages/store/StoreCartPage';
import { StoreWishlistPage } from './pages/store/StoreWishlistPage';
import { StoreCheckoutPage } from './pages/store/StoreCheckoutPage';
import { StoreLoginPage } from './pages/store/StoreLoginPage';
import { StoreSignupPage } from './pages/store/StoreSignupPage';
import { StoreAccountPage } from './pages/store/StoreAccountPage';

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

      <Route path="/store/:slug" element={<StoreLayout />}>
        <Route index element={<StoreCatalogPage />} />
        <Route path="product/:productId" element={<StoreProductPage />} />
        <Route path="cart" element={<StoreCartPage />} />
        <Route path="wishlist" element={<StoreWishlistPage />} />
        <Route path="checkout" element={<StoreCheckoutPage />} />
        <Route path="login" element={<StoreLoginPage />} />
        <Route path="signup" element={<StoreSignupPage />} />
        <Route path="account" element={<StoreAccountPage />} />
      </Route>

      <Route path="/login" element={<AuthRedirect><LoginPage /></AuthRedirect>} />
      <Route path="/signup" element={<AuthRedirect><SignupPage /></AuthRedirect>} />

      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardHome />} />
        <Route path="profile" element={<PortalProfilePage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="my-products" element={<VendorProducts />} />
        <Route path="orders" element={<VendorOrders />} />
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
        <Route path="admin/billing" element={<AdminBilling />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
