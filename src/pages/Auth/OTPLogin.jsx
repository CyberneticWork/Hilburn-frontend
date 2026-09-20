import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Key, LogIn, ArrowLeft } from 'lucide-react';
import axios from '../../utils/axios';
import { useBranding } from '../../contexts/BrandingContext';
import BrandLogo from '../../components/BrandLogo';
import { setToken } from '../../services/TokenService';
import { setUser, homePathForUser } from '../../services/UserService';

export default function OTPLogin() {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const companyName = branding?.name || 'Human Resources';
  const theme = branding?.theme || {};
  const primary = theme.primary || '#0B4F5C';
  const secondary = theme.secondary || '#0D9488';
  const accent = theme.accent || '#FF6B4A';
  const ink = theme.ink || '#062A32';
  const [step, setStep] = useState(1); // 1: email, 2: OTP
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await axios.post('/send-otp', { email });
      setMessage('If that account exists, an OTP has been sent.');
      setStep(2);
    } catch (err) {
      setError('Unable to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await axios.post('/login/otp', { email, otp });
      await setToken(data.access_token || data.token);
      const { data: userData } = await axios.get('/user');
      setUser(userData);
      navigate(homePathForUser(userData), { replace: true });
      window.location.reload();
    } catch (err) {
      setError('The provided credentials are incorrect.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(900px 500px at 15% 10%, ${secondary}55, transparent 55%), radial-gradient(700px 420px at 90% 0%, ${accent}38, transparent 50%), linear-gradient(160deg, ${ink} 0%, ${primary} 45%, ${secondary} 100%)`,
        }}
      />
      <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-teal-300/20 blur-3xl anim-float" />
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-orange-400/15 blur-3xl anim-float" style={{ animationDelay: "1.2s" }} />

      <div className="relative w-full max-w-md anim-rise">
        <div className="text-center mb-8">
          {branding?.logo_url ? (
            <BrandLogo
              src={branding.logo_url}
              alt={companyName}
              className="mx-auto mb-4 h-16 max-w-[12rem] justify-center"
              imgClassName="block h-full w-auto max-w-full object-contain object-center drop-shadow-[0_1px_10px_rgba(255,255,255,0.28)]"
            />
          ) : null}
          <p className="font-display text-3xl font-bold text-white">{companyName}</p>
          <p className="text-white/85 text-sm mt-1">Employee Portal</p>
        </div>

        <div className="glass-panel rounded-3xl p-8 border border-white/30">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-slate-600 hover:text-teal-700 mb-6 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </button>

          <h2 className="font-display text-2xl font-bold text-[var(--brand-ink)] mb-2">Employee Login</h2>
          <p className="text-slate-500 mb-6 text-sm">
            {step === 1 ? 'Enter your email to receive a one-time code' : 'Enter the OTP sent to your email'}
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl mb-4 text-sm">
              {message}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-teal-500 w-5 h-5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-teal-100 rounded-xl bg-white/90 focus:ring-2 focus:ring-teal-500/40 focus:border-teal-400 outline-none transition"
                    placeholder="employee@company.com"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center disabled:opacity-50 shadow-lg hover:shadow-xl transition-all"
                style={{ background: `linear-gradient(135deg, ${secondary}, ${primary})` }}
              >
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  OTP Code
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-teal-500 w-5 h-5" />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-teal-100 rounded-xl bg-white/90 focus:ring-2 focus:ring-teal-500/40 focus:border-teal-400 outline-none transition tracking-widest"
                    placeholder="123456"
                    maxLength="6"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center disabled:opacity-50 shadow-lg hover:shadow-xl transition-all"
                style={{ background: `linear-gradient(135deg, ${accent}, ${primary})` }}
              >
                {loading ? (
                  'Verifying...'
                ) : (
                  <>
                    <LogIn className="w-5 h-5 mr-2" />
                    Login
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-teal-700 hover:text-teal-900 text-sm font-medium"
              >
                Use a different email
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
