import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Crown, Eye, EyeOff, LogIn } from 'lucide-react';
import { getPostLoginPath } from '../../lib/postLoginRedirect';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast('Please fill all fields', 'error'); return; }
    setLoading(true);
    const { error, profileMissing, profile } = await signIn(email, password);
    setLoading(false);
    if (error) { toast(error, 'error'); return; }
    if (profileMissing) return;
    toast('Welcome back!');
    navigate(profile ? getPostLoginPath(profile) : '/dashboard');
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
