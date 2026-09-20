import React, { useState, useEffect } from "react";
import { login, loadUser } from "../../services/AuthService";
import Login from "./Login";
import { setUser } from "../../services/UserService";
import { Shield, Users, Clock3, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { useBranding } from "../../contexts/BrandingContext";
import BrandLogo from "../../components/BrandLogo";

function companyInitials(name) {
  const parts = String(name || "HR")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "HR";
}

function LoginPage({ onSuccess }) {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentYear] = useState(new Date().getFullYear());
  const { branding, loading: brandingLoading } = useBranding();
  const companyName = branding?.name || "Human Resources";
  const location = branding?.location || "";
  const theme = branding?.theme || {};
  const primary = theme.primary || "#0B4F5C";
  const secondary = theme.secondary || "#0D9488";
  const accent = theme.accent || "#FF6B4A";
  const ink = theme.ink || "#062A32";

  useEffect(() => {
    document.title = `Sign in · ${companyName}`;
  }, [companyName]);

  const handleLogin = async (credentials) => {
    setLoading(true);
    setError(null);
    try {
      await login(credentials);
      const user = await loadUser();
      setUser(user);
      if (onSuccess) onSuccess(user);
      return {};
    } catch (err) {
      const status = err?.response?.status;
      if (!err?.response) {
        setError("Cannot reach the HR API.");
      } else if (status === 429) {
        setError("Too many login attempts. Try again later.");
      } else if (status >= 500) {
        setError("Login service is unavailable. Please try again.");
      } else {
        setError("The provided credentials are incorrect.");
      }
      return {};
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: Users,
      title: "People operations",
      text: "Employees, rosters, leave and payroll in one workspace.",
    },
    {
      icon: Clock3,
      title: "Live attendance",
      text: "Time cards, approvals and biometric sync.",
    },
    {
      icon: Shield,
      title: "Secure access",
      text: "Sign-in issues a random JWT. Username and password are not sent again after login.",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row overflow-hidden bg-[var(--surface-0)]">
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.55 }}
        className="relative lg:w-[54%] min-h-[38vh] lg:min-h-screen px-8 py-10 lg:px-16 lg:py-14 flex flex-col justify-between text-white overflow-hidden"
        style={{
          background: `linear-gradient(152deg, ${ink} 0%, ${primary} 46%, ${secondary} 86%, ${accent} 145%)`,
        }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 right-0 h-80 w-80 rounded-full blur-3xl opacity-30" style={{ background: accent }} />
          <div className="absolute bottom-0 -left-16 h-96 w-96 rounded-full blur-3xl opacity-25" style={{ background: secondary }} />
          <div
            className="absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 18% 22%, white 1px, transparent 1.5px)",
              backgroundSize: "36px 36px",
            }}
          />
        </div>

        <div className="relative z-10">
          <div className="inline-flex items-center gap-4 rounded-2xl bg-white/12 border border-white/20 px-4 py-3 backdrop-blur-md">
            {branding?.logo_url ? (
              <BrandLogo
                src={branding.logo_url}
                alt={companyName}
                className="h-14 max-w-[11rem]"
              />
            ) : (
              <div
                className="h-14 w-14 rounded-xl grid place-items-center font-display text-lg font-bold shadow-lg"
                style={{ background: "rgba(255,255,255,0.18)" }}
              >
                {companyInitials(companyName)}
              </div>
            )}
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/70">Workforce portal</p>
              <p className="font-semibold leading-tight">{companyName}</p>
            </div>
          </div>

          <motion.h1
            initial={{ y: 22, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="font-display mt-8 text-4xl sm:text-5xl lg:text-[3.4rem] font-extrabold leading-[1.08] max-w-xl"
          >
            Sign in to manage your people
          </motion.h1>
          <motion.p
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.45 }}
            className="mt-4 max-w-md text-base sm:text-lg text-white/85 leading-relaxed"
          >
            Attendance, leave, payroll and employee self-service — branded for your organisation.
          </motion.p>
          {location ? (
            <p className="mt-4 inline-flex items-center gap-2 text-sm text-white/75">
              <MapPin className="h-4 w-4" />
              {location}
            </p>
          ) : null}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.45 }}
          className="relative z-10 mt-10 grid gap-3 sm:grid-cols-1"
        >
          {features.map((f) => (
            <div
              key={f.title}
              className="flex items-start gap-3 rounded-2xl bg-white/10 border border-white/15 px-4 py-3 backdrop-blur-md"
            >
              <div className="mt-0.5 rounded-xl bg-white/20 p-2">
                <f.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">{f.title}</p>
                <p className="text-sm text-white/80">{f.text}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.12 }}
        className="flex-1 flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-16"
      >
        <div className="w-full max-w-md mx-auto">
          <div className="rounded-3xl border border-white/70 bg-white/90 p-8 sm:p-9 shadow-[0_24px_60px_rgba(6,42,50,0.12)]">
            {brandingLoading && !branding ? (
              <p className="text-sm text-slate-500">Loading company branding…</p>
            ) : null}
            <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: secondary }}>
              Secure sign-in
            </p>
            <h2 className="font-display mt-2 text-3xl font-bold text-[var(--brand-ink)]">
              Welcome back
            </h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Use your email or NIC and password once. The app then keeps a signed JWT session, so closing the browser and coming back still opens the {companyName} dashboard until you log out.
            </p>

            {error && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <p className="font-semibold">Login error</p>
                <p>{error}</p>
              </div>
            )}

            <div className="mt-7">
              <Login onSuccess={handleLogin} loading={loading} />
            </div>

            <div className="mt-6 text-center space-y-2">
              <a href="/otp-login" className="block text-sm font-semibold hover:underline" style={{ color: primary }}>
                Employee OTP login →
              </a>
              <a href="/employee-portal" className="block text-sm font-semibold text-slate-600 hover:text-slate-900">
                Open employee portal →
              </a>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-[var(--text-muted)]">
            © {currentYear} {companyName}
          </p>
        </div>
      </motion.section>
    </div>
  );
}

export default LoginPage;
