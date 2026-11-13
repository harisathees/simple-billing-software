// GET /.well-known/assetlinks.json — Digital Asset Links for the Android app built
// with Bubblewrap (Trusted Web Activity). Android checks this file to prove the APK
// and this website belong together; when it matches, the app opens full-screen
// with no browser address bar.
//
// Set in .env.local / your host's environment:
//   TWA_PACKAGE_NAME=com.yourshop.billing
//   TWA_SHA256_FINGERPRINTS=AB:CD:...:EF            (comma-separate several, e.g. upload key + Play signing key)
import { connection } from "next/server";

export async function GET() {
  await connection();
  const pkg = (process.env.TWA_PACKAGE_NAME || "").trim();
  const fingerprints = (process.env.TWA_SHA256_FINGERPRINTS || "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f));

  if (!pkg || fingerprints.length === 0) {
    return Response.json(
      { error: "Set TWA_PACKAGE_NAME and TWA_SHA256_FINGERPRINTS to enable the Android app." },
      { status: 404 },
    );
  }

  return Response.json(
    [{
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: fingerprints },
    }],
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
