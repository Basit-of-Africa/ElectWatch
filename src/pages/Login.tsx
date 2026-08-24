import React, { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { 
  Vote, 
  ShieldCheck, 
  Mail, 
  Globe, 
  ArrowLeft, 
  AlertTriangle, 
  Lock, 
  Eye, 
  EyeOff, 
  KeyRound, 
  Sparkles,
  UserCheck,
  CheckCircle2,
  LogIn
} from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  authenticateAndAuthorizeUser, 
  PRE_AUTHORIZED_ACCOUNTS, 
  DEFAULT_TEMP_PASSWORD 
} from '../lib/observerAuth';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

export default function Login() {
  const [authMethod, setAuthMethod] = useState<'email' | 'google'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(DEFAULT_TEMP_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { authError, clearAuthError, user, loginWithEmail } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your Gmail address.');
      return;
    }

    setLoading(true);
    setError(null);
    clearAuthError();

    try {
      await loginWithEmail(email.trim(), password.trim() || DEFAULT_TEMP_PASSWORD);
      toast.success(`Welcome back to iVote platform.`);
      navigate('/dashboard');
    } catch (err: any) {
      console.error("Email login error:", err);
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelectAccount = (selectedEmail: string) => {
    setEmail(selectedEmail);
    setPassword(DEFAULT_TEMP_PASSWORD);
    setError(null);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    clearAuthError();

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const { user: firebaseUser } = result;

      // Authorize that user's email is in the imported roster or admin
      await authenticateAndAuthorizeUser(firebaseUser);
      
      toast.success('Successfully authenticated via Google.');
      navigate('/dashboard');
    } catch (err: any) {
      console.error("Login authorization error:", err);
      setError(err.message || 'Access Denied: Only imported observer emails can log in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left side: branding/imagery */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-emerald-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1540910419892-f39a62a1bf3d?q=80&w=2070&auto=format&fit=crop')] opacity-10 bg-cover bg-center" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Vote className="w-8 h-8 text-emerald-400" />
            <span className="text-2xl font-bold tracking-tight">iVote.</span>
          </div>
          <Link
            to="/"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-900/90 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all border border-emerald-700/60 shadow-sm"
          >
            <Globe className="w-4 h-4 text-emerald-400" /> Public Live Feed
          </Link>
        </div>
        
        <div className="relative z-10">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold leading-tight font-serif"
          >
            Protecting the integrity of every single vote.
          </motion.h2>
          <p className="mt-4 text-base text-emerald-100/70 font-light max-w-lg leading-relaxed">
            Direct real-time electoral data gathering, instant incident alerts, and transparent verification across Nigeria.
          </p>

          {/* Direct Login Callout */}
          <div className="mt-8 p-5 bg-emerald-900/60 border border-emerald-700/60 rounded-2xl backdrop-blur-xs max-w-md">
            <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs uppercase tracking-wider mb-2">
              <KeyRound className="w-4 h-4" />
              Temporary Access Bypass
            </div>
            <p className="text-xs text-emerald-100/90 leading-relaxed">
              Use your registered Gmail with default password <span className="font-mono bg-emerald-950 px-2 py-0.5 rounded-md font-bold text-emerald-300 border border-emerald-700">iVote@6268</span> to sign in directly without Google OAuth popups.
            </p>
          </div>
        </div>

        <div className="relative z-10 flex gap-8 text-emerald-100/60 text-xs font-medium">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Tiered RBAC Security
          </div>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-emerald-400" /> Immutable Audit Logs
          </div>
        </div>
      </div>

      {/* Right side: login form */}
      <div className="flex flex-col justify-center items-center p-6 sm:p-10 bg-slate-50 relative overflow-y-auto">
        <div className="absolute top-6 left-6 lg:hidden">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-emerald-700"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Public Feed
          </Link>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-lg bg-white p-7 sm:p-9 rounded-[32px] shadow-sm border border-gray-200/80 my-8"
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3 border border-emerald-200">
              <Vote className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight font-serif">Observer Portal Sign In</h1>
            <p className="text-gray-500 mt-1 text-xs">Access your assigned election reporting workspace</p>
          </div>

          {/* Authentication Mode Switcher */}
          <div className="flex p-1 bg-gray-100 rounded-2xl mb-6 text-xs font-bold">
            <button
              type="button"
              onClick={() => { setAuthMethod('email'); setError(null); }}
              className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                authMethod === 'email'
                  ? 'bg-white text-gray-900 shadow-xs border border-gray-200/60'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
              <span>Email & Password (Direct)</span>
            </button>
            <button
              type="button"
              onClick={() => { setAuthMethod('google'); setError(null); }}
              className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                authMethod === 'google'
                  ? 'bg-white text-gray-900 shadow-xs border border-gray-200/60'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <img src="https://www.google.com/favicon.ico" alt="" className="w-3.5 h-3.5" />
              <span>Google OAuth</span>
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div role="alert" aria-live="assertive" className="mb-5 p-3.5 bg-red-50 text-red-800 text-xs font-medium rounded-2xl border border-red-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-0.5">
                <p className="font-bold text-red-900">Authentication Failed</p>
                <p className="leading-relaxed text-[11px]">{error}</p>
              </div>
            </div>
          )}

          {authMethod === 'email' ? (
            <div>
              {/* Quick Select Pre-Provisioned Accounts */}
              <div className="mb-5 space-y-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Quick Select Provisioned Account:</span>
                  <span className="text-emerald-600 font-semibold text-[10px]">Click to auto-fill</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {PRE_AUTHORIZED_ACCOUNTS.map((acc) => {
                    const isSelected = email.toLowerCase() === acc.email.toLowerCase();
                    return (
                      <button
                        key={acc.email}
                        type="button"
                        onClick={() => handleQuickSelectAccount(acc.email)}
                        className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20'
                            : 'bg-gray-50 hover:bg-gray-100/80 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-bold text-xs text-gray-900 truncate">{acc.displayName}</span>
                          <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${
                            acc.role === 'admin' 
                              ? 'bg-purple-100 text-purple-800' 
                              : acc.role === 'field_supervisor' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {acc.role === 'admin' ? 'Admin' : acc.role === 'field_supervisor' ? 'Supervisor' : 'Observer'}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-500 font-mono truncate mt-0.5">{acc.email}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Email & Password Form */}
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Username / Gmail Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. sundaytimothy955@gmail.com"
                      className="w-full text-xs pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-hidden bg-gray-50/50"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-gray-700">Password</label>
                    <span className="text-[10px] text-emerald-700 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      Default: iVote@6268
                    </span>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full text-xs pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-hidden bg-gray-50/50 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3.5 px-6 rounded-2xl transition-all duration-200 shadow-sm disabled:opacity-50 min-h-[46px] cursor-pointer mt-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Sign In with Password</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 text-xs text-amber-900 leading-relaxed">
                <p className="font-bold mb-1 flex items-center gap-1.5 text-amber-800">
                  <ShieldCheck className="w-4 h-4 text-amber-600" aria-hidden="true" /> Google Account Authorization
                </p>
                Sign in with the Google Account matching your registered observer email address.
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                aria-label="Sign in with your Google account"
                className="w-full flex items-center justify-center gap-4 bg-white border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/10 text-gray-800 font-semibold py-4 px-6 rounded-2xl transition-all duration-300 disabled:opacity-50 group min-h-[48px] cursor-pointer"
              >
                <img src="https://www.google.com/favicon.ico" alt="" aria-hidden="true" className="w-5 h-5 grayscale group-hover:grayscale-0 transition-all" />
                <span>{loading ? 'Verifying Authorization...' : 'Continue with Google'}</span>
              </button>
            </div>
          )}

          {/* Public Live Feed link */}
          <div className="mt-6 pt-5 border-t border-gray-100 space-y-3">
            <Link
              to="/"
              aria-label="Go to the public live election feed without signing in"
              className="w-full flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold py-2.5 px-4 rounded-xl transition-all text-xs border border-gray-200 min-h-[40px]"
            >
              <Globe className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              <span>Public Live Dashboard (No Login Required)</span>
            </Link>
            
            <p className="text-center text-[10px] text-gray-400 leading-relaxed">
              Default credentials configured for authorized field team accounts.
            </p>
          </div>
        </motion.div>
        
        <div className="mt-4 text-center md:hidden flex items-center gap-2 text-emerald-700 font-bold">
           <Vote className="w-5 h-5" /> iVote Nigeria
        </div>
      </div>
    </div>
  );
}

