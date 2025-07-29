import React from 'react';
import { AlertCircle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from './ui/button.jsx';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Générer un ID unique pour l'erreur
    const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    this.setState({
      error: error,
      errorInfo: errorInfo,
      errorId: errorId
    });
    
    // Log détaillé de l'erreur pour le débogage
    console.group('🚨 ErrorBoundary - Erreur capturée');
    console.error('ID d\'erreur:', errorId);
    console.error('Erreur:', error);
    console.error('Stack trace:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
    console.error('Props:', this.props);
    console.groupEnd();

    // Envoyer l'erreur à un service de monitoring (optionnel)
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: error.toString(),
        fatal: true,
        error_id: errorId
      });
    }
  }

  handleReload = () => {
    console.log('Rechargement de la page demandé par l\'utilisateur');
    window.location.reload();
  };

  handleGoHome = () => {
    console.log('Retour à l\'accueil demandé par l\'utilisateur');
    window.location.href = '/';
  };

  handleReportError = () => {
    const errorReport = {
      errorId: this.state.errorId,
      error: this.state.error?.toString(),
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString()
    };

    // Copier le rapport d'erreur dans le presse-papiers
    if (navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2))
        .then(() => {
          alert('Rapport d\'erreur copié dans le presse-papiers. Vous pouvez le coller dans un email au support.');
        })
        .catch(() => {
          console.error('Impossible de copier le rapport d\'erreur');
        });
    }
  };

  render() {
    if (this.state.hasError) {
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50">
          <div className="max-w-2xl w-full bg-white rounded-xl shadow-2xl p-8 text-center border border-red-100">
            <div className="mb-6">
              <div className="relative mx-auto w-20 h-20 mb-4">
                <div className="absolute inset-0 bg-red-100 rounded-full animate-pulse"></div>
                <AlertCircle className="relative h-20 w-20 text-red-500 mx-auto animate-bounce" />
              </div>
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Oups ! Une erreur s'est produite
            </h1>
            
            <p className="text-gray-600 mb-6 leading-relaxed">
              L'application a rencontré une erreur inattendue. 
              Veuillez recharger la page ou contacter le support si le problème persiste.
            </p>

            {this.state.errorId && (
              <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>ID d'erreur :</strong> <code className="bg-gray-200 px-2 py-1 rounded text-xs">{this.state.errorId}</code>
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Conservez cet ID pour le support technique
                </p>
              </div>
            )}
            
            {isDevelopment && this.state.error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-left">
                <h3 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">
                  <Bug className="h-4 w-4" />
                  Détails de l'erreur (mode développement)
                </h3>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-medium text-red-700 mb-1">Message :</h4>
                    <pre className="text-xs text-red-600 bg-red-100 p-2 rounded overflow-auto">
                      {this.state.error.toString()}
                    </pre>
                  </div>
                  {this.state.error.stack && (
                    <div>
                      <h4 className="text-xs font-medium text-red-700 mb-1">Stack trace :</h4>
                      <pre className="text-xs text-red-600 bg-red-100 p-2 rounded overflow-auto max-h-32">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                  {this.state.errorInfo?.componentStack && (
                    <div>
                      <h4 className="text-xs font-medium text-red-700 mb-1">Component stack :</h4>
                      <pre className="text-xs text-red-600 bg-red-100 p-2 rounded overflow-auto max-h-32">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <Button 
                onClick={this.handleReload}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Recharger la page
              </Button>
              
              <Button 
                variant="outline"
                onClick={this.handleGoHome}
                className="w-full border-gray-300 hover:bg-gray-50"
              >
                <Home className="h-4 w-4 mr-2" />
                Retour à l'accueil
              </Button>
            </div>

            {this.state.errorId && (
              <Button 
                variant="ghost"
                size="sm"
                onClick={this.handleReportError}
                className="text-gray-500 hover:text-gray-700"
              >
                <Bug className="h-4 w-4 mr-2" />
                Copier le rapport d'erreur
              </Button>
            )}

            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-400">
                Si le problème persiste, contactez le support avec l'ID d'erreur ci-dessus
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

