import type { Profile, Role } from '../types';

const SLUG_KEY = 'ucmp_last_store_slug';

const STORE_PORTAL_ROLES: Role[] = ['CUSTOMER', 'AFFILIATE', 'RESELLER'];

export function rememberStoreSlug(slug: string) {
  try {
    localStorage.setItem(SLUG_KEY, slug);
  } catch {
    /* ignore */
  }
}

export function getPostLoginPath(profile: Profile): string {
  if (STORE_PORTAL_ROLES.includes(profile.role)) {
    try {
      const slug = localStorage.getItem(SLUG_KEY);
      if (slug) return `/store/${slug}`;
    } catch {
      /* ignore */
    }
    return '/';
  }
  return '/dashboard';
}
