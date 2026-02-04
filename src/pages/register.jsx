// src/pages/register.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced.jsx';
import { Input } from '../components/ui/input.jsx';
import { Label } from '../components/ui/label.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';

const Register = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!email || !password || !firstName || !lastName) {
      setError('Veuillez remplir tous les champs');
      setLoading(false);
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    try {
      await signUp(email.trim(), password, firstName.trim(), lastName.trim());
      toast.success('Inscription réussie ! Vérifiez votre email.');
      navigate('/login');
    } catch (err) {
      console.error('Erreur lors de l\'inscription:', err);
      const errorMessage = err.message || 'Une erreur s\'est produite lors de l\'inscription';
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
            <CardTitle className="text-3xl font-bold text-slate-800">Inscription</CardTitle>
            <CardDescription className="text-slate-600">
              Rejoignez l'aventure SpotBulle
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <form onSubmit={handleRegister} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-slate-800 font-medium">
                    Prénom
                  </Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass}
                    placeholder="Prénom"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-slate-800 font-medium">
                    Nom
                  </Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputClass}
                    placeholder="Nom"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-800 font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="votre@email.com"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-800 font-medium">
                  Mot de passe
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                  required
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
                className="w-full h-12 bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-lg transition-all active:scale-[0.98]" 
                disabled={loading}
              >
                {loading ? 'Création en cours...' : 'Créer mon compte'}
              </Button>

              <div className="text-center pt-2">
                <p className="text-sm text-slate-600">
                  Déjà un compte ?{' '}
                  <Link
                    to="/login"
                    className="font-semibold text-teal-700 hover:text-teal-900 hover:underline"
                  >
                    Connectez-vous
                  </Link>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
        
        <div className="text-center">
          <p className="text-white/60 text-xs">
            SpotBulle — Explorez vos talents, tracez votre futur
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
