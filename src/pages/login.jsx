// src/pages/login.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced.jsx';
import { Input } from '../components/ui/input.jsx';
import { Label } from '../components/ui/label.jsx';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

      console.log('Connexion réussie:', data.user);
      toast.success('Connexion réussie !');
      navigate('/record-video');
    } catch (err) {
      console.error('Erreur lors de la connexion:', err);
      const errorMessage = err.message || 'Une erreur s\'est produite lors de la connexion';
      setError(errorMessage);
      toast.error(errorMessage);
      if (errorMessage.includes('Email ou mot de passe incorrect')) {
        setTimeout(() => {
          setError(errorMessage + ' - Vous pouvez créer un compte en vous inscrivant.');
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Connexion à SpotBulle</h2>
          <p className="mt-2 text-sm text-gray-600">Accédez à votre espace personnel</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <Label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Mot de passe
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1"
              required
              minLength={6}
            />
          </div>
          {error && (
            <div className="text-sm p-3 rounded-md text-red-500 bg-red-50 border border-red-200">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Connexion en cours...' : 'Se connecter'}
          </Button>
          <div className="text-center">
            <Link
              to="/register"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Pas de compte ? Inscrivez-vous
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
