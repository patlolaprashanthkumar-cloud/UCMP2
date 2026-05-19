import { Link, useOutletContext } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { StoreOutletContext } from './storeTypes';

export function StoreTermsPage() {
  const { tenant, slug } = useOutletContext<StoreOutletContext>();
  const accent = tenant.primary_color || '#ea580c';
  const body = (tenant.store_terms ?? '').trim();

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link
        to={`/store/${slug}`}
        className="inline-flex items-center gap-2 text-sm font-semibold mb-6 hover:underline"
        style={{ color: accent }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to shop
      </Link>
      <h1 className="text-3xl font-bold text-[var(--sf-fg)] mb-2">Terms &amp; conditions</h1>
      <p className="text-[var(--sf-muted)] mb-8">{tenant.store_name}</p>
      {body ? (
        <div className="rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] p-6 sm:p-8 text-[var(--sf-fg)] whitespace-pre-wrap leading-relaxed">
          {body}
        </div>
      ) : (
        <p className="text-[var(--sf-muted)] rounded-2xl border border-dashed border-[var(--sf-border)] bg-[var(--sf-surface)] p-8 text-center">
          The store owner hasn&apos;t added this yet.
        </p>
      )}
    </div>
  );
}
