import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { AlertCircle, ArrowLeft, BadgeCheck, KeyRound, Loader2, LogIn, Vote } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [specialId, setSpecialId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { loginWithSpecialId } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await loginWithSpecialId(specialId);
      navigate('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify this special ID.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 grid lg:grid-cols-[1.1fr_0.9fr]">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-emerald-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1540910419892-f39a62a1bf3d?q=80&w=2070&auto=format&fit=crop')] opacity-10 bg-cover bg-center" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 bg-emerald-500 rounded-xl flex items-center justify-center">
            <Vote className="w-7 h-7 text-white" />
          </div>
          <div>
            <span className="text-2xl font-bold tracking-tight">CivicWatch</span>
            <p className="text-xs text-emerald-200 font-bold uppercase tracking-widest">Staff Access</p>
          </div>
        </div>

        <div className="relative z-10 max-w-xl">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-bold leading-tight font-serif italic"
          >
            Verified election personnel only.
          </motion.h1>
          <p className="mt-6 text-xl text-emerald-100/75 leading-relaxed">
            Observers, supervisors, and administrators enter with the special ID issued from the system.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-4 text-sm">
          {['Observer', 'Supervisor', 'Admin'].map((role) => (
            <div key={role} className="p-4 bg-white/5 rounded-2xl border border-white/10">
              <BadgeCheck className="w-4 h-4 text-emerald-400 mb-2" />
              <p className="font-bold">{role}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col justify-center items-center p-6 md:p-10">
        <div className="w-full max-w-md">
          <button
            onClick={() => navigate('/')}
            className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-emerald-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Public dashboard
          </button>

          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-8 md:p-10 rounded-[32px] shadow-sm border border-gray-100"
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <KeyRound className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Enter Special ID</h2>
              <p className="text-gray-500 mt-2">No password or extra token required.</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-2xl border border-red-100 flex gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
              System Special ID
            </label>
            <input
              value={specialId}
              onChange={(event) => setSpecialId(event.target.value)}
              placeholder="CW-ADMIN"
              autoFocus
              className="mt-3 w-full bg-gray-50 border-2 border-gray-50 focus:border-emerald-500 rounded-2xl py-4 px-5 text-lg font-bold tracking-widest uppercase outline-none transition-all focus:bg-white"
            />

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-3"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
              {loading ? 'Verifying ID...' : 'Enter Workspace'}
            </button>

            <div className="mt-8 p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Local test IDs</p>
              <p className="text-xs text-gray-500 font-mono">CW-ADMIN / CW-SUP / CW-OBS</p>
            </div>
          </motion.form>
        </div>
      </div>
    </div>
  );
}
