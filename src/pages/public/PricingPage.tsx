import { Link } from 'react-router-dom';
import { Crown, Check, ArrowRight } from 'lucide-react';
import { formatINR } from '../../lib/format';

const plans = [
  {
    name: 'Free Affiliate',
    price: 0,
    period: '',
    desc: 'Start earning with zero investment',
    features: ['Affiliate links for all products', 'Basic dashboard & analytics', '10% commission per sale', 'WhatsApp sharing tools', 'Referral tracking'],
    cta: 'Start Free',
    href: '/signup?role=AFFILIATE',
    popular: false,
  },
  {
    name: 'Reseller Pro',
    price: 999,
    period: '/year',
    desc: 'Higher margins and pro tools',
    features: ['Everything in Free', 'Custom selling margins', 'Bulk order management', 'Priority support', 'Advanced analytics'],
    cta: 'Get Started',
    href: '/signup?role=RESELLER',
    popular: true,
  },
  {
    name: 'Vendor Plan',
    price: 1999,
    period: '/month',
    desc: 'List and sell your own products',
    features: ['Product catalog management', 'Order & inventory tracking', 'Affiliate network access', 'GST invoicing', 'Stock alerts'],
    cta: 'Start Selling',
    href: '/signup?role=VENDOR',
    popular: false,
  },
  {
    name: 'SaaS Starter',
    price: 25000,
    period: ' setup + ' + formatINR(2999) + '/mo',
    desc: 'Your own white-label commerce store',
    features: ['Branded storefront', 'Custom domain support', 'Sub-user management', 'Commission controls', 'All Vendor features'],
    cta: 'Launch Store',
    href: '/signup?role=SAAS_OWNER',
    popular: false,
  },
  {
    name: 'SaaS Pro',
    price: 50000,
    period: ' setup + ' + formatINR(7999) + '/mo',
    desc: 'Full platform clone with premium support',
    features: ['Everything in Starter', 'Full platform customization', 'Dedicated support manager', 'API access', 'Unlimited sub-users'],
    cta: 'Contact Sales',
    href: '/signup?role=SAAS_OWNER',
    popular: false,
  },
];

export function PricingPage() {
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
          <div className="flex items-center gap-3 relative z-10">
            <Link to="/login" className="text-sm font-medium text-navy-600 hover:text-navy-900 px-4 py-2">Sign In</Link>
            <Link to="/signup" className="text-sm font-semibold text-white bg-accent-500 hover:bg-accent-600 px-5 py-2.5 rounded-xl transition-all">Get Started</Link>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h1 className="text-4xl sm:text-5xl font-bold text-navy-900 mb-4">Simple, Transparent Pricing</h1>
            <p className="text-lg text-navy-500 max-w-2xl mx-auto">Choose the plan that matches your ambition. Upgrade anytime as you grow.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 border flex flex-col ${
                  plan.popular
                    ? 'border-accent-500 bg-accent-50/30 shadow-xl shadow-accent-500/10 relative'
                    : 'border-navy-100 bg-white hover:shadow-lg'
                } transition-shadow`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    MOST POPULAR
                  </div>
                )}
                <h3 className="font-bold text-navy-900 text-lg">{plan.name}</h3>
                <div className="mt-3 mb-1">
                  <span className="text-3xl font-bold text-navy-900">{formatINR(plan.price)}</span>
                  {plan.period && <span className="text-sm text-navy-500">{plan.period}</span>}
                </div>
                <p className="text-sm text-navy-500 mb-5">{plan.desc}</p>
                <ul className="space-y-3 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-navy-600">
                      <Check className="w-4 h-4 text-success-500 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={plan.href}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${
                    plan.popular
                      ? 'bg-accent-500 hover:bg-accent-600 text-white shadow-lg shadow-accent-500/25'
                      : 'bg-navy-900 hover:bg-navy-800 text-white'
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
