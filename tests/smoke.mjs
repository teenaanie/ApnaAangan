#!/usr/bin/env node
/**
 * Post-deployment smoke test.
 *
 *   npm run smoke -- https://staging.apnaaangan.com
 *   npm run smoke -- https://apnaaangan.com
 *
 * No dependencies, no browser, no test account. It fetches a handful of pages
 * as an anonymous visitor and asserts on what comes back. Thirty seconds.
 *
 * WHAT THIS IS FOR, AND WHAT IT IS NOT FOR
 *
 * It answers one question well: "is the thing I just deployed actually there,
 * pointed at the right database, and not leaking anything". That is the class
 * of failure that has actually cost time on this project — code that was never
 * pushed, a variable set on the wrong Vercel environment, a migration run on
 * one database and not the other. None of those look like bugs in a browser.
 * They look like a missing button.
 *
 * It cannot tell you whether the app is any good. It never signs in, so
 * everything behind a login — the provider's own screens, the admin queue,
 * accepting a request — is untested here and belongs either to the SQL suites
 * or to the manual checklist. See TESTING.md.
 *
 * Exit code 0 if every check passed, 1 if any failed, so it can be trusted in
 * a script later without being rewritten.
 */

const BASE = (process.argv[2] || "").replace(/\/+$/, "");

if (!BASE || !/^https?:\/\//.test(BASE)) {
  console.error("Usage: npm run smoke -- https://staging.apnaaangan.com");
  process.exit(2);
}

/* Enough of a browser to get past whatever sits in front of the deployment.
   A smoke test that is refused by a bot filter reports a dozen failures that
   are all the same failure, which is worse than reporting none. */
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const results = [];
let failed = 0;

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failed++;
  const mark = ok ? "  ok  " : " FAIL ";
  console.log(`${mark} ${name}${!ok && detail ? `\n         ${detail}` : ""}`);
}

/** Fetch without following redirects, so a redirect is itself observable —
 *  which is the point for the pages that must NOT render to a stranger. */
async function raw(path) {
  const res = await fetch(BASE + path, {
    redirect: "manual",
    headers: { accept: "text/html,application/xhtml+xml", "user-agent": UA },
  });
  const body = res.status >= 300 && res.status < 400 ? "" : await res.text();
  return { status: res.status, location: res.headers.get("location") || "", body };
}

async function main() {
  console.log(`\nSmoke test · ${BASE}\n${"─".repeat(62)}`);

  // ---------------------------------------------------------- what is this ----
  let health = null;
  try {
    const r = await fetch(BASE + "/api/health", { headers: { accept: "text/html,application/xhtml+xml", "user-agent": UA } });
    if (r.ok) health = await r.json();
  } catch {
    /* older deployment, or the route is not there yet — not a failure */
  }

  const isProd = health ? health.env === "production" : /\/\/apnaaangan\.com/.test(BASE);

  if (health) {
    console.log(
      `  build   ${health.env}` +
        (health.commit ? ` · ${health.commit}` : "") +
        (health.branch ? ` · ${health.branch}` : "") +
        `\n  on      supabase=${health.supabase} ai=${health.ai} email=${health.email}` +
        `\n  terms   ${health.terms}\n${"─".repeat(62)}`
    );
  } else {
    console.log(
      `  (no /api/health on this deployment — it predates the health route,\n` +
        `   so the build and feature-switch checks below are skipped)\n${"─".repeat(62)}`
    );
  }

  // ------------------------------------------------------------- the front ----
  const home = await raw("/");
  if (home.status !== 200) {
    console.log(
      ` FAIL  the front page did not load — got ${home.status}\n\n` +
        `Nothing else was checked, because every other check would fail for the\n` +
        `same reason and none of those failures would mean what they say.\n\n` +
        (home.status === 403 || home.status === 401
          ? `A ${home.status} on the front page is usually the network you are on rather\n` +
            `than the site: a proxy, a VPN, or a bot filter. Open ${BASE} in a\n` +
            `browser — if it loads there, run this from a different network.\n`
          : `Check the address, and check the deployment in Vercel.\n`)
    );
    process.exit(2);
  }
  record("the front page loads", true);
  record(
    "it is the Aangan front page, not an error or a setup screen",
    home.body.includes("Apna Aangan") && !home.body.includes("Add your Supabase"),
    "the page rendered but does not look like the directory"
  );

  // -------------------------------------------- pointed at which database ----
  // The bar is rendered from VERCEL_ENV, so it is a direct read of which
  // deployment this is. A staging site without it is how a test booking ends
  // up on the real directory; production WITH it would tell every resident the
  // real site is fake.
  const banner = home.body.includes("Test site");
  record(
    isProd ? "no test-site banner on production" : "test-site banner is showing",
    isProd ? !banner : banner,
    isProd
      ? "PRODUCTION IS FLAGGED AS A TEST SITE — residents are being told nothing here is real"
      : "STAGING IS NOT FLAGGED — it looks exactly like production, which is how test data reaches the real directory"
  );

  const noindex = /noindex/i.test(home.body);
  record(
    isProd ? "production is indexable by Google" : "staging is hidden from Google",
    isProd ? !noindex : noindex,
    isProd
      ? "PRODUCTION IS SET TO NOINDEX — it will drop out of search results"
      : "staging is indexable, and Google will happily list fake providers"
  );

  // ------------------------------------------------------ nothing private out ----
  // Find a real listing from the front page and read it as a stranger would.
  const match = home.body.match(/\/p\/([A-Za-z0-9_-]{4,})/);
  if (!match) {
    record(
      "there is at least one listing on the front page",
      false,
      "no /p/… link found — either the directory is empty or the search is broken"
    );
  } else {
    const page = await raw(`/p/${match[1]}`);
    record(`a listing page loads (/p/${match[1]})`, page.status === 200, `got ${page.status}`);

    // The promise on the booking form, checked on the rendered page. Indian
    // mobile numbers are ten digits starting 6-9; the negative lookarounds
    // keep it off longer digit runs, which are ids and timestamps.
    const visible = page.body
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ");
    const phones = visible.match(/(?<!\d)[6-9]\d{9}(?!\d)/g) || [];
    record(
      "no provider phone number on the public listing page",
      phones.length === 0,
      `A PHONE NUMBER IS VISIBLE TO A STRANGER: ${phones.slice(0, 3).join(", ")}`
    );
  }

  // ------------------------------------------------------- the locked doors ----
  // A signed-out visitor must be sent to the login page, not shown the screen.
  for (const path of ["/admin", "/admin/providers", "/provider", "/provider/listings", "/rates"]) {
    const r = await raw(path);
    const sentToLogin =
      r.status >= 300 && r.status < 400 && r.location.includes("/auth/login");
    const refused = r.status === 401 || r.status === 403;
    // A rendered page is the only bad answer. A redirect is the intended one,
    // and a flat refusal is also shut — reporting that as a leak would be a
    // lie in the direction that gets ignored.
    const rendered = r.status === 200;
    record(
      `${path} is closed to a signed-out visitor`,
      sentToLogin || refused,
      rendered
        ? `IT RENDERED (200) TO A STRANGER — THIS PAGE IS PUBLIC`
        : `got ${r.status}${r.location ? ` → ${r.location}` : ""}, which is neither a login redirect nor a refusal`
    );
  }

  // ------------------------------------------------------------ public pages ----
  for (const [path, must] of [
    ["/terms", "agreement"],
    ["/faq", null],
    ["/auth/login", null],
  ]) {
    const r = await raw(path);
    const ok = r.status === 200 && (!must || r.body.toLowerCase().includes(must));
    record(`${path} loads`, ok, `got ${r.status}`);
  }

  // The version a provider is agreeing to must match the code that is running.
  if (health) {
    const terms = await raw("/terms");
    record(
      "the agreement page shows the version this build thinks is current",
      terms.body.includes(health.terms),
      `the build says ${health.terms}, and the page does not mention it — a provider would accept one version and have another recorded`
    );
  }

  // ------------------------------------------------------ a bad consent link ----
  // Someone will paste half a link. It must say so plainly rather than crash.
  const bad = await raw("/list/accept/" + "z".repeat(64));
  record(
    "an unrecognised consent link fails gracefully",
    bad.status === 200 || bad.status === 404,
    `got ${bad.status} — an invalid token should explain itself, not throw`
  );

  // ---------------------------------------------------- features switched on ----
  if (health) {
    record(
      "the database is configured",
      health.supabase === true,
      "NEXT_PUBLIC_SUPABASE_URL / ANON_KEY are missing on this environment"
    );

    record(
      "listing drafts are switched on",
      health.ai === true,
      "no AI key on this environment — the “Let me draft it” button will not appear. " +
        "Add OPENAI_API_KEY in Vercel for this environment and redeploy."
    );

    if (isProd) {
      record(
        "email is switched on for production",
        health.email === true,
        "RESEND_API_KEY is missing — nobody is being notified"
      );
    } else {
      record(
        "email is off on staging",
        health.email === false,
        "RESEND_API_KEY IS SET ON STAGING — a test booking can email a real provider"
      );
    }
  }

  // -------------------------------------------------------------------- done ----
  console.log("─".repeat(62));
  const passed = results.length - failed;
  if (failed === 0) {
    console.log(`All ${passed} checks passed on ${BASE}\n`);
  } else {
    console.log(`${passed} passed, ${failed} FAILED on ${BASE}\n`);
    console.log("Failures:");
    for (const r of results.filter((x) => !x.ok)) console.log(`  · ${r.name}`);
    console.log("");
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\nCould not finish: ${err.message}`);
  console.error("Is the address right, and is the site up?\n");
  process.exit(2);
});
