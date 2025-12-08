import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Label } from '../components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select.jsx';

export const CompanySignup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Get company from URL param if provided (e.g., /company-signup?company=psg)
  const companyParam = searchParams.get('company');

  // Fetch companies
  useEffect(() => {
    let mounted = true;
    
    const fetchCompanies = async () => {
      if (!mounted) return;
      
      try {
        setLoadingCompanies(true);
        console.log('[CompanySignup] Starting to fetch companies...');
        console.log('[CompanySignup] Supabase client:', supabase ? 'Available' : 'Missing');
        
        const { data, error } = await supabase
          .from('companies')
          .select('id, name, logo')
          .order('name');

        console.log('[CompanySignup] Query completed. Data:', data, 'Error:', error);

        if (!mounted) return;

        if (error) {
          console.error('[CompanySignup] Supabase error:', error);
          console.error('[CompanySignup] Error code:', error.code);
          console.error('[CompanySignup] Error message:', error.message);
          toast.error(`Erreur: ${error.message || 'Impossible de charger les entreprises'}`);
          setCompanies([]);
          setLoadingCompanies(false);
          return;
        }

        console.log('[CompanySignup] Setting companies:', data);
        setCompanies(data || []);

        // If company param provided, try to find and select it
        if (companyParam && data && data.length > 0) {
          const foundCompany = data.find(
            c => c.name.toLowerCase() === companyParam.toLowerCase()
          );
          if (foundCompany) {
            setSelectedCompanyId(foundCompany.id);
          }
        }
      } catch (err) {
        if (!mounted) return;
        console.error('[CompanySignup] Exception caught:', err);
        toast.error(`Erreur: ${err.message || 'Erreur inconnue'}`);
        setCompanies([]);
      } finally {
        if (mounted) {
          setLoadingCompanies(false);
        }
      }
    };

    // Small delay to ensure component is mounted
    const timer = setTimeout(() => {
      fetchCompanies();
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [companyParam]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !password || !selectedCompanyId) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    try {
      setSubmitting(true);

      // 1. Sign up the user
      await signUp(email.trim(), password, firstName.trim(), lastName.trim());

      // 2. Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non créé');
      }

      // 3. Link user to company
      const { error: linkError } = await supabase
        .from('user_companies')
        .insert({
          user_id: user.id,
          company_id: selectedCompanyId
        });

      if (linkError) {
        console.error('Error linking user to company:', linkError);
        throw new Error('Erreur lors de la liaison à l\'entreprise');
      }

      toast.success('Inscription réussie ! Vérifiez votre email.');
      
      // Redirect to company recording page
      navigate('/company-record');
    } catch (err) {
      toast.error(err.message || "Une erreur s'est produite");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

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
                {selectedCompany?.logo ? (
                  <img
                    src={selectedCompany.logo}
                    alt={selectedCompany.name}
                    className="h-12 w-auto rounded-lg"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 shadow-md" />
                )}
                <img src="/logo.png" alt="SpotBulle" className="h-10 w-auto opacity-90" />
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                {selectedCompany ? `Rejoindre ${selectedCompany.name}` : 'Inscription Entreprise'}
              </h1>
              <p className="mt-2 text-sm text-gray-300">
                Créez votre compte pour accéder à l'enregistrement vidéo.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="px-8 pb-8 pt-2 space-y-5">
              {!companyParam && (
                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="company" className="col-span-4 text-gray-200">
                    Entreprise
                  </Label>
                  {loadingCompanies ? (
                    <div className="col-span-4 text-gray-400 text-sm">Chargement...</div>
                  ) : (
                    <Select
                      value={selectedCompanyId}
                      onValueChange={setSelectedCompanyId}
                      required
                    >
                      <SelectTrigger className="col-span-4 bg-white/90 focus:bg-white">
                        <SelectValue placeholder="Sélectionnez une entreprise" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="firstName" className="col-span-4 text-gray-200">
                    Prénom
                  </Label>
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
                  <Label htmlFor="lastName" className="col-span-4 text-gray-200">
                    Nom
                  </Label>
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
                  minLength={6}
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={submitting || (companies.length > 0 && !companyParam && !selectedCompanyId)}
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Création du compte…' : 'Créer mon compte'}
              </Button>

              <div className="text-center text-sm text-gray-300">
                <span>Déjà un compte ? </span>
                <button
                  type="button"
                  onClick={() => navigate('/company-signin' + (companyParam ? `?company=${companyParam}` : ''))}
                  className="text-white underline decoration-blue-400/60 underline-offset-4 hover:decoration-blue-400"
                >
                  Se connecter
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

