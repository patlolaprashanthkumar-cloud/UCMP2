import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEMO_ACCOUNTS: Record<
  string,
  { email: string; password: string; name: string }
> = {
  AFFILIATE: {
    email: "demo.affiliate@ucmp.in",
    password: "demo123456",
    name: "Amit Sharma",
  },
  RESELLER: {
    email: "demo.reseller@ucmp.in",
    password: "demo123456",
    name: "Sneha Patel",
  },
  VENDOR: {
    email: "demo.vendor@ucmp.in",
    password: "demo123456",
    name: "Rajesh Electronics",
  },
  SAAS_OWNER: {
    email: "demo.saas@ucmp.in",
    password: "demo123456",
    name: "Vikram SaaS Corp",
  },
  ADMIN: {
    email: "demo.admin@ucmp.in",
    password: "demo123456",
    name: "Admin User",
  },
};

function generateReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "UCMP";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { role } = await req.json();

    if (!role || !DEMO_ACCOUNTS[role]) {
      return new Response(
        JSON.stringify({ error: "Invalid role" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const account = DEMO_ACCOUNTS[role];
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", account.email)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({
          success: true,
          email: account.email,
          password: account.password,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: newUser, error: createError } =
      await adminClient.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
        app_metadata: { role: role },
        user_metadata: { name: account.name },
      });

    if (createError) {
      if (
        createError.message?.includes("already been registered") ||
        createError.message?.includes("duplicate")
      ) {
        return new Response(
          JSON.stringify({
            success: true,
            email: account.email,
            password: account.password,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      return new Response(
        JSON.stringify({ error: createError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!newUser?.user) {
      return new Response(
        JSON.stringify({ error: "Failed to create user" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userId = newUser.user.id;

    await adminClient.from("profiles").upsert(
      {
        id: userId,
        name: account.name,
        email: account.email,
        role: role,
        referral_code: generateReferralCode(),
        kyc_status: "verified",
        is_active: true,
      },
      { onConflict: "id" }
    );

    await adminClient.from("wallets").upsert(
      {
        user_id: userId,
        balance:
          role === "ADMIN"
            ? 250000
            : role === "VENDOR"
              ? 87500
              : role === "SAAS_OWNER"
                ? 120000
                : 45200,
        pending_balance: role === "ADMIN" ? 15000 : 5600,
        total_earned:
          role === "ADMIN"
            ? 500000
            : role === "VENDOR"
              ? 350000
              : role === "SAAS_OWNER"
                ? 320000
                : 187500,
      },
      { onConflict: "user_id" }
    );

    return new Response(
      JSON.stringify({
        success: true,
        email: account.email,
        password: account.password,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
