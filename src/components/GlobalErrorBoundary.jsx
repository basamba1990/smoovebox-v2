// src/components/GlobalErrorBoundary.jsx
import React from 'react';
import { AlertTriangle, RefreshCw, Home, Mail, ExternalLink } from 'lucide-react';

/**
 * ErrorBoundary global pour capturer TOUTES les erreurs React
 * Évite les pages blanches et propose des actions de récupération
 */
export default class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error) {
    // Met à jour l'état pour afficher l'UI de fallback
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log l'erreur (dans un service de monitoring en production)
    console.error('🚨 ERREUR GLOBALE React:', error);
    console.error('📋 Stack trace:', errorInfo.componentStack);
    
    this.setState({ errorInfo });
    
    // Envoyer à un service de monitoring (ex: Sentry)
    this._logToMonitoringService(error, errorInfo);
  }

  _logToMonitoringService(error, errorInfo) {
    // Exemple: envoi à un endpoint d'erreurs
    if (import.meta.env.PROD) {
      try {
        fetch('/api/log-error', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: error.toString(),
            stack: error.stack,
            componentStack: errorInfo?.componentStack,
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
          })
        }).catch(() => {}); // Silent fail pour ne pas créer de boucle d'erreur
      } catch (e) {
        // Ne rien faire
      }
    }
  }

  handleReset = () => {
    // Réinitialise l'état et recharge la page
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleContactSupport = () => {
    window.location.href = 'mailto:support@spotbulle.fr?subject=Erreur%20Application&body=Bonjour,%0D%0A%0D%0AJ\'ai rencontré une erreur sur SpotBulle.%0D%0AURL:%20' + encodeURIComponent(window.location.href);
  };

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4 md:p-8">
          <div className="max-w-2xl w-full bg-gray-800/80 backdrop-blur-lg border border-red-500/20 rounded-2xl p-6 md:p-8 shadow-2xl">
            
            {/* Icône et titre */}
            <div className="text-center mb-8">
              <div className="relative inline-block">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-10 h-10 text-red-400" />
                </div>
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold">!</span>
                </div>
              </div>
              
              <h1 className="text-3xl font-bold text-white mb-2">
                Oups ! Une erreur est survenue
              </h1>
              <p className="text-gray-400">
                L'application a rencontré un problème inattendu
              </p>
            </div>

            {/* Message utilisateur */}
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-5 mb-6">
              <p className="text-gray-300 text-center mb-4">
                Nous sommes désolés pour ce désagrément. Notre équipe technique a été automatiquement notifiée.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-800/50 p-3 rounded-lg">
                  <p className="text-sm text-gray-400 mb-1">Code erreur</p>
                  <p className="text-red-300 font-mono text-sm">
                    {this.state.error?.name || 'UNKNOWN_ERROR'}
                  </p>
                </div>
                <div className="bg-gray-800/50 p-3 rounded-lg">
                  <p className="text-sm text-gray-400 mb-1">Heure</p>
                  <p className="text-gray-300 text-sm">
                    {new Date().toLocaleTimeString('fr-FR')}
                  </p>
                </div>
              </div>

              {/* Bouton détails techniques */}
              <button
                onClick={this.toggleDetails}
                className="w-full text-sm text-gray-400 hover:text-gray-300 flex items-center justify-center gap-2 py-2"
              >
                {this.state.showDetails ? 'Masquer les détails' : 'Afficher les détails techniques'}
                <svg className={`w-4 h-4 transition-transform ${this.state.showDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Détails techniques (dépliable) */}
              {this.state.showDetails && (
                <div className="mt-4 p-4 bg-black/30 rounded-lg border border-gray-700">
                  <p className="text-sm text-gray-400 mb-2 font-semibold">Détails techniques :</p>
                  <div className="font-mono text-xs text-red-300 bg-black/50 p-3 rounded overflow-x-auto">
                    <p>{this.state.error?.toString() || 'Erreur inconnue'}</p>
                    {this.state.error?.message && (
                      <p className="mt-2 text-orange-300">{this.state.error.message}</p>
                    )}
                    {this.state.errorInfo?.componentStack && (
                      <div className="mt-3 pt-3 border-t border-gray-800">
                        <p className="text-gray-500 text-xs mb-1">Stack trace :</p>
                        <pre className="text-gray-400 text-xs whitespace-pre-wrap">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs mt-3">
                    Ces informations peuvent être utiles à notre équipe de support.
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <button
                onClick={this.handleReset}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all hover:scale-[1.02]"
              >
                <RefreshCw className="w-5 h-5" />
                <span>Recharger l'application</span>
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all hover:scale-[1.02]"
              >
                <Home className="w-5 h-5" />
                <span>Retour à l'accueil</span>
              </button>
              
              <button
                onClick={this.handleContactSupport}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 px-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all hover:scale-[1.02]"
              >
                <Mail className="w-5 h-5" />
                <span>Contacter le support</span>
              </button>
            </div>

            {/* Informations utiles */}
            <div className="border-t border-gray-700 pt-6">
              <p className="text-gray-500 text-sm text-center mb-4">
                Si le problème persiste, vous pouvez :
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <a
                  href="https://status.spotbulle.fr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-gray-900/30 hover:bg-gray-900/50 rounded-lg border border-gray-700 transition-colors"
                >
                  <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <ExternalLink className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white">Vérifier le statut du service</p>
                    <p className="text-xs text-gray-500">Voir si des problèmes sont connus</p>
                  </div>
                </a>
                
                <a
                  href="https://docs.spotbulle.fr/troubleshooting"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-gray-900/30 hover:bg-gray-900/50 rounded-lg border border-gray-700 transition-colors"
                >
                  <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white">Guide de dépannage</p>
                    <p className="text-xs text-gray-500">Solutions aux problèmes courants</p>
                  </div>
                </a>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-gray-800">
              <p className="text-gray-600 text-sm text-center">
                SpotBulle v{import.meta.env.VITE_APP_VERSION || '2.0.0'} • Support technique disponible 7j/7
              </p>
              <p className="text-gray-700 text-xs text-center mt-2">
                ID de session : {Math.random().toString(36).substring(2, 10).toUpperCase()}
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Pas d'erreur, rend les enfants normalement
    return this.props.children;
  }
}

// Composant de test pour vérifier l'ErrorBoundary
export const ErrorTestButton = () => {
  const throwError = () => {
    throw new Error('Test ErrorBoundary - Cette erreur est intentionnelle');
  };

  return (
    <button
      onClick={throwError}
      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
    >
      Tester l'ErrorBoundary
    </button>
  );
};
