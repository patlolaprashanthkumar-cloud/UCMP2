import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Crown, ArrowRight, Calculator, TrendingUp, Shield, Zap, Users, Store, Share2 } from 'lucide-react';
import { formatINR } from '../../lib/format';

const funnelData: Record<string, {
  headline: string;
  subheadline: string;
  steps: { title: string; desc: string }[];
  calcLabel: string;
  calcUnit: string;
  calcRate: number;
  role: string;
}> = {
  affiliate: {
    headline: 'Earn ₹500-₹5,000 Daily Without Investment',
    subheadline: 'Share product links on WhatsApp, Instagram, and YouTube. Earn 10% commission on every sale.',
    steps: [
      { title: 'Sign Up Free', desc: 'Create your affiliate account in 30 seconds. No fees, no investment.' },
      { title: 'Share Product Links', desc: 'Browse 10,000+ products and generate your unique affiliate link.' },
      { title: 'Earn Commissions', desc: 'Get 10% commission on every sale. Withdraw to bank anytime.' },
    ],
    calcLabel: 'Sales per day',
    calcUnit: 'sale',
    calcRate: 100,
    role: 'AFFILIATE',
  },
  reseller: {
    headline: 'Start Your Own Product Business in Minutes',
    subheadline: 'Buy products at base price, sell at your margin. No inventory needed.',
    steps: [
      { title: 'Browse Products', desc: 'Access 10,000+ products from verified vendors across India.' },
      { title: 'Set Your Margins', desc: 'Decide how much you want to earn per product. Full control.' },
      { title: 'Sell & Earn', desc: 'Share via WhatsApp, social media. Keep the full margin on every sale.' },
    ],
    calcLabel: 'Products sold per day',
    calcUnit: 'product',
    calcRate: 150,
    role: 'RESELLER',
  },
  saas: {
    headline: 'Launch Your Own Platform Economy',
    subheadline: 'Get your own branded commerce platform. Manage affiliates, vendors, and earn override commissions.',
    steps: [
      { title: 'Choose Your Plan', desc: 'Start with SaaS Starter at just ₹25,000 setup fee.' },
      { title: 'Customize Your Brand', desc: 'Add your logo, colors, and custom domain.' },
      { title: 'Grow Your Network', desc: 'Invite affiliates and vendors. Earn from every transaction.' },
    ],
    calcLabel: 'Monthly store sales',
    calcUnit: 'sale',
    calcRate: 50,
    role: 'SAAS_OWNER',
  },
};

const icons: Record<string, React.ReactNode> = {
  affiliate: <Share2 className="w-6 h-6" />,
  reseller: <Users className="w-6 h-6" />,
  saas: <Store className="w-6 h-6" />,
};

const FUNNEL_BY_PATH: Record<string, keyof typeof funnelData> = {
  '/affiliate-landing': 'affiliate',
  '/reseller-landing': 'reseller',
  '/saas-landing': 'saas',
};

export function FunnelPage() {
  const { type } = useParams<{ type: string }>();
  const { pathname } = useLocation();
  const pathKey = FUNNEL_BY_PATH[pathname];
  const paramKey =
    type && Object.prototype.hasOwnProperty.call(funnelData, type) ? (type as keyof typeof funnelData) : null;
  const funnelKey = paramKey ?? pathKey ?? 'affiliate';
  const data = funnelData[funnelKey];
  const [calcValue, setCalcValue] = useState(10);

  const dailyIncome = calcValue * data.calcRate;
  const monthlyIncome = dailyIncome * 30;
  const yearlyIncome = monthlyIncome * 12;

  return (
    <div className="min-h-screen bg-white">
      <nav className="fixed top-0 inset-x-0 z-[100] bg-white/80 backdrop-blur-xl border-b border-navy-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between relative z-10">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent-500 rounded-lg flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-navy-900">UCMP</span>
          </Link>
          <Link
            to={`/signup?role=${data.role}`}
            className="text-sm font-semibold text-white bg-accent-500 hover:bg-accent-600 px-5 py-2.5 rounded-xl transition-all relative z-10"
          >
            Join Now
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-4 bg-gradient-to-b from-navy-900 to-navy-800">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-16 h-16 bg-accent-500/20 rounded-2xl flex items-center justify-center text-accent-400 mx-auto mb-6">
            {icons[funnelKey]}
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4 leading-tight">{data.headline}</h1>
          <p className="text-lg text-navy-300 max-w-2xl mx-auto mb-8">{data.subheadline}</p>
          <Link
            to={`/signup?role=${data.role}`}
            className="inline-flex items-center gap-2 px-8 py-4 bg-accent-500 hover:bg-accent-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-accent-500/25 text-lg group"
          >
            Get Started Now
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-navy-900 text-center mb-10">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {data.steps.map((s, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 bg-accent-50 rounded-xl flex items-center justify-center text-accent-600 font-bold mx-auto mb-4">
                  {i + 1}
                </div>
                <h3 className="font-bold text-navy-900 mb-2">{s.title}</h3>
                <p className="text-sm text-navy-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Earnings Calculator */}
      <section className="py-16 px-4 bg-navy-50">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 text-accent-600 mb-3">
              <Calculator className="w-5 h-5" />
              <span className="font-semibold">Earnings Calculator</span>
            </div>
            <h2 className="text-3xl font-bold text-navy-900">See Your Potential</h2>
          </div>

          <div className="bg-white rounded-2xl p-8 border border-navy-100 shadow-lg">
            <label className="block text-sm font-medium text-navy-600 mb-2">{data.calcLabel}</label>
            <input
              type="range"
              min={1}
              max={100}
              value={calcValue}
              onChange={(e) => setCalcValue(parseInt(e.target.value))}
              className="w-full h-2 bg-navy-200 rounded-lg appearance-none cursor-pointer accent-accent-500 mb-2"
            />
            <p className="text-right text-sm text-navy-500 mb-6">
              {calcValue} {data.calcUnit}{calcValue > 1 ? 's' : ''} / day
            </p>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-accent-50 rounded-xl p-4 text-center">
                <p className="text-xs text-navy-500 mb-1">Daily</p>
                <p className="text-xl font-bold text-accent-600">{formatINR(dailyIncome)}</p>
              </div>
              <div className="bg-accent-50 rounded-xl p-4 text-center">
                <p className="text-xs text-navy-500 mb-1">Monthly</p>
                <p className="text-xl font-bold text-accent-600">{formatINR(monthlyIncome)}</p>
              </div>
              <div className="bg-accent-500 rounded-xl p-4 text-center">
                <p className="text-xs text-white/70 mb-1">Yearly</p>
                <p className="text-xl font-bold text-white">{formatINR(yearlyIncome)}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-6 text-center">
          <div className="p-6">
            <TrendingUp className="w-8 h-8 text-accent-500 mx-auto mb-3" />
            <h3 className="font-bold text-navy-900 mb-1">Instant Commissions</h3>
            <p className="text-sm text-navy-500">Earn on every confirmed sale</p>
          </div>
          <div className="p-6">
            <Shield className="w-8 h-8 text-accent-500 mx-auto mb-3" />
            <h3 className="font-bold text-navy-900 mb-1">Secure Payments</h3>
            <p className="text-sm text-navy-500">Bank-grade security with Razorpay</p>
          </div>
          <div className="p-6">
            <Zap className="w-8 h-8 text-accent-500 mx-auto mb-3" />
            <h3 className="font-bold text-navy-900 mb-1">Fast Withdrawals</h3>
            <p className="text-sm text-navy-500">Withdraw to bank in 24-48 hours</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-navy-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Don't Wait. Start Today.</h2>
          <p className="text-navy-300 text-lg mb-8">Join thousands who are already earning with UCMP.</p>
          <Link
            to={`/signup?role=${data.role}`}
            className="inline-flex items-center gap-2 px-10 py-4 bg-accent-500 hover:bg-accent-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-accent-500/25 text-lg group"
          >
            Create Free Account
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>
    </div>
  );
}
