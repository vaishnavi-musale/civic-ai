import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import {
  AlertOctagon,
  Megaphone,
  ThumbsUp,
  MapPin,
  Search,
  X,
  Filter,
  CheckCircle,
  Loader2,
  Heart,
  MessageCircle,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import useCountUp from '../hooks/useCountUp';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const MAP_CENTER = [19.0760, 72.8777];
const SEVERITY_COLORS = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#16a34a',
};

const SEVERITY_STYLES = {
  low: 'border-l-emerald-500 bg-emerald-50 text-emerald-700',
  medium: 'border-l-amber-500 bg-amber-50 text-amber-700',
  high: 'border-l-orange-500 bg-orange-50 text-orange-700',
  critical: 'border-l-red-500 bg-red-50 text-red-700 severity-critical',
};

const STATUS_STYLES = {
  pending: 'bg-slate-100 text-slate-600',
  'in-progress': 'bg-sky-100 text-sky-700',
  resolved: 'bg-emerald-100 text-emerald-700',
};

const CATEGORIES = ['all', 'pothole', 'waterlogging', 'streetlight', 'waste', 'encroachment', 'sewage', 'road_damage', 'park', 'other'];
const SEVERITIES = ['all', 'low', 'medium', 'high', 'critical'];
const STATUSES = ['all', 'pending', 'in-progress', 'resolved'];

function LoadingCard() {
  return (
    <div className="card-surface overflow-hidden bg-white">
      <div className="shimmer-card h-44" />
      <div className="space-y-3 p-4">
        <div className="shimmer-card h-3 w-20 rounded-full" />
        <div className="shimmer-card h-5 w-5/6 rounded-full" />
        <div className="shimmer-card h-4 w-full rounded-full" />
        <div className="shimmer-card h-4 w-2/3 rounded-full" />
      </div>
    </div>
  );
}

function HeatmapLayerLeaf({ issues }) {
  const map = useMap();

  useEffect(() => {
    if (!issues.length) return;
    const points = issues.map((issue) => [
      parseFloat(issue.latitude),
      parseFloat(issue.longitude),
      { critical: 1.0, high: 0.8, medium: 0.5, low: 0.3 }[issue.severity] || 0.3,
    ]);
    const heat = L.heatLayer(points, {
      radius: 30,
      blur: 20,
      maxZoom: 17,
      max: 1.0,
      gradient: { 0.4: 'blue', 0.6: 'cyan', 0.7: 'lime', 0.8: 'yellow', 1.0: 'red' },
    });
    heat.addTo(map);
    return () => { heat.remove(); };
  }, [map, issues]);

  return null;
}

function IssueMarker({ issue }) {
  const { id, latitude, longitude, title, category, severity, status, tracking_id } = issue;
  const color = SEVERITY_COLORS[severity] || '#6b7280';
  const radius = severity === 'critical' ? 10 : severity === 'high' ? 8 : severity === 'medium' ? 7 : 6;

  return (
    <CircleMarker
      center={[parseFloat(latitude), parseFloat(longitude)]}
      radius={radius}
      pathOptions={{ color, fillColor: color, fillOpacity: 0.7, weight: 2 }}
    >
      <Popup>
        <div className="text-sm">
          <strong className="text-base">{title}</strong>
          <div className="mt-1 space-y-0.5 text-slate-600">
            <div>Category: <span className="font-semibold capitalize">{category}</span></div>
            <div>Severity: <span className="font-semibold capitalize">{severity}</span></div>
            <div>Status: <span className="font-semibold capitalize">{status}</span></div>
          </div>
          <Link
            to={`/track?id=${tracking_id}`}
            className="mt-2 inline-block text-sm font-semibold text-[#0ea5e9] hover:underline"
          >
            View Issue →
          </Link>
        </div>
      </Popup>
    </CircleMarker>
  );
}

function formatRelativeTime(value) {
  if (!value) return '';
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function CommentsSection({ issueId, currentUser }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [highlightId, setHighlightId] = useState(null);

  useEffect(() => {
    fetchComments();
  }, [issueId]);

  const fetchComments = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/issues/${issueId}/comments`);
      setComments(res.data);
    } catch (err) {
      console.error('Failed to fetch comments', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async () => {
    if (!newComment.trim() || posting) return;
    setPosting(true);
    const tempId = `temp-${Date.now()}`;
    const masked = currentUser?.email?.includes('@')
      ? `${currentUser.email.slice(0, 2)}***@${currentUser.email.split('@')[1]}`
      : 'Anonymous';
    const optimistic = {
      id: tempId,
      comment_text: newComment.trim(),
      created_at: new Date().toISOString(),
      masked_email: masked,
    };
    setComments((prev) => [...prev, optimistic]);
    setNewComment('');
    setHighlightId(tempId);
    setTimeout(() => setHighlightId(null), 2000);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/issues/${issueId}/comments`, {
        user_id: currentUser?.id || null,
        user_email: currentUser?.email || 'Anonymous',
        comment_text: optimistic.comment_text,
      });
      setComments((prev) => prev.map((c) => (c.id === tempId ? { ...res.data, masked_email: masked } : c)));
    } catch (err) {
      toast.error('Failed to post comment');
      setComments((prev) => prev.filter((c) => c.id !== tempId));
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="mt-3 border-t border-slate-200/80 pt-3">
      <div className="mb-3 flex items-center gap-2">
        <MessageCircle size={14} className="text-slate-400" />
        <span className="text-xs font-bold text-slate-500">Comments ({comments.length})</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 size={12} className="loading-spin text-slate-400" />
          <span className="text-xs text-slate-400">Loading comments...</span>
        </div>
      ) : comments.length === 0 ? (
        <p className="py-2 text-xs italic text-slate-400">No comments yet. Be the first to share your thoughts.</p>
      ) : (
        <div className="mb-3 max-h-48 space-y-2 overflow-y-auto">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className={`rounded-xl border-l-2 bg-white px-3 py-2 text-xs transition ${highlightId === comment.id ? 'border-l-[#0ea5e9] bg-sky-50 shadow-sm' : 'border-l-slate-200'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-600">{comment.masked_email}</span>
                <span className="text-[10px] text-slate-400">{formatRelativeTime(comment.created_at)}</span>
              </div>
              <p className="mt-1 text-slate-700">{comment.comment_text}</p>
            </div>
          ))}
        </div>
      )}

      {currentUser ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePost()}
            placeholder="Add a comment..."
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none transition focus:border-[#0ea5e9]"
          />
          <button
            onClick={handlePost}
            disabled={!newComment.trim() || posting}
            className="rounded-xl bg-[#0ea5e9] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#0284c7] disabled:opacity-50"
          >
            {posting ? <Loader2 size={12} className="loading-spin" /> : 'Post'}
          </button>
        </div>
      ) : (
        <Link to="/login" className="inline-block text-xs font-semibold text-[#0ea5e9] hover:underline">
          Login to comment
        </Link>
      )}
    </div>
  );
}

export default function Community() {
  const { currentUser } = useAuth();
  const [issues, setIssues] = useState([]);
  const [stats, setStats] = useState(null);
  const [broadcasts, setBroadcasts] = useState([]);
  const [dismissedEmergency, setDismissedEmergency] = useState(false);
  const [upvotedIds, setUpvotedIds] = useState(new Set());
  const [pulseIds, setPulseIds] = useState(new Set());
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loadingIssues, setLoadingIssues] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(true);
  const [heatmapMode, setHeatmapMode] = useState(false);

  useEffect(() => {
    fetchIssues();
    fetchStats();
    fetchBroadcasts();
  }, []);

  const fetchIssues = async () => {
    setLoadingIssues(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/issues`);
      setIssues(res.data);
    } catch (err) {
      console.error('Failed to fetch issues', err);
      toast.error('Failed to load community issues.');
    } finally {
      setLoadingIssues(false);
    }
  };

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/issues/stats`);
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats', err);
      toast.error('Failed to load live stats.');
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchBroadcasts = async () => {
    setLoadingBroadcasts(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/broadcasts`);
      setBroadcasts(res.data);
    } catch (err) {
      console.error('Failed to fetch broadcasts', err);
      toast.error('Failed to load broadcast updates.');
    } finally {
      setLoadingBroadcasts(false);
    }
  };

  const handleFeedback = async (id, type) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/issues/${id}/${type}`, {
        user_id: currentUser?.id || null,
      });
      setIssues((prev) => prev.map((issue) => (issue.id === id ? {
        ...issue,
        ...(type === 'confirm' ? { confirm_count: res.data.confirm_count } : { deny_count: res.data.deny_count }),
      } : issue)));
      toast.success(type === 'confirm' ? 'Confirmed. Thanks for helping.' : 'Marked as not an issue.');
    } catch (err) {
      toast.error('Unable to record your feedback right now.');
    }
  };

  const handleUpvote = async (id) => {
    if (upvotedIds.has(id)) {
      toast.error('You already upvoted this issue!');
      return;
    }

    setPulseIds((prev) => new Set(prev).add(id));
    window.setTimeout(() => setPulseIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    }), 900);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/issues/${id}/upvote`);
      setIssues((prev) => prev.map((issue) => (issue.id === id ? { ...issue, upvotes: res.data.upvotes } : issue)));
      setUpvotedIds((prev) => new Set([...prev, id]));
      toast.success('Upvote added!');
    } catch (err) {
      toast.error('Failed to upvote. Please try again.');
    }
  };

  const activeEmergency = broadcasts.find((broadcast) => broadcast.type === 'emergency' && broadcast.is_active);
  const activeInfoBroadcasts = broadcasts.filter((broadcast) => broadcast.type !== 'emergency' && broadcast.is_active);

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (categoryFilter !== 'all' && issue.category !== categoryFilter) return false;
      if (severityFilter !== 'all' && issue.severity !== severityFilter) return false;
      if (statusFilter !== 'all' && issue.status !== statusFilter) return false;
      if (search) {
        const query = search.toLowerCase();
        return (
          issue.title?.toLowerCase().includes(query) ||
          issue.location_address?.toLowerCase().includes(query) ||
          issue.category?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [issues, categoryFilter, severityFilter, statusFilter, search]);

  const geoIssues = issues.filter((issue) => issue.latitude && issue.longitude).slice(0, 6);
  const heatmapIssues = useMemo(() => issues.filter((issue) => issue.latitude && issue.longitude), [issues]);
  const totalCount = useCountUp(stats?.total || 0);
  const resolvedCount = useCountUp(stats?.resolved_total || 0);
  const avgResolution = useCountUp(stats?.avg_resolution_days || 0);


  return (
    <div className="min-h-screen bg-[var(--civic-bg)]">
      {activeEmergency && !dismissedEmergency && (
        <div className="sticky top-0 z-50 bg-red-600 px-4 py-3 text-white shadow-lg">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm font-semibold">
              <AlertOctagon size={18} className="flex-shrink-0" />
              <span>EMERGENCY ALERT:</span>
              <span className="font-normal">{activeEmergency.message}</span>
            </div>
            <button onClick={() => setDismissedEmergency(true)} className="rounded-full p-1 transition hover:bg-white/15" aria-label="Dismiss alert">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      <Navbar />

      {loadingBroadcasts ? (
        <div className="bg-[#1e3a5f] px-6 py-2 text-sm text-white">
          <div className="mx-auto flex max-w-7xl items-center gap-2">
            <Loader2 size={16} className="loading-spin" />
            Loading city updates...
          </div>
        </div>
      ) : activeInfoBroadcasts.map((broadcast) => (
        <div key={broadcast.id} className="bg-[#1e3a5f] px-6 py-2 text-sm text-white">
          <div className="mx-auto flex max-w-7xl items-center gap-2">
            <Megaphone size={16} className="flex-shrink-0" />
            <span>{broadcast.message}</span>
          </div>
        </div>
      ))}

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-4 md:grid-cols-3">
          {loadingStats ? (
            <>
              <div className="shimmer-card h-28 rounded-2xl" />
              <div className="shimmer-card h-28 rounded-2xl" />
              <div className="shimmer-card h-28 rounded-2xl" />
            </>
          ) : (
            <>
              <div className="content-card bg-white p-6 text-center">
                <p className="text-4xl font-black text-[#1e3a5f]">{totalCount.toLocaleString()}</p>
                <p className="mt-2 text-sm font-medium text-[var(--civic-text-muted)]">Total issues reported</p>
              </div>
              <div className="content-card bg-white p-6 text-center">
                <p className="text-4xl font-black text-emerald-600">{resolvedCount.toLocaleString()}</p>
                <p className="mt-2 text-sm font-medium text-[var(--civic-text-muted)]">Resolved</p>
              </div>
              <div className="content-card bg-white p-6 text-center">
                <p className="text-4xl font-black text-[#0ea5e9]">{avgResolution}</p>
                <p className="mt-2 text-sm font-medium text-[var(--civic-text-muted)]">Avg. resolution days</p>
              </div>
            </>
          )}
        </section>

        <section className="card-surface overflow-hidden bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 p-4 sm:p-5">
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="h-px w-6 bg-sky-600/60" />
                <span className="text-[11px] font-bold uppercase tracking-[0.36em] text-sky-700">Map view</span>
              </div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">Issue locations</h2>
                <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-700">{issues.length} active</span>
              </div>
            </div>
            <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-xs font-semibold">
              <button type="button" onClick={() => setHeatmapMode(false)} className={`px-3 py-1.5 transition ${!heatmapMode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <MapPin size={14} className="mr-1 inline-block" />Pins
              </button>
              <button type="button" onClick={() => setHeatmapMode(true)} className={`px-3 py-1.5 transition ${heatmapMode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <span className="mr-1 inline-block">🔥</span>Heatmap
              </button>
            </div>
          </div>
          <div className="relative h-[320px] overflow-hidden rounded-none">
            <MapContainer
              center={MAP_CENTER}
              zoom={11}
              className="h-full w-full"
              zoomControl={true}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {heatmapMode ? (
                <HeatmapLayerLeaf issues={heatmapIssues} />
              ) : (
                geoIssues.map((issue) => (
                  <IssueMarker key={issue.id} issue={issue} />
                ))
              )}
            </MapContainer>
          </div>
          {heatmapMode && (
            <div className="flex items-center justify-center gap-4 border-t border-slate-200/80 px-4 py-2 text-xs text-slate-500">
              <span><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" /> High density</span>
              <span><span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-400" /> Medium</span>
              <span><span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-300" /> Low</span>
            </div>
          )}
          {!heatmapMode && geoIssues.length > 0 && (
            <div className="grid gap-2 border-t border-slate-200/80 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {geoIssues.map((issue) => (
                <a
                  key={issue.id}
                  href={`https://www.openstreetmap.org/?mlat=${issue.latitude}&mlon=${issue.longitude}#map=15/${issue.latitude}/${issue.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                >
                  <MapPin size={12} className="mr-1 inline-block" />
                  <span className="truncate">{issue.location_address || 'View on Maps'}</span>
                </a>
              ))}
            </div>
          )}
        </section>

        {activeInfoBroadcasts.length > 0 && (
          <div className="card-surface border-l-4 border-l-[#0ea5e9] bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <Megaphone className="mt-0.5 text-[#0ea5e9]" size={20} />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-sky-700">Admin broadcast</p>
                <p className="mt-1 text-sm text-slate-700">{activeInfoBroadcasts[0].message}</p>
              </div>
            </div>
          </div>
        )}

        <section className="sticky-filter content-card bg-white p-4">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))]">
            <div className="input-glow flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <Search size={16} className="text-slate-400" />
              <input type="text" placeholder="Search issues..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full border-0 bg-transparent text-sm outline-none" />
            </div>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="civic-select px-3 py-3 text-sm capitalize">
              {CATEGORIES.map((item) => <option key={item} value={item}>{item === 'all' ? 'All categories' : item}</option>)}
            </select>
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="civic-select px-3 py-3 text-sm capitalize">
              {SEVERITIES.map((item) => <option key={item} value={item}>{item === 'all' ? 'All severities' : item}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="civic-select px-3 py-3 text-sm capitalize">
              {STATUSES.map((item) => <option key={item} value={item}>{item === 'all' ? 'All statuses' : item}</option>)}
            </select>
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <Filter size={12} /> Showing {filteredIssues.length} of {issues.length} issues
          </p>
        </section>

        {loadingIssues ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((item) => <LoadingCard key={item} />)}
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="content-card bg-white px-6 py-16 text-center text-slate-400">
            <CheckCircle className="mx-auto text-slate-200" size={64} />
            <p className="mt-4 text-lg font-semibold text-slate-500">No issues found</p>
            <p className="mt-1 text-sm">Try adjusting your filters or be the first to report.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {filteredIssues.map((issue, index) => {
              const isUpvoted = upvotedIds.has(issue.id);
              const isPulsing = pulseIds.has(issue.id);
              const pScore = issue.ai_analysis?.priority_score ?? null;

              const scoreColor = pScore >= 80 ? 'border-emerald-400 text-emerald-600' :
                pScore >= 60 ? 'border-sky-400 text-sky-600' :
                pScore >= 40 ? 'border-amber-400 text-amber-600' :
                'border-slate-300 text-slate-400';

              const severityOverlay = issue.severity === 'critical' ? 'bg-red-600/80 text-white' :
                issue.severity === 'high' ? 'bg-orange-500/80 text-white' :
                issue.severity === 'medium' ? 'bg-amber-500/80 text-white' :
                'bg-emerald-500/80 text-white';

              return (
                <article
                  key={issue.id}
                  className={`overflow-hidden rounded-[1.5rem] bg-white border border-slate-200 shadow-[0_4px_24px_rgba(10,22,40,0.06)] transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_20px_40px_rgba(10,22,40,0.12)] ${issue.severity === 'critical' ? 'border-l-[5px] border-l-red-500' : issue.severity === 'high' ? 'border-l-[5px] border-l-orange-500' : issue.severity === 'medium' ? 'border-l-[5px] border-l-amber-500' : 'border-l-[5px] border-l-emerald-500'}`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="relative h-52 overflow-hidden bg-slate-100 sm:h-56">
                    {issue.photo_url ? (
                      <img src={issue.photo_url} alt={issue.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-4xl text-slate-300">📷</div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold capitalize text-slate-800 shadow-sm backdrop-blur-sm">
                      {issue.category || 'uncategorized'}
                    </span>
                    <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold capitalize shadow-sm backdrop-blur-sm ${severityOverlay}`}>
                      {issue.severity || 'unknown'}
                    </span>
                  </div>

                  <div className="p-5">
                    <h3 className="line-clamp-2 text-xl font-black leading-snug text-slate-900">{issue.title || 'Untitled issue'}</h3>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-400">
                        <MapPin size={12} className="flex-shrink-0" />
                        <span className="truncate">{issue.location_address || 'Location not specified'}</span>
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-400">{formatRelativeTime(issue.created_at)}</span>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      {pScore !== null && (
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-black ${scoreColor}`}>
                          {pScore}
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${STATUS_STYLES[issue.status] || 'bg-slate-100 text-slate-600'}`}>
                        {issue.status === 'in-progress' && <span className="h-1.5 w-1.5 rounded-full bg-current loading-spin" />}
                        {issue.status === 'resolved' && <CheckCircle size={10} />}
                        {issue.status || 'unknown'}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleFeedback(issue.id, 'confirm')}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          ✓ Confirm
                        </button>
                        <button
                          onClick={() => handleFeedback(issue.id, 'deny')}
                          className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
                        >
                          ✗ Not issue
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleUpvote(issue.id)}
                          disabled={isUpvoted}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition ${isUpvoted ? 'cursor-default bg-sky-100 text-[#1e3a5f]' : 'bg-slate-50 text-slate-500 hover:bg-sky-50 hover:text-[#1e3a5f]'}`}
                        >
                          <Heart size={12} className={isPulsing ? 'loading-spin' : ''} />
                          {issue.upvotes || 0}
                        </button>
                        <Link to={`/track?id=${issue.tracking_id}`} className="rounded-full bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-sky-50 hover:text-[#1e3a5f]">
                          Track →
                        </Link>
                      </div>
                    </div>

                    {(issue.confirm_count || 0) > 0 && (
                      <p className="mt-2 text-[11px] text-slate-400">{(issue.confirm_count || 0)} citizens confirmed this</p>
                    )}

                    <CommentsSection issueId={issue.id} currentUser={currentUser} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}