import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Crown, Eye, EyeOff, UserPlus } from 'lucide-react';
import type { Role } from '../../types';
import { getRoleLabel } from '../../lib/format';

const roles: { role: Role; desc: string }[] = [
  { role: 'AFFILIATE', desc: 'Earn commissions by sharing product links' },
  { role: 'RESELLER', desc: 'Buy low, sell high with custom margins' },
  { role: 'VENDOR', desc: 'List and sell your own products' },
  { role: 'SAAS_OWNER', desc: 'Launch your own white-label store' },
  { role: 'CUSTOMER', desc: 'Shop products from curated stores' },
];

const URL_SIGNUP_ROLES = new Set<Role>(['AFFILIATE', 'RESELLER', 'VENDOR', 'SAAS_OWNER', 'CUSTOMER']);

function roleFromSearchParam(raw: string | null): Role {
  if (!raw) return 'AFFILIATE';
  const upper = raw.trim().toUpperCase();
  return URL_SIGNUP_ROLES.has(upper as Role) ? (upper as Role) : 'AFFILIATE';
}

export function SignupPage() {
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(() => roleFromSearchParam(searchParams.get('role')));

  useEffect(() => {
    setRole(roleFromSearchParam(searchParams.get('role')));
  }, [searchParams]);
  const [referralCode, setReferralCode] = useState(searchParams.get('ref') || '');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) { toast('Please fill all required fields', 'error'); return; }
    if (password.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    setLoading(true);
    const { error, needsEmailVerification } = await signUp(email, password, name, role, referralCode || undefined);
    setLoading(false);
    if (error) { toast(error, 'error'); return; }
    if (needsEmailVerification) {
      toast('Check your email to confirm your account, then sign in.', 'info');
      navigate('/login');
      return;
    }
    toast('Account created successfully!');
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-10 h-10 bg-accent-500 rounded-xl flex items-center justify-center">
            <Crown className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">UCMP</span>
        </div>

        <div className="bg-navy-800/50 border border-navy-700 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white mb-1">Create your account</h2>
          <p className="text-navy-400 mb-6">Start your online income journey today</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-all"
                placeholder="Enter your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-all pr-12"
                  placeholder="Min 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-500 hover:text-navy-300"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-navy-300 mb-2">Select Role</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {roles.map((r) => (
                  <button
                    key={r.role}
                    type="button"
                    onClick={() => setRole(r.role)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      role === r.role
                        ? 'border-accent-500 bg-accent-500/10'
                        : 'border-navy-700 bg-navy-800/50 hover:border-navy-600'
                    }`}
                  >
                    <p className={`text-sm font-medium ${role === r.role ? 'text-accent-400' : 'text-white'}`}>
                      {getRoleLabel(r.role)}
                    </p>
                    <p className="text-xs text-navy-500 mt-0.5">{r.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1.5">Referral Code (optional)</label>
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-all"
                placeholder="e.g. UCMPXYZ123"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-accent-500 hover:bg-accent-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Create Account
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-navy-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-accent-400 hover:text-accent-300 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
