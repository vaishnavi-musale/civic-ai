import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import toast from 'react-hot-toast';
import {
  Search,
  MapPin,
  Calendar,
  User,
  Shield,
  Download,
  CheckCircle,
  Check,
  Clock,
  AlertTriangle,
  Loader2,
  UploadCloud,
  ArrowLeft,
  Sparkles,
  Share2,
  Globe,
  MessageSquare,
} from 'lucide-react';
import Navbar from '../components/Navbar';

const SEVERITY_COLORS = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-red-50 text-red-700 border-red-200 severity-critical',
};

const TIMELINE_STEPS = [
  { id: 1, label: 'Issue Reported', icon: '📋', description: 'Your complaint has been received' },
  { id: 2, label: 'Assigned to Officer', icon: '👨‍💼', description: 'Issue assigned to municipal officer' },
  { id: 3, label: 'Worker Dispatched', icon: '🚛', description: 'Field team on the way' },
  { id: 4, label: 'Work in Progress', icon: '🔧', description: 'Repair/cleanup underway' },
  { id: 5, label: 'Verification Pending', icon: '🔍', description: 'Awaiting citizen verification' },
  { id: 6, label: 'Completed', icon: '✅', description: 'Issue resolved and verified' },
];

const maskEmail = (email) => {
  if (!email) return 'Anonymous';
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}***@${domain}`;
};

function getTimelineIndex(status) {
  if (status === 'resolved') return 5;
  if (status === 'verification') return 4;
  if (status === 'in-progress') return 3;
  if (status === 'pending') return 0;
  return 0;
}

function ConfettiCard() {
  return (
    <div className="confetti-burst pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {Array.from({ length: 34 }).map((_, index) => (
        <span
          key={index}
          className="confetti-piece"
          style={{
            left: `${(index * 29) % 100}%`,
            animationDelay: `${(index % 9) * 120}ms`,
            backgroundColor: ['#10b981', '#0ea5e9', '#f59e0b', '#ef4444'][index % 4],
          }}
        />
      ))}
    </div>
  );
}

function formatRelativeTime(value) {
  if (!value) return 'just now';
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function buildTimeline(issue) {
  if (Array.isArray(issue?.timeline_steps) && issue.timeline_steps.length) {
    return issue.timeline_steps;
  }

  const currentIndex = getTimelineIndex(issue?.status);
  return TIMELINE_STEPS.map((step, index) => ({
    ...step,
    state: issue?.status === 'resolved' || index < currentIndex ? 'completed' : index === currentIndex ? 'current' : 'pending',
    completed_at: issue?.status === 'resolved' || index < currentIndex ? issue?.updated_at || issue?.created_at : null,
    started_at: index === currentIndex ? issue?.updated_at || issue?.created_at : null,
  }));
}

function ProgressTimeline({ issue }) {
  const steps = buildTimeline(issue);
  const lastUpdated = steps
    .map((step) => step.updated_at || step.started_at || step.completed_at)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0] || issue.updated_at || issue.created_at;

  const completedCount = steps.filter((s) => s.state === 'completed').length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);
  const [progressWidth, setProgressWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setProgressWidth(progressPercent), 120);
    return () => clearTimeout(timer);
  }, [progressPercent]);

  const stepContexts = {
    1: { officer: 'Citizen Report', comment: 'Issue logged and queued for review', photo: issue.photo_url },
    2: { officer: 'Zone 3 Officer', comment: issue.admin_message || 'Officer assigned for initial assessment' },
    3: { officer: 'Field Team Alpha', comment: 'Worker dispatched to the reported location' },
    4: { officer: 'Maintenance Crew', comment: 'Repair and cleanup work is underway' },
    5: { officer: 'Quality Inspector', comment: 'Awaiting citizen verification submission' },
    6: { officer: 'Admin Team', comment: 'Issue resolved and verified', photo: issue.resolution_photo_url },
  };

  return (
    <div className="content-card bg-white p-6 sm:p-8">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-4 flex items-center gap-2"><span className="h-px w-6 bg-sky-600/60" /><span className="text-[11px] font-bold uppercase tracking-[0.36em] text-sky-700">Live progress</span></div>
          <h3 className="mt-2 text-xl font-black text-slate-900">Every handoff, clearly tracked.</h3>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-white">
          <span className="h-2 w-2 rounded-full bg-emerald-400 pulse-dot" /> Live
        </div>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-slate-700">Progress</span>
          <span className="font-bold text-[#0ea5e9]">{progressPercent}%</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#0ea5e9] to-[#1e3a5f] transition-all duration-700 ease-out"
            style={{ width: `${progressWidth}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-slate-400">{completedCount} of {steps.length} steps complete</p>
      </div>

      <div className="space-y-0">
        {steps.map((step, index) => {
          const done = step.state === 'completed';
          const current = step.state === 'current';
          const pending = step.state === 'pending';
          const timestamp = step.completed_at || step.started_at || step.updated_at;
          const ctx = stepContexts[step.id] || {};

          return (
            <div key={step.id} className="timeline-step-enter grid grid-cols-[3rem_1fr] gap-4" style={{ animationDelay: `${index * 150}ms` }}>
              <div className="relative flex justify-center">
                {index < steps.length - 1 && (
                  <div className={`absolute top-12 h-[calc(100%-0.25rem)] w-0.5 ${done ? 'bg-emerald-400' : pending ? 'border-l-2 border-dashed border-slate-200 bg-transparent' : 'bg-sky-300'}`} />
                )}
                <div className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-sm transition-all duration-500 ${done ? 'border-emerald-500 bg-emerald-500 text-white' : current ? 'scale-110 border-sky-500 bg-white text-sky-600 shadow-sky-200 timeline-current-pulse' : 'border-slate-200 bg-white text-slate-400'}`}>
                  {done ? <Check size={20} strokeWidth={3} className="checkmark-draw" /> : <span className={pending ? 'opacity-40' : ''}>{step.icon}</span>}
                </div>
              </div>

              <div className={`pb-8 ${index === steps.length - 1 ? 'pb-1' : ''}`}>
                <div className={`rounded-2xl border p-4 transition ${done ? 'border-emerald-100 bg-emerald-50/70' : current ? 'border-sky-200 bg-sky-50 shadow-[0_14px_35px_rgba(14,165,233,0.14)]' : 'border-slate-200 bg-white/60'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className={`font-black ${done ? 'text-emerald-700' : current ? 'text-sky-700' : 'text-slate-500'}`}>{step.label}</p>
                      <p className={`mt-1 text-sm ${pending ? 'text-slate-400' : 'text-slate-600'}`}>{step.description}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${done ? 'bg-emerald-100 text-emerald-700' : current ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-400'}`}>
                      {done ? 'Done' : current ? 'Now' : 'Next'}
                    </span>
                  </div>

                  {!pending && (
                    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                      {ctx.officer && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <User size={12} className="flex-shrink-0 text-slate-400" />
                          <span className="font-medium">{ctx.officer}</span>
                        </div>
                      )}
                      {ctx.photo && (
                        <div className="flex items-center gap-2">
                          <img src={ctx.photo} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
                          <span className="text-xs text-slate-500">{step.id === 1 ? 'Report photo' : 'Resolution photo'}</span>
                        </div>
                      )}
                      {ctx.comment && (
                        <div className="flex items-start gap-2 text-xs text-slate-500">
                          <div className="mt-0.5 flex-shrink-0 rounded bg-slate-100 p-0.5">
                            <MessageSquare size={12} className="text-slate-400" />
                          </div>
                          <span className="italic">{ctx.comment}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {timestamp && (
                    <p className="mt-3 text-xs font-semibold text-slate-400">
                      {new Date(timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-5 border-t border-slate-100 pt-4 text-sm font-semibold text-slate-500">Last updated {formatRelativeTime(lastUpdated)}</p>
    </div>
  );
}

export default function TrackIssue() {
  const [searchParams] = useSearchParams();
  const [trackingId, setTrackingId] = useState(searchParams.get('id') || '');
  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newPhoto, setNewPhoto] = useState(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [comparePosition, setComparePosition] = useState(50);
  const [showOriginal, setShowOriginal] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      setTrackingId(id);
      fetchIssue(id);
    }
  }, []);

  const fetchIssue = async (id = trackingId) => {
    if (!id.trim()) {
      setError('Please enter a tracking ID');
      return;
    }

    setLoading(true);
    setError('');
    setIssue(null);
    setVerifyResult(null);

    try {
      const res = await axios.get(`${API_BASE_URL}/api/issues/${id.trim().toUpperCase()}`);
      setIssue(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('No issue found with that Tracking ID. Please double-check and try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
      toast.error('Unable to load issue details.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setNewPhoto(file);
    setNewPhotoPreview(URL.createObjectURL(file));
    setVerifyResult(null);
  };

  const handleVerifyResolution = async () => {
    if (!newPhoto || !issue) return;
    setVerifying(true);
    setVerifyResult(null);

    try {
      const formData = new FormData();
      formData.append('photo', newPhoto);
      const res = await axios.post(`${API_BASE_URL}/api/issues/${issue.tracking_id}/verify-resolved`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setVerifyResult(res.data);

      if (res.data.recommendation === 'mark_resolved') {
        const refreshed = await axios.get(`${API_BASE_URL}/api/issues/${issue.tracking_id}`);
        setIssue(refreshed.data);
        toast.success('Resolution photo sent for admin confirmation.');
      } else {
        toast.success('Verification completed.');
      }
    } catch (err) {
      console.error(err);
      setVerifyResult({ error: 'Verification failed. Please try again.' });
      toast.error('Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!issue) return;
    window.open(`${API_BASE_URL}/api/issues/${issue.tracking_id}/pdf`, '_blank');
  };

  const handleShareResolution = async () => {
    const shareUrl = `${window.location.origin}/track?id=${issue.tracking_id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Resolution link copied.');
    } catch (err) {
      toast.error('Could not copy link.');
    }
  };

  const resolutionVerdict = issue?.ai_analysis?.resolution_verification;
  const showResolvedGallery = issue?.status === 'resolved' && issue?.photo_url && issue?.resolution_photo_url;

  return (
    <div className="min-h-screen bg-[var(--civic-bg)]">
      <Navbar />

      <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="content-card bg-white p-6 sm:p-8">
          <div className="mb-4 flex items-center gap-2"><span className="h-px w-6 bg-sky-600/60" /><span className="text-[11px] font-bold uppercase tracking-[0.36em] text-sky-700">Track issue</span></div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Track your issue in a living timeline.</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--civic-text-muted)]">Search a tracking ID to see the current status, updates, and verification history in one place.</p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <div className="input-glow flex flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <Search className="text-slate-400" size={20} />
              <input
                type="text"
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && fetchIssue()}
                placeholder="e.g. CIVIC-AB12CD"
                className="w-full border-0 bg-transparent py-1 text-lg font-mono text-slate-800 outline-none placeholder:font-sans placeholder:text-base placeholder:text-slate-300"
              />
            </div>
            <button
              onClick={() => fetchIssue()}
              disabled={loading}
              className="civic-button inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white disabled:opacity-70"
            >
              {loading ? <Loader2 size={18} className="loading-spin" /> : 'Search'}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={16} className="mr-2 inline-block align-text-bottom" />
              {error}
            </div>
          )}
        </div>

        {issue && (
          <div className="space-y-6">
            <div className="content-card overflow-hidden bg-white">
              {issue.photo_url && <img src={issue.photo_url} alt={issue.title} className="h-72 w-full object-cover" />}
              <div className="space-y-3 p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold capitalize text-sky-700">{issue.category}</span>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold capitalize ${SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.low}`}>{issue.severity} severity</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900">{issue.title}</h2>
                <p className="text-sm leading-relaxed text-slate-600">{issue.description}</p>
                {issue.original_description && (
                  <div className="mt-3">
                    <button
                      onClick={() => setShowOriginal(!showOriginal)}
                      className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 ring-1 ring-sky-200 transition hover:bg-sky-100"
                    >
                      <Globe size={14} />
                      {showOriginal ? 'View in English' : 'View in original language'} ({issue.reported_language || 'original'})
                    </button>
                    {showOriginal && (
                      <div className="mt-2 rounded-2xl bg-sky-50 p-4 text-sm leading-7 text-slate-700 ring-1 ring-sky-100">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-500 mb-1">Original ({issue.reported_language})</p>
                        {issue.original_description}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:flex-wrap">
                  <span className="flex items-center"><MapPin size={14} className="mr-1.5 text-slate-400" />{issue.location_address || 'Location not specified'}</span>
                  <span className="flex items-center"><Calendar size={14} className="mr-1.5 text-slate-400" />{new Date(issue.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  <span className="flex items-center"><User size={14} className="mr-1.5 text-slate-400" />{maskEmail(issue.user_email)}</span>
                </div>
              </div>
            </div>

            <ProgressTimeline issue={issue} />

            {issue.ai_analysis && (
              <div className="content-card bg-white p-6 sm:p-8">
                <div className="mb-5">
                  <div className="mb-4 flex items-center gap-2"><span className="h-px w-6 bg-sky-600/60" /><span className="text-[11px] font-bold uppercase tracking-[0.36em] text-sky-700">AI analysis</span></div>
                  <h3 className="mt-1 text-xl font-black text-slate-900">Groq insights on the reported issue.</h3>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Category</p>
                    <p className="mt-2 font-bold text-slate-900 capitalize">{issue.ai_analysis.category}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Severity</p>
                    <p className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-bold capitalize ${SEVERITY_COLORS[issue.ai_analysis.severity] || SEVERITY_COLORS.low}`}>{issue.ai_analysis.severity}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Severity reasoning</p>
                    <p className="mt-2 text-sm leading-7 text-slate-700">{issue.ai_analysis.severity_reason}</p>
                  </div>
                  {issue.ai_analysis.estimated_resolution_days && (
                    <div className="md:col-span-2 flex items-center gap-3 rounded-2xl bg-sky-50 p-4">
                      <Clock className="text-[#0ea5e9]" size={20} />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Estimated resolution</p>
                        <p className="font-bold text-[#1e3a5f]">{issue.ai_analysis.estimated_resolution_days} days</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {issue.admin_message && (
              <div className="content-card bg-white p-6 sm:p-8">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1e3a5f] font-bold text-white">A</div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900">Message from admin</p>
                    <p className="mt-2 rounded-2xl border-l-4 border-[#0ea5e9] bg-sky-50 p-4 text-sm leading-7 text-slate-700">{issue.admin_message}</p>
                  </div>
                </div>
              </div>
            )}

            {showResolvedGallery && (
              <div className="content-card overflow-hidden bg-white">
                <div className="p-6 sm:p-8">
                  <div className="mb-4 flex items-center gap-2"><span className="h-px w-6 bg-emerald-600/60" /><span className="text-[11px] font-bold uppercase tracking-[0.36em] text-emerald-700">Before / After</span></div>
                  <h3 className="mt-2 text-2xl font-black text-slate-900">Verified resolution gallery.</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-500">Drag the handle to compare the original report with the confirmed repair photo.</p>
                </div>

                <div className="px-6 pb-6 sm:px-8 sm:pb-8">
                  <div className="before-after-slider relative aspect-[16/10] overflow-hidden rounded-3xl bg-slate-100 shadow-inner ring-1 ring-slate-200">
                    <img src={issue.photo_url} alt="Before resolution" className="absolute inset-0 h-full w-full object-cover" />
                    <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 0 0 ${comparePosition}%)` }}>
                      <img src={issue.resolution_photo_url} alt="After resolution" className="h-full w-full object-cover" />
                    </div>
                    <span className="absolute left-4 top-4 rounded-full bg-red-500 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white shadow-lg">Before</span>
                    <span className="absolute right-4 top-4 rounded-full bg-emerald-500 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white shadow-lg">After</span>
                    <div className="absolute inset-y-0 z-10 w-1 bg-white shadow-[0_0_0_999px_rgba(0,0,0,0)]" style={{ left: `${comparePosition}%` }}>
                      <div className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-700 shadow-xl ring-1 ring-slate-200">↔</div>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="95"
                      value={comparePosition}
                      onChange={(event) => setComparePosition(Number(event.target.value))}
                      aria-label="Compare before and after photos"
                      className="before-after-range absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0"
                    />
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-black text-emerald-900">AI verdict</p>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-700">{resolutionVerdict?.confidence || 0}% confidence</span>
                      </div>
                      <p className="mt-2 text-sm leading-7 text-emerald-900/80">{resolutionVerdict?.verdict || 'Resolution confirmed by admin.'}</p>
                      {resolutionVerdict?.what_changed && <p className="mt-2 text-sm font-semibold text-emerald-900">What changed: {resolutionVerdict.what_changed}</p>}
                    </div>
                    <button onClick={handleShareResolution} className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-emerald-500 bg-white px-5 py-3 text-sm font-black text-emerald-700 transition hover:bg-emerald-50">
                      <Share2 size={16} /> Share this resolution
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(issue.status === 'in-progress' || issue.status === 'verification') && (
              <div className="content-card bg-white p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-[#0ea5e9]">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">{issue.status === 'verification' ? 'Resolution under admin review' : 'Has this been fixed?'}</h3>
                    <p className="mt-1 text-sm text-slate-500">{issue.status === 'verification' ? 'Your photo passed AI verification. An admin will confirm the final closure.' : 'Upload a new photo and the AI will compare it against the original.'}</p>
                  </div>
                </div>

                {issue.status === 'verification' && issue.resolution_photo_url ? (
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <img src={issue.photo_url} alt="Original" className="h-44 w-full rounded-2xl object-cover ring-1 ring-slate-200" />
                    <img src={issue.resolution_photo_url} alt="Resolution submitted" className="h-44 w-full rounded-2xl object-cover ring-1 ring-emerald-200" />
                  </div>
                ) : null}

                {issue.status !== 'verification' && !newPhoto ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-6 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-10 text-center transition hover:border-[#0ea5e9] hover:bg-sky-50/50"
                  >
                    <UploadCloud className="mx-auto text-slate-300" size={42} />
                    <p className="mt-4 text-sm font-semibold text-slate-700">Click to upload new photo</p>
                    <p className="mt-1 text-xs text-slate-400">JPG, PNG - taken at the same location</p>
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoSelect} className="hidden" />
                  </div>
                ) : issue.status !== 'verification' ? (
                  <div className="mt-6 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Original photo</p>
                        <img src={issue.photo_url} alt="Original" className="h-44 w-full rounded-2xl object-cover ring-1 ring-slate-200" />
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">New photo</p>
                        <div className="relative">
                          <img src={newPhotoPreview} alt="New" className="h-44 w-full rounded-2xl object-cover ring-1 ring-slate-200" />
                          <button onClick={() => { setNewPhoto(null); setNewPhotoPreview(''); setVerifyResult(null); }} className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-slate-600 shadow-sm transition hover:bg-white">
                            ×
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleVerifyResolution}
                      disabled={verifying}
                      className="civic-button inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white disabled:opacity-70"
                    >
                      {verifying ? <Loader2 className="loading-spin" size={18} /> : <Sparkles size={18} />} Submit for AI verification
                    </button>
                  </div>
                ) : null}

                {verifyResult && !verifyResult.error ? (
                  <div className={`mt-6 rounded-3xl border p-5 ${verifyResult.recommendation === 'mark_resolved' ? 'border-emerald-200 bg-emerald-50' : verifyResult.recommendation === 'needs_admin_review' ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
                    <div className="flex items-start gap-3">
                      {verifyResult.recommendation === 'mark_resolved' ? (
                        <CheckCircle className="mt-0.5 text-emerald-600" size={20} />
                      ) : verifyResult.recommendation === 'needs_admin_review' ? (
                        <Clock className="mt-0.5 text-amber-600" size={20} />
                      ) : (
                        <AlertTriangle className="mt-0.5 text-red-600" size={20} />
                      )}
                      <div className="flex-1">
                        <p className="font-bold text-slate-900">
                          {verifyResult.recommendation === 'mark_resolved' && 'Sent to admin for final confirmation'}
                          {verifyResult.recommendation === 'needs_admin_review' && 'Submitted for admin review'}
                          {verifyResult.recommendation === 'still_open' && 'Issue does not appear resolved yet'}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">{verifyResult.verdict}</p>
                        {verifyResult.what_changed && <p className="mt-2 text-xs italic text-slate-500">Changes detected: {verifyResult.what_changed}</p>}
                        <div className="mt-4 flex items-center gap-3">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/70">
                            <div className={`h-full rounded-full ${verifyResult.recommendation === 'mark_resolved' ? 'bg-emerald-500' : verifyResult.recommendation === 'needs_admin_review' ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${verifyResult.confidence || 0}%` }} />
                          </div>
                          <span className="text-xs font-bold text-slate-600">{verifyResult.confidence}% confidence</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {verifyResult?.error && (
                  <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertTriangle size={16} className="mr-2 inline-block align-text-bottom" />
                    {verifyResult.error}
                  </div>
                )}
              </div>
            )}

            {issue.status === 'resolved' && <ConfettiCard />}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <Link to="/community" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-800">
                <ArrowLeft size={14} /> Back to community
              </Link>
              <button
                onClick={handleDownloadPDF}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[#1e3a5f] bg-white px-5 py-3 text-sm font-bold text-[#1e3a5f] transition hover:bg-slate-50"
              >
                <Download size={16} /> Download PDF report
              </button>
            </div>
          </div>
        )}

        {!issue && !loading && !error && (
          <div className="content-card bg-white px-6 py-16 text-center text-slate-400">
            <Search className="mx-auto text-slate-200" size={64} />
            <p className="mt-4 text-lg font-semibold text-slate-500">Enter your tracking ID above to get started</p>
            <p className="mt-2 text-sm">You receive it after reporting an issue, e.g. <span className="font-mono text-slate-600">CIVIC-AB12CD</span></p>
          </div>
        )}
      </div>
    </div>
  );
}
