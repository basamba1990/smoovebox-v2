// src/pages/ResetPassword.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced.jsx';
import { Input } from '../components/ui/input.jsx';
import { Label } from '../components/ui/label.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Eye, EyeOff, Lock, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      setTimeout(() => navigate('/login'), 2500);
      
    } catch (error) {
      console.error('Erreur lors de la réinitialisation du mot de passe:', error);
      const errorMessage = error.message || 'Erreur lors de la réinitialisation du mot de passe';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-[#3d6b66]"
      style={{
        backgroundImage: "url('/Fond-2.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Logo animé en haut à gauche */}
      <div className="absolute top-0 left-0 p-4 z-10 animate-float">
        <img
          src="/Logo-2.png"
          alt="SpotBulle"
          className="w-auto h-24 md:h-32 drop-shadow-2xl"
        />
      </div>

      {/* Décoration de fond */}
      <div className="absolute top-1/2 -left-20 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl animate-pulse" />

      <div className="max-w-md w-full space-y-8 relative z-10">
        <Card className="glass-card border-white/10 shadow-2xl rounded-3xl overflow-hidden animate-in fade-in zoom-in duration-500">
          <CardHeader className="text-center pt-8">
            <div className="mx-auto w-16 h-16 bg-teal-500/20 rounded-2xl flex items-center justify-center mb-4 animate-glow-pulse">
              {success ? (
                <CheckCircle2 className="text-green-400 w-8 h-8" />
              ) : (
                <RefreshCw className="text-teal-400 w-8 h-8" />
              )}
            </div>
            <CardTitle className="text-2xl font-bold text-white tracking-tight">
              Réinitialisation
            </CardTitle>
            <CardDescription className="text-teal-100/70">
              Sécurisez à nouveau votre accès
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            {success ? (
              <div className="p-6 text-sm text-teal-50 bg-teal-500/20 border border-teal-500/30 rounded-2xl text-center animate-in fade-in zoom-in duration-500">
                <p className="text-lg font-semibold mb-2">Succès !</p>
                Votre mot de passe a été mis à jour.<br/>
                Redirection vers la connexion...
              </div>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-teal-50/90 font-medium ml-1">
                    Nouveau mot de passe
                  </Label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400/60 group-focus-within:text-teal-400 transition-colors" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-volt pl-10 pr-10 h-12 rounded-xl"
                      placeholder="••••••••"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-400/40 hover:text-teal-400 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                
                {error && (
                  <div className="text-sm p-3 rounded-xl text-red-200 bg-red-500/20 border border-red-500/30 animate-in slide-in-from-top-2">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-teal-600 hover:bg-teal-500 text-white rounded-xl shadow-lg shadow-teal-900/20 transition-all active:scale-[0.98] font-semibold"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Mise à jour...</span>
                    </div>
                  ) : 'Réinitialiser le mot de passe'}
                </Button>
                
                <div className="text-center pt-2">
                  <Link
                    to="/login"
                    className="text-sm font-bold text-teal-400 hover:text-teal-300 transition-colors"
                  >
                    Retour à la connexion
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
        
        <div className="text-center animate-pulse">
          <p className="text-teal-100/40 text-xs tracking-widest uppercase">
            SpotBulle — Sécurisez votre galaxie
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
