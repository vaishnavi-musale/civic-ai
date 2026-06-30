import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PageWrapper from './components/PageWrapper';
import ChatAssistant from './components/ChatAssistant';

import Landing from './pages/Landing';
import ReportIssue from './pages/ReportIssue';
import TrackIssue from './pages/TrackIssue';
import Community from './pages/Community';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Profile from './pages/Profile';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          reverseOrder={false}
          toastOptions={{
            duration: 3200,
            style: {
              borderRadius: '8px',
              background: '#ffffff',
              color: '#0f172a',
              fontSize: '14px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(30, 58, 95, 0.08)',
            },
            success: {
              iconTheme: { primary: '#10b981', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#fff' },
            },
          }}
        />

        <Routes>
          <Route path="/" element={<PageWrapper><Landing /></PageWrapper>} />
          <Route path="/login" element={<PageWrapper><Login /></PageWrapper>} />
          <Route path="/signup" element={<PageWrapper><Signup /></PageWrapper>} />
          <Route path="/profile" element={<ProtectedRoute><PageWrapper><Profile /></PageWrapper></ProtectedRoute>} />
          <Route path="/report" element={<ProtectedRoute><PageWrapper><ReportIssue /></PageWrapper></ProtectedRoute>} />
          <Route path="/track" element={<ProtectedRoute><PageWrapper><TrackIssue /></PageWrapper></ProtectedRoute>} />
          <Route path="/community" element={<ProtectedRoute><PageWrapper><Community /></PageWrapper></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute adminOnly={true}><PageWrapper><AdminDashboard /></PageWrapper></ProtectedRoute>} />
        </Routes>
        <ChatAssistant />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
