import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  trend?: number;
  subtitle?: string;
  color?: 'accent' | 'success' | 'blue' | 'navy';
  /** Navigate when the card is clicked */
  to?: string;
  onClick?: () => void;
}

const iconBgColors = {
  accent: 'bg-accent-50 text-accent-500',
  success: 'bg-success-50 text-success-500',
  blue: 'bg-blue-50 text-blue-500',
  navy: 'bg-navy-50 text-navy-500',
};

const shellClass =
  'bg-white rounded-xl p-5 border border-navy-100 hover:shadow-md transition-shadow w-full text-left';

export function StatCard({ title, value, icon, trend, subtitle, color = 'accent', to, onClick }: StatCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-navy-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-navy-900 animate-count-up">{value}</p>
          {subtitle && <p className="text-xs text-navy-400">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl ${iconBgColors[color]}`}>{icon}</div>
      </div>
      {trend !== undefined && (
        <div
          className={`flex items-center gap-1 mt-3 text-xs font-medium ${trend >= 0 ? 'text-success-600' : 'text-error-600'}`}
        >
          {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          <span>{Math.abs(trend)}% from last month</span>
        </div>
      )}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={`${shellClass} block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 rounded-xl`}>
        {body}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${shellClass} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 rounded-xl`}>
        {body}
      </button>
    );
  }

  return <div className={shellClass}>{body}</div>;
}
