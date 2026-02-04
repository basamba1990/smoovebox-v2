// src/pages/ResetPassword.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced.jsx';
import { Input } from '../components/ui/input.jsx';
import { Label } from '../components/ui/label.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    
    if (!password || password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const { error } = await supabase.auth.updateUser({ 
        password: password 
      });
      
      if (error) {
        throw error;
      }
      
      setSuccess(true);
      toast.success('Mot de passe modifié avec succès !');
      setTimeout(() => navigate('/login'), 2000);
      
    } catch (error) {
      console.error('Erreur lors de la réinitialisation du mot de passe:', error);
      const errorMessage = error.message || 'Erreur lors de la réinitialisation du mot de passe';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'bg-white/90 border-slate-300 text-slate-800 placeholder:text-slate-500 focus:border-teal-600 focus:ring-teal-500/30';

  return (
    <div 
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
      style={{
        backgroundColor: '#3d6b66',
        backgroundImage: "url('/Fond-2.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Logo en haut à gauche */}
      <div className="absolute top-0 left-0 p-4 z-10">
        <img
          src="/Logo-2.png"
          alt="SpotBulle"
          className="w-auto h-24 md:h-32"
        />
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        <Card className="bg-white/95 border border-slate-200 shadow-2xl backdrop-blur-sm rounded-3xl overflow-hidden">
          <CardHeader className="text-center pt-8">
            <CardTitle className="text-2xl font-bold text-slate-800">
              Réinitialisation
            </CardTitle>
            <CardDescription className="text-slate-600">
              Choisissez un nouveau mot de passe pour votre compte
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            {success ? (
              <div className="p-4 text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl text-center animate-in fade-in zoom-in">
                <div className="text-4xl mb-2">✅</div>
                Mot de passe modifié avec succès !<br/>
                Vous allez être redirigé vers la page de connexion...
              </div>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-800 font-medium">
                    Nouveau mot de passe
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    placeholder="••••••••"
                    minLength={6}
                  />
                </div>
                
                {error && (
                  <div className="text-sm p-3 rounded-xl text-red-600 bg-red-50 border border-red-100 animate-in fade-in slide-in-from-top-1">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-lg transition-all active:scale-[0.98]"
                >
                  {loading ? 'Chargement...' : 'Réinitialiser le mot de passe'}
                </Button>
                
                <div className="text-center pt-2">
                  <Link
                    to="/login"
                    className="text-sm font-semibold text-teal-700 hover:text-teal-900 hover:underline"
                  >
                    Retour à la connexion
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
        
        <div className="text-center">
          <p className="text-white/60 text-xs">
            SpotBulle — Sécurisez votre accès à la galaxie
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
