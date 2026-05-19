import { Link } from 'react-router-dom';
import {
  Crown, ArrowRight, Share2, Store, Zap, TrendingUp, Users, Shield,
  ChevronRight, DollarSign, Package, BarChart3,
} from 'lucide-react';

const platformHighlights = [
  { label: 'Affiliate to SaaS', sub: 'One account, multiple ways to earn', icon: <Users className="w-5 h-5" /> },
  { label: 'Dashboards', sub: 'Orders, wallet, and referrals in one place', icon: <BarChart3 className="w-5 h-5" /> },
  { label: 'Payouts', sub: 'Withdraw to your bank after verification', icon: <DollarSign className="w-5 h-5" /> },
];

const steps = [
  { step: '01', title: 'Choose Your Role', desc: 'Sign up as an Affiliate, Reseller, Vendor, or SaaS Owner based on your goals.', icon: <Users className="w-6 h-6" /> },
  { step: '02', title: 'Start Earning', desc: 'Share links, resell products, or list your own inventory. Commissions are instant.', icon: <TrendingUp className="w-6 h-6" /> },
  { step: '03', title: 'Withdraw Profits', desc: 'Track earnings in real-time and withdraw directly to your bank account.', icon: <DollarSign className="w-6 h-6" /> },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-[100] bg-white/80 backdrop-blur-xl border-b border-navy-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between relative z-10">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent-500 rounded-lg flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-navy-900">UCMP</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link to="/pricing" className="text-sm font-medium text-navy-600 hover:text-navy-900 transition-colors">Pricing</Link>
            <Link to="/leaderboard" className="text-sm font-medium text-navy-600 hover:text-navy-900 transition-colors">Leaderboard</Link>
            <Link to="/affiliate-landing" className="text-sm font-medium text-navy-600 hover:text-navy-900 transition-colors">Earn Money</Link>
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <Link to="/login" className="text-sm font-medium text-navy-600 hover:text-navy-900 px-4 py-2 transition-colors">
              Sign In
            </Link>
            <Link to="/signup" className="text-sm font-semibold text-white bg-accent-500 hover:bg-accent-600 px-5 py-2.5 rounded-xl transition-all shadow-sm hover:shadow-md">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-accent-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-accent-50 text-accent-600 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            India's First All-in-One Online Income Ecosystem
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-navy-900 mb-6 leading-tight">
            Start Your Online Income
            <br />
            <span className="text-accent-500">In Minutes</span>
          </h1>
          <p className="text-lg sm:text-xl text-navy-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Whether you want to earn through affiliate marketing, reselling products, or building your own
            commerce platform — UCMP gives you everything under one roof.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/signup?role=AFFILIATE"
              className="flex items-center gap-2 px-8 py-4 bg-accent-500 hover:bg-accent-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-accent-500/25 hover:shadow-xl hover:shadow-accent-500/30 text-lg group"
            >
              <Share2 className="w-5 h-5" />
              Become Affiliate
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/signup?role=RESELLER"
              className="flex items-center gap-2 px-8 py-4 bg-navy-900 hover:bg-navy-800 text-white font-semibold rounded-xl transition-all text-lg"
            >
              Start Reselling
            </Link>
            <Link
              to="/saas-landing"
              className="flex items-center gap-2 px-8 py-4 border-2 border-navy-200 hover:border-navy-300 text-navy-700 font-semibold rounded-xl transition-all text-lg"
            >
              <Store className="w-5 h-5" />
              Launch Platform
            </Link>
          </div>
        </div>
      </section>

      {/* Platform highlights */}
      <section className="bg-navy-900 py-6">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16">
          {platformHighlights.map((s) => (
            <div key={s.label} className="flex items-center gap-3 text-white max-w-xs">
              <div className="p-2 bg-accent-500/20 rounded-lg text-accent-400 shrink-0">{s.icon}</div>
              <div>
                <p className="text-sm font-semibold">{s.label}</p>
                <p className="text-xs text-navy-400">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-navy-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-navy-900 mb-3">How It Works</h2>
            <p className="text-navy-500 text-lg">Three simple steps to start earning</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.step} className="bg-white rounded-2xl p-8 border border-navy-100 hover:shadow-lg transition-shadow group">
                <div className="w-12 h-12 bg-accent-50 rounded-xl flex items-center justify-center text-accent-500 mb-5 group-hover:bg-accent-500 group-hover:text-white transition-colors">
                  {s.icon}
                </div>
                <span className="text-xs font-bold text-accent-500 tracking-wider">STEP {s.step}</span>
                <h3 className="text-xl font-bold text-navy-900 mt-2 mb-2">{s.title}</h3>
                <p className="text-navy-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-navy-900 mb-3">Everything You Need</h2>
            <p className="text-navy-500 text-lg">Built for India's entrepreneurial economy</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: <Share2 className="w-5 h-5" />, title: 'Affiliate Marketing', desc: 'Share links, earn commissions on every sale. Zero investment needed.' },
              { icon: <Package className="w-5 h-5" />, title: 'Product Reselling', desc: 'Set your own margins and sell products via WhatsApp and social media.' },
              { icon: <Store className="w-5 h-5" />, title: 'White-Label Store', desc: 'Launch your own branded commerce platform with full customization.' },
              { icon: <BarChart3 className="w-5 h-5" />, title: 'Real-Time Analytics', desc: 'Track every sale, commission, and payout with live dashboards.' },
              { icon: <Shield className="w-5 h-5" />, title: 'Secure Payments', desc: 'Razorpay-powered checkout with instant commission crediting.' },
              { icon: <TrendingUp className="w-5 h-5" />, title: 'Multi-Level Commissions', desc: 'Earn from direct sales and up to 3 levels of referral network.' },
            ].map((f) => (
              <div key={f.title} className="p-6 rounded-2xl border border-navy-100 hover:border-accent-200 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-xl bg-accent-50 text-accent-500 flex items-center justify-center mb-4 group-hover:bg-accent-500 group-hover:text-white transition-colors">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-navy-900 mb-1">{f.title}</h3>
                <p className="text-sm text-navy-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="py-16 px-4 bg-navy-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-3">Plans for Every Ambition</h2>
          <p className="text-navy-300 text-lg mb-8">From free affiliate accounts to full SaaS platform clones</p>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 px-8 py-4 bg-accent-500 hover:bg-accent-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-accent-500/25 group"
          >
            View Pricing
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* Trust */}
      <section className="py-16 px-4 bg-navy-50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-navy-900 mb-4">Built for serious earners</h2>
          <p className="text-navy-500 leading-relaxed">
            Complete KYC, pick your role, and manage orders, wallet, and referrals from your dashboard. Your metrics reflect your real activity on the platform.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-navy-900 mb-4">Ready to Start Earning?</h2>
          <p className="text-navy-500 text-lg mb-8">Create a free account and start from your dashboard with real data for your activity.</p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-10 py-4 bg-accent-500 hover:bg-accent-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-accent-500/25 text-lg group"
          >
            Create Free Account
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy-900 py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-accent-500 rounded-lg flex items-center justify-center">
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-white">UCMP</span>
              </div>
              <p className="text-sm text-navy-400">India's all-in-one online income ecosystem for affiliates, resellers, vendors, and SaaS owners.</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Platform</h4>
              <div className="space-y-2">
                <Link to="/pricing" className="block text-sm text-navy-400 hover:text-white transition-colors">Pricing</Link>
                <Link to="/affiliate-landing" className="block text-sm text-navy-400 hover:text-white transition-colors">Affiliate Program</Link>
                <Link to="/reseller-landing" className="block text-sm text-navy-400 hover:text-white transition-colors">Reseller Program</Link>
                <Link to="/saas-landing" className="block text-sm text-navy-400 hover:text-white transition-colors">SaaS Platform</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Resources</h4>
              <div className="space-y-2">
                <Link to="/leaderboard" className="block text-sm text-navy-400 hover:text-white transition-colors">Leaderboard</Link>
                <Link to="/help" className="block text-sm text-navy-400 hover:text-white transition-colors">
                  Help Center
                </Link>
                <Link to="/docs" className="block text-sm text-navy-400 hover:text-white transition-colors">
                  API Docs
                </Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Legal</h4>
              <div className="space-y-2">
                <Link to="/privacy" className="block text-sm text-navy-400 hover:text-white transition-colors">
                  Privacy Policy
                </Link>
                <Link to="/terms" className="block text-sm text-navy-400 hover:text-white transition-colors">
                  Terms of Service
                </Link>
                <Link to="/refunds" className="block text-sm text-navy-400 hover:text-white transition-colors">
                  Refund Policy
                </Link>
              </div>
            </div>
          </div>
          <div className="border-t border-navy-800 pt-6 text-center text-sm text-navy-500">
            &copy; {new Date().getFullYear()} UCMP. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
