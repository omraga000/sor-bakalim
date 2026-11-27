/**
 * Sor Bakalım — Safe Authenticated & Concurrent Load Test Script (Node.js 18+)
 *
 * Security rules:
 *   - NEVER hardcode passwords, JWTs, or service_role keys in this file.
 *   - Credentials are read strictly from environment variables (TEST_USER_EMAIL, TEST_USER_PASSWORD).
 *   - By default, this script is 100% non-destructive (read-only + RLS block checks).
 *
 * Usage:
 *   node tests/load-test.mjs
 *   CONCURRENCY_LEVELS="5,10,25,50" node tests/load-test.mjs
 *   TEST_USER_EMAIL="player@example.com" TEST_USER_PASSWORD="secret" node tests/load-test.mjs
 *   (Optional: add ALLOW_CREDIT_DEDUCT=1 only on a disposable test account to verify 1 RPC deduction.)
 */

import fs from "node:fs";
import path from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://fzxrqvobatablbtssggo.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_orCsNwYborsnhOhixAez_Q_H_Aw73tM";
const LEVELS = (process.env.CONCURRENCY_LEVELS || "5,10,25,50")
  .split(",")
  .map(n => parseInt(n.trim(), 10))
  .filter(n => n > 0);

const TEST_EMAIL = process.env.TEST_USER_EMAIL || "";
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || "";
const ALLOW_CREDIT_DEDUCT = process.env.ALLOW_CREDIT_DEDUCT === "1";

const CATEGORY_SELECT = "id,name,emoji,icon,img,info,description,questions,created_at";

function verifyGitignoreSafety() {
  const gitignorePath = path.resolve(process.cwd(), ".gitignore");
  if (!fs.existsSync(gitignorePath)) {
    console.warn("[WARN] .gitignore not found! Add .env and tests/credentials.* to .gitignore.");
    return false;
  }
  const content = fs.readFileSync(gitignorePath, "utf8");
  const hasEnv = /(^|\r?\n)\.env(\r?\n|$)/.test(content);
  console.log(`[GITIGNORE CHECK] .env ignored = ${hasEnv ? "PASS" : "MISSING"}`);
  return hasEnv;
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[idx]);
}

async function timedFetch(url, options = {}) {
  const start = performance.now();
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    const ms = performance.now() - start;
    return { ok: res.ok, status: res.status, ms, bytes: text.length, body: text };
  } catch (err) {
    return { ok: false, status: 0, ms: performance.now() - start, bytes: 0, error: err.message };
  }
}

async function runReadCategoriesStage(concurrency, bearerToken = SUPABASE_ANON_KEY, label = "ANON") {
  const url = `${SUPABASE_URL}/rest/v1/game_categories?select=${CATEGORY_SELECT}&order=created_at.asc`;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${bearerToken}`,
    Accept: "application/json"
  };

  const results = await Promise.all(
    Array.from({ length: concurrency }, () => timedFetch(url, { method: "GET", headers }))
  );

  const latencies = results.map(r => r.ms).sort((a, b) => a - b);
  const okCount = results.filter(r => r.status === 200).length;
  const statusMap = {};
  results.forEach(r => { statusMap[r.status] = (statusMap[r.status] || 0) + 1; });

  console.log(
    `[game_categories GET (${label})] concurrency=${concurrency} | ok=${okCount}/${concurrency} | p50=${percentile(latencies, 50)}ms | p95=${percentile(latencies, 95)}ms | max=${percentile(latencies, 100)}ms | statuses=${JSON.stringify(statusMap)}`
  );
}

async function runAnonSecurityChecks() {
  const rpcHeaders = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json"
  };

  const consumeRes = await timedFetch(`${SUPABASE_URL}/rest/v1/rpc/consume_game_credit`, {
    method: "POST",
    headers: rpcHeaders,
    body: "{}"
  });
  console.log(`[SECURITY ANON consume_game_credit] status=${consumeRes.status} (expected 401/403)`);

  const adminRes = await timedFetch(`${SUPABASE_URL}/rest/v1/rpc/admin_add_credits`, {
    method: "POST",
    headers: rpcHeaders,
    body: JSON.stringify({ target_email: "test@example.com", amount: 1 })
  });
  console.log(`[SECURITY ANON admin_add_credits] status=${adminRes.status} (expected 401/403)`);

  const creditsRes = await timedFetch(`${SUPABASE_URL}/rest/v1/user_game_credits?select=user_id,games_remaining`, {
    method: "GET",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
  });
  console.log(`[SECURITY ANON user_game_credits] status=${creditsRes.status} | body=${creditsRes.body} (expected [])`);
}

async function runAuthenticatedFlow() {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    console.log("[AUTH FLOW] Skipped (set TEST_USER_EMAIL & TEST_USER_PASSWORD env vars to run authenticated tests).");
    return;
  }

  const loginRes = await timedFetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD })
  });

  if (!loginRes.ok) {
    console.log(`[AUTH LOGIN] Failed status=${loginRes.status}`);
    return;
  }

  const authJson = JSON.parse(loginRes.body);
  const token = authJson.access_token;
  const userId = authJson.user?.id;
  console.log(`[AUTH LOGIN] Success in ${Math.round(loginRes.ms)}ms (user_id=${userId})`);

  // 1. Concurrent authenticated reads of user_game_credits (scoped to user_id)
  const authReadConcurrency = LEVELS[0] || 5;
  const creditsUrl = `${SUPABASE_URL}/rest/v1/user_game_credits?select=user_id,games_remaining,total_purchased&user_id=eq.${encodeURIComponent(userId)}`;
  const creditReads = await Promise.all(
    Array.from({ length: authReadConcurrency }, () =>
      timedFetch(creditsUrl, {
        method: "GET",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
      })
    )
  );
  const readOk = creditReads.filter(r => r.status === 200).length;
  console.log(`[AUTH user_game_credits GET] concurrency=${authReadConcurrency} | ok=${readOk}/${authReadConcurrency} | sample=${creditReads[0]?.body}`);

  // 2. Verify regular user CANNOT directly tamper with user_game_credits via REST PATCH
  const tamperRes = await timedFetch(
    `${SUPABASE_URL}/rest/v1/user_game_credits?user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({ games_remaining: 999 })
    }
  );
  console.log(`[SECURITY AUTH PATCH tamper check] status=${tamperRes.status} | body=${tamperRes.body} (expected blocked or [])`);

  // 3. Optional single consume_game_credit RPC check (disabled by default to avoid modifying credits)
  if (ALLOW_CREDIT_DEDUCT) {
    const rpcRes = await timedFetch(`${SUPABASE_URL}/rest/v1/rpc/consume_game_credit`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}"
    });
    console.log(`[AUTH RPC consume_game_credit] status=${rpcRes.status} | body=${rpcRes.body}`);
  } else {
    console.log("[AUTH RPC consume_game_credit] Dry-run skipped (set ALLOW_CREDIT_DEDUCT=1 on a test account to test 1 deduction).");
  }
}

async function main() {
  console.log("=== Sor Bakalım Safe Concurrent Load & Security Test ===");
  verifyGitignoreSafety();
  for (const level of LEVELS) {
    await runReadCategoriesStage(level);
  }
  await runAnonSecurityChecks();
  await runAuthenticatedFlow();
  console.log("=== Completed ===");
}

main().catch(err => {
  console.error("Load test failed:", err);
  process.exit(1);
});
