#!/usr/bin/env node
// Runs Supabase CLI migration commands against your cloud database, using
// SUPABASE_DB_URL from .env.local (so the password never goes on the command line).
//
//   npm run db:push     apply new files in supabase/migrations
//   npm run db:status   list which migrations are applied
//   npm run db:new -- add_customer_gst   create an empty migration file
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd(), false, { info() {}, error: console.error });

const [cmd, ...rest] = process.argv.slice(2);
const cli = (args) => {
  const r = spawnSync("npx", ["--no-install", "supabase", ...args], { stdio: "inherit" });
  process.exit(r.status ?? 1);
};

if (cmd === "new") {
  if (!rest[0]) {
    console.error("Usage: npm run db:new -- <name>   e.g. npm run db:new -- add_gst_number");
    process.exit(1);
  }
  cli(["migration", "new", rest.join("_")]);
}

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error(
    "\nSUPABASE_DB_URL is missing in .env.local.\n" +
    "Supabase Dashboard → Connect → Session pooler → copy the URI and put your database password in it.\n",
  );
  process.exit(1);
}

if (cmd === "push") cli(["db", "push", "--db-url", dbUrl, ...rest]);
else if (cmd === "status") cli(["migration", "list", "--db-url", dbUrl, ...rest]);
else {
  console.error("Usage: node scripts/db.mjs <push|status|new> [args]");
  process.exit(1);
}
