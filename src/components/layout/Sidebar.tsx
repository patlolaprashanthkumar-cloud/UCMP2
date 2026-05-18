import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { Role } from '../../types';
import {
  LayoutDashboard, Package, ShoppingCart, Wallet, Users, Settings,
  Trophy, Shield, BarChart3, Store, LogOut,
  Menu, X, ChevronRight, Zap, FileCheck, Crown, User, DollarSign,
} from 'lucide-react';
import { getRoleLabel } from '../../lib/format';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: Role[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['VENDOR', 'SAAS_OWNER', 'ADMIN'] },
  { label: 'Profile', path: '/dashboard/profile', icon: <User className="w-5 h-5" />, roles: ['VENDOR', 'SAAS_OWNER'] },
  { label: 'Products', path: '/dashboard/products', icon: <Package className="w-5 h-5" />, roles: ['VENDOR', 'ADMIN'] },
  { label: 'My Products', path: '/dashboard/my-products', icon: <Package className="w-5 h-5" />, roles: ['VENDOR'] },
  { label: 'Orders', path: '/dashboard/orders', icon: <ShoppingCart className="w-5 h-5" />, roles: ['VENDOR', 'ADMIN'] },
  { label: 'Wallet', path: '/dashboard/wallet', icon: <Wallet className="w-5 h-5" />, roles: ['VENDOR', 'SAAS_OWNER'] },
  { label: 'Referrals', path: '/dashboard/referrals', icon: <Users className="w-5 h-5" />, roles: ['VENDOR', 'SAAS_OWNER'] },
  { label: 'KYC', path: '/dashboard/kyc', icon: <FileCheck className="w-5 h-5" />, roles: ['VENDOR', 'SAAS_OWNER'] },
  { label: 'Challenges', path: '/dashboard/challenges', icon: <Zap className="w-5 h-5" />, roles: ['VENDOR'] },
  { label: 'My Store', path: '/dashboard/saas', icon: <Store className="w-5 h-5" />, roles: ['SAAS_OWNER'] },
  { label: 'Leaderboard', path: '/leaderboard', icon: <Trophy className="w-5 h-5" />, roles: ['VENDOR', 'SAAS_OWNER', 'ADMIN'] },
  { label: 'Users', path: '/dashboard/admin/users', icon: <Users className="w-5 h-5" />, roles: ['ADMIN'] },
  { label: 'Commissions', path: '/dashboard/admin/commissions', icon: <Settings className="w-5 h-5" />, roles: ['ADMIN'] },
  { label: 'KYC Review', path: '/dashboard/admin/kyc', icon: <Shield className="w-5 h-5" />, roles: ['ADMIN'] },
  { label: 'Withdrawals', path: '/dashboard/admin/withdrawals', icon: <Wallet className="w-5 h-5" />, roles: ['ADMIN'] },
  { label: 'Tenants', path: '/dashboard/admin/tenants', icon: <Store className="w-5 h-5" />, roles: ['ADMIN'] },
  { label: 'Billing', path: '/dashboard/admin/billing', icon: <DollarSign className="w-5 h-5" />, roles: ['ADMIN'] },
  { label: 'Analytics', path: '/dashboard/admin/analytics', icon: <BarChart3 className="w-5 h-5" />, roles: ['ADMIN'] },
];

export function Sidebar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  const filteredItems = navItems.filter((item) => item.roles.includes(user.role));

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  const nav = (
    <>
      <div className="px-4 py-6 border-b border-navy-800">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 bg-accent-500 rounded-lg flex items-center justify-center">
            <Crown className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold text-white tracking-tight">UCMP</span>
            <p className="text-[10px] text-navy-400 -mt-0.5">Commerce Platform</p>
          </div>
        </Link>
      </div>

      <div className="px-3 py-3 border-b border-navy-800">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-9 h-9 rounded-full bg-accent-500/20 flex items-center justify-center text-accent-400 font-semibold text-sm">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <p className="text-xs text-navy-400">{getRoleLabel(user.role)}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
              isActive(item.path)
                ? 'bg-accent-500/15 text-accent-400'
                : 'text-navy-300 hover:bg-navy-800 hover:text-white'
            }`}
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>
            {isActive(item.path) && <ChevronRight className="w-4 h-4 text-accent-400" />}
          </Link>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-navy-800">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-navy-400 hover:bg-navy-800 hover:text-white transition-all w-full"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-navy-900 rounded-lg text-white shadow-lg"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-navy-900 flex flex-col transform transition-transform duration-300 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-1 text-navy-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        {nav}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-navy-900">
        {nav}
      </aside>
    </>
  );
}
