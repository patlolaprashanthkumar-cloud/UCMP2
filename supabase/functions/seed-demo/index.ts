import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DemoUser {
  email: string;
  password: string;
  name: string;
  role: string;
  referralCode: string;
  walletBalance: number;
  walletPending: number;
  walletEarned: number;
}

const DEMO_USERS: DemoUser[] = [
  { email: "demo.admin@ucmp.in", password: "demo123456", name: "Admin User", role: "ADMIN", referralCode: "UCMPADMIN1", walletBalance: 250000, walletPending: 15000, walletEarned: 500000 },
  { email: "demo.vendor@ucmp.in", password: "demo123456", name: "Rajesh Electronics", role: "VENDOR", referralCode: "UCMPVEND01", walletBalance: 87500, walletPending: 12000, walletEarned: 350000 },
  { email: "demo.vendor2@ucmp.in", password: "demo123456", name: "Priya Fashion Hub", role: "VENDOR", referralCode: "UCMPVEND02", walletBalance: 65000, walletPending: 8000, walletEarned: 180000 },
  { email: "demo.vendor3@ucmp.in", password: "demo123456", name: "HealthFirst Store", role: "VENDOR", referralCode: "UCMPVEND03", walletBalance: 12000, walletPending: 3000, walletEarned: 45000 },
  { email: "demo.affiliate@ucmp.in", password: "demo123456", name: "Amit Sharma", role: "AFFILIATE", referralCode: "UCMPAFF01", walletBalance: 45200, walletPending: 5600, walletEarned: 187500 },
  { email: "demo.reseller@ucmp.in", password: "demo123456", name: "Sneha Patel", role: "RESELLER", referralCode: "UCMPRES01", walletBalance: 38000, walletPending: 4200, walletEarned: 156200 },
  { email: "demo.saas@ucmp.in", password: "demo123456", name: "Vikram SaaS Corp", role: "SAAS_OWNER", referralCode: "UCMPSAAS1", walletBalance: 120000, walletPending: 8000, walletEarned: 320000 },
  { email: "affiliate2@ucmp.in", password: "demo123456", name: "Kavita Nair", role: "AFFILIATE", referralCode: "UCMPAFF02", walletBalance: 23400, walletPending: 2100, walletEarned: 76800 },
  { email: "reseller2@ucmp.in", password: "demo123456", name: "Manish Gupta", role: "RESELLER", referralCode: "UCMPRES02", walletBalance: 31000, walletPending: 3500, walletEarned: 98500 },
];

const PRODUCTS = [
  { vendorEmail: "demo.vendor@ucmp.in", name: "Wireless Bluetooth Earbuds Pro", description: "Premium TWS earbuds with ANC, 30hr battery life, IPX5 water resistant.", price: 1499, mrp: 2999, stock: 150, category: "Electronics" },
  { vendorEmail: "demo.vendor@ucmp.in", name: "Smart Watch Ultra", description: "1.9 inch AMOLED display, health monitoring, 7-day battery, GPS tracking.", price: 2999, mrp: 5999, stock: 75, category: "Electronics" },
  { vendorEmail: "demo.vendor@ucmp.in", name: "Portable Bluetooth Speaker", description: "20W output, 12hr playtime, waterproof IPX7, deep bass.", price: 999, mrp: 1999, stock: 200, category: "Electronics" },
  { vendorEmail: "demo.vendor@ucmp.in", name: "USB-C Fast Charger 65W", description: "GaN charger, dual port, compatible with laptops and phones.", price: 799, mrp: 1499, stock: 300, category: "Electronics" },
  { vendorEmail: "demo.vendor@ucmp.in", name: "Wireless Charging Pad", description: "Qi-certified 15W fast charging, LED indicator, slim design.", price: 599, mrp: 1199, stock: 250, category: "Electronics" },
  { vendorEmail: "demo.vendor2@ucmp.in", name: "Cotton Kurta Set", description: "Handloom cotton kurta with pants, available in multiple colors.", price: 1299, mrp: 2499, stock: 100, category: "Fashion" },
  { vendorEmail: "demo.vendor2@ucmp.in", name: "Designer Silk Saree", description: "Pure Banarasi silk saree with gold zari work, comes with blouse piece.", price: 3499, mrp: 6999, stock: 50, category: "Fashion" },
  { vendorEmail: "demo.vendor2@ucmp.in", name: "Leather Wallet Premium", description: "Genuine leather bi-fold wallet with RFID protection.", price: 699, mrp: 1299, stock: 180, category: "Fashion" },
  { vendorEmail: "demo.vendor2@ucmp.in", name: "Embroidered Clutch Bag", description: "Handcrafted embroidered clutch, perfect for festive occasions.", price: 899, mrp: 1799, stock: 120, category: "Fashion" },
  { vendorEmail: "demo.vendor2@ucmp.in", name: "Unisex Sunglasses UV400", description: "UV400 protection, polarized lenses, lightweight titanium frame.", price: 499, mrp: 999, stock: 200, category: "Fashion" },
  { vendorEmail: "demo.vendor3@ucmp.in", name: "Organic Protein Powder", description: "100% plant-based protein, 25g per serving, chocolate flavor.", price: 1899, mrp: 2999, stock: 80, category: "Health" },
  { vendorEmail: "demo.vendor3@ucmp.in", name: "Multivitamin Daily 60 Tablets", description: "60 tablets, complete A-Z vitamins and minerals.", price: 499, mrp: 899, stock: 300, category: "Health" },
  { vendorEmail: "demo.vendor3@ucmp.in", name: "Yoga Mat Premium 6mm", description: "6mm thick TPE material, non-slip, with carry strap.", price: 799, mrp: 1499, stock: 150, category: "Health" },
  { vendorEmail: "demo.vendor3@ucmp.in", name: "Digital Blood Pressure Monitor", description: "Accurate readings, large LCD display, memory for 120 readings.", price: 1299, mrp: 2499, stock: 60, category: "Health" },
  { vendorEmail: "demo.vendor3@ucmp.in", name: "Immunity Booster Tea 50 Bags", description: "Ayurvedic herbal tea blend, 50 tea bags, caffeine-free.", price: 399, mrp: 699, stock: 8, category: "Health" },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: existingProfiles } = await admin.from("profiles").select("email").limit(1);
    if (existingProfiles && existingProfiles.length > 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Demo data already exists" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIdMap: Record<string, string> = {};

    for (const u of DEMO_USERS) {
      const { data: existing } = await admin.auth.admin.listUsers();
      const found = existing?.users?.find((eu: { email?: string }) => eu.email === u.email);

      let userId: string;
      if (found) {
        userId = found.id;
        await admin.auth.admin.updateUser(userId, { password: u.password, email_confirm: true });
      } else {
        const { data: created, error } = await admin.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
        });
        if (error || !created.user) continue;
        userId = created.user.id;
      }

      userIdMap[u.email] = userId;

      await admin.from("profiles").upsert({
        id: userId, name: u.name, email: u.email, role: u.role,
        referral_code: u.referralCode, kyc_status: "verified", is_active: true,
      }, { onConflict: "id" });

      await admin.from("wallets").upsert({
        user_id: userId, balance: u.walletBalance,
        pending_balance: u.walletPending, total_earned: u.walletEarned,
      }, { onConflict: "user_id" });

      await admin.from("kyc").upsert({
        user_id: userId, pan_number: "ABCPD1234E",
        aadhar_no: "123456789012", bank_acc_no: "50100012345678",
        ifsc: "HDFC0001234", status: "verified",
      }, { onConflict: "user_id" });
    }

    for (const p of PRODUCTS) {
      const vendorId = userIdMap[p.vendorEmail];
      if (!vendorId) continue;
      await admin.from("products").insert({
        vendor_id: vendorId, name: p.name, description: p.description,
        price: p.price, mrp: p.mrp, stock: p.stock, category: p.category, is_active: true,
      });
    }

    const affiliateId = userIdMap["demo.affiliate@ucmp.in"];
    const resellerId = userIdMap["demo.reseller@ucmp.in"];
    const affiliate2Id = userIdMap["affiliate2@ucmp.in"];
    const reseller2Id = userIdMap["reseller2@ucmp.in"];

    const { data: allProducts } = await admin.from("products").select("id, price").limit(15);
    if (allProducts && allProducts.length >= 5 && affiliateId && resellerId) {
      const orderData = [
        { buyer_id: affiliate2Id || affiliateId, product_id: allProducts[0].id, affiliate_id: affiliateId, quantity: 2, total_amount: allProducts[0].price * 2, status: "delivered" },
        { buyer_id: reseller2Id || resellerId, product_id: allProducts[1].id, affiliate_id: affiliateId, quantity: 1, total_amount: allProducts[1].price, status: "delivered" },
        { buyer_id: affiliate2Id || affiliateId, product_id: allProducts[5]?.id || allProducts[2].id, reseller_id: resellerId, quantity: 1, total_amount: (allProducts[5] || allProducts[2]).price, status: "shipped" },
        { buyer_id: reseller2Id || resellerId, product_id: allProducts[2].id, affiliate_id: affiliateId, quantity: 3, total_amount: allProducts[2].price * 3, status: "confirmed" },
        { buyer_id: affiliate2Id || affiliateId, product_id: allProducts[3].id, reseller_id: resellerId, quantity: 1, total_amount: allProducts[3].price, status: "pending" },
        { buyer_id: resellerId, product_id: allProducts[4].id, affiliate_id: affiliateId, quantity: 2, total_amount: allProducts[4].price * 2, status: "delivered" },
      ];
      await admin.from("orders").insert(orderData);

      const txData = [
        { user_id: affiliateId, amount: 300, type: "commission", status: "completed", description: "Commission on sale" },
        { user_id: affiliateId, amount: 300, type: "commission", status: "completed", description: "Commission on sale" },
        { user_id: affiliateId, amount: 5000, type: "withdrawal", status: "completed", description: "Bank withdrawal" },
        { user_id: affiliateId, amount: 100, type: "bonus", status: "completed", description: "Referral bonus" },
        { user_id: resellerId, amount: 260, type: "commission", status: "completed", description: "Commission on sale" },
        { user_id: resellerId, amount: 350, type: "commission", status: "completed", description: "Commission on sale" },
        { user_id: resellerId, amount: 2000, type: "withdrawal", status: "pending", description: "Withdrawal request" },
      ];
      await admin.from("transactions").insert(txData);
    }

    if (affiliateId) {
      const referralPairs = [
        { referrer: affiliateId, referred: resellerId },
        { referrer: affiliateId, referred: affiliate2Id },
        { referrer: resellerId, referred: reseller2Id },
      ].filter((p) => p.referrer && p.referred);

      for (const pair of referralPairs) {
        await admin.from("referrals").insert({
          referrer_id: pair.referrer, referred_id: pair.referred, bonus_paid: true,
        });
      }
    }

    const currentMonth = new Date().toISOString().slice(0, 7);
    const leaderEntries = Object.entries(userIdMap)
      .filter(([email]) => !email.includes("admin"))
      .map(([_, uid], i) => ({
        user_id: uid, month: currentMonth,
        earnings: [187500, 156200, 134800, 112000, 98500, 76800, 65400, 54100][i] || 40000,
        rank: i + 1,
      }));
    for (const entry of leaderEntries) {
      await admin.from("leaderboard").upsert(entry, { onConflict: "user_id,month" });
    }

    await admin.from("challenges").insert([
      { title: "Refer 3 Users Today", description: "Refer 3 new users to UCMP and earn a bonus reward.", type: "daily", target_value: 3, reward_amount: 150, is_active: true },
      { title: "Sell 5 Products This Week", description: "Complete 5 product sales this week to earn a special bonus.", type: "weekly", target_value: 5, reward_amount: 500, is_active: true },
      { title: "Reach 50K Earnings", description: "Reach a total of 50,000 in earnings this month for a mega bonus.", type: "monthly", target_value: 50000, reward_amount: 2500, is_active: true },
      { title: "Share 10 Product Links", description: "Share 10 unique product links on social media today.", type: "daily", target_value: 10, reward_amount: 100, is_active: true },
      { title: "First Sale Bonus", description: "Make your first sale and earn bonus reward.", type: "daily", target_value: 1, reward_amount: 200, is_active: true },
    ]);

    const saasOwnerId = userIdMap["demo.saas@ucmp.in"];
    if (saasOwnerId) {
      await admin.from("saas_tenants").upsert({
        owner_id: saasOwnerId, store_name: "VikramMart", slug: "vikrammart",
        custom_domain: "vikrammart.in", primary_color: "#F97316", subscription_plan: "pro", is_active: true,
      }, { onConflict: "owner_id" });
    }

    return new Response(
      JSON.stringify({ success: true, message: "Demo data seeded successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
