import { Navigate, useLocation } from 'react-router-dom';

/** Legacy referral URLs use `/register?ref=...`; signup reads the same query on `/signup`. */
export function LegacyRegisterRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/signup${search}`} replace />;
}
