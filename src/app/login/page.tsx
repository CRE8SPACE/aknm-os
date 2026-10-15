
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./login.css";

type AuthMode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");
    setLoading(true);

    try {
      const supabase = createClient();

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        router.replace("/");
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data.session) {
        router.replace("/");
        router.refresh();
        return;
      }

      setMessage(
        "Your registration was submitted. Check your email for a confirmation link if email confirmation is enabled in Supabase."
      );
      setMode("signin");
    } catch {
      setErrorMessage(
        "Unable to connect to authentication. Check your connection and Supabase configuration."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-brand">
          <div className="auth-brand-mark">A</div>
          <div>
            <p className="auth-brand-name">AKNM OS</p>
            <p className="auth-brand-caption">FOUNDER OPERATING SYSTEM</p>
          </div>
        </div>

        <div className="auth-heading">
          <span className="auth-eyebrow">
            {mode === "signin" ? "WELCOME BACK" : "GET STARTED"}
          </span>

          <h1>
            {mode === "signin"
              ? "Return to your command centre."
              : "Create your AKNM OS account."}
          </h1>

          <p>
            {mode === "signin"
              ? "Sign in to manage your plans, ventures, finances, and progress."
              : "Set up your personal operating system and start organising your work."}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="auth-email">Email address</label>
          <div className="auth-input-wrap">
            <Mail size={18} aria-hidden="true" />
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength={254}
            />
          </div>

          <label htmlFor="auth-password">Password</label>
          <div className="auth-input-wrap">
            <LockKeyhole size={18} aria-hidden="true" />
            <input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              placeholder={
                mode === "signup"
                  ? "At least 8 characters"
                  : "Enter your password"
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              maxLength={128}
            />
            <button
              className="auth-password-toggle"
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </div>

          {errorMessage && (
            <p className="auth-feedback auth-error" role="alert">
              {errorMessage}
            </p>
          )}

          {message && (
            <p className="auth-feedback auth-success" role="status">
              {message}
            </p>
          )}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            <span>
              {loading
                ? "Please wait..."
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </span>
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div className="auth-mode-switch">
          {mode === "signin" ? (
            <>
              <span>New to AKNM OS?</span>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setMessage("");
                  setErrorMessage("");
                }}
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              <span>Already have an account?</span>
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setMessage("");
                  setErrorMessage("");
                }}
              >
                Sign in
              </button>
            </>
          )}
        </div>

        <p className="auth-security-note">
          Your account is protected by Supabase authentication.
        </p>
      </section>

      <aside className="auth-aside">
        <div className="auth-orbit auth-orbit-one" />
        <div className="auth-orbit auth-orbit-two" />

        <div className="auth-aside-content">
          <span className="auth-aside-label">ONE SYSTEM. CLEAR DIRECTION.</span>
          <h2>Build deliberately. Execute consistently.</h2>
          <p>
            Bring your daily priorities, business ventures, projects, and
            achievements into one operating system.
          </p>
          <div className="auth-aside-indicator">
            <span />
            Your next chapter starts with a clear plan.
          </div>
        </div>

        <span className="auth-aside-footer">
          AKNM OS · YOUR PERSONAL EXECUTIVE SYSTEM
        </span>
      </aside>
    </main>
  );
}
