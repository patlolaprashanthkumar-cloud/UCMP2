export type Role = 'AFFILIATE' | 'RESELLER' | 'VENDOR' | 'SAAS_OWNER' | 'ADMIN';

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
  is_active: boolean;
  tenant_id: string | null;
  created_at: string;
  vendor?: Profile;
}

export interface Order {
  id: string;
  buyer_id: string;
  product_id: string;
  affiliate_id: string | null;
  reseller_id: string | null;
  quantity: number;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  tenant_id: string | null;
  created_at: string;
  product?: Product;
  buyer?: Profile;
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

export interface TenantMember {
  id: string;
  tenant_id: string;
  user_id: string;
  role: string;
  created_at: string;
  user?: Profile;
}
