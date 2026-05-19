import { Link } from 'react-router-dom';

const DOCS: Record<string, { title: string; body: string }> = {
  privacy: {
    title: 'Privacy Policy',
    body:
      'UCMP collects and processes account, order, and KYC information to operate the marketplace and comply with regulations. We do not sell your personal data. For questions or data requests, contact support through your dashboard or the Help page.',
  },
  terms: {
    title: 'Terms of Service',
    body:
      'By using UCMP you agree to follow applicable laws, provide accurate KYC information, and use affiliate and reseller programs fairly. We may update these terms; continued use constitutes acceptance. Disputes are subject to the jurisdiction specified in your agreement with UCMP.',
  },
  refunds: {
    title: 'Refund Policy',
    body:
      'Refund eligibility depends on the vendor, store policy, and payment status of each order. For storefront purchases, check the seller’s terms and initiate requests through your order flow or support channels. Platform fees may be non-refundable where disclosed at purchase.',
  },
};

type DocKey = keyof typeof DOCS;

export function PublicLegalPage({ doc }: { doc: DocKey }) {
  const c = DOCS[doc];
  return (
    <div className="min-h-screen bg-white pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="text-sm text-accent-600 hover:underline">
          ← Home
        </Link>
        <h1 className="text-3xl font-bold text-navy-900 mt-4 mb-6">{c.title}</h1>
        <p className="text-navy-600 leading-relaxed whitespace-pre-line">{c.body}</p>
      </div>
    </div>
  );
}
