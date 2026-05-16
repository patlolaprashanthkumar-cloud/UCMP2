import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  trend?: number;
  subtitle?: string;
  color?: 'accent' | 'success' | 'blue' | 'navy';
}

const iconBgColors = {
  accent: 'bg-accent-50 text-accent-500',
  success: 'bg-success-50 text-success-500',
  blue: 'bg-blue-50 text-blue-500',
  navy: 'bg-navy-50 text-navy-500',
};

export function StatCard({ title, value, icon, trend, subtitle, color = 'accent' }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl p-5 border border-navy-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-navy-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-navy-900 animate-count-up">{value}</p>
          {subtitle && <p className="text-xs text-navy-400">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl ${iconBgColors[color]}`}>
          {icon}
        </div>
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${trend >= 0 ? 'text-success-600' : 'text-error-600'}`}>
          {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          <span>{Math.abs(trend)}% from last month</span>
        </div>
      )}
    </div>
  );
}
