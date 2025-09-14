import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { toast } from 'sonner';
import { Button } from './ui/button-enhanced.jsx';
import { Input } from './ui/input.jsx'; // Assure-toi d'avoir un composant Input si pas présent
import { Label } from './ui/label.jsx'; // Composant Radix UI

const UserRegistration = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [step, setStep] = useState(1); // 1: Sexe, 2: Majeur/Mineur, 3: Détails
  const [isMajor, setIsMajor] = useState(null);
  const { register, handleSubmit, formState: { errors }, reset } = useForm();

  const onSubmitSex = (data) => {
    setStep(2);
    reset(); // Reset pour l'étape suivante
  };

  const onSubmitAge = (data) => {
    setIsMajor(data.isMajor);
    if (data.isMajor === 'minor') {
      // Pour mineur : enregistrement limité, redirection ou message
      toast.info('Accès limité pour les mineurs. Contactez-nous pour plus d\'infos.');
      return;
    }
    setStep(3);
    reset();
  };

  const onSubmitDetails = async (data) => {
    if (!user) {
      toast.error('Veuillez vous connecter d\'abord.');
      return;
    }

    try {
      const { error } = await supabase
        .from('users') // Assure-toi que la table 'users' existe dans Supabase
        .upsert({
          id: user.id,
          sex: data.sex,
          is_major: true,
          passions: data.passions ? data.passions.split(',') : [],
          clubs: data.clubs ? data.clubs.split(',') : [],
          football_interest: data.football_interest || false,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      toast.success('Enregistrement réussi ! Vous apparaissez maintenant dans l\'annuaire.');
      setStep(1);
      reset();
    } catch (error) {
      console.error('Erreur enregistrement:', error);
      toast.error('Erreur lors de l\'enregistrement.');
    }
  };

  if (step === 1) {
    return (
      <form onSubmit={handleSubmit(onSubmitSex)} className="space-y-4">
        <Label htmlFor="sex">Votre sexe :</Label>
        <select {...register('sex', { required: true })} className="w-full p-2 border rounded">
          <option value="">Sélectionnez...</option>
          <option value="male">Homme</option>
          <option value="female">Femme</option>
          <option value="other">Autre</option>
        </select>
        {errors.sex && <p className="text-red-500">Sélection obligatoire.</p>}
        <Button type="submit">Suivant</Button>
      </form>
    );
  }

  if (step === 2) {
    return (
      <form onSubmit={handleSubmit(onSubmitAge)} className="space-y-4">
        <Label>Êtes-vous majeur (18 ans ou plus) ?</Label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input type="radio" value="major" {...register('isMajor', { required: true })} />
            <span className="ml-2">Oui, je suis majeur</span>
          </label>
          <label className="flex items-center">
            <input type="radio" value="minor" {...register('isMajor', { required: true })} />
            <span className="ml-2">Non, je suis mineur</span>
          </label>
        </div>
        {errors.isMajor && <p className="text-red-500">Sélection obligatoire.</p>}
        <Button type="submit">Suivant</Button>
      </form>
    );
  }

  if (step === 3 && isMajor) {
    return (
      <form onSubmit={handleSubmit(onSubmitDetails)} className="space-y-4">
        <div>
          <Label htmlFor="passions">Vos passions (séparées par des virgules) :</Label>
          <Input {...register('passions')} placeholder="Football, Musique, etc." />
        </div>
        <div>
          <Label htmlFor="clubs">Clubs ou valeurs importantes :</Label>
          <Input {...register('clubs')} placeholder="Club de foot, Leadership, etc." />
        </div>
        <div>
          <Label className="flex items-center">
            <input type="checkbox" {...register('football_interest')} />
            <span className="ml-2">Je suis passionné de football ou membre d'un club</span>
          </Label>
        </div>
        <Button type="submit">S'enregistrer</Button>
      </form>
    );
  }

  return null;
};

export default UserRegistration;
