import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import AuthCallback from './pages/AuthCallback.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import RecordVideo from './pages/RecordVideo.jsx';
import VideoSuccess from './pages/VideoSuccess.jsx';
import Directory from './pages/Directory.jsx';
import UserRegistration from './components/UserRegistration.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/record-video" element={<RecordVideo />} />
        <Route path="/video-success" element={<VideoSuccess />} />
        <Route path="/directory" element={<Directory />} />
        <Route path="/register" element={<UserRegistration />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
