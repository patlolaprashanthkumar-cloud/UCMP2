import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, type StoreSignupRole } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { rememberStoreSlug } from '../../lib/postLoginRedirect';
import type { StoreOutletContext } from './storeTypes';
import { Eye, EyeOff, UserPlus } from 'lucide-react';

function safeNextPath(slug: string, raw: string | null): string {
  if (!raw || !raw.startsWith('/')) return `/store/${slug}`;
  if (!raw.startsWith(`/store/${slug}`)) return `/store/${slug}`;
  return raw;
}

export function StoreSignupPage() {
  const { tenant, slug } = useOutletContext<StoreOutletContext>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signUp, user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [storeRole, setStoreRole] = useState<StoreSignupRole>('CUSTOMER');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const accent = tenant.primary_color || '#ea580c';

  const next = safeNextPath(slug, searchParams.get('next'));

  if (user) {
    rememberStoreSlug(slug);
    navigate(next, { replace: true });
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !password) {
      toast('Please fill all required fields', 'error');
      return;
    }
    if (password.length < 6) {
      toast('Password must be at least 6 characters', 'error');
      return;
    }
    setLoading(true);
    const { error, needsEmailVerification } = await signUp(email, password, name, 'CUSTOMER', undefined, {
      tenantId: tenant.id,
      storeRole,
    });
    setLoading(false);
    if (error) {
      toast(error, 'error');
      return;
    }
    rememberStoreSlug(slug);
    if (needsEmailVerification) {
      toast('Check your email to confirm your account, then sign in.', 'info');
      navigate(`/store/${slug}/login?next=${encodeURIComponent(next)}`);
      return;
    }
    toast('Welcome! Your store account is ready.');
    navigate(next, { replace: true });
  }

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <div className="rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] shadow-sm p-8">
        <h1 className="text-2xl font-bold text-[var(--sf-fg)] mb-1">Create account</h1>
        <p className="text-sm text-[var(--sf-muted)] mb-6">Join {tenant.store_name} on UCMP</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--sf-fg)] mb-1">Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[var(--sf-border)] bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--sf-fg)] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[var(--sf-border)] bg-white"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--sf-fg)] mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[var(--sf-border)] bg-white pr-11"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--sf-muted)]"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <div>
            <span className="block text-sm font-medium text-[var(--sf-fg)] mb-2">How you use this store</span>
            <div className="grid grid-cols-1 gap-2">
              {(
                [
                  ['CUSTOMER', 'Shop as a customer'],
                  ['AFFILIATE', 'Share products and earn (affiliate)'],
                  ['RESELLER', 'Resell with margin (reseller)'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStoreRole(value)}
                  className={`text-left px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${
                    storeRole === value ? 'bg-stone-50' : 'border-[var(--sf-border)] bg-white hover:bg-stone-50'
                  }`}
                  style={storeRole === value ? { borderColor: accent, color: accent } : undefined}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: accent }}
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                Create account
              </>
            )}
          </button>
        </form>
        <p className="text-center text-sm text-[var(--sf-muted)] mt-6">
          Already have an account?{' '}
          <Link to={`/store/${slug}/login`} className="font-semibold hover:underline" style={{ color: accent }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
