export type Role = 'AFFILIATE' | 'RESELLER' | 'VENDOR' | 'SAAS_OWNER' | 'ADMIN' | 'CUSTOMER';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
  referral_code: string;
  referred_by: string | null;
  kyc_status: 'pending' | 'verified' | 'rejected';
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  vendor_id: string;
  name: string;
  description: string;
  price: number;
  mrp: number;
  stock: number;
  category: string;
  images: string[];
  sizes?: string[];
  is_active: boolean;
  tenant_id: string | null;
  created_at: string;
  vendor?: Profile;
}

export type OrderPaymentTiming = 'prepaid' | 'postpaid';
export type OrderPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface Order {
  id: string;
  buyer_id: string;
  product_id: string;
  affiliate_id: string | null;
  reseller_id: string | null;
  quantity: number;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
  payment_timing: OrderPaymentTiming;
  payment_status: OrderPaymentStatus;
  customer_email: string | null;
  customer_phone: string | null;
  shipping_snapshot: Record<string, unknown> | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  tenant_id: string | null;
  created_at: string;
  size?: string | null;
  product?: Product;
  buyer?: Profile;
}

export interface StoreCartItem {
  id: string;
  tenant_id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  updated_at: string;
  size?: string | null;
  product?: Product;
}

export interface StoreWishlistItem {
  id: string;
  tenant_id: string;
  user_id: string;
  product_id: string;
  created_at: string;
  product?: Product;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'commission' | 'withdrawal' | 'refund' | 'bonus' | 'subscription';
  status: 'pending' | 'completed' | 'failed' | 'rejected';
  reference_id: string | null;
  description: string;
  created_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  pending_balance: number;
  total_earned: number;
  created_at: string;
}

export interface Commission {
  id: string;
  role: string;
  level: number;
  percentage: number;
  created_at: string;
}

export interface SaasTenant {
  id: string;
  owner_id: string;
  store_name: string;
  slug: string;
  logo: string | null;
  custom_domain: string | null;
  primary_color: string;
  banner_image: string | null;
  subscription_plan: 'starter' | 'pro';
  is_active: boolean;
  created_at: string;
  reseller_requirements?: string;
  default_affiliate_platform_fee_percent?: number;
  default_reseller_platform_fee_percent?: number;
}

export interface StoreDeliveryAddress {
  id: string;
  tenant_id: string;
  user_id: string;
  label: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
  created_at: string;
}

export interface TenantStorePartnerSettings {
  id: string;
  tenant_id: string;
  user_id: string;
  /** Legacy; store reseller UI uses per-product margins in `tenant_store_reseller_product_margins`. */
  margin_percent: number;
  margin_amount: number;
  affiliate_fee_percent_override: number | null;
  reseller_fee_percent_override: number | null;
  requirements_ack_at: string | null;
  updated_at: string;
}

export interface TenantStoreResellerProductMargin {
  id: string;
  tenant_id: string;
  user_id: string;
  product_id: string;
  margin_amount: number;
  updated_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  bonus_paid: boolean;
  created_at: string;
  referred?: Profile;
  referrer?: Profile;
}

export interface LeaderboardEntry {
  id: string;
  user_id: string;
  month: string;
  earnings: number;
  rank: number | null;
  user?: Profile;
}

export interface KYC {
  id: string;
  user_id: string;
  pan_number: string | null;
  aadhar_no: string | null;
  bank_acc_no: string | null;
  ifsc: string | null;
  gst_number: string | null;
  status: 'pending' | 'verified' | 'rejected';
  created_at: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly';
  target_value: number;
  reward_amount: number;
  is_active: boolean;
  start_date: string;
  end_date: string | null;
  created_at: string;
}

export interface ChallengeProgress {
  id: string;
  user_id: string;
  challenge_id: string;
  current_value: number;
  is_completed: boolean;
  reward_claimed: boolean;
  created_at: string;
  challenge?: Challenge;
}

export interface TenantProduct {
  id: string;
  tenant_id: string;
  product_id: string;
  created_at: string;
  vendor_royalty_percent?: number;
  product?: Product;
}

export interface VendorPlatformDue {
  id: string;
  vendor_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'waived';
  title: string;
  notes: string;
  created_at: string;
  paid_at: string | null;
  vendor?: Profile;
}

export interface SaasVendorCatalogDue {
  id: string;
  tenant_id: string;
  vendor_id: string;
  amount: number;
  status: 'pending' | 'paid' | 'waived';
  period_start: string | null;
  period_end: string | null;
  basis: string;
  created_at: string;
  paid_at: string | null;
  tenant?: SaasTenant;
  vendor?: Profile;
}

export interface TenantMember {
  id: string;
  tenant_id: string;
  user_id: string;
  role: string;
  created_at: string;
  user?: Profile;
}
