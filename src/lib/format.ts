export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatINRCompact(amount: number): string {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
  return formatINR(amount);
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string): string {
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function maskName(name: string): string {
  if (name.length <= 3) return name + '***';
  return name.slice(0, 3) + '***';
}

export function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'UCMP';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-warning-100 text-warning-600',
    confirmed: 'bg-success-100 text-success-600',
    shipped: 'bg-blue-100 text-blue-600',
    delivered: 'bg-success-100 text-success-600',
    cancelled: 'bg-error-100 text-error-600',
    returned: 'bg-error-100 text-error-600',
    completed: 'bg-success-100 text-success-600',
    failed: 'bg-error-100 text-error-600',
    rejected: 'bg-error-100 text-error-600',
    verified: 'bg-success-100 text-success-600',
  };
  return colors[status] || 'bg-gray-100 text-gray-600';
}

export function getRoleBadgeColor(role: string): string {
  const colors: Record<string, string> = {
    AFFILIATE: 'bg-blue-100 text-blue-700',
    RESELLER: 'bg-accent-100 text-accent-700',
    VENDOR: 'bg-teal-100 text-teal-700',
    SAAS_OWNER: 'bg-navy-100 text-navy-700',
    ADMIN: 'bg-error-100 text-error-700',
  };
  return colors[role] || 'bg-gray-100 text-gray-700';
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    AFFILIATE: 'Affiliate',
    RESELLER: 'Reseller',
    VENDOR: 'Vendor',
    SAAS_OWNER: 'SaaS Owner',
    ADMIN: 'Admin',
  };
  return labels[role] || role;
}
