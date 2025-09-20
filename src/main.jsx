import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import './index.css';

import App from './App.jsx'; // Gardez App pour les composants communs, mais sans routing interne
import AuthCallback from '@/pages/AuthCallback.jsx';
import ResetPassword from '@/pages/ResetPassword.jsx';
import RecordVideo from '@/pages/record-video.jsx';
import VideoSuccess from '@/pages/video-success.jsx';
import Directory from '@/pages/directory.jsx';
import UserRegistration from '@components/UserRegistration.jsx';
import Login from '@/pages/login.jsx';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SessionContextProvider supabaseClient={supabase}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} /> {/* App gère maintenant le dashboard comme page d'accueil */}
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/record-video" element={<RecordVideo />} /> {/* Indépendante, comme avant */}
          <Route path="/video-success" element={<VideoSuccess />} />
          <Route path="/directory" element={<Directory />} />
          <Route path="/register" element={<UserRegistration />} />
          {/* Ajoutez une route pour le dashboard si besoin d'accès direct, mais App le gère */}
          <Route path="/dashboard/*" element={<App />} /> {/* Optionnel : pour les sous-routes si vous en ajoutez */}
        </Routes>
      </BrowserRouter>
    </SessionContextProvider>
  </StrictMode>
);
