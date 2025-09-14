import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { toast } from 'sonner';
import { Button } from './ui/button-enhanced.jsx';
import { Input } from './ui/input.jsx'; // Corrigé : minuscule 'input.jsx'
import { Label } from './ui/label.jsx'; // Corrigé : minuscule 'label.jsx'
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const UserRegistration = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Sexe, 2: Majeur/Mineur, 3: Détails
  const [isMajor, setIsMajor] = useState(null);
  const { register, handleSubmit, formState: { errors }, reset } = useForm();

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
      toast.error('Veuillez vous connecter d\'abord.');
      navigate('/auth');
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          sex: data.sex,
          is_major: true,
          passions: data.passions ? data.passions.split(',').map(p => p.trim()) : [],
          clubs: data.clubs ? data.clubs.split(',').map(c => c.trim()) : [],
          football_interest: data.football_interest || false,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      toast.success('Enregistrement réussi ! Vous apparaissez maintenant dans l\'annuaire.');
      navigate('/directory');
    } catch (error) {
      console.error('Erreur enregistrement:', error);
      toast.error('Erreur lors de l\'enregistrement.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-900 to-red-700 p-4">
      <div className="max-w-md w-full bg-black/50 backdrop-blur-md rounded-3xl p-8 border-2 border-gold shadow-2xl">
        <h2 className="text-2xl font-bold text-gold mb-6 text-center">Enregistrement</h2>

        {step === 1 && (
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
