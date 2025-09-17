// src/pages/login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button-enhanced.jsx';

const Login = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      toast.success('Connexion réussie !');
      if (onClose) onClose();
      navigate('/record-video');
    } catch (err) {
      console.error('Erreur de connexion:', err);
      toast.error(`Erreur de connexion: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 min-h-screen bg-black text-white flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold mb-6">Connexion</h1>
      <form onSubmit={handleLogin} className="w-full max-w-md">
        <div className="mb-4">
          <label className="block text-sm font-medium text-white mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded bg-white/10 text-white"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-white mb-1">Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded bg-white/10 text-white"
            required
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? 'Connexion en cours...' : 'Se connecter'}
        </Button>
        <Button
          onClick={() => navigate('/register')}
          className="ml-4 bg-gray-500 hover:bg-gray-600"
        >
          S'inscrire
        </Button>
      </form>
    </div>
  );
};

export default Login;
