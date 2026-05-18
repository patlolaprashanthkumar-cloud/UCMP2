import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getPostLoginPath, rememberStoreSlug } from '../../lib/postLoginRedirect';
import type { StoreOutletContext } from './storeTypes';
import { Eye, EyeOff, LogIn } from 'lucide-react';

function safeNextPath(slug: string, raw: string | null): string {
  if (!raw || !raw.startsWith('/')) return `/store/${slug}`;
  if (!raw.startsWith(`/store/${slug}`)) return `/store/${slug}`;
  return raw;
}

export function StoreLoginPage() {
  const { tenant, slug } = useOutletContext<StoreOutletContext>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signIn, user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    if (!email || !password) {
      toast('Please fill all fields', 'error');
      return;
    }
    setLoading(true);
    const { error, profileMissing, profile } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast(error, 'error');
      return;
    }
    if (profileMissing) return;
    rememberStoreSlug(slug);
    toast('Welcome back!');
    const dest = profile ? getPostLoginPath(profile) : '/dashboard';
    if (dest.startsWith('/store/')) {
      navigate(next, { replace: true });
    } else {
      navigate(dest, { replace: true });
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <div className="rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] shadow-sm p-8">
        <h1 className="text-2xl font-bold text-[var(--sf-fg)] mb-1">Sign in</h1>
        <p className="text-sm text-[var(--sf-muted)] mb-6">{tenant.store_name}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
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
                autoComplete="current-password"
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
                <LogIn className="w-5 h-5" />
                Sign in
              </>
            )}
          </button>
        </form>
        <p className="text-center text-sm text-[var(--sf-muted)] mt-6">
          New here?{' '}
          <Link to={`/store/${slug}/signup`} className="font-semibold hover:underline" style={{ color: accent }}>
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
