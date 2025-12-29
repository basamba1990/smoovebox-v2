// src/App.jsx - Extraits corrigés
import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import AppRoutes from './routes/AppRoutes';
import { AuthProvider } from './context/AuthContext';
import './App.css';

// Configuration React Query avec retry et cache
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
  },
});

function AppContent() {
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [hasNetworkError, setHasNetworkError] = useState(false);

  // Vérification de la connexion réseau
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch('https://api.supabase.co/health', {
          signal: controller.signal,
          headers: { 'Cache-Control': 'no-cache' }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          setConnectionStatus('connected');
          setHasNetworkError(false);
        } else {
          setConnectionStatus('api_error');
        }
      } catch (error) {
        console.warn('⚠️ Vérification connexion:', error);
        setConnectionStatus('offline');
        setHasNetworkError(true);
        
        // Tentative de fallback
        setTimeout(() => checkConnection(), 10000);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Vérifier toutes les 30s

    return () => clearInterval(interval);
  }, []);

  // Gestion des erreurs globales
  useEffect(() => {
    const handleGlobalError = (event) => {
      console.error('🚨 Erreur globale non capturée:', event.error);
      // Ne pas prévenir l'utilisateur ici, ErrorBoundary s'en charge
    };

    const handleUnhandledRejection = (event) => {
      console.error('🚨 Promise rejetée non gérée:', event.reason);
      event.preventDefault(); // Évite le log dans la console
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Afficher un indicateur de connexion
  const renderConnectionStatus = () => {
    if (connectionStatus === 'checking') return null;
    
    const statusConfig = {
      connected: { color: 'bg-green-500', text: 'Connecté', icon: '🟢' },
      offline: { color: 'bg-red-500', text: 'Hors ligne', icon: '🔴' },
      api_error: { color: 'bg-yellow-500', text: 'Service limité', icon: '🟡' }
    };

    const config = statusConfig[connectionStatus] || statusConfig.offline;

    return (
      <div className={`fixed bottom-4 left-4 ${config.color} text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 z-50 shadow-lg`}>
        <span>{config.icon}</span>
        <span>{config.text}</span>
      </div>
    );
  };

  return (
    <>
      <GlobalErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Router>
              <AppRoutes />
            </Router>
          </AuthProvider>
        </QueryClientProvider>
      </GlobalErrorBoundary>

      {/* Toaster pour les notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1f2937',
            color: '#f3f4f6',
            border: '1px solid #374151',
            fontSize: '14px',
            maxWidth: '500px'
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#ffffff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#ffffff',
            },
          },
        }}
      />

      {renderConnectionStatus()}
    </>
  );
}

export default function App() {
  return <AppContent />;
}
