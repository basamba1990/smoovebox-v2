// src/components/SupabaseDiagnostic.jsx
import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';

const SupabaseDiagnostic = ({ 
  error, 
  onRetry, 
  onContinue 
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [diagnosticDetails, setDiagnosticDetails] = useState(false);
  
  const handleRetry = async () => {
    if (onRetry) {
      setIsRetrying(true);
      try {
        await onRetry();
      } catch (err) {
        console.error('Erreur lors de la tentative de reconnexion:', err);
      } finally {
        setIsRetrying(false);
      }
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="h-16 w-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          </div>
          
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Problème de connexion détecté
          </h2>
          
          <p className="text-gray-600">
            L'application a rencontré un problème lors de la connexion à la base de données.
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800 font-medium mb-1">Message d'erreur:</p>
            <p className="text-sm text-red-700">{error}</p>
            
            {diagnosticDetails && (
              <div className="mt-3 pt-3 border-t border-red-100">
                <p className="text-xs text-red-600 font-mono whitespace-pre-wrap">
                  {JSON.stringify({
                    timestamp: new Date().toISOString(),
                    userAgent: navigator.userAgent,
                    error: error
                  }, null, 2)}
                </p>
              </div>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-xs text-red-700 hover:text-red-800"
              onClick={() => setDiagnosticDetails(!diagnosticDetails)}
            >
              {diagnosticDetails ? 'Masquer les détails' : 'Afficher les détails techniques'}
            </Button>
          </div>
        )}
        
        <div className="space-y-4">
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleRetry}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Tentative de reconnexion...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Réessayer la connexion
              </>
            )}
          </Button>
          
          <Button 
            variant="outline"
            className="w-full"
            onClick={onContinue}
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            Continuer quand même
          </Button>
          
          <div className="text-center">
            <p className="text-xs text-gray-500 mt-4">
              L'application fonctionnera en mode limité si vous continuez sans connexion à la base de données.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupabaseDiagnostic;
