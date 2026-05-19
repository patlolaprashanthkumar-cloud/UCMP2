import { Link } from 'react-router-dom';

export function PublicHelpPage() {
  return (
    <div className="min-h-screen bg-white pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="text-sm text-accent-600 hover:underline">
          ← Home
        </Link>
        <h1 className="text-3xl font-bold text-navy-900 mt-4 mb-6">Help Center</h1>
        <p className="text-navy-600 leading-relaxed mb-6">
          For account issues, payouts, or storefront support, sign in and use the in-app help options on your dashboard. For general inquiries you can reach us at{' '}
          <a href="mailto:support@ucmp.app" className="text-accent-600 hover:underline">
            support@ucmp.app
          </a>
          .
        </p>
        <ul className="list-disc pl-5 text-navy-600 space-y-2">
          <li>
            <Link to="/pricing" className="text-accent-600 hover:underline">
              Pricing &amp; plans
            </Link>
          </li>
          <li>
            <Link to="/signup" className="text-accent-600 hover:underline">
              Create an account
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
