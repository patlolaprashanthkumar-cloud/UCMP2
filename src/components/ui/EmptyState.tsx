import { PackageOpen } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-navy-50 flex items-center justify-center mb-4">
        {icon || <PackageOpen className="w-8 h-8 text-navy-300" />}
      </div>
      <h3 className="text-lg font-semibold text-navy-800 mb-1">{title}</h3>
      <p className="text-sm text-navy-500 max-w-sm mb-4">{description}</p>
      {action}
    </div>
  );
}
