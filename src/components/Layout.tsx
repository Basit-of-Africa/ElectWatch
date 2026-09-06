import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import NotificationCenter from './NotificationCenter';
import OfflineSyncBanner from './OfflineSyncBanner';
import FirstTimeLocationPrompt from './FirstTimeLocationPrompt';
import DangerButton from './DangerButton';
import ActiveSOSBanner from './ActiveSOSBanner';
import ActiveDirectivesBanner from './ActiveDirectivesBanner';
import InstallPWABanner, { InstallPWAButton } from './InstallPWA';
import ElectionScopeSelector from './ElectionScopeSelector';
import ObserverOnboarding from './ObserverOnboarding';
import PushNotificationPrompt from './PushNotificationPrompt';
import ObserverFAB from './ObserverFAB';
import { 
  LayoutGrid, 
  FileText, 
  FilePlus,
  AlertTriangle, 
  LogOut, 
  Menu, 
  X, 
  Vote, 
  Map as MapIcon, 
  Building2,
  ClipboardList,
  Paperclip,
  Bell,
  Wifi, 
  WifiOff, 
  Users, 
  Globe, 
  BookOpen, 
  ShieldCheck,
  CalendarDays
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { onSnapshotsInSync } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getIsOnline } from '../lib/offlineStorage';

export default function Layout() {
  const { user, isAdmin, isSupervisor, signOut: logoutUser } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(getIsOnline);
  const [showGuidelinesModal, setShowGuidelinesModal] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(getIsOnline());
    const handleOffline = () => setIsOnline(false);
    const handleNetworkChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ isOnline: boolean }>;
      setIsOnline(customEvent.detail?.isOnline ?? getIsOnline());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('ivote_network_status_change', handleNetworkChange);

    // Escape key listener for accessible modal / mobile menu dismiss
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isMobileMenuOpen) setIsMobileMenuOpen(false);
        if (showGuidelinesModal) setShowGuidelinesModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Track Firestore sync status
    const unsubscribeSync = onSnapshotsInSync(db, () => {
      setIsSyncing(false);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('ivote_network_status_change', handleNetworkChange);
      window.removeEventListener('keydown', handleKeyDown);
      unsubscribeSync();
    };
  }, [isMobileMenuOpen, showGuidelinesModal]);

  const navSections = [
    {
      title: 'Core Operations',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutGrid, exact: true },
        { name: 'Election Rounds', href: '/election-rounds', icon: Vote, exact: false },
        { name: 'Polling Stations', href: '/polling-stations', icon: Building2, match: ['/polling-stations', '/map'] },
        { name: 'Observers', href: '/observers', icon: Users, exact: false },
      ]
    },
    {
      title: 'Data & Monitoring',
      items: [
        { name: 'Forms', href: '/forms', icon: ClipboardList, match: ['/forms', '/report'] },
        { name: 'Reports', href: '/reports', icon: FileText, exact: false },
        { name: 'Incidents', href: '/incidents', icon: AlertTriangle, exact: false },
        { name: 'Attachments / Evidence', href: '/evidence', icon: Paperclip, match: ['/evidence', '/attachments'] },
      ]
    },
    {
      title: 'Governance & Alerts',
      items: [
        { name: 'Notifications', href: '/notifications', icon: Bell, exact: false },
        ...(isAdmin || isSupervisor ? [
          { name: 'Administration', href: '/administration', icon: ShieldCheck, match: ['/administration', '/admin'] }
        ] : []),
        { name: 'Public Live Feed', href: '/', icon: Globe, exact: true },
      ]
    }
  ];

  const isRouteActive = (item: any) => {
    if (item.match && Array.isArray(item.match)) {
      return item.match.some((p: string) => location.pathname.startsWith(p));
    }
    if (item.exact) {
      return location.pathname === item.href;
    }
    return location.pathname.startsWith(item.href);
  };

  const handleSignOut = () => {
    logoutUser();
  };

  const getRoleLabel = () => {
    if (isAdmin) return 'Administrator';
    if (isSupervisor) return 'Field Supervisor';
    return 'Field Observer';
  };

  const getRoleBadgeClasses = () => {
    if (isAdmin) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (isSupervisor) return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-emerald-100/70 text-emerald-800 border-emerald-200';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Accessible Skip Link for Keyboard and Screen Reader Users */}
      <a 
        href="#main-content" 
        className="sr-only-focusable z-50 p-4 bg-[#141A56] text-white font-bold rounded-xl shadow-2xl fixed top-4 left-4 focus:ring-4 focus:ring-emerald-400"
      >
        Skip to main content
      </a>

      {/* Sidebar for Desktop */}
      <aside 
        aria-label="Desktop Sidebar Navigation"
        className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 sticky top-0 h-screen shrink-0"
      >
        <div className="p-5 flex items-center gap-3 border-b border-gray-100">
          <div className="w-10 h-10 bg-emerald-700 rounded-xl flex items-center justify-center shadow-xs">
            <Vote className="text-white w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-base leading-none font-serif">iVote</h1>
            <p className="text-[11px] text-gray-500 font-medium mt-1">Election Monitor</p>
          </div>
        </div>

        <nav aria-label="Main Navigation" className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.title}>
              <p className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 font-sans">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = isRouteActive(item);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-full text-xs font-semibold transition-all duration-150 min-h-[40px] group ${
                        isActive 
                          ? 'bg-[#f0f4ff] text-[#1e2246] border border-[#c7d7fe] shadow-xs' 
                          : 'text-gray-600 hover:bg-gray-100/70 hover:text-gray-900 border border-transparent font-medium'
                      }`}
                    >
                      <Icon 
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-[#1e2246]' : 'text-gray-400 group-hover:text-gray-600'
                        }`} 
                        aria-hidden="true" 
                      />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="bg-gray-50 rounded-2xl p-3.5 mb-3 space-y-1.5">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Active Account</p>
              <p className="text-xs font-bold text-gray-900 mt-0.5 truncate">{user?.displayName || user?.email}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1 uppercase tracking-wider border ${getRoleBadgeClasses()}`}>
                {getRoleLabel()}
              </span>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            aria-label="Sign out of your account"
            className="flex items-center gap-2.5 w-full px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-bold text-xs cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Nav Header */}
      <div className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Vote className="text-emerald-600 w-6 h-6" aria-hidden="true" />
          <span className="font-bold text-gray-900 tracking-tight text-lg font-serif">iVote</span>
        </div>
        <div className="flex items-center gap-2">
          <DangerButton variant="compact" />
          <NotificationCenter />
          <button 
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation-drawer"
            className="p-2.5 text-gray-700 hover:bg-gray-100 active:bg-gray-200 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            id="mobile-navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation Menu"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden fixed inset-0 z-40 pt-20 bg-white overflow-y-auto"
          >
            <nav aria-label="Mobile Main Navigation" className="p-6 space-y-4">
              {navSections.map((section) => (
                <div key={section.title}>
                  <p className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    {section.title}
                  </p>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const isActive = isRouteActive(item);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`flex items-center gap-3.5 px-4 py-3 rounded-full text-sm font-semibold transition-colors ${
                            isActive 
                              ? 'bg-[#f0f4ff] text-[#1e2246] border border-[#c7d7fe] shadow-xs' 
                              : 'text-gray-800 hover:bg-gray-100/70 border border-transparent font-medium'
                          }`}
                        >
                          <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#1e2246]' : 'text-gray-400'}`} aria-hidden="true" />
                          <span>{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="pt-4 border-t border-gray-100 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setShowGuidelinesModal(true);
                  }}
                  className="flex items-center gap-3.5 p-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 rounded-xl w-full text-left cursor-pointer"
                >
                  <BookOpen className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span>Code of Conduct & Guidelines</span>
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center gap-3.5 p-3 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-xl w-full text-left cursor-pointer"
                >
                  <LogOut className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <span>Sign Out</span>
                </button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main id="main-content" role="main" tabIndex={-1} className="flex-1 min-h-screen outline-none">
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
             <button
               onClick={() => setShowGuidelinesModal(true)}
               className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200/80 transition-all cursor-pointer"
             >
               <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
               <span>Code of Conduct</span>
             </button>
             <ElectionScopeSelector compact />
             <PushNotificationPrompt compact />
             <DangerButton variant="header" />
             <div className="h-8 w-px bg-gray-100 mx-1" />
             <NotificationCenter />
          </div>
        </header>

        <ActiveSOSBanner />
        <OfflineSyncBanner />
        <FirstTimeLocationPrompt />
        <InstallPWABanner />

        <div className="p-6 md:p-10 lg:p-12 max-w-7xl mx-auto w-full space-y-6">
          <ActiveDirectivesBanner />
          <Outlet />
        </div>
      </main>

      {/* Observer Floating Quick Action Button (Speed Dial FAB) */}
      <ObserverFAB />

      {/* Modal Overlay for Observer Guidelines & Onboarding */}
      <AnimatePresence>
        {showGuidelinesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-4xl"
            >
              <ObserverOnboarding 
                onCancel={() => setShowGuidelinesModal(false)}
                onComplete={() => setShowGuidelinesModal(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
