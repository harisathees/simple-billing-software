#!/usr/bin/env node
// Manage who can log in. There is no sign-up page — only these commands create accounts.
// Uses SUPABASE_URL + SUPABASE_SECRET_KEY from .env.local. Passwords are typed at a hidden
// prompt and are never written to any file.
//
//   npm run user:add -- owner@shop.com        create a staff login (or allow an existing one)
//   npm run user:list                          show all logins
//   npm run user:password -- owner@shop.com    change a password
//   npm run user:remove -- staff@shop.com      delete a login
import { createRequire } from "node:module";
import readline from "node:readline";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd(), false, { info() {}, error: console.error });
const { createClient } = require("@supabase/supabase-js");

const STAFF_ROLE = "staff"; // must match src/lib/server/auth.ts

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) fail("SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local.");
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).auth.admin;

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Echo "*" instead of the typed characters.
      rl._writeToOutput = (s) => rl.output.write(s.startsWith(question) ? question + "*".repeat(rl.line.length) : "*");
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function askNewPassword() {
  const pw = await ask("Password (min 8 characters): ", { hidden: true });
  if (pw.length < 8) fail("Password must be at least 8 characters.");
  const again = await ask("Repeat password: ", { hidden: true });
  if (pw !== again) fail("Passwords don't match.");
  return pw;
}

async function allUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 200 });
    if (error) fail(error.message);
    users.push(...data.users);
    if (data.users.length < 200) return users;
  }
}

async function findUser(email) {
  const u = (await allUsers()).find((x) => x.email?.toLowerCase() === email);
  if (!u) fail(`No login found for ${email}.`);
  return u;
}

function emailArg(rest) {
  const email = (rest[0] || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Give an email address, e.g. npm run user:add -- owner@shop.com");
  return email;
}

const [cmd, ...rest] = process.argv.slice(2);

if (cmd === "add") {
  const email = emailArg(rest);
  const password = await askNewPassword();
  const { data, error } = await admin.createUser({
    email, password,
    email_confirm: true,                 // no confirmation email needed
    app_metadata: { role: STAFF_ROLE },  // only the secret key can set this
  });
  if (error && /already|exists|registered/i.test(error.message)) {
    const ok = await ask(`${email} already has an account. Allow it to use the app and set this password? (y/N) `);
    if (ok.trim().toLowerCase() !== "y") fail("Cancelled.");
    const u = await findUser(email);
    const upd = await admin.updateUserById(u.id, {
      password, email_confirm: true, app_metadata: { ...u.app_metadata, role: STAFF_ROLE },
    });
    if (upd.error) fail(upd.error.message);
    console.log(`\n✔ ${email} can now log in.\n`);
  } else if (error) {
    fail(error.message);
  } else {
    console.log(`\n✔ Created login for ${data.user.email}. They can sign in at /login.\n`);
  }
} else if (cmd === "list") {
  const users = await allUsers();
  if (!users.length) console.log("\nNo logins yet. Add one with: npm run user:add -- owner@shop.com\n");
  else {
    console.log("");
    for (const u of users) {
      const staff = u.app_metadata?.role === STAFF_ROLE ? "staff  " : "BLOCKED";
      const last = u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "never";
      console.log(`  ${staff}  ${u.email}   (last sign-in: ${last})`);
    }
    console.log("\n  staff = can use the app · BLOCKED = account exists but is not allowed\n");
  }
} else if (cmd === "password") {
  const email = emailArg(rest);
  const u = await findUser(email);
  const password = await askNewPassword();
  const { error } = await admin.updateUserById(u.id, { password });
  if (error) fail(error.message);
  console.log(`\n✔ Password changed for ${email}.\n`);
} else if (cmd === "remove") {
  const email = emailArg(rest);
  const u = await findUser(email);
  const ok = await ask(`Delete the login ${email}? Bills are not affected. (y/N) `);
  if (ok.trim().toLowerCase() !== "y") fail("Cancelled.");
  const { error } = await admin.deleteUser(u.id);
  if (error) fail(error.message);
  console.log(`\n✔ Removed ${email}. They are signed out the next time their session refreshes.\n`);
} else {
  fail("Usage: npm run user:add|user:list|user:password|user:remove -- <email>");
}
