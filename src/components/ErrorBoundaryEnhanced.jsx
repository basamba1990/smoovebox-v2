import React from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from './ui/button-enhanced';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card-enhanced';

class ErrorBoundaryEnhanced extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
      hasError: true
    });

    // Log error to monitoring service if available
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: error.toString(),
        fatal: false
      });
    }
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, retryCount } = this.state;
      const { fallback: Fallback, showDetails = false } = this.props;

      // Use custom fallback if provided
      if (Fallback) {
        return (
          <Fallback 
            error={error} 
            errorInfo={errorInfo}
            retry={this.handleRetry}
            reload={this.handleReload}
            retryCount={retryCount}
          />
        );
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gradient-background flex items-center justify-center p-4">
          <Card className="w-full max-w-lg" variant="elevated">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-error-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-error-600" />
              </div>
              <CardTitle className="text-xl text-error-700">
                Une erreur s'est produite
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <p className="text-center text-muted-foreground">
                Nous nous excusons pour ce désagrément. L'application a rencontré une erreur inattendue.
              </p>

              {showDetails && error && (
                <details className="bg-neutral-50 rounded-lg p-4 text-sm">
                  <summary className="cursor-pointer font-medium text-neutral-700 mb-2">
                    Détails techniques
                  </summary>
                  <div className="space-y-2">
                    <div>
                      <strong>Erreur:</strong>
                      <pre className="mt-1 text-xs bg-white p-2 rounded border overflow-auto">
                        {error.toString()}
                      </pre>
                    </div>
                    {errorInfo && (
                      <div>
                        <strong>Stack trace:</strong>
                        <pre className="mt-1 text-xs bg-white p-2 rounded border overflow-auto max-h-32">
                          {errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button 
                  onClick={this.handleRetry}
                  variant="default"
                  className="flex-1"
                  icon={<RefreshCw className="w-4 h-4" />}
                  disabled={retryCount >= 3}
                >
                  {retryCount >= 3 ? 'Trop de tentatives' : 'Réessayer'}
                </Button>
                
                <Button 
                  onClick={this.handleGoHome}
                  variant="outline"
                  className="flex-1"
                  icon={<Home className="w-4 h-4" />}
                >
                  Accueil
                </Button>
              </div>

              <div className="flex justify-center pt-2">
                <Button 
                  onClick={this.handleReload}
                  variant="ghost"
                  size="sm"
                  icon={<RefreshCw className="w-4 h-4" />}
                >
                  Recharger la page
                </Button>
              </div>

              {process.env.NODE_ENV === 'development' && (
                <div className="text-center pt-4 border-t">
                  <p className="text-xs text-muted-foreground">
                    Mode développement - Erreurs détaillées activées
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook pour gérer les erreurs dans les composants fonctionnels
export const useErrorHandler = () => {
  const [error, setError] = React.useState(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const handleError = React.useCallback((error) => {
    console.error('Error caught by useErrorHandler:', error);
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { handleError, resetError };
};

// Composant d'erreur pour les erreurs de connexion Supabase
export const SupabaseErrorFallback = ({ 
  error, 
  retry, 
  reload,
  onContinueOffline 
}) => (
  <div className="min-h-screen bg-gradient-background flex items-center justify-center p-4">
    <Card className="w-full max-w-md" variant="elevated">
      <CardHeader className="text-center">
        <div className="mx-auto w-16 h-16 bg-warning-100 rounded-full flex items-center justify-center mb-4">
          <Bug className="w-8 h-8 text-warning-600" />
        </div>
        <CardTitle className="text-xl text-warning-700">
          Problème de connexion
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-center text-muted-foreground">
          Impossible de se connecter au serveur. Vérifiez votre connexion internet.
        </p>

        <div className="bg-warning-50 border border-warning-200 rounded-lg p-3">
          <p className="text-sm text-warning-800">
            <strong>Erreur:</strong> {error?.message || 'Connexion échouée'}
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-4">
          <Button 
            onClick={retry}
            variant="default"
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Réessayer la connexion
          </Button>
          
          <Button 
            onClick={reload}
            variant="outline"
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Recharger l'application
          </Button>
        </div>

        <div className="text-center pt-2">
          <p className="text-xs text-muted-foreground">
            Si le problème persiste, contactez le support technique.
          </p>
        </div>
      </CardContent>
    </Card>
  </div>
);

export default ErrorBoundaryEnhanced;

