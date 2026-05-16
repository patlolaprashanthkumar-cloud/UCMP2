/*
  # Fix RLS infinite recursion on profiles table

  1. Changes
    - Create a function to sync user role to auth.users.raw_app_meta_data
    - Create a trigger on profiles to keep app_metadata.role in sync
    - Replace ALL admin policies that query profiles table with auth.jwt() checks
    - This eliminates infinite recursion where profiles policies query profiles

  2. Security
    - Admin check now uses auth.jwt()->'app_metadata'->>'role' = 'ADMIN'
    - Role stored in raw_app_meta_data cannot be modified by users (only server-side)
*/

-- Step 1: Create function to sync role to app_metadata
CREATE OR REPLACE FUNCTION sync_role_to_app_metadata()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create trigger
DROP TRIGGER IF EXISTS on_profile_role_change ON profiles;
CREATE TRIGGER on_profile_role_change
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_role_to_app_metadata();

-- Step 3: Sync existing users' roles to app_metadata
UPDATE auth.users u
SET raw_app_meta_data = u.raw_app_meta_data || jsonb_build_object('role', p.role)
FROM profiles p
WHERE u.id = p.id;

-- Step 4: Drop and recreate ALL admin policies on profiles
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN');

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN')
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN');

-- Step 5: Fix admin policies on ALL other tables
-- Products
DROP POLICY IF EXISTS "Admins can manage all products" ON products;
DROP POLICY IF EXISTS "Admins can update all products" ON products;

CREATE POLICY "Admins can manage all products"
  ON products FOR SELECT TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN');

CREATE POLICY "Admins can update all products"
  ON products FOR UPDATE TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN')
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN');

-- Orders
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can update all orders" ON orders;

CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN');

CREATE POLICY "Admins can update all orders"
  ON orders FOR UPDATE TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN')
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN');

-- Transactions
DROP POLICY IF EXISTS "Admins can view all transactions" ON transactions;
DROP POLICY IF EXISTS "Admins can update transactions" ON transactions;

CREATE POLICY "Admins can view all transactions"
  ON transactions FOR SELECT TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN');

CREATE POLICY "Admins can update transactions"
  ON transactions FOR UPDATE TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN')
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN');

-- Wallets
DROP POLICY IF EXISTS "Admins can view all wallets" ON wallets;
DROP POLICY IF EXISTS "Admins can update all wallets" ON wallets;

CREATE POLICY "Admins can view all wallets"
  ON wallets FOR SELECT TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN');

CREATE POLICY "Admins can update all wallets"
  ON wallets FOR UPDATE TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN')
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN');

-- Commissions
DROP POLICY IF EXISTS "Admins can insert commissions" ON commissions;
DROP POLICY IF EXISTS "Admins can update commissions" ON commissions;
DROP POLICY IF EXISTS "Admins can delete commissions" ON commissions;

CREATE POLICY "Admins can insert commissions"
  ON commissions FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN');

CREATE POLICY "Admins can update commissions"
  ON commissions FOR UPDATE TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN')
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN');

CREATE POLICY "Admins can delete commissions"
  ON commissions FOR DELETE TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN');

-- SaaS Tenants
DROP POLICY IF EXISTS "Admins can view all tenants" ON saas_tenants;
DROP POLICY IF EXISTS "Admins can update all tenants" ON saas_tenants;

CREATE POLICY "Admins can view all tenants"
  ON saas_tenants FOR SELECT TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN');

CREATE POLICY "Admins can update all tenants"
  ON saas_tenants FOR UPDATE TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN')
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN');

-- Referrals
DROP POLICY IF EXISTS "Admins can view all referrals" ON referrals;

CREATE POLICY "Admins can view all referrals"
  ON referrals FOR SELECT TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN');

-- KYC
DROP POLICY IF EXISTS "Admins can view all KYC" ON kyc;
DROP POLICY IF EXISTS "Admins can update all KYC" ON kyc;

CREATE POLICY "Admins can view all KYC"
  ON kyc FOR SELECT TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN');

CREATE POLICY "Admins can update all KYC"
  ON kyc FOR UPDATE TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN')
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN');

-- Leaderboard
DROP POLICY IF EXISTS "Admins can manage leaderboard" ON leaderboard;
DROP POLICY IF EXISTS "Admins can update leaderboard" ON leaderboard;

CREATE POLICY "Admins can manage leaderboard"
  ON leaderboard FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN');

CREATE POLICY "Admins can update leaderboard"
  ON leaderboard FOR UPDATE TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN')
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN');

-- Challenges
DROP POLICY IF EXISTS "Admins can manage challenges" ON challenges;
DROP POLICY IF EXISTS "Admins can update challenges" ON challenges;

CREATE POLICY "Admins can manage challenges"
  ON challenges FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN');

CREATE POLICY "Admins can update challenges"
  ON challenges FOR UPDATE TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN')
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'ADMIN');
