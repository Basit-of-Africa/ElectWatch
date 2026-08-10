import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import NotificationCenter from './NotificationCenter';
import OfflineSyncBanner from './OfflineSyncBanner';
import FirstTimeLocationPrompt from './FirstTimeLocationPrompt';
import DangerButton from './DangerButton';
import ActiveSOSBanner from './ActiveSOSBanner';
import InstallPWABanner, { InstallPWAButton } from './InstallPWA';
import { 
  LayoutDashboard, 
  FileText, 
  FilePlus,
  AlertTriangle, 
  LogOut, 
  Menu, 
  X,
  Vote,
  Map as MapIcon,
  Wifi,
  WifiOff,
  Users,
  Globe
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { onSnapshotsInSync } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Layout() {
  const { user, isAdmin, isSupervisor } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Track Firestore sync status
    const unsubscribeSync = onSnapshotsInSync(db, () => {
      setIsSyncing(false);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeSync();
    };
  }, []);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Public Live Feed', href: '/', icon: Globe },
    { name: 'Incident Map', href: '/map', icon: MapIcon },
    // Administrators and supervisors can see all reports and observers directory
    ...(isAdmin || isSupervisor ? [
      { name: 'Reports', href: '/reports', icon: FileText },
      { name: 'Observers', href: '/observers', icon: Users }
    ] : []),
    // Only common observers and admins can submit reports in this model
    ...(!isSupervisor ? [{ name: 'Report', href: '/report', icon: FilePlus }] : []),
    { name: 'Incidents', href: '/incidents', icon: AlertTriangle },
  ];

  const handleSignOut = () => {
    try {
      localStorage.removeItem('ivote_authorized_user_session');
    } catch (e) {
      // ignore
    }
    signOut(auth);
  };

  const getRoleLabel = () => {
    if (isAdmin) return 'Administrator';
    if (isSupervisor) return 'Supervisor';
    return 'Field Observer';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 sticky top-0 h-screen">
        <div className="p-6 flex items-center gap-3 border-b border-gray-100">
          <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
            <Vote className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 leading-none">iVote</h1>
            <p className="text-xs text-gray-500 mt-1">Election Monitor</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-emerald-50 text-emerald-700 font-medium' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-emerald-600' : ''}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="bg-gray-50 rounded-2xl p-4 mb-4 space-y-2">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Account</p>
              <p className="text-sm font-medium text-gray-900 mt-1 truncate">{user?.displayName}</p>
              <p className="text-xs text-emerald-600 font-medium bg-emerald-100/50 px-2 py-0.5 rounded-full inline-block mt-1 uppercase tracking-tighter">
                {getRoleLabel()}
              </p>
            </div>
            <div className="pt-2 border-t border-gray-200/60">
              <InstallPWAButton className="w-full justify-center" />
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium text-sm"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Nav */}
      <div className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Vote className="text-emerald-600 w-6 h-6" />
          <span className="font-bold text-gray-900 tracking-tight">iVote</span>
        </div>
        <div className="flex items-center gap-2">
          <DangerButton variant="compact" />
          <NotificationCenter />
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden fixed inset-0 z-40 pt-20 bg-white"
          >
            <nav className="p-6 space-y-2">
              <div className="pb-2">
                <InstallPWAButton className="w-full justify-center py-3 text-sm" />
              </div>
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-4 p-4 text-lg font-medium text-gray-900 hover:bg-gray-50 rounded-2xl"
                >
                  <item.icon className="w-6 h-6 text-emerald-600" />
                  {item.name}
                </Link>
              ))}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-4 p-4 text-lg font-medium text-red-600 hover:bg-red-50 rounded-2xl w-full text-left"
              >
                <LogOut className="w-6 h-6" />
                Sign Out
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 min-h-screen">
        <header className="hidden md:flex justify-between items-center p-6 border-b border-gray-50 bg-white/50 backdrop-blur-sm sticky top-0 z-30">
          <div className="flex items-center gap-4 px-4">
             <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-100 shadow-sm">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 animate-pulse'}`} />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  {isOnline ? (
                    <>
                      <Wifi className="w-3 h-3 text-emerald-500" />
                      Live Connection
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3 h-3 text-red-500" />
                      Offline Mode
                    </>
                  )}
                </span>
             </div>
             {isSyncing && (
               <motion.span 
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1"
               >
                 <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                 Syncing
               </motion.span>
             )}
          </div>
          <div className="flex items-center gap-3">
             <InstallPWAButton />
             <DangerButton variant="header" />
             <div className="h-8 w-px bg-gray-100 mx-1" />
             <NotificationCenter />
          </div>
        </header>

        <ActiveSOSBanner />
        <OfflineSyncBanner />
        <FirstTimeLocationPrompt />
        <InstallPWABanner />

        <div className="p-6 md:p-10 lg:p-12 max-w-7xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
