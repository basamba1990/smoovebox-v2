// src/pages/login.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced.jsx';
import { Input } from '../components/ui/input.jsx';
import { Label } from '../components/ui/label.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { checkCompanyMembershipAndRedirect } from '../utils/companyRedirect.js';
import { Eye, EyeOff, Mail, Lock, LogIn, Loader2 } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!email || !password) {
      setError('Veuillez remplir tous les champs');
      setLoading(false);
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success('Connexion réussie !');
      
      const isCompanyUser = await checkCompanyMembershipAndRedirect(navigate);
      if (!isCompanyUser) {
        navigate('/');
      }
    } catch (err) {
      console.error('Erreur lors de la connexion:', err);
      const errorMessage = err.message || 'Une erreur s\'est produite lors de la connexion';
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

      {/* Décoration de fond (VoltFlow style) */}
      <div className="absolute top-1/4 -left-20 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 -right-20 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />

      <div className="max-w-md w-full space-y-8 relative z-10">
        <Card className="glass-card border-white/10 shadow-2xl rounded-3xl overflow-hidden animate-in fade-in zoom-in duration-500">
          <CardHeader className="text-center pt-8">
            <div className="mx-auto w-16 h-16 bg-teal-500/20 rounded-2xl flex items-center justify-center mb-4 animate-glow-pulse">
              <LogIn className="text-teal-400 w-8 h-8" />
            </div>
            <CardTitle className="text-3xl font-bold text-white tracking-tight">Connexion</CardTitle>
            <CardDescription className="text-teal-100/70">
              Accédez à votre Odyssée SpotBulle
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-teal-50/90 font-medium ml-1">
                  Email
                </Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400/60 group-focus-within:text-teal-400 transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-volt pl-10 h-12 rounded-xl"
                    placeholder="nom@exemple.com"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <Label htmlFor="password" className="text-teal-50/90 font-medium">
                    Mot de passe
                  </Label>
                  <Link
                    to="/reset-password"
                    className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
                  >
                    Oublié ?
                  </Link>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400/60 group-focus-within:text-teal-400 transition-colors" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-volt pl-10 pr-10 h-12 rounded-xl"
                    placeholder="••••••••"
                    required
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
                className="w-full h-12 bg-teal-600 hover:bg-teal-500 text-white rounded-xl shadow-lg shadow-teal-900/20 transition-all active:scale-[0.98] font-semibold text-lg" 
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Connexion...</span>
                  </div>
                ) : 'Se connecter'}
              </Button>

              <div className="text-center pt-2">
                <p className="text-sm text-teal-100/60">
                  Pas encore de compte ?{' '}
                  <Link
                    to="/register"
                    className="font-bold text-teal-400 hover:text-teal-300 transition-colors"
                  >
                    Inscrivez-vous
                  </Link>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
        
        <div className="text-center animate-pulse">
          <p className="text-teal-100/40 text-xs tracking-widest uppercase">
            SpotBulle — Explorez vos talents
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
