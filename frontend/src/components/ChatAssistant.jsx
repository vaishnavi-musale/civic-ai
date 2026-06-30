import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { MessageCircle, Send, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const QUICK_QUESTIONS = [
  "Why isn't my issue resolved?",
  'How long will it take?',
  'How do I report an issue?',
  "What's my issue status?",
];

export default function ChatAssistant() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const trackingId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    return location.pathname === '/track' && id ? id.toUpperCase() : null;
  }, [location.pathname, location.search]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, open]);

  const sendMessage = async (text = input) => {
    const cleanText = text.trim();
    if (!cleanText || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text: cleanText }]);
    setInput('');
    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/ai/chat`, {
        message: cleanText,
        userId: currentUser?.id,
        trackingId,
      });

      setMessages((prev) => [...prev, { role: 'ai', text: res.data.reply || 'I could not find an answer right now.' }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'ai', text: 'Sorry, I could not reach the assistant right now. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <div
        className={`fixed bottom-24 right-4 z-50 w-[calc(100vw-2rem)] max-w-[320px] origin-bottom-right transition-all duration-300 sm:right-6 ${
          open ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-6 scale-95 opacity-0'
        }`}
      >
        <div className="flex h-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="border-b border-slate-100 bg-[#1e3a5f] px-4 py-3 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-black">CivicAI Assistant 🤖</h2>
                <p className="mt-0.5 text-xs text-sky-100">Ask me about your issues</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-sky-100 transition hover:bg-white/10 hover:text-white"
                aria-label="Close chat assistant"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {messages.length === 0 && (
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {QUICK_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    onClick={() => sendMessage(question)}
                    className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-left text-xs font-semibold text-sky-700 transition hover:border-sky-200 hover:bg-sky-100"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-500">
                Hi, I can explain status, timelines, reporting steps, and your tracked issue details.
              </div>
            )}

            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-6 ${
                    message.role === 'user'
                      ? 'bg-[#1B4FD8] text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500">
                  <span className="chat-dot" />
                  <span className="chat-dot animation-delay-150" />
                  <span className="chat-dot animation-delay-300" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-slate-100 p-3">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-sky-400 focus-within:bg-white">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask CivicAI..."
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#1B4FD8] text-white transition hover:bg-[#173fb0] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-6 right-4 z-50 flex h-14 w-14 animate-[assistant-bounce_900ms_ease-out_1] items-center justify-center rounded-full bg-[#1B4FD8] text-white shadow-2xl shadow-blue-500/30 transition hover:-translate-y-1 hover:bg-[#173fb0] sm:right-6"
        aria-label={open ? 'Close CivicAI Assistant' : 'Open CivicAI Assistant'}
      >
        <MessageCircle size={24} />
        <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black leading-none text-white ring-2 ring-white">AI</span>
      </button>
    </>
  );
}
