// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Intercepter les erreurs de chargement
window.addEventListener('error', (event) => {
  if (event.target.tagName === 'SCRIPT' || event.target.tagName === 'LINK') {
    console.warn(`⚠️ Ressource non chargée: ${event.target.src || event.target.href}`);
    event.preventDefault();
  }
});

// Désactiver les logs en production
if (import.meta.env.PROD) {
  console.log = () => {};
  console.warn = () => {};
  console.info = () => {};
}

// Création de la racine React avec gestion d'erreur
try {
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    throw new Error('Élément #root introuvable dans le DOM');
  }

  const root = ReactDOM.createRoot(rootElement);
  
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  
} catch (error) {
  // Fallback HTML en cas d'échec critique
  document.body.innerHTML = `
    <div style="
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      color: white;
      font-family: system-ui, -apple-system, sans-serif;
      padding: 20px;
    ">
      <div style="
        max-width: 600px;
        text-align: center;
        background: rgba(30, 41, 59, 0.8);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(100, 116, 139, 0.3);
        border-radius: 16px;
        padding: 40px;
      ">
        <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 16px; color: #f1f5f9;">
          SpotBulle - Plateforme de Pitch Vidéo
        </h1>
        <p style="color: #94a3b8; margin-bottom: 24px;">
          Nous rencontrons des difficultés techniques. L'application sera disponible dans quelques instants.
        </p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button onclick="window.location.reload()" style="
            background: #3b82f6;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 500;
            cursor: pointer;
          ">
            Recharger
          </button>
          <a href="/" style="
            background: #475569;
            color: white;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 500;
          ">
            Retour à l'accueil
          </a>
        </div>
        <p style="color: #64748b; font-size: 14px; margin-top: 32px;">
          Support : support@spotbulle.fr • Tél : +33 6 28 35 34 50
        </p>
      </div>
    </div>
  `;
  
  console.error('❌ Erreur critique React:', error);
}
