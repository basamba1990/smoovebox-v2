import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Database, CheckCircle, AlertTriangle, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { debugStoragePermissions, supabase } from '../lib/supabase.js';

const DatabaseSetup = ({ onSetupComplete }) => {
  const [diagnostics, setDiagnostics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [setupStep, setSetupStep] = useState('diagnosis');
  const [sqlScript, setSqlScript] = useState('');

  useEffect(() => {
    runDiagnostics();
    loadSqlScript();
  }, []);

  const loadSqlScript = async () => {
    try {
      const response = await fetch('/database-setup.sql');
      const script = await response.text();
      setSqlScript(script);
    } catch (error) {
      console.error('Erreur lors du chargement du script SQL:', error);
    }
  };

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const results = await debugStoragePermissions();
      setDiagnostics(results);
      
      // Vérifier si tout est configuré correctement
      if (results.auth?.success && results.buckets?.hasVideosBucket && results.testUpload?.success) {
        setSetupStep('complete');
      } else {
        setSetupStep('setup-needed');
      }
    } catch (error) {
      console.error('Erreur lors du diagnostic:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const createBucket = async () => {
    try {
      const { data, error } = await supabase.storage.createBucket('videos', {
        public: true,
        allowedMimeTypes: ['video/*'],
        fileSizeLimit: 104857600 // 100MB
      });
      
      if (error) {
        console.error('Erreur lors de la création du bucket:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Exception lors de la création du bucket:', error);
      return false;
    }
  };

  const testDatabaseTables = async () => {
    try {
      // Tester l'existence des tables
      const tables = ['profiles', 'videos', 'transcriptions'];
      const results = {};
      
      for (const table of tables) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('count')
            .limit(1);
          
          results[table] = !error || error.code !== 'PGRST116';
        } catch (err) {
          results[table] = false;
        }
      }
      
      return results;
    } catch (error) {
      console.error('Erreur lors du test des tables:', error);
      return {};
    }
  };

  const DiagnosticItem = ({ title, status, details, action }) => (
    <div className="flex items-start gap-3 p-4 border rounded-lg">
      <div className="flex-shrink-0 mt-1">
        {status === 'success' ? (
          <CheckCircle className="h-5 w-5 text-green-600" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-red-600" />
        )}
      </div>
      <div className="flex-1">
        <h4 className="font-medium text-sm">{title}</h4>
        <p className="text-xs text-gray-600 mt-1">{details}</p>
        {action && (
          <div className="mt-2">
            {action}
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <Database className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-pulse" />
          <h2 className="text-xl font-bold mb-2">Diagnostic en cours...</h2>
          <p className="text-gray-600">Vérification de la configuration de la base de données</p>
        </div>
      </div>
    );
  }

  if (setupStep === 'complete') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-green-800 mb-2">Configuration complète !</h2>
          <p className="text-gray-600 mb-6">
            Votre base de données est correctement configurée et prête à l'emploi.
          </p>
          <Button onClick={onSetupComplete} size="lg">
            Continuer vers l'application
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <Database className="h-16 w-16 text-blue-600 mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-2">Configuration de la base de données</h1>
        <p className="text-gray-600">
          Votre application nécessite une configuration initiale de la base de données Supabase.
        </p>
      </div>

      {/* Résultats du diagnostic */}
      {diagnostics && (
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Diagnostic de configuration</h3>
            <Button variant="outline" size="sm" onClick={runDiagnostics}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          </div>
          
          <div className="space-y-3">
            <DiagnosticItem
              title="Variables d'environnement"
              status={diagnostics.environment?.supabaseUrl && diagnostics.environment?.supabaseKey ? 'success' : 'error'}
              details={
                diagnostics.environment?.supabaseUrl && diagnostics.environment?.supabaseKey
                  ? 'Les variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont configurées'
                  : 'Variables d\'environnement manquantes ou incorrectes'
              }
            />
            
            <DiagnosticItem
              title="Authentification Supabase"
              status={diagnostics.auth?.success ? 'success' : 'error'}
              details={
                diagnostics.auth?.success
                  ? `Connexion réussie (Utilisateur: ${diagnostics.auth.user?.email || 'Anonyme'})`
                  : `Erreur d'authentification: ${diagnostics.auth?.error || 'Inconnue'}`
              }
            />
            
            <DiagnosticItem
              title="Bucket de stockage 'videos'"
              status={diagnostics.buckets?.hasVideosBucket ? 'success' : 'error'}
              details={
                diagnostics.buckets?.hasVideosBucket
                  ? 'Le bucket videos existe et est accessible'
                  : 'Le bucket videos n\'existe pas ou n\'est pas accessible'
              }
              action={
                !diagnostics.buckets?.hasVideosBucket && (
                  <Button size="sm" variant="outline" onClick={createBucket}>
                    Créer le bucket
                  </Button>
                )
              }
            />
            
            <DiagnosticItem
              title="Test d'upload"
              status={diagnostics.testUpload?.success ? 'success' : 'error'}
              details={
                diagnostics.testUpload?.success
                  ? 'Upload de test réussi'
                  : `Échec de l'upload: ${diagnostics.testUpload?.error || 'Erreur inconnue'}`
              }
            />
            
            <DiagnosticItem
              title="Service OpenAI"
              status={diagnostics.openai?.available ? 'success' : 'error'}
              details={
                diagnostics.openai?.available
                  ? 'Service d\'analyse IA disponible'
                  : `Service IA indisponible: ${diagnostics.openai?.error || 'Configuration manquante'}`
              }
            />
          </div>
        </div>
      )}

      {/* Instructions de configuration */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-yellow-800 mb-4">
          Étapes de configuration requises
        </h3>
        
        <div className="space-y-4 text-sm">
          <div>
            <h4 className="font-medium text-yellow-800 mb-2">1. Créer les tables de base de données</h4>
            <p className="text-yellow-700 mb-3">
              Exécutez le script SQL suivant dans l'éditeur SQL de votre projet Supabase :
            </p>
            <div className="bg-white p-4 rounded border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-gray-600">database-setup.sql</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(sqlScript)}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copier
                </Button>
              </div>
              <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto max-h-40">
                {sqlScript || 'Chargement du script...'}
              </pre>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-yellow-800 mb-2">2. Créer le bucket de stockage</h4>
            <p className="text-yellow-700 mb-2">
              Dans la section Storage de Supabase, créez un bucket nommé "videos" avec les paramètres :
            </p>
            <ul className="text-yellow-700 text-xs space-y-1 ml-4">
              <li>• Public : Oui</li>
              <li>• Types de fichiers : video/*</li>
              <li>• Taille max : 100MB</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium text-yellow-800 mb-2">3. Configurer les politiques RLS</h4>
            <p className="text-yellow-700">
              Les politiques Row Level Security sont incluses dans le script SQL ci-dessus.
            </p>
          </div>
        </div>
        
        <div className="mt-6 flex gap-3">
          <Button
            onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
            variant="outline"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Ouvrir Supabase Dashboard
          </Button>
          <Button onClick={runDiagnostics}>
            Tester la configuration
          </Button>
        </div>
      </div>

      {/* Mode dégradé */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">
          Mode dégradé disponible
        </h3>
        <p className="text-blue-700 mb-4">
          Vous pouvez utiliser l'application en mode limité pendant la configuration. 
          Certaines fonctionnalités seront désactivées.
        </p>
        <Button variant="outline" onClick={onSetupComplete}>
          Continuer en mode dégradé
        </Button>
      </div>
    </div>
  );
};

export default DatabaseSetup;

