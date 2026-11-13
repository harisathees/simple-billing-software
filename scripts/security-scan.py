#!/usr/bin/env python3
"""Checks that no secret from .env.local ends up in anything the browser receives.
Run with `npm run security:scan` (builds first). Prints where a secret was found, never its value.
The live-response checks use the app running on PORT (default 3001), if any."""
import os, re, sys, json, base64, urllib.parse, urllib.request
root = sys.argv[1] if len(sys.argv) > 1 else "."
BASE = "http://localhost:" + os.environ.get("PORT", "3001")
env = {}
for line in open(os.path.join(root, ".env.local")):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1); env[k.strip()] = v.strip().strip('"').strip("'")

secrets = {}  # label -> value (never printed)
for k in ["SUPABASE_SECRET_KEY", "SUPABASE_DB_URL", "WHATSAPP_TOKEN"]:
    if env.get(k): secrets[k] = env[k]
if env.get("SUPABASE_DB_URL"):
    pw = urllib.parse.urlparse(env["SUPABASE_DB_URL"]).password
    if pw and len(pw) >= 6: secrets["database password"] = urllib.parse.unquote(pw)
not_secret = {"SUPABASE_URL": env.get("SUPABASE_URL", "")}

def b64(v): return base64.b64encode(v.encode()).decode().rstrip("=")
needles = {lab: [v, b64(v)] for lab, v in secrets.items()}

patterns = {
  "sb_secret_ key prefix": re.compile(rb"sb_secret_[A-Za-z0-9_\-]{10,}"),
  "service_role JWT": re.compile(rb"eyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]+"),
  "postgres URL with password": re.compile(rb"postgres(?:ql)?://[^\s\"'<>:/]+:[^\s\"'<>@/]+@"),
  "env var name SUPABASE_SECRET_KEY": re.compile(rb"SUPABASE_SECRET_KEY"),
  "env var name WHATSAPP_TOKEN": re.compile(rb"WHATSAPP_TOKEN"),
}

def scan_dir(d, label):
    files = 0; hits = []
    for dp, _, fns in os.walk(d):
        for fn in fns:
            p = os.path.join(dp, fn); files += 1
            try: data = open(p, "rb").read()
            except Exception: continue
            for lab, vals in needles.items():
                if any(v and v.encode() in data for v in vals): hits.append((lab, os.path.relpath(p, root)))
            for lab, rx in patterns.items():
                for m in rx.finditer(data):
                    if lab == "service_role JWT":
                        try:
                            payload = json.loads(base64.urlsafe_b64decode(m.group().split(b".")[1] + b"==="))
                            if payload.get("role") != "service_role": continue
                        except Exception: continue
                    hits.append((lab, os.path.relpath(p, root))); break
    print(f"\n[{label}] scanned {files} files")
    real = [(l, p) for l, p in set(hits) if not l.startswith("env var name")]
    names = [(l, p) for l, p in set(hits) if l.startswith("env var name")]
    for lab, p in sorted(real): print(f"   FOUND {lab}  ->  {p}")
    for lab, p in sorted(names): print(f"   note: {lab[13:]} appears as text (just the name, e.g. in help text — not the value)  ->  {p}")
    if not real: print("   OK - no secrets found")
    return real

print("Secrets loaded from .env.local:", ", ".join(secrets) or "(none)")
print("(values are never printed)")
h1 = scan_dir(os.path.join(root, ".next/static"), "Browser JS/CSS bundles  .next/static")
h2 = scan_dir(os.path.join(root, "public"), "Public folder  public/")
# Prerendered HTML / RSC payloads that are sent to the browser
tmp = os.path.join(root, ".next/server/app")
print("\n[Prerendered pages sent to the browser  .next/server/app/*.html|*.rsc|*.body]")
hits3 = []
for dp, _, fns in os.walk(tmp):
    for fn in fns:
        if fn.endswith((".html", ".rsc", ".body", ".meta")):
            data = open(os.path.join(dp, fn), "rb").read()
            for lab, vals in needles.items():
                if any(v and v.encode() in data for v in vals): hits3.append((lab, fn))
print("   " + ("OK - no secrets found" if not hits3 else "\n   ".join(f"FOUND {a} -> {b}" for a, b in hits3)))
# Server bundles: secrets should be read at runtime, not baked in at build time
h4 = []
for dp, _, fns in os.walk(os.path.join(root, ".next/server")):
    for fn in fns:
        data = open(os.path.join(dp, fn), "rb").read()
        for lab, vals in needles.items():
            if vals[0].encode() in data: h4.append((lab, fn))
print("\n[Server build: secrets baked in at build time?]")
print("   " + ("OK - read from .env.local at runtime only" if not h4 else "\n   ".join(f"FOUND {a} -> {b}" for a, b in h4)))
# Is the (non-secret) project URL shipped to the browser?
u = not_secret["SUPABASE_URL"]
inb = any(u and u.encode() in open(os.path.join(dp, f), "rb").read() for dp, _, fs in os.walk(os.path.join(root, ".next/static")) for f in fs)
print(f"\n[Info] Supabase project URL in browser bundle: {'yes' if inb else 'no (browser only talks to /api/*)'}")
# Live API responses from the running app
print(f"\n[Live responses from {BASE}]")
for path in ["/", "/api/shop", "/api/bills", "/api/whatsapp", "/api/customers?phone=87", "/api/bills/999999999", "/api/shop/logo?v=x"]:
    try:
        req = urllib.request.Request(BASE + path)
        try: body = urllib.request.urlopen(req, timeout=20).read()
        except urllib.error.HTTPError as e: body = e.read()
        bad = [lab for lab, vals in needles.items() if any(v and v.encode() in body for v in vals)]
        bad += [lab for lab, rx in patterns.items() if lab.startswith(("sb_secret", "postgres")) and rx.search(body)]
        print(f"   {path:28s} {'LEAK: ' + ', '.join(bad) if bad else 'OK'}")
    except Exception as e:
        print(f"   {path:28s} (could not fetch: {e.__class__.__name__})")
