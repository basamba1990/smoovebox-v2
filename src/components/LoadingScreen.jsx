// src/components/LoadingScreen.jsx
import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from './ui/button';

const LoadingScreen = ({ 
  message = "Chargement...", 
  showReloadButton = false,
  timeout = 30000,
  onCancel = null
}) => {
  const [showTimeout, setShowTimeout] = useState(false);
  
  useEffect(() => {
    // Afficher un message après un certain temps si le chargement prend trop longtemps
    const timeoutId = setTimeout(() => {
      setShowTimeout(true);
    }, timeout);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [timeout]);
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] py-16">
      <div className="relative mx-auto w-16 h-16 mb-6">
        <div className="absolute inset-0 rounded-full border-4 border-blue-200"></div>
        <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
      </div>
      
      <p className="text-gray-700 font-medium text-lg">{message}</p>
      
      {showTimeout && (
        <div className="mt-6 space-y-3">
          <p className="text-amber-600 text-sm">
            Le chargement prend plus de temps que prévu.
          </p>
          
          <div className="flex gap-3 justify-center">
            {showReloadButton && (
              <Button 
                variant="default" 
                size="sm"
                onClick={() => window.location.reload()}
              >
                Recharger la page
              </Button>
            )}
            
            {onCancel && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={onCancel}
              >
                Annuler
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoadingScreen;
