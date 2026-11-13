"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import ThemeToggle from "./ThemeToggle";
import { EyeIcon, EyeOffIcon, LockIcon } from "./icons";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.login(email, password);
      window.location.replace("/");          // full load so the new session cookie is used
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-theme"><ThemeToggle /></div>
      <form className="login-card" onSubmit={submit}>
        <div className="login-icon"><LockIcon /></div>
        <h1>Sign in</h1>

        <label htmlFor="l_email">Email</label>
        <input
          id="l_email" type="email" required autoComplete="username" autoFocus
          value={email} onChange={(e) => setEmail(e.target.value)}
        />

        <label htmlFor="l_password">Password</label>
        <div className="pw-field">
          <input
            id="l_password" type={show ? "text" : "password"} required autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button" className="pw-toggle" onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"} title={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>

        {error && <div className="error" role="alert">{error}</div>}

        <button type="submit" className="primary login-btn" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
