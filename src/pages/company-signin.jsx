import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Label } from '../components/ui/label.jsx';

export const CompanySignin = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [company, setCompany] = useState(null);

  // Get company from URL param if provided (e.g., /company-signin?company=psg)
  const companyParam = searchParams.get('company');

  // Fetch company info if param provided
  useEffect(() => {
    const fetchCompany = async () => {
      if (!companyParam) return;

      try {
        const { data, error } = await supabase
          .from('companies')
          .select('id, name, logo')
          .ilike('name', companyParam)
          .maybeSingle();

        if (error) throw error;
        if (data) setCompany(data);
      } catch (err) {
        console.error('Error fetching company:', err);
      }
    };

    fetchCompany();
  }, [companyParam]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    try {
      setSubmitting(true);
      await signIn(email.trim(), password);

      // Check if user belongs to a company
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non trouvé');
      }

      const { data: membership } = await supabase
        .from('user_companies')
        .select('company_id, companies(name)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (membership) {
        toast.success('Connexion réussie');
        navigate('/company-record');
      } else {
        // User is not a company user, redirect to normal home
        toast.success('Connexion réussie');
        navigate('/');
      }
    } catch (err) {
      toast.error(err.message || 'Email ou mot de passe incorrect');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="p-[2px] rounded-3xl border-slate-600 border shadow-2xl">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-slate-900/70">
            <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600" />

            <div className="px-8 pt-8 pb-4 text-center relative">
              <button
                onClick={() => navigate('/')}
                className="absolute left-8 top-8 text-gray-400 hover:text-white transition-colors"
                aria-label="Retour"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </button>
              <div className="mx-auto mb-4 flex items-center justify-center gap-3">
                {company?.logo ? (
                  <img
                    src={company.logo}
                    alt={company.name}
                    className="h-12 w-auto rounded-lg"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 shadow-md" />
                )}
                <img
                  src="/logo.png"
                  alt="SpotBulle"
                  className="h-10 w-auto opacity-90"
                />
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                {company ? `Connexion ${company.name}` : 'Connexion Entreprise'}
              </h1>
              <p className="mt-2 text-sm text-gray-300">
                Accédez à l'enregistrement vidéo.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="px-8 pb-8 pt-2 space-y-5">
              <div className="grid grid-cols-4 items-center gap-2">
                <Label htmlFor="email" className="col-span-4 text-gray-200">
                  Email
                </Label>
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
                <Label htmlFor="password" className="col-span-4 text-gray-200">
                  Mot de passe
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="col-span-4 bg-white/90 focus:bg-white"
                  required
                  minLength={6}
                />
              </div>

              <Button
                type="submit"
                disabled={loading || submitting}
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 shadow-lg"
              >
                {loading || submitting ? 'Connexion…' : 'Se connecter'}
              </Button>

              <div className="text-center text-sm text-gray-300">
                <span>Nouveau ? </span>
                <button
                  type="button"
                  onClick={() => navigate('/company-signup' + (companyParam ? `?company=${companyParam}` : ''))}
                  className="text-white underline decoration-blue-400/60 underline-offset-4 hover:decoration-blue-400"
                >
                  Créer un compte
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="text-center mt-6 text-gray-300 text-xs">
          <p>SpotBulle — Enregistrement vidéo pour entreprises</p>
        </div>
      </div>
    </div>
  );
};

