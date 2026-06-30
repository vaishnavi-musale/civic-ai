import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { supabase } from '../config/supabase';
import Navbar from '../components/Navbar';
import { API_BASE_URL } from '../config/api';
import useCountUp from '../hooks/useCountUp';
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  Compass,
  MapPin,
  MessageCircleMore,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Waves,
  Mic,
  BarChart3,
  ScanSearch,
  Check,
} from 'lucide-react';

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Report',
    description: 'Upload a photo. AI instantly detects category, severity and department with a priority score.',
    icon: Camera,
    accent: 'from-civic-blue to-civic-sky',
    border: 'border-civic-blue',
  },
  {
    step: '02',
    title: 'Track',
    description: 'Get a live tracking ID and watch every handoff from department to resolution status.',
    icon: CircleDashed,
    accent: 'from-civic-blue to-civic-sky',
    border: 'border-civic-blue',
  },
  {
    step: '03',
    title: 'Resolve',
    description: 'Verify completion with before-and-after evidence and a community confirmation loop.',
    icon: CheckCircle2,
    accent: 'from-civic-blue to-civic-sky',
    border: 'border-civic-blue',
  },
];

const FEATURES = [
  { icon: ScanSearch, title: 'Smart Photo Analysis', description: 'Groq detects issue type and severity the moment you upload.', accent: 'border-civic-blue', iconBg: 'bg-civic-blue' },
  { icon: ShieldCheck, title: 'Duplicate Prevention', description: 'AI blocks repeat reports so city teams focus on new problems.', accent: 'border-civic-green', iconBg: 'bg-civic-green' },
  { icon: BarChart3, title: 'Priority Scoring', description: 'Safety risk, location and community signals shape every priority score.', accent: 'border-civic-orange', iconBg: 'bg-civic-orange' },
  { icon: Mic, title: 'Voice Reporting', description: 'Speak in Hindi or Marathi and let CivicAI turn it into a complete report.', accent: 'border-civic-sky', iconBg: 'bg-civic-sky' },
  { icon: Compass, title: 'Resolution Verification', description: 'Before and after photo comparison confirms whether the issue is really fixed.', accent: 'border-civic-green', iconBg: 'bg-civic-green' },
  { icon: MessageCircleMore, title: 'AI Chat Assistant', description: 'Ask what happened next and get a clear answer in plain language.', accent: 'border-civic-blue', iconBg: 'bg-civic-blue' },
];

const TICKER_ITEMS = ['✅ Pothole fixed · Dadar West · 2h ago', '✅ Garbage cleared · Bandra · 4h ago', '✅ Streetlight repaired · Andheri · 1d ago'];

export default function Landing() {
  const [stats, setStats] = useState(null);
  const [resolvedIssues, setResolvedIssues] = useState([]);
  const [liveIssues, setLiveIssues] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [error, setError] = useState('');

  const reportedCount = useCountUp(stats?.total || 0);
  const resolvedCount = useCountUp(stats?.resolved_total || 0);
  const avgDays = useCountUp(stats?.avg_resolution_days || 0);
  const activeCities = useCountUp(6);

  useEffect(() => {
    const load = async () => {
      setLoadingStats(true);
      setLoadingFeed(true);
      setError('');

      try {
        const [statsResponse, resolvedResponse, issuesResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/issues/stats`),
          supabase
            .from('issues')
            .select('id, tracking_id, title, location_address, photo_url, created_at, resolved_at, category, severity, status')
            .eq('status', 'resolved')
            .order('resolved_at', { ascending: false, nullsFirst: false })
            .limit(6),
          supabase
            .from('issues')
            .select('id, tracking_id, title, location_address, photo_url, category, severity, status, upvotes, created_at')
            .order('created_at', { ascending: false })
            .limit(6),
        ]);

        setStats(statsResponse.data);
        setResolvedIssues(resolvedResponse.data || []);
        setLiveIssues(issuesResponse.data || []);
      } catch (err) {
        console.error(err);
        setError('Live civic data is temporarily unavailable.');
      } finally {
        setLoadingStats(false);
        setLoadingFeed(false);
      }
    };

    load();
  }, []);

  const tickerItems = useMemo(() => [...TICKER_ITEMS, ...TICKER_ITEMS], []);

  return (
    <div className="min-h-screen bg-civic-off text-civic-navy">
      <Navbar />

      <section className="relative overflow-hidden bg-civic-navy text-white">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(https://images.unsplash.com/photo-1649510700685-f1f05a50bceb?w=1920&q=80)` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(10,22,40,0.72)] to-[rgba(10,22,40,0.93)]" />
        <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
          <div className="flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 backdrop-blur">
              <span className="pulse-dot inline-flex h-2.5 w-2.5 rounded-full bg-civic-green" />
              Built for Indian communities
            </div>
            <h1 className="max-w-3xl font-display text-6xl font-black leading-[0.85] tracking-[-0.02em] sm:text-7xl lg:text-[6rem]">
              <span className="block text-civic-sky">Report.</span>
              <span className="block text-white">Track.</span>
              <span className="block text-civic-green">Resolve.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300/80 sm:text-xl">
              AI-powered civic reporting trusted by communities across India. Every complaint matters. Every resolution counts.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/report" className="civic-button rounded-full px-7 py-3.5 text-base font-semibold">
                Report an Issue <ArrowRight size={18} className="ml-2" />
              </Link>
              <Link to="/track" className="rounded-full border border-white/25 bg-white/10 px-7 py-3.5 text-base font-semibold text-white transition hover:bg-white hover:text-civic-navy">
                Track My Issue
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-300">
              {['Free for citizens', 'AI-powered', 'Real-time tracking', 'Verified resolutions'].map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-2">✓ {item}</span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center lg:justify-end lg:translate-y-6">
            <div className="relative w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/10 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.25)] backdrop-blur-xl">
              <div className="absolute inset-0 rounded-[2rem] border border-civic-sky/30" />
              <div className="relative">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="mb-3 flex items-center gap-2"><span className="h-px w-6 bg-slate-400/40" /><span className="text-[11px] font-semibold uppercase tracking-[0.36em] text-slate-300">Live civic pulse</span></div>
                    <h2 className="mt-2 text-2xl font-black text-white">Service momentum in motion</h2>
                  </div>
                  <span className="rounded-full bg-civic-green/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-civic-green">Live</span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {[
                    { label: 'Issues Reported', value: reportedCount, accent: 'text-civic-sky' },
                    { label: 'Resolved Today', value: resolvedCount, accent: 'text-civic-green' },
                    { label: 'Avg Response (hrs)', value: stats?.median_response_hours || 2.4, accent: 'text-civic-sky' },
                    { label: 'Cities Active', value: activeCities, accent: 'text-slate-300' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/10 bg-civic-navy/60 p-4">
                      <p className={`text-3xl font-black ${item.accent}`}>{typeof item.value === 'number' ? item.value.toLocaleString() : item.value}</p>
                      <p className="mt-2 text-sm text-slate-400">{item.label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-gradient-to-br from-civic-blue/30 to-civic-sky/25 p-4">
                  <p className="text-sm font-semibold text-civic-sky">Rising public trust</p>
                  <p className="mt-2 text-sm leading-7 text-slate-300/80">
                    {error || 'Every report becomes a visible civic signal — accountable, trackable and actionable.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="overflow-hidden bg-civic-navy py-4 text-white">
        <div className="marquee-track gap-8 px-4 sm:px-6 lg:px-8">
          {tickerItems.map((item, index) => (
            <div key={`${item}-${index}`} className="flex items-center gap-3 whitespace-nowrap rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold">
              <span className="text-civic-green">✓</span>
              {item}
            </div>
          ))}
        </div>
      </div>

      <section className="section-shell bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { title: '10,000+ Issues Reported', value: `${reportedCount.toLocaleString()}+`, accent: 'border-civic-blue', subtitle: 'Citizen-led visibility' },
              { title: '8,200+ Resolved', value: `${resolvedCount.toLocaleString()}+`, accent: 'border-civic-green', subtitle: 'Verified results' },
              { title: '2.4 Days Avg Resolution', value: '2.4d', accent: 'border-civic-blue', subtitle: 'Faster follow-through' },
              { title: '6 Cities Active', value: '6', accent: 'border-civic-blue', subtitle: 'Growing across India' },
            ].map((item) => (
              <div key={item.title} className={`card-surface card-surface-hover border-l-4 ${item.accent} p-6`}>
                <p className="text-3xl font-black text-civic-navy">{item.value}</p>
                <p className="mt-2 text-lg font-semibold text-civic-navy">{item.title}</p>
                <p className="mt-2 text-sm text-slate-500">{item.subtitle}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-shell bg-civic-off">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <div className="mb-4 flex items-center gap-3"><span className="h-px w-8 bg-civic-blue/60" /><span className="text-[11px] font-bold uppercase tracking-[0.36em] text-civic-blue">How it works</span></div>
            <h2 className="mt-3 font-display text-3xl font-extrabold text-civic-navy sm:text-4xl">From complaint to resolution in three clear steps.</h2>
          </div>

          <div className="relative mt-10 grid gap-6 lg:grid-cols-3">
            <div className="absolute left-[16%] top-1/2 hidden h-0.5 w-[68%] -translate-y-1/2 border-t border-dashed border-civic-blue/25 lg:block" />
            {HOW_IT_WORKS.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className={`content-card relative border-l-4 ${item.border} p-6`}>
                  <div className={`mb-5 inline-flex rounded-2xl bg-gradient-to-br ${item.accent} p-3 text-white`}>
                    <Icon size={22} />
                  </div>
                  <div className="text-5xl font-black text-slate-200">0{index + 1}</div>
                  <h3 className="mt-3 text-xl font-black text-civic-navy">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section-shell bg-civic-navy text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <div className="mb-4 flex items-center gap-3"><span className="h-px w-8 bg-slate-400/60" /><span className="text-[11px] font-bold uppercase tracking-[0.36em] text-slate-300">AI features</span></div>
            <h2 className="mt-3 font-display text-3xl font-extrabold text-white sm:text-4xl">AI that works for citizens.</h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className={`content-card border-t-[5px] bg-[#132440] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:brightness-110 ${feature.accent}`}>
                  <div className={`inline-flex rounded-2xl ${feature.iconBg} p-3.5 text-white shadow-sm`}>
                    <Icon size={28} />
                  </div>
                  <h3 className="mt-4 text-xl font-black text-white">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-400/90">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section-shell bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-4 flex items-center gap-3"><span className="h-px w-8 bg-civic-blue/60" /><span className="text-[11px] font-bold uppercase tracking-[0.36em] text-civic-blue">Live issues</span></div>
              <h2 className="mt-2 font-display text-3xl font-extrabold text-civic-navy sm:text-4xl">What is happening in your city right now.</h2>
            </div>
            <Link to="/community" className="text-sm font-semibold text-civic-blue">View all issues →</Link>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max gap-4">
              {loadingFeed ? (
                [1, 2, 3, 4].map((item) => <div key={item} className="shimmer-card h-72 w-72 rounded-[1.25rem]" />)
              ) : (
                liveIssues.map((issue) => (
                  <article key={issue.id} className="content-card w-72 overflow-hidden border-l-4 border-civic-blue bg-white">
                    <div className="h-36 bg-civic-off">
                      {issue.photo_url ? <img src={issue.photo_url} alt={issue.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-4xl text-slate-300">📷</div>}
                    </div>
                    <div className="p-5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-civic-blue/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-civic-blue">{issue.category}</span>
                        <span className="rounded-full bg-civic-green/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-civic-green">{issue.status}</span>
                      </div>
                      <h3 className="mt-4 text-lg font-black text-civic-navy">{issue.title}</h3>
                      <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                        <MapPin size={14} /> {issue.location_address || 'Location pending'}
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-500">{issue.upvotes || 0} upvotes</span>
                        <Link to={`/track?id=${issue.tracking_id}`} className="text-sm font-semibold text-civic-blue">View →</Link>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell bg-gradient-to-br from-civic-blue to-civic-navy text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <div>
            <div className="mb-4 flex items-center gap-3"><span className="h-px w-8 bg-white/30" /><span className="text-[11px] font-bold uppercase tracking-[0.36em] text-slate-300">Community trust</span></div>
            <h2 className="mt-3 font-display text-3xl font-extrabold text-white sm:text-4xl">Join 10,000+ citizens making their city better.</h2>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-6 backdrop-blur">
            <div className="space-y-4 text-sm text-slate-100">
              {['Every report gets a tracking ID', 'AI ensures it reaches the right department', 'You verify when it is actually fixed'].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3">
                  <Check size={18} className="text-civic-green" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <Link to="/report" className="civic-button mt-6 rounded-full px-6 py-3 text-sm font-semibold text-white">
              Start Reporting Free →
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-civic-navy py-8 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 font-black text-white text-xl">C</div>
              <div>
                <p className="text-lg font-black">CivicAI</p>
                <p className="text-sm text-slate-400">Trusted civic reporting for modern India.</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-slate-400">
            <Link to="/report" className="transition hover:text-white">Report</Link>
            <Link to="/track" className="transition hover:text-white">Track</Link>
            <Link to="/community" className="transition hover:text-white">Community</Link>
            <Link to="/admin" className="transition hover:text-white">Admin</Link>
          </div>
        </div>
        <div className="mx-auto mt-6 max-w-7xl border-t border-white/10 px-4 pt-6 text-sm text-slate-500 sm:px-6 lg:px-8">
          © 2026 CivicAI · Built with Groq AI · Made for India 🇮🇳
        </div>
      </footer>
    </div>
  );
}
