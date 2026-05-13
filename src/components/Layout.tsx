import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import NotificationCenter from './NotificationCenter';
import { 
  LayoutDashboard, 
  FileText, 
  FilePlus,
  AlertTriangle, 
  LogOut, 
  Menu, 
  X,
  Vote
} from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export default function Layout() {
  const { user, isAdmin, isSupervisor } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    // Administrators and supervisors can see all reports
    ...(isAdmin || isSupervisor ? [{ name: 'Reports', href: '/reports', icon: FileText }] : []),
    // Only common observers and admins can submit reports in this model
    ...(!isSupervisor ? [{ name: 'Report', href: '/report', icon: FilePlus }] : []),
    { name: 'Incidents', href: '/incidents', icon: AlertTriangle },
  ];

  const handleSignOut = () => {
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
            <h1 className="font-bold text-gray-900 leading-none">CivicWatch</h1>
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
          <div className="bg-gray-50 rounded-2xl p-4 mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Account</p>
            <p className="text-sm font-medium text-gray-900 mt-1 truncate">{user?.displayName}</p>
            <p className="text-xs text-emerald-600 font-medium bg-emerald-100/50 px-2 py-0.5 rounded-full inline-block mt-1 uppercase tracking-tighter">
              {getRoleLabel()}
            </p>
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
          <span className="font-bold text-gray-900 tracking-tight">CivicWatch</span>
        </div>
        <div className="flex items-center gap-2">
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
        <header className="hidden md:flex justify-end p-6 border-b border-gray-50 bg-white/50 backdrop-blur-sm sticky top-0 z-30">
          <div className="flex items-center gap-4">
             <div className="h-8 w-px bg-gray-100 mx-2" />
             <NotificationCenter />
          </div>
        </header>

        <div className="p-6 md:p-10 lg:p-12 max-w-7xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
