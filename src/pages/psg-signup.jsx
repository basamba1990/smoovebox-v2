import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Label } from '../components/ui/label.jsx';

// PSG color refs (navy/red/white)
// Navy: #0A122A  | Red: #DA291C

export const PsgSignup = () => {
  const navigate = useNavigate();
  const { signUp, loading } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !password) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    try {
      setSubmitting(true);
      await signUp(email.trim(), password, firstName.trim(), lastName.trim());
      toast.success('Inscription réussie ! Vérifiez votre email.');
      navigate('/');
    } catch (err) {
      toast.error(err.message || "Une erreur s'est produite");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0A122A] via-[#0A122A] to-[#151B34] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Liseré doré */}
        <div className="p-[2px] rounded-3xl border-[#C9A227] border shadow-2xl">
          {/* Card */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#0A122A]/70">
          {/* Top accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-[#DA291C] via-white to-[#0A122A]" />

          {/* Header */}
          <div className="px-8 pt-8 pb-4 text-center">
            <div className="mx-auto mb-4 flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#DA291C] shadow-md" />
              <img src="/logo.png" alt="SpotBulle" className="h-10 w-auto opacity-90" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Rejoindre la Communauté PSG</h1>
            <p className="mt-2 text-sm text-gray-300">Créez votre compte pour accéder aux expériences dédiées aux supporters.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 pb-8 pt-2 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid grid-cols-4 items-center gap-2">
                <Label htmlFor="firstName" className="col-span-4 md:col-span-4 text-gray-200">Prénom</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Prénom"
                  className="col-span-4 bg-white/90 focus:bg-white"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-2">
                <Label htmlFor="lastName" className="col-span-4 md:col-span-4 text-gray-200">Nom</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Nom"
                  className="col-span-4 bg-white/90 focus:bg-white"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-2">
              <Label htmlFor="email" className="col-span-4 text-gray-200">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                className="col-span-4 bg-white/90 focus:bg-white"
                required
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-2">
              <Label htmlFor="password" className="col-span-4 text-gray-200">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="col-span-4 bg-white/90 focus:bg-white"
                minLength={6}
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading || submitting}
              className="w-full h-11 bg-[#DA291C] hover:bg-[#c32518] text-white border-0 shadow-lg"
            >
              {loading || submitting ? 'Création du compte…' : 'Créer mon compte PSG'}
            </Button>

            <div className="text-center text-sm text-gray-300">
              <span>Déjà un compte ? </span>
              <button
                type="button"
                onClick={() => navigate('/psg-signin')}
                className="text-white underline decoration-[#DA291C]/60 underline-offset-4 hover:decoration-[#DA291C]"
              >
                Se connecter
              </button>
            </div>
          </form>
          </div>
        </div>

        {/* Footer tagline */}
        <div className="text-center mt-6 text-gray-300 text-xs">
          <p>SpotBulle x PSG — Passion, Communauté, Performance</p>
        </div>
      </div>
    </div>
  );
};
