import { Link } from 'react-router-dom';

export function PublicApiDocsPage() {
  return (
    <div className="min-h-screen bg-white pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="text-sm text-accent-600 hover:underline">
          ← Home
        </Link>
        <h1 className="text-3xl font-bold text-navy-900 mt-4 mb-6">API documentation</h1>
        <p className="text-navy-600 leading-relaxed">
          Programmatic access is available to qualifying SaaS and integration partners. If you need API credentials or technical documentation, contact{' '}
          <a href="mailto:support@ucmp.app" className="text-accent-600 hover:underline">
            support@ucmp.app
          </a>{' '}
          with your use case and tenant details.
        </p>
      </div>
    </div>
  );
}
