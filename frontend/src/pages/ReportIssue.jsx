import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import { useAuth } from '../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import Navbar from '../components/Navbar';
import {
  Camera,
  MapPin,
  FileText,
  CheckCircle,
  Check,
  UploadCloud,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Copy,
  ShieldAlert,
  CircleDashed,
  Sparkles,
  Shield,
  BadgeCheck,
  Clock3,
  Flame,
  Globe,
  ChevronDown,
  X,
  Navigation,
} from 'lucide-react';

const CATEGORIES = ['pothole', 'waterlogging', 'streetlight', 'waste', 'encroachment', 'sewage', 'road_damage', 'park', 'other'];

const LANGUAGES = [
  { code: 'English', label: 'English', placeholder: 'Describe the issue in detail...' },
  { code: 'Hindi', label: 'हिंदी (Hindi)', placeholder: 'समस्या का विस्तार से वर्णन करें...' },
  { code: 'Marathi', label: 'मराठी (Marathi)', placeholder: 'समस्येचे तपशीलवार वर्णन करा...' },
  { code: 'Tamil', label: 'தமிழ் (Tamil)', placeholder: 'பிரச்சினை விரிவாக விவரிக்கவும்...' },
  { code: 'Telugu', label: 'తెలుగు (Telugu)', placeholder: 'సమస్యను వివరంగా వివరించండి...' },
  { code: 'Bengali', label: 'বাংলা (Bengali)', placeholder: 'সমস্যা সম্পর্কে বিস্তারিত বর্ণনা করুন...' },
];

const SEVERITY_STYLES = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-red-50 text-red-700 border-red-200 severity-critical',
};

const PROCESSING_STEPS = [
  { id: 'upload', label: 'Uploading image...', doneLabel: 'Image received' },
  { id: 'analyze', label: 'Analyzing objects...', doneLabel: null },
  { id: 'duplicate', label: 'Checking duplicates...', doneLabel: 'No duplicates found' },
  { id: 'severity', label: 'Estimating severity...', doneLabel: null },
  { id: 'report', label: 'Generating report...', doneLabel: 'Done' },
];

function useTypewriter(text, speed = 18) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!text) {
      setValue('');
      return;
    }

    let index = 0;
    setValue('');
    const timer = window.setInterval(() => {
      index += 1;
      setValue(text.slice(0, index));
      if (index >= text.length) window.clearInterval(timer);
    }, speed);

    return () => window.clearInterval(timer);
  }, [text, speed]);

  return value;
}

function StepShell({ active, children }) {
  return (
    <div key={active} className="slide-in-right content-card bg-white p-5 sm:p-8">
      {children}
    </div>
  );
}

export default function ReportIssue() {
  const { currentUser } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [photoMode, setPhotoMode] = useState('upload');

  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationDetected, setLocationDetected] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('English');
  const [category, setCategory] = useState('other');
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [aiTypingSeed, setAiTypingSeed] = useState('');
  const [duplicateBypass, setDuplicateBypass] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const processingTimers = useRef([]);
  const processingStepRef = useRef(-1);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [processingState, setProcessingState] = useState({ active: false, step: -1, completed: {}, labels: {} });
  const typedAiDescription = useTypewriter(aiTypingSeed, 16);
  const confidenceValue = Number(aiResult?.confidence_percent ?? aiResult?.confidence ?? 0);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  useEffect(() => {
    if (aiResult?.ai_description) {
      setAiTypingSeed(aiResult.ai_description);
    }
  }, [aiResult]);

  const analyzePhoto = async (file) => {
    setAnalyzing(true);
    setError('');
    setProcessingState({ active: true, step: 0, completed: {}, labels: {} });
    processingStepRef.current = 0;
    processingTimers.current.forEach(t => clearTimeout(t));

    const advance = (dones, from, to) => {
      processingTimers.current.push(setTimeout(() => {
        processingStepRef.current = to;
        setProcessingState(p => ({ ...p, completed: { ...p.completed, ...dones }, step: to }));
      }, from));
    };

    advance({}, 0, 0);
    advance({ 0: 'done' }, 400, 1);
    advance({ 1: 'done' }, 1000, 2);
    advance({ 2: 'done' }, 1400, 3);

    const finishProcessing = (aiData) => {
      processingTimers.current.forEach(t => clearTimeout(t));
      processingTimers.current = [];
      const currentStep = processingStepRef.current;
      const newCompleted = { 0: 'done', 1: 'done', 2: 'done' };
      if (currentStep >= 3) {
        newCompleted[3] = 'done';
        newCompleted[4] = 'done';
        setProcessingState(p => ({ ...p, completed: { ...p.completed, ...newCompleted }, labels: { 1: (aiData?.category || 'issue') + ' detected', 3: aiData?.severity || 'medium' }, step: -1 }));
        setTimeout(() => setProcessingState({ active: false, step: -1, completed: {}, labels: {} }), 600);
      } else {
        setProcessingState(p => ({ ...p, completed: { ...p.completed, ...newCompleted }, labels: { 1: (aiData?.category || 'issue') + ' detected', 3: aiData?.severity || 'medium' }, step: 3 }));
        processingTimers.current.push(setTimeout(() => {
          setProcessingState(p => ({ ...p, completed: { ...p.completed, 3: 'done' }, step: 4 }));
          processingTimers.current.push(setTimeout(() => {
            setProcessingState(p => ({ ...p, completed: { ...p.completed, 4: 'done' }, step: -1 }));
            setTimeout(() => setProcessingState({ active: false, step: -1, completed: {}, labels: {} }), 600);
          }, 300));
        }, 300));
      }
    };

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64data = String(reader.result).split(',')[1];
          const response = await axios.post(`${API_BASE_URL}/api/ai/analyze-image`, {
            imageBase64: base64data,
            mimeType: file.type,
            userDescription: '',
          });

              console.log('analyze-image response', response);

          const aiData = response.data;
          if (aiData?.error === 'AI_UNAVAILABLE' || aiData?.error === 'QUOTA_EXCEEDED') {
            throw new Error(aiData.message || 'AI analysis temporarily unavailable. Please select the category manually.');
          }
          setAiResult(aiData);
          setTitle(aiData.suggested_title || '');
          setDescription(aiData.ai_description || '');
          setCategory(aiData.category || 'other');
          finishProcessing(aiData);
          setAnalyzing(false);
        } catch (analysisError) {
          console.error(analysisError);
          processingTimers.current.forEach(t => clearTimeout(t));
          processingTimers.current = [];
          setProcessingState({ active: false, step: -1, completed: {}, labels: {} });
          setError('⚠ AI analysis unavailable right now. Please select category manually.');
          toast.error('AI analysis unavailable. Continue manually.');
          setAnalyzing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      processingTimers.current.forEach(t => clearTimeout(t));
      processingTimers.current = [];
      setProcessingState({ active: false, step: -1, completed: {}, labels: {} });
      setError('Failed to process the image.');
      setAnalyzing(false);
    }
  };

  const handlePhotoSelect = async (file) => {
    if (!file) return;
    setPhoto(file);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(URL.createObjectURL(file));
    setAiResult(null);
    setDuplicateWarning(null);
    await analyzePhoto(file);
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    await handlePhotoSelect(file);
  };

  const handleOpenCamera = async () => {
    try {
      setPhotoMode('camera');
      setCameraLoading(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      setCameraModalOpen(true);
    } catch {
      console.error('Camera access denied or unavailable');
      toast.error('Camera unavailable. Please use Upload Photo instead.');
    } finally {
      setCameraLoading(false);
    }
  };

  const handleCloseCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraModalOpen(false);
  };

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
      handleCloseCamera();
      handlePhotoSelect(file);
    }, 'image/jpeg', 0.92);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (cameraModalOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraModalOpen]);

  const checkDuplicateFrontend = async () => {
    if (duplicateBypass) return;
    try {
      const res = await axios.post(`${API_BASE_URL}/api/issues/check-duplicate`, {
        title,
        description,
        location_address: address,
        category,
        latitude,
        longitude,
        ai_analysis: aiResult,
      });
      if (res.data?.is_duplicate) {
        setDuplicateWarning(res.data);
        setStep(2);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (step === 3 && aiResult && address) {
      checkDuplicateFrontend();
    }
  }, [step, aiResult, address, title, description, category, latitude, longitude, duplicateBypass]);

  const handleSubmit = async () => {
    if (!title || !description) {
      setError('Title and description are required.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      let finalDescription = description;
      let originalDescription = null;
      let reportedLanguage = language || 'English';

      if (language && language !== 'English') {
        try {
          const transRes = await axios.post(`${API_BASE_URL}/api/ai/translate`, {
            text: description,
            fromLanguage: language,
          });
          if (transRes.data?.translated_text) {
            originalDescription = description;
            finalDescription = transRes.data.translated_text;
          }
        } catch (transErr) {
          console.error('Translation failed, submitting in original language:', transErr);
        }
      }

      const formData = new FormData();
      if (photo) formData.append('photo', photo);
      formData.append('title', title);
      formData.append('description', finalDescription);
      if (originalDescription) formData.append('original_description', originalDescription);
      formData.append('reported_language', reportedLanguage);
      formData.append('location_address', address);
      formData.append('category', category);
      if (latitude) formData.append('latitude', latitude);
      if (longitude) formData.append('longitude', longitude);
      if (currentUser) {
        formData.append('user_id', currentUser.id);
        formData.append('user_email', currentUser.email);
      }
        if (duplicateBypass) formData.append('bypassDuplicate', 'true');
      if (aiResult) formData.append('ai_analysis', JSON.stringify(aiResult));

      const res = await axios.post(`${API_BASE_URL}/api/issues`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSubmissionResult(res.data);
      setStep(4);
      toast.success('Issue submitted successfully!');
    } catch (err) {
      console.error(err);
      const msg = 'Failed to submit issue. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const generatePDF = () => {
    if (!submissionResult) return;

    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(30, 58, 95);
    doc.text('CivicAI Issue Report', 20, 20);

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`Tracking ID: ${submissionResult.tracking_id}`, 20, 40);
    doc.text(`Title: ${title}`, 20, 50);
    doc.text(`Category: ${category}`, 20, 60);
    doc.text(`Severity: ${aiResult?.severity || 'N/A'}`, 20, 70);
    doc.text(`Location: ${address}`, 20, 80);
    doc.text('Description:', 20, 100);
    doc.text(doc.splitTextToSize(description, 170), 20, 110);
    doc.save(`CivicAI_Report_${submissionResult.tracking_id}.pdf`);
  };

  const progress = ((step - 1) / 3) * 100;

  const handleSupportExisting = async () => {
    if (!duplicateWarning?.existing_issue?.id) return;
    try {
      const res = await axios.post(`${API_BASE_URL}/api/issues/${duplicateWarning.existing_issue.id}/upvote`);
      toast.success(`Support added for ${duplicateWarning.existing_issue.tracking_id}`);
      setDuplicateWarning({ ...duplicateWarning, existing_issue: { ...duplicateWarning.existing_issue, upvotes: res.data.upvotes } });
    } catch (err) {
      toast.error('Unable to support this issue right now.');
    }
  };

  const resetForm = () => {
    setStep(1);
    setPhoto(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview('');
    setAddress('');
    setLatitude('');
    setLongitude('');
    setAiResult(null);
    setAiTypingSeed('');
    setTitle('');
    setDescription('');
    setLanguage('English');
    setCategory('other');
    setDuplicateWarning(null);
    setSubmissionResult(null);
    setError('');
    setLocating(false);
    setLocationDetected(false);
  };

  const getLocation = () => {
    if (!navigator.geolocation) return;

    setLocating(true);
    setLocationDetected(false);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        setLatitude(lat.toFixed(6));
        setLongitude(lng.toFixed(6));

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
            { headers: { 'User-Agent': 'CivicAI/1.0' } }
          );
          const data = await res.json();
          if (data.display_name) {
            setAddress(data.display_name);
          } else {
            toast.error('Location detected, please confirm address.');
          }
        } catch {
          toast.error('Location detected, please confirm address.');
        }

        setLocating(false);
        setLocationDetected(true);
        setTimeout(() => setLocationDetected(false), 3000);
      },
      (error) => {
        setLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error('Location access denied. Please enter address manually.');
            break;
          case error.TIMEOUT:
            toast.error('Location request timed out. Please try again.');
            break;
          default:
            toast.error('Could not detect location. Please enter address manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const startVoiceRecording = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    toast.error('Voice recording not supported in this browser. Use Chrome.');
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = 'en-IN';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onstart = () => setIsRecording(true);
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    setDescription((prev) => prev ? `${prev} ${transcript}` : transcript);
    toast.success('Voice captured!');
  };
  recognition.onerror = () => {
    toast.error('Voice recording failed. Try again.');
    setIsRecording(false);
  };
  recognition.onend = () => setIsRecording(false);
  recognitionRef.current = recognition;
  recognition.start();
};

const stopVoiceRecording = () => {
  recognitionRef.current?.stop();
  setIsRecording(false);
};

  return (
    <div className="min-h-screen bg-[var(--civic-bg)]">
      <Navbar />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 content-card bg-white px-5 py-6 sm:px-8">
          <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="mb-4 flex items-center gap-2"><span className="h-px w-6 bg-sky-600/60" /><span className="text-[11px] font-bold uppercase tracking-[0.36em] text-sky-700">Report issue</span></div>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Submit a civic issue with clarity and speed.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--civic-text-muted)]">The experience is designed to feel guided, responsive, and trustworthy from the first upload to the final confirmation.</p>
            </div>
            <div className="rounded-2xl bg-slate-900 px-4 py-3 text-right text-white shadow-lg">
              <p className="text-xs uppercase tracking-[0.2em] text-sky-200">Step</p>
              <p className="text-2xl font-black">{step}/4</p>
            </div>
          </div>

          <div className="mb-4 flex items-center gap-3">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="flex flex-1 items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${step >= item ? 'border-[#0ea5e9] bg-[#0ea5e9] text-white' : 'border-slate-200 bg-white text-slate-400'}`}>
                  {item === 1 && <Camera size={18} />}
                  {item === 2 && <MapPin size={18} />}
                  {item === 3 && <ShieldAlert size={18} />}
                  {item === 4 && <CheckCircle size={18} />}
                </div>
                {item < 4 && <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-[#1e3a5f] to-[#0ea5e9] transition-all duration-500" style={{ width: progress >= item * 25 ? '100%' : '0%' }} /></div>}
              </div>
            ))}
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-[#1e3a5f] to-[#0ea5e9] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            <AlertTriangle className="mr-2 inline-block align-text-bottom" size={16} />
            {error}
          </div>
        )}

        {step === 1 && (
          <StepShell active={step}>
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <div className="mb-4 flex items-center gap-2"><span className="h-px w-6 bg-slate-400/50" /><span className="text-[11px] font-bold uppercase tracking-[0.36em] text-slate-400">Step 1</span></div>
                <h2 className="mt-2 text-2xl font-black text-slate-900">Upload a clear photo of the issue.</h2>
                <p className="mt-3 text-sm leading-relaxed text-[var(--civic-text-muted)]">Dragging a file here activates the pulsing border. The AI analysis appears immediately after upload.</p>

                {!photo ? (
                  <div className="mt-6 space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <button type="button" onClick={handleOpenCamera} disabled={cameraLoading} className={`flex flex-col items-center gap-3 rounded-3xl border-2 p-6 text-center transition-all ${photoMode === 'camera' ? 'border-[#0ea5e9] bg-sky-50/80 shadow-[0_0_0_3px_rgba(14,165,233,0.14)]' : 'border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/40'} ${cameraLoading ? 'pointer-events-none opacity-60' : ''}`}>
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm"><Camera size={28} /></div>
                        <p className="text-lg font-bold text-slate-900">{cameraLoading ? 'Opening camera...' : 'Take Photo'}</p>
                        <p className="text-sm text-slate-500">Use your camera to capture the issue live</p>
                      </button>
                      <button type="button" onClick={() => { setPhotoMode('upload'); fileInputRef.current?.click(); }} className={`flex flex-col items-center gap-3 rounded-3xl border-2 p-6 text-center transition-all ${photoMode === 'upload' ? 'border-[#0ea5e9] bg-sky-50/80 shadow-[0_0_0_3px_rgba(14,165,233,0.14)]' : 'border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/40'}`}>
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-sky-600 shadow-sm ring-1 ring-slate-200"><UploadCloud size={28} /></div>
                        <p className="text-lg font-bold text-slate-900">Upload Photo</p>
                        <p className="text-sm text-slate-500">Choose an existing photo from your device</p>
                      </button>
                    </div>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDrop={handleDrop}
                      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                      onDragLeave={() => setDragActive(false)}
                      className={`rounded-3xl border-2 border-dashed p-10 text-center transition-all ${dragActive ? 'border-[#0ea5e9] bg-sky-50/80 shadow-[0_0_0_3px_rgba(14,165,233,0.14)]' : 'border-slate-200 bg-slate-50/70 hover:border-sky-200 hover:bg-sky-50/40'}`}
                    >
                      <p className="text-sm font-semibold text-slate-500">or drag & drop a photo here</p>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoSelect(e.target.files?.[0])} />
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                      <img src={photoPreview} alt="Issue preview" className="h-72 w-full object-cover" />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={() => { setPhoto(null); setAiResult(null); setAiTypingSeed(''); setPhotoPreview(''); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                        <Copy size={14} /> Replace photo
                      </button>
                      <button type="button" onClick={() => setStep(2)} disabled={analyzing} className="civic-button inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold text-white disabled:opacity-70">
                        Continue <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl bg-slate-50 p-5">
                  <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.22em] text-slate-500">
                    <CircleDashed size={16} className={analyzing && !aiResult ? 'loading-spin' : ''} /> AI analysis
                  </div>
                  {processingState.active || Object.keys(processingState.completed).length > 0 ? (
                    <div className="mt-5 space-y-0">
                      {PROCESSING_STEPS.map((step, i) => {
                        const status = processingState.completed[i];
                        const isActive = processingState.step === i;
                        const label = status === 'done' ? (step.doneLabel || processingState.labels[i] || step.label) : step.label;
                        return (
                          <div key={step.id} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className="flex h-5 w-5 items-center justify-center">
                                {status === 'done' ? (
                                  <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : isActive ? (
                                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />
                                ) : (
                                  <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                                )}
                              </div>
                              {i < PROCESSING_STEPS.length - 1 && (
                                <div className={`mt-1 h-6 w-0.5 ${status === 'done' ? 'bg-emerald-200' : 'bg-slate-200'}`} />
                              )}
                            </div>
                            <div className="pb-2">
                              <p className={`text-sm font-semibold transition-all duration-300 ${status === 'done' ? 'text-emerald-700' : isActive ? 'text-sky-700' : 'text-slate-400'}`}>
                                {label}
                                {isActive && i === 4 && (
                                  <span className="ml-1 inline-flex">
                                    <span className="animate-pulse">.</span>
                                    <span className="animate-pulse delay-150">.</span>
                                    <span className="animate-pulse delay-300">.</span>
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : aiResult ? (
                    <div className="mt-4 space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-sky-700">{aiResult.category || 'other'}</span>
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${SEVERITY_STYLES[aiResult.severity] || SEVERITY_STYLES.low}`}>{aiResult.severity || 'low'}</span>
                      </div>
                      <p className="text-sm leading-relaxed text-slate-600">{typedAiDescription || aiResult.ai_description}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Suggested title</p>
                          <p className="mt-2 text-sm font-semibold text-slate-900">{aiResult.suggested_title || 'Issue detected'}</p>
                        </div>
                        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Confidence</p>
                          <p className="mt-2 text-sm font-semibold text-slate-900">{Number.isFinite(confidenceValue) ? `${confidenceValue}%` : '—'}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm leading-relaxed text-slate-500">Upload a photo to see AI classification, severity, and a suggested issue title.</p>
                  )}
                </div>

                <div className="rounded-3xl bg-white p-5 shadow-sm">
                  <label className="block text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="civic-select mt-3 px-4 py-3 text-sm">
                    {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </StepShell>
        )}

        {step === 2 && duplicateWarning && (
          <StepShell active={step}>
            <div className="space-y-6">
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 text-amber-600" size={20} />
                  <div>
                    <p className="text-lg font-black text-amber-900">⚠ This issue has already been reported</p>
                    <p className="mt-1 text-sm text-amber-800">{duplicateWarning.message || 'A very similar issue was reported recently nearby.'}</p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    {duplicateWarning.existing_issue?.photo_url ? (
                      <img src={duplicateWarning.existing_issue.photo_url} alt="Existing issue" className="h-16 w-16 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100 text-xl">📷</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-slate-900">{duplicateWarning.existing_issue?.title || 'Existing issue'}</p>
                      <p className="mt-1 text-sm text-slate-600">{duplicateWarning.existing_issue?.distance_text || 'Nearby location'}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{duplicateWarning.existing_issue?.tracking_id}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={handleSupportExisting} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700">
                    <CheckCircle size={16} /> Support this issue
                  </button>
                  <button type="button" onClick={() => { setDuplicateBypass(true); setDuplicateWarning(null); setStep(3); }} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-white px-4 py-3 text-sm font-bold text-amber-800 transition hover:bg-amber-100">
                    Report anyway
                  </button>
                </div>
              </div>
            </div>
          </StepShell>
        )}

        {step === 2 && !duplicateWarning && (
          <StepShell active={step}>
            <div className="space-y-6">
              <div>
                <div className="mb-4 flex items-center gap-2"><span className="h-px w-6 bg-slate-400/50" /><span className="text-[11px] font-bold uppercase tracking-[0.36em] text-slate-400">Step 2</span></div>
                <h2 className="mt-2 text-2xl font-black text-slate-900">Pin the issue location.</h2>
              </div>

              <div className="grid gap-5">
                {typeof navigator !== 'undefined' && navigator.geolocation && (
                  <button type="button" onClick={getLocation} disabled={locating} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed">
                    {locating ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} className="text-civic-blue" />}
                    <span>{locating ? 'Detecting location...' : 'Use My Location'}</span>
                    {locationDetected && !locating && <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600"><Check size={14} /> Location detected</span>}
                  </button>
                )}
                <div className={`floating-label ${address ? 'has-value' : ''}`}>
                  <label>Address *</label>
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="civic-input px-4 pb-3 pt-6" placeholder=" " />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className={`floating-label ${latitude ? 'has-value' : ''}`}>
                    <label>Latitude</label>
                    <input type="number" value={latitude} onChange={(e) => setLatitude(e.target.value)} className="civic-input px-4 pb-3 pt-6" placeholder=" " />
                  </div>
                  <div className={`floating-label ${longitude ? 'has-value' : ''}`}>
                    <label>Longitude</label>
                    <input type="number" value={longitude} onChange={(e) => setLongitude(e.target.value)} className="civic-input px-4 pb-3 pt-6" placeholder=" " />
                  </div>
                </div>
                <p className="text-xs text-slate-500">Tip: coordinates help route faster. The form is optimized for mobile and desktop alike.</p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  <ArrowLeft size={14} /> Back
                </button>
                <button type="button" onClick={() => {
                  if (!address) {
                    setError('Location address is required.');
                    return;
                  }
                  setError('');
                  setStep(3);
                }} className="civic-button inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white">
                  Continue <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </StepShell>
        )}

        {step === 3 && (
          <StepShell active={step}>
            <div className="space-y-6">
              <div>
                <div className="mb-4 flex items-center gap-2"><span className="h-px w-6 bg-slate-400/50" /><span className="text-[11px] font-bold uppercase tracking-[0.36em] text-slate-400">Step 3</span></div>
                <h2 className="mt-2 text-2xl font-black text-slate-900">Review the AI-generated details.</h2>
              </div>

              {duplicateWarning && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
                  <div className="flex gap-3">
                    <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-amber-600" />
                    <div>
                      <p className="font-bold">A similar issue already exists nearby</p>
                      <p className="mt-1 text-amber-800">Reason: {duplicateWarning.reason}. Confidence: {duplicateWarning.confidence}%</p>
                    </div>
                  </div>
                </div>
              )}

              <div className={`floating-label ${title ? 'has-value' : ''}`}>
                <label>Title</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="civic-input px-4 pb-3 pt-6 font-semibold" placeholder=" " />
              </div>

             <div className={`floating-label ${description ? 'has-value' : ''}`}>
  <label>Description</label>
  <div className="mb-3">
    <label className="block text-xs font-bold uppercase tracking-[0.22em] text-slate-400 mb-1">Language</label>
    <div className="relative">
      <select value={language} onChange={(e) => setLanguage(e.target.value)} className="civic-select w-full px-4 py-3 pr-10 text-sm appearance-none">
        {LANGUAGES.map((lang) => <option key={lang.code} value={lang.code}>{lang.label}</option>)}
      </select>
      <Globe className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
    </div>
  </div>
  <div className="relative">
    <textarea rows={6} value={description} onChange={(e) => setDescription(e.target.value)} className="civic-textarea px-4 pb-3 pt-6 pr-14 leading-7" placeholder={LANGUAGES.find(l => l.code === language)?.placeholder || 'Describe the issue in detail...'} />
    <button
      type="button"
      onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
      className={`absolute right-3 top-4 rounded-xl p-2 transition ${isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-600 hover:bg-sky-100 hover:text-sky-600'}`}
      title={isRecording ? 'Stop recording' : 'Start voice input'}
    >
      🎤
    </button>
  </div>
  {isRecording && <p className="mt-1 text-xs font-semibold text-red-600 animate-pulse">● Listening... speak now</p>}
</div>

              <div className="grid gap-4">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">AI assessment</p>
                      <p className="mt-2 text-lg font-black text-slate-900">{aiResult?.category || category} · {Number.isFinite(confidenceValue) ? `${confidenceValue}%` : '0%'} confident</p>
                    </div>
                    <div className="rounded-full bg-sky-100 px-3 py-1 text-sm font-bold text-sky-700">{aiResult?.recommended_department || 'Public Works Department'}</div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-bold capitalize ${SEVERITY_STYLES[aiResult?.severity || 'low']}`}>
                      {aiResult?.severity || 'low'} severity
                    </span>
                    <span className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-sm font-bold text-white">Priority {aiResult?.priority_score || 0}/100</span>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-600">
                      <span>Priority score</span>
                      <span>{aiResult?.priority_score || 0}/100</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-600" style={{ width: `${aiResult?.priority_score || 0}%` }} />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-700"><Sparkles size={16} className="text-sky-600" /> Priority reasons</div>
                      <ul className="mt-3 space-y-2 text-sm text-slate-600">
                        {(aiResult?.priority_reasons || []).map((reason) => <li key={reason} className="flex gap-2"><span className="mt-1 text-sky-600">•</span><span>{reason}</span></li>)}
                      </ul>
                    </div>
                    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-700"><Clock3 size={16} className="text-emerald-600" /> Estimated resolution</div>
                      <p className="mt-3 text-sm text-slate-600">Usually resolved in {aiResult?.estimated_resolution_days || 7} days</p>
                      <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><Shield size={16} className="text-amber-600" /> Safety risk: <span className="capitalize">{aiResult?.safety_risk || 'low'}</span></div>
                    </div>
                  </div>

                  {aiResult?.is_emergency && (
                    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                      <Flame size={16} className="animate-pulse" /> Safety hazard detected — this will be escalated immediately.
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Severity reason</p>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{aiResult?.severity_reason || 'AI assisted assessment.'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Location</p>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{address || 'No location selected'}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button type="button" onClick={() => setStep(2)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  <ArrowLeft size={14} /> Back
                </button>
                <button type="button" onClick={handleSubmit} disabled={submitting} className="civic-button inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-white disabled:opacity-70">
                  {submitting ? <Loader2 size={16} className="loading-spin" /> : <CheckCircle size={16} />} Submit issue
                </button>
              </div>
            </div>
          </StepShell>
        )}

        {step === 4 && submissionResult && (
          <StepShell active={step}>
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shadow-sm ring-1 ring-emerald-100">
                <CheckCircle size={34} />
              </div>
              <h2 className="mt-6 text-3xl font-black text-slate-900">Issue reported successfully.</h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--civic-text-muted)]">A tracking ID has been created and the record is now ready for follow-up and verification.</p>

             <div className="mt-8 rounded-3xl bg-slate-50 p-5 text-left">
  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Tracking ID</p>
  <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <span className="font-mono text-2xl font-black tracking-wider text-[#1e3a5f]">{submissionResult.tracking_id}</span>
    <button type="button" onClick={() => { navigator.clipboard.writeText(submissionResult.tracking_id); toast.success('Copied!'); }} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
      Copy
    </button>
  </div>

  {/* QR CODE */}
  <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5">
    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Scan to track anytime</p>
   <div className="qr-code-container">
  <QRCodeSVG
    value={`${window.location.origin}/track?id=${submissionResult.tracking_id}`}
    size={160}
    bgColor="#ffffff"
    fgColor="#1e3a5f"
    level="M"
    includeMargin={true}
  />
</div>
   <button
  type="button"
  onClick={() => {
    const svg = document.querySelector('.qr-code-container svg');
    if (!svg) { toast.error('QR not found'); return; }
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 200, 200);
      ctx.drawImage(img, 0, 0, 200, 200);
      const link = document.createElement('a');
      link.download = `CivicAI_QR_${submissionResult.tracking_id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  }}
  className="text-xs font-semibold text-sky-600 underline hover:text-sky-800"
>
  Download QR
</button>
  </div>

  {submissionResult.is_duplicate && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Marked as a potential duplicate.</p>}
</div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button type="button" onClick={generatePDF} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#1e3a5f] bg-white px-5 py-3 text-sm font-bold text-[#1e3a5f] transition hover:bg-slate-50">
                  Download PDF Report
                </button>
                <Link to="/track" className="civic-button inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-bold text-white">
                  Track this issue
                </Link>
                <button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                  Report another
                </button>
              </div>
            </div>
          </StepShell>
        )}

        {cameraModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm" onClick={handleCloseCamera}>
            <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-black shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={handleCloseCamera} className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70">
                <X size={18} />
              </button>
              <video ref={videoRef} autoPlay playsInline className="h-[60vh] w-full bg-black object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                <button type="button" onClick={handleCapture} className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 backdrop-blur-sm transition hover:scale-105 active:scale-95">
                  <div className="h-12 w-12 rounded-full border-4 border-white" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}