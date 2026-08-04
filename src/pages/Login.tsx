import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Vote, ShieldCheck, Mail, LogIn } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const { user } = result;

      // Check if user exists in our Firestore
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // Create a new user record
        await setDoc(userRef, {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          role: 'observer', // Default role
          createdAt: new Date().toISOString(),
          updatedAt: serverTimestamp(),
        });
      }
      
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left side: branding/imagery */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-emerald-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1540910419892-f39a62a1bf3d?q=80&w=2070&auto=format&fit=crop')] opacity-10 bg-cover bg-center" />
        <div className="relative z-10 flex items-center gap-3">
          <Vote className="w-8 h-8 text-emerald-400" />
          <span className="text-2xl font-bold tracking-tight">CivicWatch.</span>
        </div>
        
        <div className="relative z-10">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-bold leading-tight font-serif"
          >
            Protecting the integrity of every single vote.
          </motion.h2>
          <p className="mt-6 text-xl text-emerald-100/70 font-light max-w-lg">
            A secure, real-time election monitoring system designed for accountability, transparency, and civil impact.
          </p>
        </div>

        <div className="relative z-10 flex gap-12 text-emerald-100/50 text-sm font-medium">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Secure Auth
          </div>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4" /> Audit Trails
          </div>
        </div>
      </div>

      {/* Right side: login form */}
      <div className="flex flex-col justify-center items-center p-8 bg-gray-50">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white p-10 rounded-[32px] shadow-sm border border-gray-100"
        >
          <div className="text-center mb-10">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Observer Sign In</h1>
            <p className="text-gray-500 mt-2">Access your reporting dashboard</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-2xl border border-red-100 animate-pulse">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-4 bg-white border-2 border-gray-100 hover:border-emerald-500 hover:bg-emerald-50/10 text-gray-700 font-semibold py-4 px-6 rounded-2xl transition-all duration-300 disabled:opacity-50 group"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 grayscale group-hover:grayscale-0 transition-all" />
              {loading ? 'Authenticating...' : 'Continue with Google'}
            </button>
            
            <div className="flex items-center gap-4 text-gray-400 text-xs font-medium uppercase tracking-widest my-8">
              <div className="h-px flex-1 bg-gray-100" />
              Authorized Personnel Only
              <div className="h-px flex-1 bg-gray-100" />
            </div>

            <p className="text-center text-xs text-gray-400 leading-relaxed px-4">
              By continuing, you agree to our terms of service and acknowledge that all reports submitted are subject to audit and verification.
            </p>
          </div>
        </motion.div>
        
        <div className="mt-8 text-center md:hidden flex items-center gap-2 text-emerald-700 font-bold">
           <Vote className="w-5 h-5" /> CivicWatch
        </div>
      </div>
    </div>
  );
}
