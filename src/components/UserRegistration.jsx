// src/components/UserRegistration.jsx
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from './ui/button-enhanced.jsx';
import { Input } from './ui/input.jsx';
import { Label } from './ui/label.jsx';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '../context/AuthContext.jsx'; // Remplacer useSupabaseClient/useUser

const UserRegistration = () => {
  const { user, loading, signUp, updateUserProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Sexe, 2: Majeur/Mineur, 3: Détails, 4: Inscription
  const [isMajor, setIsMajor] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { register, handleSubmit, formState: { errors }, reset } = useForm();

  const onSubmitSignUp = async (data) => {
    try {
      console.log('UserRegistration: Tentative d\'inscription:', data.email);
      await signUp(data.email, data.password, data.firstName, data.lastName);
      toast.success('Inscription réussie ! Veuillez vérifier votre email.');
      setEmail(data.email);
      setPassword(data.password);
      setStep(1); // Passer à l'étape du sexe après inscription
    } catch (error) {
      console.error('UserRegistration: Erreur inscription:', error);
      toast.error(`Erreur lors de l'inscription : ${error.message}`);
    }
  };

  const onSubmitSex = (data) => {
    setStep(2);
    reset();
  };

  const onSubmitAge = (data) => {
    setIsMajor(data.isMajor === 'major');
    if (data.isMajor === 'minor') {
      toast.info('Accès limité pour les mineurs. Contactez-nous pour plus d\'infos.');
      navigate('/');
      return;
    }
    setStep(3);
    reset();
  };

  const onSubmitDetails = async (data) => {
    if (!user) {
      console.log('UserRegistration: Utilisateur non connecté');
      toast.error('Veuillez vous connecter d\'abord.');
      navigate('/'); // Rediriger vers la page d'accueil
      return;
    }

    try {
      console.log('UserRegistration: Mise à jour profil pour user:', user.id);
      await updateUserProfile({
        sex: data.sex,
        is_major: true,
        passions: data.passions ? data.passions.split(',').map(p => p.trim()) : [],
        clubs: data.clubs ? data.clubs.split(',').map(c => c.trim()) : [],
        football_interest: data.football_interest || false,
        updated_at: new Date().toISOString(),
      });
      toast.success('Enregistrement réussi ! Vous apparaissez maintenant dans l\'annuaire.');
      navigate('/directory');
    } catch (error) {
      console.error('UserRegistration: Erreur mise à jour profil:', error);
      toast.error('Erreur lors de l\'enregistrement.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-900 to-red-700 p-4">
      <div className="max-w-md w-full bg-black/50 backdrop-blur-md rounded-3xl p-8 border-2 border-gold shadow-2xl">
        <h2 className="text-2xl font-bold text-gold mb-6 text-center">Enregistrement</h2>

        {step === 1 && !user && !loading && (
          <form onSubmit={handleSubmit(onSubmitSignUp)} className="space-y-4">
            <div>
              <Label htmlFor="email">Email :</Label>
              <Input
                id="email"
                type="email"
                {...register('email', { required: 'Email obligatoire' })}
                placeholder="votre@email.com"
                className="dark:bg-white/10 text-white"
              />
              {errors.email && <p className="text-red-400 text-sm">{errors.email.message}</p>}
            </div>
            <div>
              <Label htmlFor="password">Mot de passe :</Label>
              <Input
                id="password"
                type="password"
                {...register('password', { required: 'Mot de passe obligatoire', minLength: { value: 6, message: 'Minimum 6 caractères' } })}
                className="dark:bg-white/10 text-white"
              />
              {errors.password && <p className="text-red-400 text-sm">{errors.password.message}</p>}
            </div>
            <div>
              <Label htmlFor="firstName">Prénom :</Label>
              <Input
                id="firstName"
                {...register('firstName', { required: 'Prénom obligatoire' })}
                placeholder="Votre prénom"
                className="dark:bg-white/10 text-white"
              />
              {errors.firstName && <p className="text-red-400 text-sm">{errors.firstName.message}</p>}
            </div>
            <div>
              <Label htmlFor="lastName">Nom :</Label>
              <Input
                id="lastName"
                {...register('lastName', { required: 'Nom obligatoire' })}
                placeholder="Votre nom"
                className="dark:bg-white/10 text-white"
              />
              {errors.lastName && <p className="text-red-400 text-sm">{errors.lastName.message}</p>}
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Chargement...' : 'S\'inscrire'}
            </Button>
          </form>
        )}

        {step === 1 && user && (
          <form onSubmit={handleSubmit(onSubmitSex)} className="space-y-4">
            <div>
              <Label htmlFor="sex">Votre sexe :</Label>
              <select
                id="sex"
                {...register('sex', { required: 'Sélection obligatoire' })}
                className={cn(
                  'file:text-foreground placeholder:text-muted-foreground dark:bg-white/10 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none text-white',
                  'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                  errors.sex && 'aria-invalid ring-destructive/20 dark:ring-destructive/40 border-destructive'
                )}
              >
                <option value="">Sélectionnez...</option>
                <option value="male">Homme</option>
                <option value="female">Femme</option>
                <option value="other">Autre</option>
              </select>
              {errors.sex && <p className="text-red-400 text-sm">{errors.sex.message}</p>}
            </div>
            <Button type="submit">Suivant</Button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit(onSubmitAge)} className="space-y-4">
            <div>
              <Label>Êtes-vous majeur (18 ans ou plus) ?</Label>
              <div className="space-y-2">
                <label className="flex items-center text-white">
                  <input
                    type="radio"
                    value="major"
                    {...register('isMajor', { required: 'Sélection obligatoire' })}
                    className="mr-2 text-blue-500 focus:ring-blue-500"
                  />
                  Oui, je suis majeur
                </label>
                <label className="flex items-center text-white">
                  <input
                    type="radio"
                    value="minor"
                    {...register('isMajor', { required: 'Sélection obligatoire' })}
                    className="mr-2 text-blue-500 focus:ring-blue-500"
                  />
                  Non, je suis mineur
                </label>
              </div>
              {errors.isMajor && <p className="text-red-400 text-sm">{errors.isMajor.message}</p>}
            </div>
            <Button type="submit">Suivant</Button>
          </form>
        )}

        {step === 3 && isMajor && (
          <form onSubmit={handleSubmit(onSubmitDetails)} className="space-y-4">
            <div>
              <Label htmlFor="passions">Vos passions (séparées par des virgules) :</Label>
              <Input
                id="passions"
                {...register('passions')}
                placeholder="Football, Musique, etc."
                className="dark:bg-white/10 text-white"
              />
            </div>
            <div>
              <Label htmlFor="clubs">Clubs ou valeurs importantes :</Label>
              <Input
                id="clubs"
                {...register('clubs')}
                placeholder="Club de foot, Leadership, etc."
                className="dark:bg-white/10 text-white"
              />
            </div>
            <div>
              <label className="flex items-center text-white">
                <input
                  type="checkbox"
                  {...register('football_interest')}
                  className="mr-2 text-blue-500 focus:ring-blue-500"
                />
                Je suis passionné de football ou membre d'un club
              </label>
            </div>
            <Button type="submit">S'enregistrer</Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default UserRegistration;
