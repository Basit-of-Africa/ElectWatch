import React, { useEffect, useState, FormEvent } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, Report } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  Search, 
  Filter, 
  UserPlus, 
  MapPin, 
  Shield, 
  CheckCircle, 
  AlertOctagon, 
  Clock, 
  Download, 
  Edit3, 
  FileText, 
  X, 
  Check,
  Building2,
  Phone,
  Mail,
  Activity,
  MoreVertical
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Seed default observers for rich initial Admin display
const DEFAULT_OBSERVERS: User[] = [
  {
    uid: 'obs-lagos-01',
    displayName: 'Amina Bello',
    email: 'amina.bello@civicwatch.org',
    role: 'observer',
    assignedPollingUnitId: 'PU-LAG-014',
    assignedPollingUnitName: 'Ikeja Primary School, Ward 02',
    phone: '+234 802 345 6789',
    status: 'active',
    state: 'Lagos',
    lga: 'Ikeja',
    reportsCount: 12,
    lastActive: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString()
  },
  {
    uid: 'obs-abuja-02',
    displayName: 'Chidi Okonkwo',
    email: 'chidi.okonkwo@civicwatch.org',
    role: 'observer',
    assignedPollingUnitId: 'PU-FCT-042',
    assignedPollingUnitName: 'Garki Model Secondary, Area 11',
    phone: '+234 803 987 6543',
    status: 'active',
    state: 'FCT',
    lga: 'Abuja Municipal',
    reportsCount: 8,
    lastActive: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 25).toISOString()
  },
  {
    uid: 'obs-rivers-03',
    displayName: 'Blessing Nwosu',
    email: 'blessing.nwosu@civicwatch.org',
    role: 'observer',
    assignedPollingUnitId: 'PU-RV-089',
    assignedPollingUnitName: 'Port Harcourt Township Hall',
    phone: '+234 814 112 2334',
    status: 'active',
    state: 'Rivers',
    lga: 'Port Harcourt',
    reportsCount: 15,
    lastActive: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString()
  },
  {
    uid: 'obs-kano-04',
    displayName: 'Ibrahim Danlami',
    email: 'ibrahim.danlami@civicwatch.org',
    role: 'observer',
    assignedPollingUnitId: 'PU-KN-102',
    assignedPollingUnitName: 'Kano Central Library, Ward 05',
    phone: '+234 805 443 3221',
    status: 'inactive',
    state: 'Kano',
    lga: 'Kano Municipal',
    reportsCount: 4,
    lastActive: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString()
  },
  {
    uid: 'obs-oyO-05',
    displayName: 'Folake Adeleke',
    email: 'folake.adeleke@civicwatch.org',
    role: 'supervisor',
    assignedPollingUnitId: 'SUP-OYO-01',
    assignedPollingUnitName: 'Ibadan North Zonal Operations',
    phone: '+234 809 776 5544',
    status: 'active',
    state: 'Oyo',
    lga: 'Ibadan North',
    reportsCount: 22,
    lastActive: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 40).toISOString()
  }
];

export default function Observers() {
  const { isAdmin, isSupervisor } = useAuth();
  const [observers, setObservers] = useState<User[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  
  // Modals state
  const [selectedObserver, setSelectedObserver] = useState<User | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Assignment Form State
  const [assignedUnitId, setAssignedUnitId] = useState('');
  const [assignedUnitName, setAssignedUnitName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // New Observer Form State
  const [newObserver, setNewObserver] = useState({
    displayName: '',
    email: '',
    phone: '',
    role: 'observer' as 'observer' | 'supervisor',
    assignedPollingUnitId: '',
    assignedPollingUnitName: '',
    state: 'Lagos',
    lga: 'Ikeja'
  });

  useEffect(() => {
    // 1. Fetch Users
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
      
      // Merge Firestore users with default seed users if they aren't already present
      const map = new Map<string, User>();
      DEFAULT_OBSERVERS.forEach(obs => map.set(obs.uid, obs));
      docs.forEach(doc => {
        if (doc.role === 'observer' || doc.role === 'supervisor' || doc.role === 'admin') {
          map.set(doc.uid, {
            ...map.get(doc.uid),
            ...doc,
            status: doc.status || 'active',
          });
        }
      });
      
      setObservers(Array.from(map.values()));
      setLoading(false);
    }, (error) => {
      console.warn('Firestore users error, falling back to seed observers:', error);
      setObservers(DEFAULT_OBSERVERS);
      setLoading(false);
    });

    // 2. Fetch Reports to aggregate counts per observer
    const unsubscribeReports = onSnapshot(collection(db, 'reports'), (snapshot) => {
      const repDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
      setReports(repDocs);
    }, (error) => {
      console.warn('Firestore reports error in Observers view:', error);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeReports();
    };
  }, []);

  // Compute report count map
  const reportCountsByObserver = reports.reduce((acc, r) => {
    if (r.observerId) {
      acc[r.observerId] = (acc[r.observerId] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Filtered observers list
  const filteredObservers = observers.filter(obs => {
    const matchesSearch = 
      obs.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      obs.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (obs.assignedPollingUnitId && obs.assignedPollingUnitId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (obs.lga && obs.lga.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (obs.state && obs.state.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || (obs.status || 'active') === statusFilter;
    const matchesRole = roleFilter === 'all' || obs.role === roleFilter;

    return matchesSearch && matchesStatus && matchesRole;
  });

  // Calculate Metrics
  const totalCount = observers.length;
  const activeCount = observers.filter(o => o.status === 'active' || !o.status).length;
  const assignedCount = observers.filter(o => o.assignedPollingUnitId).length;
  const totalSubmissions = (Object.values(reportCountsByObserver) as number[]).reduce((a, b) => a + b, 0);

  // Open Edit Assignment Modal
  const handleOpenAssignModal = (obs: User) => {
    setSelectedObserver(obs);
    setAssignedUnitId(obs.assignedPollingUnitId || '');
    setAssignedUnitName(obs.assignedPollingUnitName || '');
    setIsAssignModalOpen(true);
  };

  // Save Polling Unit Assignment
  const handleSaveAssignment = async () => {
    if (!selectedObserver) return;
    setIsUpdating(true);
    try {
      const userRef = doc(db, 'users', selectedObserver.uid);
      await updateDoc(userRef, {
        assignedPollingUnitId: assignedUnitId,
        assignedPollingUnitName: assignedUnitName,
        updatedAt: serverTimestamp()
      });
      
      // Update local state in case Firestore document doesn't exist yet for seed user
      setObservers(prev => prev.map(o => o.uid === selectedObserver.uid ? {
        ...o,
        assignedPollingUnitId: assignedUnitId,
        assignedPollingUnitName: assignedUnitName
      } : o));

      toast.success(`Updated Polling Unit assignment for ${selectedObserver.displayName}`);
      setIsAssignModalOpen(false);
    } catch (err: any) {
      console.error(err);
      // Fallback for mock/seed users if updateDoc fails
      setObservers(prev => prev.map(o => o.uid === selectedObserver.uid ? {
        ...o,
        assignedPollingUnitId: assignedUnitId,
        assignedPollingUnitName: assignedUnitName
      } : o));
      toast.success(`Updated Polling Unit for ${selectedObserver.displayName} (Local Sync)`);
      setIsAssignModalOpen(false);
    } finally {
      setIsUpdating(false);
    }
  };

  // Toggle Observer Status
  const handleToggleStatus = async (obs: User, newStatus: 'active' | 'inactive' | 'suspended') => {
    try {
      const userRef = doc(db, 'users', obs.uid);
      await updateDoc(userRef, { status: newStatus });
      setObservers(prev => prev.map(o => o.uid === obs.uid ? { ...o, status: newStatus } : o));
      toast.success(`Observer ${obs.displayName} marked as ${newStatus.toUpperCase()}`);
    } catch (err) {
      setObservers(prev => prev.map(o => o.uid === obs.uid ? { ...o, status: newStatus } : o));
      toast.success(`Observer status updated to ${newStatus.toUpperCase()}`);
    }
  };

  // Add New Observer
  const handleCreateObserver = async (e: FormEvent) => {
    e.preventDefault();
    if (!newObserver.displayName || !newObserver.email) {
      toast.error('Name and Email are required');
      return;
    }

    setIsUpdating(true);
    const generatedUid = `obs-${Date.now()}`;
    const newRecord: User = {
      uid: generatedUid,
      displayName: newObserver.displayName,
      email: newObserver.email,
      phone: newObserver.phone,
      role: newObserver.role,
      assignedPollingUnitId: newObserver.assignedPollingUnitId,
      assignedPollingUnitName: newObserver.assignedPollingUnitName,
      state: newObserver.state,
      lga: newObserver.lga,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'users', generatedUid), {
        ...newRecord,
        updatedAt: serverTimestamp()
      });
      setObservers(prev => [newRecord, ...prev]);
      toast.success(`Field Observer ${newObserver.displayName} registered successfully`);
      setIsAddModalOpen(false);
      setNewObserver({
        displayName: '',
        email: '',
        phone: '',
        role: 'observer',
        assignedPollingUnitId: '',
        assignedPollingUnitName: '',
        state: 'Lagos',
        lga: 'Ikeja'
      });
    } catch (err: any) {
      console.error(err);
      setObservers(prev => [newRecord, ...prev]);
      toast.success(`Observer ${newObserver.displayName} added locally`);
      setIsAddModalOpen(false);
    } finally {
      setIsUpdating(false);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Role', 'Status', 'Polling Unit ID', 'Polling Unit Name', 'State', 'LGA', 'Submissions'];
    const csvContent = [
      headers.join(','),
      ...filteredObservers.map(o => [
        `"${o.displayName}"`,
        `"${o.email}"`,
        o.role,
        o.status || 'active',
        `"${o.assignedPollingUnitId || 'Unassigned'}"`,
        `"${o.assignedPollingUnitName || ''}"`,
        `"${o.state || ''}"`,
        `"${o.lga || ''}"`,
        reportCountsByObserver[o.uid] || o.reportsCount || 0
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `observers_directory_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Observers CSV exported successfully');
  };

  // Export to PDF
  const exportToPDF = () => {
    const docPDF = new jsPDF();
    docPDF.text('CivicWatch - Observer Operations Directory', 14, 15);
    docPDF.setFontSize(10);
    docPDF.text(`Generated on: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`, 14, 22);

    const tableData = filteredObservers.map(o => [
      o.displayName,
      o.email,
      o.role.toUpperCase(),
      (o.status || 'active').toUpperCase(),
      o.assignedPollingUnitId || 'N/A',
      `${reportCountsByObserver[o.uid] || o.reportsCount || 0} reports`
    ]);

    autoTable(docPDF, {
      head: [['Observer Name', 'Email', 'Role', 'Status', 'Assigned Unit', 'Submissions']],
      body: tableData,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [5, 150, 105] }
    });

    docPDF.save(`observers_directory_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
    toast.success('Observers PDF exported successfully');
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-full uppercase tracking-wider">
              Admin & Supervisor Hub
            </span>
            <span className="text-gray-400 text-xs">Updated Live</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight font-serif mt-2">
            Field Observers Directory
          </h1>
          <p className="text-gray-500 mt-2 text-lg font-medium">
            Monitor deployed personnel, manage polling unit assignments, and audit field transmission activity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-700 font-semibold rounded-2xl hover:bg-gray-50 shadow-sm transition-all text-sm"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Export CSV
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-700 font-semibold rounded-2xl hover:bg-gray-50 shadow-sm transition-all text-sm"
          >
            <FileText className="w-4 h-4 text-emerald-600" />
            PDF Report
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl shadow-md transition-all text-sm"
          >
            <UserPlus className="w-4 h-4" />
            Add Observer
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Registered</p>
            <h3 className="text-3xl font-extrabold text-gray-900 mt-2 font-serif">{totalCount}</h3>
            <p className="text-xs text-emerald-600 font-semibold mt-1">Personnel on Roster</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active On Duty</p>
            <h3 className="text-3xl font-extrabold text-emerald-600 mt-2 font-serif">{activeCount}</h3>
            <p className="text-xs text-gray-500 font-semibold mt-1">Live Monitoring</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Deployed to Polling Units</p>
            <h3 className="text-3xl font-extrabold text-indigo-600 mt-2 font-serif">{assignedCount}</h3>
            <p className="text-xs text-indigo-600 font-semibold mt-1">{Math.round((assignedCount / (totalCount || 1)) * 100)}% Coverage</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <MapPin className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Transmissions</p>
            <h3 className="text-3xl font-extrabold text-amber-600 mt-2 font-serif">{totalSubmissions}</h3>
            <p className="text-xs text-amber-600 font-semibold mt-1">Reports Received</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by observer name, email, LGA, or assigned polling unit..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-medium transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-2xl border border-gray-100 text-xs font-semibold text-gray-500">
              <Filter className="w-3.5 h-3.5" />
              <span>Filter:</span>
            </div>

            {/* Status Select */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active On Duty</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>

            {/* Role Select */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="all">All Roles</option>
              <option value="observer">Field Observers</option>
              <option value="supervisor">Supervisors</option>
              <option value="admin">Administrators</option>
            </select>
          </div>
        </div>
      </div>

      {/* Observers Directory Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="font-medium text-sm">Syncing Observers Roster...</p>
          </div>
        ) : filteredObservers.length === 0 ? (
          <div className="p-16 text-center text-gray-500 space-y-3">
            <Users className="w-12 h-12 text-gray-300 mx-auto" />
            <h3 className="text-lg font-bold text-gray-800 font-serif">No observers matched your search</h3>
            <p className="text-sm text-gray-400">Try adjusting your filters or search keywords.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Observer Personnel</th>
                  <th className="py-4 px-6">Role & Status</th>
                  <th className="py-4 px-6">Assigned Polling Unit</th>
                  <th className="py-4 px-6">State / LGA</th>
                  <th className="py-4 px-6 text-center">Submissions</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredObservers.map((obs) => {
                  const submissionCount = reportCountsByObserver[obs.uid] ?? obs.reportsCount ?? 0;
                  const isCurrentActive = obs.status === 'active' || !obs.status;
                  const isSuspended = obs.status === 'suspended';

                  return (
                    <tr key={obs.uid} className="hover:bg-emerald-50/20 transition-colors group">
                      {/* Name & Contact */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm shadow-sm border border-emerald-200 shrink-0">
                            {obs.displayName ? obs.displayName.charAt(0).toUpperCase() : 'O'}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                              {obs.displayName}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-gray-400" />
                                {obs.email}
                              </span>
                              {obs.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-gray-400" />
                                  {obs.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role & Status Badges */}
                      <td className="py-4 px-6">
                        <div className="flex flex-col items-start gap-1.5">
                          <span className={`px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-md ${
                            obs.role === 'admin' 
                              ? 'bg-purple-100 text-purple-700 border border-purple-200'
                              : obs.role === 'supervisor'
                              ? 'bg-blue-100 text-blue-700 border border-blue-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {obs.role === 'admin' ? 'Administrator' : obs.role === 'supervisor' ? 'Supervisor' : 'Field Observer'}
                          </span>

                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            isCurrentActive 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                              : isSuspended 
                              ? 'bg-red-50 text-red-700 border border-red-100'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              isCurrentActive ? 'bg-emerald-500 animate-pulse' : isSuspended ? 'bg-red-500' : 'bg-gray-400'
                            }`} />
                            {isCurrentActive ? 'Active On Duty' : isSuspended ? 'Suspended' : 'Inactive'}
                          </span>
                        </div>
                      </td>

                      {/* Polling Unit */}
                      <td className="py-4 px-6">
                        {obs.assignedPollingUnitId ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-800 rounded-lg text-xs font-mono font-bold">
                              <MapPin className="w-3 h-3 text-emerald-600" />
                              {obs.assignedPollingUnitId}
                            </span>
                            {obs.assignedPollingUnitName && (
                              <p className="text-xs text-gray-500 truncate max-w-[200px]">
                                {obs.assignedPollingUnitName}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100 inline-block">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* State & LGA */}
                      <td className="py-4 px-6 text-xs text-gray-600 font-medium">
                        {obs.state || obs.lga ? (
                          <div>
                            <p className="font-bold text-gray-800">{obs.state || 'N/A'}</p>
                            <p className="text-gray-400">{obs.lga || ''}</p>
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Submission Count */}
                      <td className="py-4 px-6 text-center">
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-extrabold text-xs rounded-full border border-emerald-100">
                          {submissionCount} {submissionCount === 1 ? 'Report' : 'Reports'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenAssignModal(obs)}
                            className="p-2 text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all"
                            title="Assign or Edit Polling Unit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Quick Status Toggle */}
                          {obs.status === 'suspended' ? (
                            <button
                              onClick={() => handleToggleStatus(obs, 'active')}
                              className="px-2.5 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-all"
                              title="Reactivate Observer"
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleStatus(obs, 'suspended')}
                              className="px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Suspend Access"
                            >
                              Suspend
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Assign Polling Unit */}
      <AnimatePresence>
        {isAssignModalOpen && selectedObserver && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl border border-gray-100 space-y-6"
            >
              <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 font-serif">
                    Assign Polling Unit
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-1">
                    Updating deployment for <span className="font-bold text-emerald-700">{selectedObserver.displayName}</span>
                  </p>
                </div>
                <button
                  onClick={() => setIsAssignModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Polling Unit Identifier Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PU-LAG-014 or PU-FCT-042"
                    value={assignedUnitId}
                    onChange={(e) => setAssignedUnitId(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Polling Unit Name / Venue Details
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ikeja Primary School, Ward 02"
                    value={assignedUnitName}
                    onChange={(e) => setAssignedUnitName(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-medium"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAssignment}
                  disabled={isUpdating}
                  className="px-6 py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-md transition-all flex items-center gap-2"
                >
                  {isUpdating ? 'Saving...' : 'Confirm Assignment'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Add New Observer */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-xl w-full shadow-2xl border border-gray-100 space-y-6"
            >
              <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 font-serif">
                    Register New Field Observer
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-1">
                    Add authorized election monitoring personnel to the roster.
                  </p>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateObserver} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. David Alabi"
                      value={newObserver.displayName}
                      onChange={(e) => setNewObserver({ ...newObserver, displayName: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="observer@civicwatch.org"
                      value={newObserver.email}
                      onChange={(e) => setNewObserver({ ...newObserver, email: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="+234 800 000 0000"
                      value={newObserver.phone}
                      onChange={(e) => setNewObserver({ ...newObserver, phone: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      System Role
                    </label>
                    <select
                      value={newObserver.role}
                      onChange={(e) => setNewObserver({ ...newObserver, role: e.target.value as any })}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-bold bg-white"
                    >
                      <option value="observer">Field Observer</option>
                      <option value="supervisor">Regional Supervisor</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      State
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Lagos"
                      value={newObserver.state}
                      onChange={(e) => setNewObserver({ ...newObserver, state: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      LGA / District
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ikeja"
                      value={newObserver.lga}
                      onChange={(e) => setNewObserver({ ...newObserver, lga: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Polling Unit Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. PU-LAG-015"
                      value={newObserver.assignedPollingUnitId}
                      onChange={(e) => setNewObserver({ ...newObserver, assignedPollingUnitId: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Venue Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. St. Judes Secondary"
                      value={newObserver.assignedPollingUnitName}
                      onChange={(e) => setNewObserver({ ...newObserver, assignedPollingUnitName: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-2xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="px-6 py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-md transition-all flex items-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    Register Observer
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
