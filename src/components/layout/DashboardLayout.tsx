import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getPostLoginPath } from '../../lib/postLoginRedirect';
import { Sidebar } from './Sidebar';
import { DashboardSkeleton } from '../ui/LoadingSkeleton';
import type { Role } from '../../types';

const STORE_PORTAL_ROLES: Role[] = ['CUSTOMER', 'AFFILIATE', 'RESELLER'];

export function DashboardLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-50 flex items-center justify-center">
        <DashboardSkeleton />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (STORE_PORTAL_ROLES.includes(user.role)) {
    return <Navigate to={getPostLoginPath(user)} replace />;
  }

  return (
    <div className="min-h-screen bg-navy-50">
      <Sidebar />
      <main className="lg:pl-64">
        <div className="px-4 sm:px-6 lg:px-8 py-6 pt-16 lg:pt-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
