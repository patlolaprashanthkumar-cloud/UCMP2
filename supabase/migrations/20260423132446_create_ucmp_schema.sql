/*
  # UCMP - Unified Commerce & Monetization Platform Schema

  1. New Tables
    - `profiles` - User profiles with role, referral code, KYC status
      - `id` (uuid, FK to auth.users)
      - `name` (text)
      - `email` (text, unique)
      - `role` (text) - AFFILIATE, RESELLER, VENDOR, SAAS_OWNER, ADMIN
      - `referral_code` (text, unique)
      - `referred_by` (text, nullable)
      - `kyc_status` (text) - pending, verified, rejected
      - `is_active` (boolean)
    - `products` - Product catalog
      - `id` (uuid), `vendor_id` (uuid, FK profiles), `name`, `description`, `price`, `mrp`, `stock`, `category`, `images` (text[]), `is_active`
    - `orders` - Purchase orders
      - `id`, `buyer_id`, `product_id`, `affiliate_id`, `reseller_id`, `quantity`, `total_amount`, `status`, `razorpay_order_id`, `razorpay_payment_id`
    - `transactions` - Financial transactions
      - `id`, `user_id`, `amount`, `type` (commission/withdrawal/refund/bonus), `status`, `reference_id`
    - `wallets` - User wallets
      - `id`, `user_id` (unique), `balance`, `pending_balance`
    - `commissions` - Commission rate config
      - `id`, `role`, `level`, `percentage`
    - `saas_tenants` - White-label store tenants
      - `id`, `owner_id`, `store_name`, `logo`, `custom_domain`, `primary_color`, `banner_image`, `subscription_plan`, `is_active`
    - `referrals` - Referral relationships
      - `id`, `referrer_id`, `referred_id`, `bonus_paid`
    - `leaderboard` - Monthly earnings leaderboard
      - `id`, `user_id`, `month`, `earnings`, `rank`
    - `kyc` - KYC verification documents
      - `id`, `user_id`, `pan_number`, `aadhar_no`, `bank_acc_no`, `ifsc`, `status`
    - `challenges` - Daily/weekly challenges
      - `id`, `title`, `description`, `type`, `target_value`, `reward_amount`, `is_active`, `start_date`, `end_date`
    - `challenge_progress` - User progress on challenges
      - `id`, `user_id`, `challenge_id`, `current_value`, `is_completed`, `reward_claimed`

  2. Security
    - RLS enabled on ALL tables
    - Policies for authenticated users to access own data
    - Admin policies for management
    - Vendor policies for product/order management
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  name text NOT NULL DEFAULT '',
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'AFFILIATE' CHECK (role IN ('AFFILIATE', 'RESELLER', 'VENDOR', 'SAAS_OWNER', 'ADMIN')),
  referral_code text UNIQUE NOT NULL,
  referred_by text,
  kyc_status text NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
  is_active boolean NOT NULL DEFAULT true,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES profiles(id),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price float NOT NULL DEFAULT 0,
  mrp float NOT NULL DEFAULT 0,
  stock int NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'general',
  images text[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  tenant_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active products"
  ON products FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Vendors can insert own products"
  ON products FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "Vendors can update own products"
  ON products FOR UPDATE TO authenticated
  USING (auth.uid() = vendor_id)
  WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "Vendors can delete own products"
  ON products FOR DELETE TO authenticated
  USING (auth.uid() = vendor_id);

CREATE POLICY "Admins can manage all products"
  ON products FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

CREATE POLICY "Admins can update all products"
  ON products FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES profiles(id),
  product_id uuid NOT NULL REFERENCES products(id),
  affiliate_id uuid REFERENCES profiles(id),
  reseller_id uuid REFERENCES profiles(id),
  quantity int NOT NULL DEFAULT 1,
  total_amount float NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned')),
  razorpay_order_id text,
  razorpay_payment_id text,
  tenant_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can view own orders"
  ON orders FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id);

CREATE POLICY "Affiliates can view referred orders"
  ON orders FOR SELECT TO authenticated
  USING (auth.uid() = affiliate_id);

CREATE POLICY "Resellers can view referred orders"
  ON orders FOR SELECT TO authenticated
  USING (auth.uid() = reseller_id);

CREATE POLICY "Vendors can view orders for their products"
  ON orders FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.vendor_id = auth.uid())
  );

CREATE POLICY "Authenticated users can create orders"
  ON orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Vendors can update order status"
  ON orders FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.vendor_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.vendor_id = auth.uid())
  );

CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

CREATE POLICY "Admins can update all orders"
  ON orders FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  amount float NOT NULL DEFAULT 0,
  type text NOT NULL CHECK (type IN ('commission', 'withdrawal', 'refund', 'bonus', 'subscription')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'rejected')),
  reference_id text,
  description text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert transactions"
  ON transactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions"
  ON transactions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

CREATE POLICY "Admins can update transactions"
  ON transactions FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

-- Wallets table
CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES profiles(id),
  balance float NOT NULL DEFAULT 0,
  pending_balance float NOT NULL DEFAULT 0,
  total_earned float NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet"
  ON wallets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wallet"
  ON wallets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet"
  ON wallets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all wallets"
  ON wallets FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

CREATE POLICY "Admins can update all wallets"
  ON wallets FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

-- Commissions config table
CREATE TABLE IF NOT EXISTS commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  level int NOT NULL DEFAULT 1,
  percentage float NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read commissions"
  ON commissions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert commissions"
  ON commissions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

CREATE POLICY "Admins can update commissions"
  ON commissions FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

CREATE POLICY "Admins can delete commissions"
  ON commissions FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

-- SaaS tenants table
CREATE TABLE IF NOT EXISTS saas_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid UNIQUE NOT NULL REFERENCES profiles(id),
  store_name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo text,
  custom_domain text,
  primary_color text DEFAULT '#F97316',
  banner_image text,
  subscription_plan text NOT NULL DEFAULT 'starter' CHECK (subscription_plan IN ('starter', 'pro')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE saas_tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active tenants"
  ON saas_tenants FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Owners can manage own tenant"
  ON saas_tenants FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can insert own tenant"
  ON saas_tenants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Admins can view all tenants"
  ON saas_tenants FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

CREATE POLICY "Admins can update all tenants"
  ON saas_tenants FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

-- Referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES profiles(id),
  referred_id uuid NOT NULL REFERENCES profiles(id),
  bonus_paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals"
  ON referrals FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "System can insert referrals"
  ON referrals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = referred_id);

CREATE POLICY "Admins can view all referrals"
  ON referrals FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

-- Leaderboard table
CREATE TABLE IF NOT EXISTS leaderboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  month text NOT NULL,
  earnings float NOT NULL DEFAULT 0,
  rank int,
  UNIQUE(user_id, month)
);
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view leaderboard"
  ON leaderboard FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage leaderboard"
  ON leaderboard FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

CREATE POLICY "Admins can update leaderboard"
  ON leaderboard FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

-- KYC table
CREATE TABLE IF NOT EXISTS kyc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES profiles(id),
  pan_number text,
  aadhar_no text,
  bank_acc_no text,
  ifsc text,
  gst_number text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE kyc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own KYC"
  ON kyc FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own KYC"
  ON kyc FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own KYC"
  ON kyc FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all KYC"
  ON kyc FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

CREATE POLICY "Admins can update all KYC"
  ON kyc FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

-- Challenges table
CREATE TABLE IF NOT EXISTS challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'daily' CHECK (type IN ('daily', 'weekly', 'monthly')),
  target_value int NOT NULL DEFAULT 1,
  reward_amount float NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active challenges"
  ON challenges FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage challenges"
  ON challenges FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

CREATE POLICY "Admins can update challenges"
  ON challenges FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

-- Challenge progress table
CREATE TABLE IF NOT EXISTS challenge_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  challenge_id uuid NOT NULL REFERENCES challenges(id),
  current_value int NOT NULL DEFAULT 0,
  is_completed boolean NOT NULL DEFAULT false,
  reward_claimed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, challenge_id)
);
ALTER TABLE challenge_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own challenge progress"
  ON challenge_progress FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own challenge progress"
  ON challenge_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own challenge progress"
  ON challenge_progress FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tenant members table (for SaaS multi-tenant)
CREATE TABLE IF NOT EXISTS tenant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_tenants(id),
  user_id uuid NOT NULL REFERENCES profiles(id),
  role text NOT NULL DEFAULT 'AFFILIATE',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant owners can view members"
  ON tenant_members FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM saas_tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid())
  );

CREATE POLICY "Tenant owners can manage members"
  ON tenant_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM saas_tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid())
  );

CREATE POLICY "Tenant owners can update members"
  ON tenant_members FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM saas_tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM saas_tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid())
  );

CREATE POLICY "Tenant owners can remove members"
  ON tenant_members FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM saas_tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid())
  );

CREATE POLICY "Members can view own membership"
  ON tenant_members FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Insert default commission rates
INSERT INTO commissions (role, level, percentage) VALUES
  ('AFFILIATE', 1, 10),
  ('RESELLER', 1, 10),
  ('FRANCHISE', 2, 5),
  ('PLATFORM', 3, 2);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_affiliate_id ON orders(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_orders_reseller_id ON orders(reseller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_month ON leaderboard(month);
CREATE INDEX IF NOT EXISTS idx_leaderboard_earnings ON leaderboard(earnings DESC);
