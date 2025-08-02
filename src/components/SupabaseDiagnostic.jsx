// src/components/SupabaseDiagnostic.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const SupabaseDiagnostic = () => {
  const [diagnosticResults, setDiagnosticResults] = useState({
    connectionStatus: 'checking',
    authStatus: 'checking',
    storageStatus: 'checking',
    databaseStatus: 'checking',
    errors: []
  });
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const runDiagnostics = async () => {
      const results = {
        connectionStatus: 'checking',
        authStatus: 'checking',
        storageStatus: 'checking',
        databaseStatus: 'checking',
        errors: []
      };

      // Vérifier la connexion de base
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          results.connectionStatus = 'error';
          results.errors.push(`Erreur de connexion: ${error.message}`);
        } else {
          results.connectionStatus = 'success';
        }
      } catch (error) {
        results.connectionStatus = 'error';
        results.errors.push(`Exception de connexion: ${error.message}`);
      }

      // Vérifier l'authentification
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          results.authStatus = 'error';
          results.errors.push(`Erreur d'authentification: ${error.message}`);
        } else {
          results.authStatus = data.user ? 'authenticated' : 'unauthenticated';
        }
      } catch (error) {
        results.authStatus = 'error';
        results.errors.push(`Exception d'authentification: ${error.message}`);
      }

      // Vérifier le stockage
      try {
        const { data, error } = await supabase.storage.getBucket('videos');
        if (error) {
          results.storageStatus = 'error';
          results.errors.push(`Erreur de stockage: ${error.message}`);
        } else {
          results.storageStatus = 'success';
        }
      } catch (error) {
        results.storageStatus = 'error';
        results.errors.push(`Exception de stockage: ${error.message}`);
      }

      // Vérifier la base de données
      try {
        const { data, error } = await supabase.from('profiles').select('count').limit(1);
        if (error) {
          results.databaseStatus = 'error';
          results.errors.push(`Erreur de base de données: ${error.message}`);
        } else {
          results.databaseStatus = 'success';
        }
      } catch (error) {
        results.databaseStatus = 'error';
        results.errors.push(`Exception de base de données: ${error.message}`);
      }

      setDiagnosticResults(results);
    };

    runDiagnostics();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'success':
      case 'authenticated':
      case 'unauthenticated':
        return 'green';
      case 'error':
        return 'red';
      default:
        return 'orange';
    }
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '15px',
      borderRadius: '5px',
      zIndex: 9999,
      maxWidth: '400px',
      maxHeight: '80vh',
      overflow: 'auto'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <h3 style={{ margin: 0 }}>Diagnostic Supabase</h3>
        <button 
          onClick={() => setIsVisible(false)}
          style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>
      
      <div>
        <p>
          <strong>Connexion:</strong> 
          <span style={{ color: getStatusColor(diagnosticResults.connectionStatus) }}>
            {diagnosticResults.connectionStatus}
          </span>
        </p>
        <p>
          <strong>Authentification:</strong> 
          <span style={{ color: getStatusColor(diagnosticResults.authStatus) }}>
            {diagnosticResults.authStatus}
          </span>
        </p>
        <p>
          <strong>Stockage:</strong> 
          <span style={{ color: getStatusColor(diagnosticResults.storageStatus) }}>
            {diagnosticResults.storageStatus}
          </span>
        </p>
        <p>
          <strong>Base de données:</strong> 
          <span style={{ color: getStatusColor(diagnosticResults.databaseStatus) }}>
            {diagnosticResults.databaseStatus}
          </span>
        </p>
      </div>
      
      {diagnosticResults.errors.length > 0 && (
        <div>
          <h4>Erreurs:</h4>
          <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
            {diagnosticResults.errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      
      <div style={{ marginTop: '10px' }}>
        <p><strong>URL Supabase:</strong> {import.meta.env.VITE_SUPABASE_URL || 'Non définie'}</p>
        <p><strong>Clé Anon:</strong> {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✓ Définie' : '✗ Non définie'}</p>
      </div>
      
      <button 
        onClick={() => window.location.reload()}
        style={{
          marginTop: '10px',
          padding: '5px 10px',
          backgroundColor: '#4a4a4a',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Rafraîchir
      </button>
    </div>
  );
};

export default SupabaseDiagnostic;
