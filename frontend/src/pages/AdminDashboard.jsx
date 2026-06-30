import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import useCountUp from '../hooks/useCountUp';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import {
  LayoutDashboard,
  LineChart,
  Radio,
  AlertOctagon,
  LogOut,
  Clock,
  ThumbsUp,
  MapPin,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Menu,
  X,
  Sparkles,
  Send,
} from 'lucide-react';

const SEVERITY_STYLES = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-red-50 text-red-700 border-red-200 severity-critical',
};

const STATUS_STYLES = {
  pending: 'bg-slate-100 text-slate-700',
  'in-progress': 'bg-sky-100 text-sky-700',
  verification: 'bg-amber-100 text-amber-700',
  resolved: 'bg-emerald-100 text-emerald-700',
};

const TIMELINE_STEPS = [
  { id: 1, label: 'Issue Reported' },
  { id: 2, label: 'Assigned to Officer' },
  { id: 3, label: 'Worker Dispatched' },
  { id: 4, label: 'Work in Progress' },
  { id: 5, label: 'Verification Pending' },
  { id: 6, label: 'Completed' },
];

function barWidth(value, max) {
  if (!max) return '0%';
  return `${Math.max(8, (value / max) * 100)}%`;
}

export default function AdminDashboard() {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState('issues');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [issues, setIssues] = useState([]);
  const [expandedIssue, setExpandedIssue] = useState(null);
  const [statusUpdate, setStatusUpdate] = useState({});
  const [adminNotes, setAdminNotes] = useState({});
  const [draftedResponse, setDraftedResponse] = useState(null);
  const [loadingIssues, setLoadingIssues] = useState(true);
  const [insights, setInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastType, setBroadcastType] = useState('info');
  const [broadcasts, setBroadcasts] = useState([]);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(true);
  const [emergencyMessage, setEmergencyMessage] = useState('');
  const [emergencySeverity, setEmergencySeverity] = useState('high');
  const [updatedIds, setUpdatedIds] = useState(new Set());

  useEffect(() => {
    fetchIssues();
    fetchBroadcasts();
  }, []);

  const fetchIssues = async () => {
    setLoadingIssues(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/issues`);
      setIssues(res.data);
    } catch (err) {
      console.error('Failed to fetch issues', err);
      toast.error('Failed to fetch issues.');
    } finally {
      setLoadingIssues(false);
    }
  };

  const fetchBroadcasts = async () => {
    setLoadingBroadcasts(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/broadcasts`);
      setBroadcasts(res.data);
    } catch (err) {
      console.error('Failed to fetch broadcasts', err);
    } finally {
      setLoadingBroadcasts(false);
    }
  };

  const handleRankIssues = async () => {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/ai/rank-issues`, { openIssues: issues.filter((issue) => issue.status !== 'resolved') });
      const rankedIds = res.data.ranked_ids || [];
      const rankedMap = new Map(rankedIds.map((id, index) => [id, index]));
      const sorted = [...issues].sort((a, b) => {
        if (a.status === 'resolved' && b.status !== 'resolved') return 1;
        if (a.status !== 'resolved' && b.status === 'resolved') return -1;
        const rankA = rankedMap.has(a.id) ? rankedMap.get(a.id) : 999;
        const rankB = rankedMap.has(b.id) ? rankedMap.get(b.id) : 999;
        return rankA - rankB;
      });
      setIssues(sorted);
      toast.success('AI ranking applied.');
    } catch (err) {
      console.error('Failed to rank issues', err);
      toast.error('Failed to rank issues.');
    }
  };

  const handleUpdateStatus = async (issueId) => {
    const status = statusUpdate[issueId] || 'pending';
    const notes = adminNotes[issueId] || '';

    try {
      const res = await axios.put(`${API_BASE_URL}/api/admin/issues/${issueId}/status`, { status, adminNotes: notes });
      setDraftedResponse(res.data.drafted_response);
      setUpdatedIds((prev) => new Set([...prev, issueId]));
      window.setTimeout(() => setUpdatedIds((prev) => {
        const next = new Set(prev);
        next.delete(issueId);
        return next;
      }), 2000);
      toast.success(`Status updated to "${status}"!`);
      fetchIssues();
    } catch (err) {
      toast.error('Failed to update status.');
    }
  };

  const handleAdvanceStep = async (issueId, stepId, mode = 'current') => {
    try {
      await axios.put(`${API_BASE_URL}/api/admin/issues/${issueId}/timeline-step`, { stepId, mode });
      toast.success(mode === 'completed' ? 'Timeline step completed.' : 'Timeline advanced.');
      fetchIssues();
    } catch (err) {
      toast.error('Failed to update timeline.');
    }
  };

  const handleConfirmResolved = async (issueId) => {
    setStatusUpdate((prev) => ({ ...prev, [issueId]: 'resolved' }));
    try {
      await axios.put(`${API_BASE_URL}/api/admin/issues/${issueId}/status`, {
        status: 'resolved',
        adminNotes: 'Resolution photo confirmed by admin.',
      });
      toast.success('Issue confirmed resolved.');
      fetchIssues();
    } catch (err) {
      toast.error('Failed to confirm resolution.');
    }
  };

  const handleRejectResolution = async (issueId) => {
    setStatusUpdate((prev) => ({ ...prev, [issueId]: 'in-progress' }));
    try {
      await axios.put(`${API_BASE_URL}/api/admin/issues/${issueId}/status`, {
        status: 'in-progress',
        adminNotes: 'Resolution photo rejected. Issue remains open for field work.',
      });
      toast.success('Issue sent back to work in progress.');
      fetchIssues();
    } catch (err) {
      toast.error('Failed to reject resolution.');
    }
  };

  const handleGenerateInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/ai/insights`);
      setInsights(res.data);
      toast.success('Insights generated.');
    } catch (err) {
      console.error('Failed to generate insights', err);
      toast.error('Failed to generate insights.');
    } finally {
      setLoadingInsights(false);
    }
  };

  const handleSendBroadcast = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/admin/broadcast`, { message: broadcastMessage, type: broadcastType, severity: 'low' });
      setBroadcastMessage('');
      toast.success('Broadcast sent successfully!');
      fetchBroadcasts();
    } catch (err) {
      toast.error('Failed to send broadcast.');
    }
  };

  const handlePublishEmergency = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/admin/emergency`, { message: emergencyMessage, severity: emergencySeverity });
      setEmergencyMessage('');
      toast.success('Emergency alert published!');
      fetchBroadcasts();
    } catch (err) {
      toast.error('Failed to publish emergency alert.');
    }
  };

  const stats = useMemo(() => ({
    total: issues.length,
    pending: issues.filter((issue) => issue.status === 'pending').length,
    inProgress: issues.filter((issue) => issue.status === 'in-progress').length,
    verification: issues.filter((issue) => issue.status === 'verification').length,
    resolved: issues.filter((issue) => issue.status === 'resolved').length,
  }), [issues]);

  const totalCount = useCountUp(stats.total);
  const pendingCount = useCountUp(stats.pending);
  const inProgressCount = useCountUp(stats.inProgress);
  const resolvedCount = useCountUp(stats.resolved);

  const issueSeries = [
    { label: 'Pending', value: stats.pending, color: '#94a3b8' },
    { label: 'In progress', value: stats.inProgress, color: '#0ea5e9' },
    { label: 'Verification', value: stats.verification, color: '#f59e0b' },
    { label: 'Resolved', value: stats.resolved, color: '#10b981' },
  ];

  const verificationIssues = issues.filter((issue) => issue.status === 'verification' && issue.resolution_photo_url);

  const sidebarItems = [
    { key: 'issues', label: 'Issues Queue', icon: LayoutDashboard },
    { key: 'insights', label: 'Insights', icon: LineChart },
    { key: 'analytics', label: 'Analytics', icon: LineChart },
    { key: 'broadcast', label: 'Broadcast', icon: Radio },
    { key: 'emergency', label: 'Emergency Alert', icon: AlertOctagon },
  ];

  const welcome = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning, Admin 👋';
    if (hour < 18) return 'Good afternoon, Admin 👋';
    return 'Good evening, Admin 👋';
  })();

  return (
    <div className="min-h-screen bg-[var(--civic-bg)]">
      <Navbar />

      <div className="mx-auto flex max-w-[1600px] gap-0 px-0 lg:px-4">
        <aside className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200/80 bg-white/95 shadow-2xl backdrop-blur lg:sticky lg:top-20 lg:h-[calc(100vh-5rem)] lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} transition-transform duration-300`}>
          <div className="flex items-center justify-between border-b border-slate-200/80 p-5 lg:hidden">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-sky-700">Admin portal</p>
              <p className="text-lg font-black text-slate-900">CivicAI</p>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600">
              <X size={18} />
            </button>
          </div>

          <div className="hidden border-b border-slate-200/80 p-5 lg:block">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-sky-700">Admin portal</p>
            <p className="mt-1 text-2xl font-black text-slate-900">CivicAI</p>
          </div>

          <nav className="p-4">
            <div className="space-y-2">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => { setActiveTab(item.key); setSidebarOpen(false); }}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-all duration-200 ${active ? 'bg-[#1e3a5f] text-white shadow-lg shadow-slate-900/10' : 'text-slate-600 hover:bg-slate-50 hover:text-[#1e3a5f]'}`}
                  >
                    <span className={`h-5 w-1 shrink-0 rounded-full transition-all duration-200 ${active ? 'bg-sky-400' : 'bg-transparent'}`} />
                    <Icon size={18} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="border-t border-slate-200/80 p-4 space-y-3">
            <button onClick={logout} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              <LogOut size={16} /> Logout
            </button>
            <button onClick={() => setSidebarOpen(false)} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1e3a5f] lg:hidden">
              Close menu
            </button>
          </div>
        </aside>

        <div className="min-h-[calc(100vh-5rem)] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between gap-3 lg:hidden">
            <button onClick={() => setSidebarOpen(true)} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
              <Menu size={16} /> Menu
            </button>
            <button onClick={handleRankIssues} className="civic-button inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white">
              <Sparkles size={16} /> Rank issues
            </button>
          </div>

          <div className="mx-auto max-w-7xl space-y-6">
            <section className="card-surface bg-white p-6 sm:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="mb-4 flex items-center gap-2"><span className="h-px w-6 bg-sky-600/60" /><span className="text-[11px] font-bold uppercase tracking-[0.36em] text-sky-700">Operations</span></div>
                  <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">{welcome}</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--civic-text-muted)]">A focused command surface for issue triage, public messaging, and response analytics.</p>
                </div>
                <button onClick={handleRankIssues} className="hidden items-center gap-2 rounded-2xl bg-[#1e3a5f] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-slate-900/10 transition hover:bg-[#0f2842] lg:inline-flex">
                  <Sparkles size={16} /> Get AI Priority Ranking
                </button>
              </div>
            </section>

            {loadingIssues && (
              <div className="card-surface flex items-center gap-3 bg-white p-6 text-slate-500">
                <Loader2 className="loading-spin text-[#0ea5e9]" size={20} /> Loading issues queue...
              </div>
            )}

            <section className="grid gap-4 md:grid-cols-5">
              {[
                { label: 'Total issues', value: totalCount, accent: 'text-[#1e3a5f]', icon: LayoutDashboard, iconBg: 'bg-blue-100', iconClr: 'text-[#1e3a5f]' },
                { label: 'Pending', value: pendingCount, accent: 'text-slate-600', icon: Clock, iconBg: 'bg-slate-100', iconClr: 'text-slate-600' },
                { label: 'In progress', value: inProgressCount, accent: 'text-[#0ea5e9]', icon: Loader2, iconBg: 'bg-sky-100', iconClr: 'text-[#0ea5e9]' },
                { label: 'Verification', value: stats.verification, accent: 'text-amber-600', icon: ThumbsUp, iconBg: 'bg-amber-100', iconClr: 'text-amber-600' },
                { label: 'Resolved', value: resolvedCount, accent: 'text-emerald-600', icon: CheckCircle, iconBg: 'bg-emerald-100', iconClr: 'text-emerald-600' },
              ].map((item) => (
                <div key={item.label} className="card-surface card-surface-hover cursor-default bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${item.iconBg}`}>
                      <item.icon size={16} className={item.iconClr} />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
                  </div>
                  <p className={`mt-3 text-4xl font-black ${item.accent}`}>{item.value.toLocaleString()}</p>
                </div>
              ))}
            </section>

            {activeTab === 'issues' && (
              <section className="space-y-6">
                {verificationIssues.length > 0 && (
                  <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">Resolution review</p>
                        <h2 className="mt-1 text-lg font-black text-amber-950">Citizen submitted resolution photo for {verificationIssues.length} issue{verificationIssues.length === 1 ? '' : 's'}</h2>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-amber-700">{verificationIssues[0].tracking_id}</span>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {verificationIssues.slice(0, 4).map((issue) => (
                        <button key={issue.id} onClick={() => setExpandedIssue(issue.id)} className="flex items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-amber-100 transition hover:ring-amber-300">
                          <img src={issue.resolution_photo_url} alt="Resolution submitted" className="h-14 w-14 rounded-xl object-cover" />
                          <div>
                            <p className="text-sm font-black text-slate-900">Citizen submitted resolution photo for Issue #{issue.tracking_id}</p>
                            <p className="mt-1 text-xs text-slate-500">{issue.title}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="content-card bg-white p-6">
                  <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
                    <div>
                      <h2 className="text-xl font-black text-slate-900">Operational snapshot</h2>
                      <div className="mt-5 space-y-4">
                        {issueSeries.map((item) => (
                          <div key={item.label}>
                            <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-600">
                              <span>{item.label}</span>
                              <span>{item.value}</span>
                            </div>
                            <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: barWidth(item.value, Math.max(...issueSeries.map((series) => series.value), 1)), background: `linear-gradient(90deg, ${item.color}, ${item.color}cc)` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-3xl bg-slate-50 p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Current queue</p>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                          <div className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100">
                            <Clock size={13} className="text-slate-600" />
                          </div>
                          <p className="text-2xl font-black text-slate-900">{stats.pending}</p>
                          <p className="mt-1 text-xs text-slate-500">Pending</p>
                        </div>
                        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                          <div className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100">
                            <Loader2 size={13} className="text-[#0ea5e9]" />
                          </div>
                          <p className="text-2xl font-black text-slate-900">{stats.inProgress}</p>
                          <p className="mt-1 text-xs text-slate-500">In progress</p>
                        </div>
                        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                          <div className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
                            <ThumbsUp size={13} className="text-amber-600" />
                          </div>
                          <p className="text-2xl font-black text-slate-900">{stats.verification}</p>
                          <p className="mt-1 text-xs text-slate-500">Verification</p>
                        </div>
                        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                          <div className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
                            <CheckCircle size={13} className="text-emerald-600" />
                          </div>
                          <p className="text-2xl font-black text-slate-900">{stats.resolved}</p>
                          <p className="mt-1 text-xs text-slate-500">Resolved</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-3xl bg-white shadow-[0_20px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/70">
                  <div className="border-b border-slate-200/80 px-6 py-4">
                    <h2 className="text-xl font-black text-slate-900">Issues queue</h2>
                  </div>

                  <div className="divide-y divide-slate-200/80">
                    {issues.map((issue) => {
                      const isExpanded = expandedIssue === issue.id;
                      const isUpdated = updatedIds.has(issue.id);

                      return (
                        <div key={issue.id} className={`${isUpdated ? 'bg-sky-50/80' : 'bg-white'} transition-colors duration-300`}>
                          <button className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-slate-50" onClick={() => setExpandedIssue(isExpanded ? null : issue.id)}>
                            <div className="flex items-center gap-4">
                              <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
                                {issue.photo_url ? <img className="h-full w-full object-cover" src={issue.photo_url} alt={issue.title} /> : <div className="flex h-full items-center justify-center text-2xl text-slate-300">📷</div>}
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-sm font-black text-slate-900">{issue.title}</h3>
                                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700">{issue.category}</span>
                                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${SEVERITY_STYLES[issue.severity] || SEVERITY_STYLES.low}`}>{issue.severity}</span>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">{issue.tracking_id} • {issue.location_address || 'Unknown'} • {issue.upvotes || 0} upvotes • {(issue.confirm_count || 0)} confirmations</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${STATUS_STYLES[issue.status] || STATUS_STYLES.pending}`}>{issue.status}</span>
                              {isExpanded ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-slate-200/80 px-6 py-6">
                              <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                                <img src={issue.photo_url} alt="Full" className="w-full rounded-3xl object-cover shadow-sm ring-1 ring-slate-200" />
                                <div className="space-y-5">
                                  <div className="rounded-3xl bg-slate-50 p-5">
                                    <h4 className="text-sm font-black text-slate-900">Description</h4>
                                    <p className="mt-2 text-sm leading-7 text-slate-700">{issue.description}</p>
                                  </div>

                                  {issue.ai_analysis && (
                                    <div className="rounded-3xl border border-sky-100 bg-sky-50 p-5">
                                      <h4 className="flex items-center gap-2 text-sm font-black text-sky-900"><AlertTriangle size={16} /> AI analysis</h4>
                                      <div className="mt-3 space-y-2 text-sm text-sky-900/90">
                                        <p><span className="font-semibold">Reasoning:</span> {issue.ai_analysis.severity_reason}</p>
                                        <p><span className="font-semibold">Est. resolution:</span> {issue.ai_analysis.estimated_resolution_days} days</p>
                                      </div>
                                    </div>
                                  )}

                                  {issue.status === 'verification' && issue.resolution_photo_url && (
                                    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                                      <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                          <h4 className="text-sm font-black text-amber-950">Citizen resolution photo pending review</h4>
                                          <p className="mt-1 text-xs font-semibold text-amber-800">Issue #{issue.tracking_id}</p>
                                        </div>
                                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-amber-700">Verification</span>
                                      </div>
                                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                        <div>
                                          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-800">Before</p>
                                          <img src={issue.photo_url} alt="Before" className="h-36 w-full rounded-2xl object-cover ring-1 ring-amber-100" />
                                        </div>
                                        <div>
                                          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-800">After</p>
                                          <img src={issue.resolution_photo_url} alt="After" className="h-36 w-full rounded-2xl object-cover ring-1 ring-amber-100" />
                                        </div>
                                      </div>
                                      {issue.ai_analysis?.resolution_verification && (
                                        <p className="mt-3 rounded-2xl bg-white p-3 text-sm leading-6 text-amber-950">
                                          <span className="font-bold">AI verdict:</span> {issue.ai_analysis.resolution_verification.verdict}
                                        </p>
                                      )}
                                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                                        <button onClick={() => handleConfirmResolved(issue.id)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700">
                                          <CheckCircle size={16} /> Confirm Resolved
                                        </button>
                                        <button onClick={() => handleRejectResolution(issue.id)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-black text-red-700 transition hover:bg-red-50">
                                          <X size={16} /> Reject - Still Open
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                                      <span>Community confirmation</span>
                                      <span>{issue.confirm_count || 0}</span>
                                    </div>
                                    <h4 className="mt-4 border-b border-slate-200 pb-3 text-sm font-black text-slate-900">Admin actions</h4>
                                    <div className="mt-4 space-y-4">
                                      <div>
                                        <label className="mb-1 block text-sm font-semibold text-slate-700">Update status</label>
                                        <select
                                          value={statusUpdate[issue.id] || issue.status}
                                          onChange={(e) => setStatusUpdate({ ...statusUpdate, [issue.id]: e.target.value })}
                                          className="civic-select px-4 py-3 text-sm"
                                        >
                                          <option value="pending">Pending</option>
                                          <option value="in-progress">In Progress</option>
                                          <option value="verification">Verification Pending</option>
                                          <option value="resolved">Resolved</option>
                                        </select>
                                      </div>

                                      <div>
                                        <label className="mb-1 block text-sm font-semibold text-slate-700">Admin notes</label>
                                        <textarea
                                          value={adminNotes[issue.id] || ''}
                                          onChange={(e) => setAdminNotes({ ...adminNotes, [issue.id]: e.target.value })}
                                          rows={3}
                                          className="civic-textarea px-4 py-3 text-sm"
                                          placeholder="Internal note and citizen response draft"
                                        />
                                      </div>

                                      <div className="flex justify-end">
                                        <button onClick={() => handleUpdateStatus(issue.id)} className="civic-button inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white">
                                          <Send size={16} /> Update status
                                        </button>
                                      </div>

                                      {draftedResponse && (
                                        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                                          <p className="font-bold">Drafted response saved</p>
                                          <p className="mt-1"><span className="font-semibold">Subject:</span> {draftedResponse.subject}</p>
                                          <p className="mt-1">{draftedResponse.message}</p>
                                        </div>
                                      )}

                                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                        <h4 className="text-sm font-black text-slate-900">Manual timeline advance</h4>
                                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                          {TIMELINE_STEPS.map((step) => {
                                            const savedStep = (issue.timeline_steps || []).find((item) => Number(item.id) === step.id);
                                            const isDone = savedStep?.state === 'completed';
                                            const isCurrent = savedStep?.state === 'current';

                                            return (
                                              <button
                                                key={step.id}
                                                onClick={() => handleAdvanceStep(issue.id, step.id, step.id === 6 ? 'completed' : 'current')}
                                                className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-left text-xs font-bold transition ${isDone ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : isCurrent ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200'}`}
                                              >
                                                <span>{step.id}. {step.label}</span>
                                                <span>{isDone ? 'Done' : isCurrent ? 'Active' : 'Set'}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'insights' && (
              <section className="space-y-6 max-w-5xl">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="mb-4 flex items-center gap-2"><span className="h-px w-6 bg-sky-600/60" /><span className="text-[11px] font-bold uppercase tracking-[0.36em] text-sky-700">Insights</span></div>
                    <h2 className="mt-2 text-3xl font-black text-slate-900">Community insights</h2>
                  </div>
                  <button onClick={handleGenerateInsights} disabled={loadingInsights} className="civic-button inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white disabled:opacity-70">
                    {loadingInsights ? <Loader2 className="loading-spin" size={16} /> : <LineChart size={16} />} Generate weekly report
                  </button>
                </div>

                {insights ? (
                  <div className="space-y-6">
                    {insights.highlight && (
                      <div className="rounded-3xl bg-gradient-to-r from-[#1e3a5f] to-[#0ea5e9] p-6 text-white shadow-[0_4px_24px_rgba(10,22,40,0.06)] ring-1 ring-white/10">
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-sky-100">Key highlight</p>
                        <p className="mt-2 text-2xl font-black">{insights.highlight}</p>
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="card-surface bg-white p-6"><p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Total reported</p><p className="mt-2 text-4xl font-black text-slate-900">{insights.total_reported}</p></div>
                      <div className="card-surface bg-white p-6"><p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Total resolved</p><p className="mt-2 text-4xl font-black text-emerald-600">{insights.total_resolved}</p></div>
                      <div className="card-surface bg-white p-6"><p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Avg. resolution</p><p className="mt-2 text-4xl font-black text-[#0ea5e9]">{insights.avg_resolution_days} <span className="text-lg text-slate-400">days</span></p></div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                      <div className="content-card bg-white p-6">
                        <h3 className="text-lg font-black text-slate-900">Bar chart</h3>
                        <div className="mt-5 space-y-4">
                          {[
                            { label: 'Reported', value: insights.total_reported, color: '#1e3a5f' },
                            { label: 'Resolved', value: insights.total_resolved, color: '#10b981' },
                            { label: 'Average days', value: insights.avg_resolution_days, color: '#0ea5e9' },
                          ].map((bar) => (
                            <div key={bar.label}>
                              <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-600">
                                <span>{bar.label}</span>
                                <span>{bar.value}</span>
                              </div>
                              <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(10, (bar.value / Math.max(insights.total_reported || 1, 1)) * 100)}%`, backgroundColor: bar.color }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="content-card bg-white p-6">
                        <h3 className="text-lg font-black text-slate-900">Hotspots and predictions</h3>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Hotspots</p>
                            <ul className="mt-3 space-y-2 text-sm text-slate-700">
                              {(insights.hotspot_areas || []).map((area, index) => <li key={index} className="flex items-center gap-2"><MapPin size={14} className="text-red-500" /> {area}</li>)}
                            </ul>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Predictions</p>
                            <ul className="mt-3 space-y-2 text-sm text-slate-700">
                              {(insights.predictions || []).map((prediction, index) => <li key={index} className="flex items-start gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200"><CheckCircle size={14} className="mt-0.5 text-[#0ea5e9]" /> {prediction}</li>)}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="content-card bg-white px-6 py-16 text-center text-slate-400">
                    <LineChart className="mx-auto text-slate-200" size={64} />
                    <p className="mt-4 text-lg font-semibold text-slate-500">Click the button above to generate a weekly insights report.</p>
                  </div>
                )}
              </section>
            )}

            {activeTab === 'broadcast' && (
              <section className="space-y-6 max-w-4xl">
                  <div>
                    <div className="mb-4 flex items-center gap-2"><span className="h-px w-6 bg-sky-600/60" /><span className="text-[11px] font-bold uppercase tracking-[0.36em] text-sky-700">Broadcast</span></div>
                    <h2 className="mt-2 text-3xl font-black text-slate-900">Community broadcast</h2>
                  </div>

                <div className="content-card bg-white p-6 space-y-4">
                  <div className={`floating-label ${broadcastMessage ? 'has-value' : ''}`}>
                    <label>Message</label>
                    <textarea value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} rows={4} className="civic-textarea px-4 py-3" placeholder=" " />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Type</label>
                    <select value={broadcastType} onChange={(e) => setBroadcastType(e.target.value)} className="civic-select px-4 py-3 text-sm">
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                    </select>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={handleSendBroadcast} className="civic-button inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white">
                      <Send size={16} /> Send broadcast
                    </button>
                  </div>
                </div>

                {loadingBroadcasts && (
                  <div className="card-surface flex items-center gap-3 bg-white p-6 text-slate-500">
                    <Loader2 className="loading-spin text-[#0ea5e9]" size={20} /> Loading broadcasts...
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="text-xl font-black text-slate-900">Past broadcasts</h3>
                  <div className="space-y-4">
                    {broadcasts.filter((broadcast) => broadcast.type !== 'emergency').map((broadcast) => (
                      <div key={broadcast.id} className="content-card bg-white p-4">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold uppercase tracking-[0.16em] ${broadcast.type === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>{broadcast.type}</span>
                        <p className="mt-3 text-slate-800">{broadcast.message}</p>
                        <p className="mt-2 text-xs text-slate-400">{new Date(broadcast.created_at).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'emergency' && (
              <section className="space-y-6 max-w-4xl">
                  <div>
                    <div className="mb-4 flex items-center gap-2"><span className="h-px w-6 bg-red-600/60" /><span className="text-[11px] font-bold uppercase tracking-[0.36em] text-red-700">Emergency</span></div>
                    <h2 className="mt-2 text-3xl font-black text-slate-900">Emergency alert</h2>
                  </div>

                <div className="content-card bg-white p-6 space-y-4">
                  <div className={`floating-label ${emergencyMessage ? 'has-value' : ''}`}>
                    <label>Emergency message</label>
                    <textarea value={emergencyMessage} onChange={(e) => setEmergencyMessage(e.target.value)} rows={4} className="civic-textarea px-4 py-3" placeholder=" " />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Severity</label>
                    <select value={emergencySeverity} onChange={(e) => setEmergencySeverity(e.target.value)} className="civic-select px-4 py-3 text-sm capitalize">
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={handlePublishEmergency} className="civic-button inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white">
                      <AlertOctagon size={16} /> Publish emergency alert
                    </button>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'analytics' && (
              <section className="space-y-6 max-w-6xl">
                  <div>
                    <div className="mb-4 flex items-center gap-2"><span className="h-px w-6 bg-sky-600/60" /><span className="text-[11px] font-bold uppercase tracking-[0.36em] text-sky-700">Analytics</span></div>
                    <h2 className="mt-2 text-3xl font-black text-slate-900">Issue analytics</h2>
                  </div>

                {/* Overview cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: 'Total Issues', value: stats.total, color: 'text-[#1e3a5f]', bg: 'bg-blue-50' },
                    { label: 'Resolved', value: stats.resolved, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Pending', value: stats.pending, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'In Progress', value: stats.inProgress, color: 'text-sky-600', bg: 'bg-sky-50' },
                  ].map((card) => (
                    <div key={card.label} className={`card-surface ${card.bg} p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg`}>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{card.label}</p>
                      <p className={`mt-2 text-4xl font-black ${card.color}`}>{card.value}</p>
                    </div>
                  ))}
                </div>

                {/* Category breakdown bar chart */}
                <div className="content-card bg-white p-6">
                  <h3 className="text-lg font-black text-slate-900 mb-6">Issues by category</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={(() => {
                      const cats = {};
                      issues.forEach(i => { cats[i.category] = (cats[i.category] || 0) + 1; });
                      return Object.entries(cats).map(([name, count]) => ({ name, count }));
                    })()}>
                      <defs>
                        <linearGradient id="catBarGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1e3a5f" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.45} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} cursor={{ fill: '#f1f5f9' }} />
                      <Bar dataKey="count" fill="url(#catBarGrad)" radius={[6, 6, 0, 0]} isAnimationActive={true} animationDuration={800} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Status pie chart + Severity breakdown */}
                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="content-card bg-white p-6">
                      <h3 className="text-lg font-black text-slate-900 mb-6">Status distribution</h3>
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Pending', value: stats.pending },
                              { name: 'In Progress', value: stats.inProgress },
                              { name: 'Verification', value: stats.verification },
                              { name: 'Resolved', value: stats.resolved },
                            ]}
                            cx="50%" cy="50%"
                            innerRadius={55}
                            outerRadius={90}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                            isAnimationActive={true}
                            animationDuration={1000}
                            stroke="#fff"
                            strokeWidth={2}
                          >
                            {['#94a3b8', '#0ea5e9', '#f59e0b', '#10b981'].map((color, index) => (
                              <Cell key={index} fill={color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="content-card bg-white p-6">
                      <h3 className="text-lg font-black text-slate-900 mb-6">Severity breakdown</h3>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={(() => {
                          const sevs = { low: 0, medium: 0, high: 0, critical: 0 };
                          issues.forEach(i => { if (sevs[i.severity] !== undefined) sevs[i.severity]++; });
                          return Object.entries(sevs).map(([name, count]) => ({ name, count }));
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} cursor={{ fill: '#f1f5f9' }} />
                          <Bar dataKey="count" radius={[6, 6, 0, 0]} isAnimationActive={true} animationDuration={800}>
                            {['#10b981', '#f59e0b', '#f97316', '#ef4444'].map((color, index) => (
                              <Cell key={index} fill={color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                </div>

                {/* Top locations table */}
                <div className="content-card bg-white p-6">
                  <h3 className="text-lg font-black text-slate-900 mb-4">Top reported locations</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="pb-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Location</th>
                          <th className="pb-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Issues</th>
                          <th className="pb-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Most common</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(() => {
                          const locs = {};
                          issues.forEach(i => {
                            const loc = i.location_address || 'Unknown';
                            if (!locs[loc]) locs[loc] = { count: 0, cats: {} };
                            locs[loc].count++;
                            locs[loc].cats[i.category] = (locs[loc].cats[i.category] || 0) + 1;
                          });
                          return Object.entries(locs)
                            .sort((a, b) => b[1].count - a[1].count)
                            .slice(0, 8)
                            .map(([loc, data]) => (
                              <tr key={loc} className="even:bg-slate-50/60">
                                <td className="py-3 font-semibold text-slate-900">{loc}</td>
                                <td className="py-3 text-right tabular-nums text-slate-600">{data.count}</td>
                                <td className="py-3 text-right">
                                  <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-bold text-sky-700">
                                    {Object.entries(data.cats).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'}
                                  </span>
                                </td>
                              </tr>
                            ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
