import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Crown, Eye, EyeOff, LogIn, Users, Package, Store, Shield, Share2 } from 'lucide-react';
import type { Role } from '../../types';
import { getRoleLabel } from '../../lib/format';

const demoRoles: { role: Role; icon: React.ReactNode; desc: string }[] = [
  { role: 'AFFILIATE', icon: <Share2 className="w-4 h-4" />, desc: 'Earn commissions' },
  { role: 'RESELLER', icon: <Users className="w-4 h-4" />, desc: 'Resell products' },
  { role: 'VENDOR', icon: <Package className="w-4 h-4" />, desc: 'Sell products' },
  { role: 'SAAS_OWNER', icon: <Store className="w-4 h-4" />, desc: 'Own a store' },
  { role: 'ADMIN', icon: <Shield className="w-4 h-4" />, desc: 'Manage platform' },
];

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<Role | null>(null);
  const { signIn, demoLogin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast('Please fill all fields', 'error'); return; }
    setLoading(true);
    const { error, profileMissing } = await signIn(email, password);
    setLoading(false);
    if (error) { toast(error, 'error'); return; }
    if (profileMissing) return;
    toast('Welcome back!');
    navigate('/dashboard');
  };

  const handleDemoLogin = async (role: Role) => {
    setDemoLoading(role);
    const { error } = await demoLogin(role);
    setDemoLoading(null);
    if (error) { toast(error, 'error'); return; }
    toast(`Logged in as Demo ${getRoleLabel(role)}`);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-navy-900 flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20 w-72 h-72 bg-accent-500 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent-500 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 px-12 max-w-lg">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-accent-500 rounded-xl flex items-center justify-center">
              <Crown className="w-7 h-7 text-white" />
            </div>
            <span className="text-3xl font-bold text-white tracking-tight">UCMP</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            India's All-in-One Online Income Ecosystem
          </h1>
          <p className="text-navy-300 text-lg leading-relaxed">
            Start earning through affiliate marketing, reselling, or launch your own white-label commerce platform.
          </p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-10 h-10 bg-accent-500 rounded-xl flex items-center justify-center">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">UCMP</span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
          <p className="text-navy-400 mb-8">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent transition-all"
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
                  className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent transition-all pr-12"
                  placeholder="Enter your password"
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
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-accent-500 hover:bg-accent-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-navy-700" />
            <span className="text-xs text-navy-500 font-medium">OR TRY DEMO</span>
            <div className="flex-1 h-px bg-navy-700" />
          </div>

          <div className="grid grid-cols-1 gap-2">
            {demoRoles.map(({ role, icon, desc }) => (
              <button
                key={role}
                onClick={() => handleDemoLogin(role)}
                disabled={demoLoading !== null}
                className="flex items-center gap-3 px-4 py-3 bg-navy-800/50 hover:bg-navy-800 border border-navy-700 rounded-xl transition-all group disabled:opacity-50"
              >
                <div className="w-8 h-8 rounded-lg bg-accent-500/10 flex items-center justify-center text-accent-400 group-hover:bg-accent-500/20 transition-colors">
                  {icon}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-white">Demo {getRoleLabel(role)}</p>
                  <p className="text-xs text-navy-500">{desc}</p>
                </div>
                {demoLoading === role && (
                  <div className="w-4 h-4 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin" />
                )}
              </button>
            ))}
          </div>

          <p className="text-center text-sm text-navy-500 mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-accent-400 hover:text-accent-300 font-medium">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
