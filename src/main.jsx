// src/main.jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SupabaseProvider, createClient } from '@supabase/auth-helpers-react';
import './index.css';
import App from './App.jsx';
import AuthCallback from './pages/AuthCallback.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import RecordVideo from './pages/record-video.jsx';
import VideoSuccess from './pages/video-success.jsx';
import Directory from './pages/directory.jsx';
import UserRegistration from './components/UserRegistration.jsx';
import Login from './pages/login.jsx';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Erreur de configuration Supabase : VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquant');
  throw new Error('Configuration Supabase incomplète');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'spotbulle-auth-token',
    flowType: 'pkce',
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SupabaseProvider client={supabase}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/record-video" element={<RecordVideo />} />
          <Route path="/video-success" element={<VideoSuccess />} />
          <Route path="/directory" element={<Directory />} />
          <Route path="/register" element={<UserRegistration />} />
        </Routes>
      </BrowserRouter>
    </SupabaseProvider>
  </StrictMode>
);
