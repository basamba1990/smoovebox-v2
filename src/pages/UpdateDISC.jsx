import React, { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Button } from '../components/ui/button-enhanced.jsx';
import { toast } from 'sonner';
import ProfessionalHeader from '../components/ProfessionalHeader.jsx';
import { DISC_QUESTIONS, DISC_PROFILES } from '../constants/discData';
import { calculateDominantColor } from '../utils/discUtils';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog.jsx';

const QUESTION_COUNT = DISC_QUESTIONS.length;

const UpdateDISC = ({ profile, onSignOut }) => {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  
  // State pour stocker les réponses: un tableau où chaque élément est un tableau d'indices d'options sélectionnées
  const [answers, setAnswers] = useState(Array(QUESTION_COUNT).fill([]));
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadAnswers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('questionnaire_responses')
        .select('color_quiz')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data && data.color_quiz) {
        // Le format existant est un tableau de réponses uniques (indices).
        // On le convertit en tableau de tableaux pour supporter la sélection multiple.
        const loadedAnswers = data.color_quiz.map(answerIndex => 
          answerIndex !== null ? [answerIndex] : []
        );
        
        // S'assurer que le tableau a la bonne taille
        while (loadedAnswers.length < QUESTION_COUNT) {
          loadedAnswers.push([]);
        }
        setAnswers(loadedAnswers);
        toast.info("Vos réponses précédentes ont été chargées.");
      } else {
        // Si aucun DISC n'est trouvé, on initialise avec des tableaux vides
        setAnswers(Array(QUESTION_COUNT).fill([]));
        toast.info("Aucun DISC trouvé. Vous pouvez commencer le questionnaire.");
      }
    } catch (error) {
      console.error('Erreur lors du chargement des réponses:', error);
      toast.error('Erreur lors du chargement de vos réponses.');
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (user) {
      loadAnswers();
    }
  }, [user, loadAnswers]);

  const handleAnswerChange = (questionIndex, optionIndex) => {
    const newAnswers = [...answers];
    const currentSelections = newAnswers[questionIndex];
    
    // Logique de bascule (toggle) pour la sélection multiple
    if (currentSelections.includes(optionIndex)) {
      // Désélectionner
      newAnswers[questionIndex] = currentSelections.filter(i => i !== optionIndex);
    } else {
      // Sélectionner
      newAnswers[questionIndex] = [...currentSelections, optionIndex];
    }
    
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestionIndex < QUESTION_COUNT - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Vérifier que chaque question a au moins une réponse
      if (answers.some(selection => selection.length === 0)) {
        toast.error("Veuillez répondre à toutes les questions (au moins une sélection par question) avant de sauvegarder.");
        setIsSaving(false);
        return;
      }

      // Pour le calcul du profil, on prendra la première réponse sélectionnée pour chaque question
      // ou on adaptera la fonction calculateDominantColor pour gérer les tableaux de sélections.
      // Pour l'instant, on adapte pour prendre la première sélection pour rester compatible avec l'ancienne logique de calcul.
      // NOTE: Si la logique de calcul DISC doit changer pour la sélection multiple, il faudra modifier discUtils.js
      const answersForCalculation = answers.map(selection => selection[0]); 
      
      // 2. Calculer le nouveau profil dominant
      const dominantType = calculateDominantColor(answersForCalculation);

      // 3. Sauvegarder les nouvelles réponses. On sauvegarde le tableau de tableaux de sélections.
      const { error: saveError } = await supabase
        .from('questionnaire_responses')
        .upsert({
          user_id: user.id,
          dominant_color: dominantType,
          // On sauvegarde le nouveau format (tableau de tableaux)
          color_quiz: answers, 
          completed_at: new Date().toISOString()
        }, { onConflict: 'user_id' }); // Utiliser upsert avec onConflict si on veut écraser l'ancienne entrée

      if (saveError) throw saveError;

      // 4. Mettre à jour le profil utilisateur
      await supabase
        .from('profiles')
        .update({ 
          dominant_color: dominantType,
        })
        .eq('id', user.id);

      toast.success(`Votre DISC a été mis à jour ! Nouveau profil: ${DISC_PROFILES[dominantType].name}`);
      
      // Rediriger vers le tableau de bord ou la page de résultats
      navigate('/personality-test'); 

    } catch (error) {
      console.error('Erreur sauvegarde DISC:', error);
      toast.error('Erreur lors de la mise à jour du DISC.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // 1. Supprimer l'entrée dans questionnaire_responses
      const { error: deleteError } = await supabase
        .from('questionnaire_responses')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      // 2. Optionnel: Réinitialiser la couleur dominante dans le profil utilisateur
      await supabase
        .from('profiles')
        .update({ 
          dominant_color: null,
        })
        .eq('id', user.id);

      toast.success("Votre profil DISC a été supprimé avec succès.");
      
      // Rediriger l'utilisateur après la suppression
      navigate('/personality-test'); 

    } catch (error) {
      console.error('Erreur suppression DISC:', error);
      toast.error('Erreur lors de la suppression du profil DISC.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-xl text-gray-600">Chargement de votre DISC...</p>
      </div>
    );
  }

  const currentQuestion = DISC_QUESTIONS[currentQuestionIndex];
  const currentSelections = answers[currentQuestionIndex] || [];
  const isLastQuestion = currentQuestionIndex === QUESTION_COUNT - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <ProfessionalHeader user={user} profile={profile} onSignOut={onSignOut} />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            📝 Mettre à jour mon DISC ({currentQuestionIndex + 1}/{QUESTION_COUNT})
          </h1>
          <p className="text-xl text-gray-600">
            Sélectionnez une ou plusieurs réponses qui vous correspondent le mieux.
          </p>
        </div>

        <div className="space-y-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              {currentQuestionIndex + 1}. {currentQuestion.question}
            </h2>
            
            <div className="grid grid-cols-1 gap-3">
              {currentQuestion.options.map((option, oIndex) => {
                const isSelected = currentSelections.includes(oIndex);
                return (
                  <button
                    key={option.id}
                    onClick={() => handleAnswerChange(currentQuestionIndex, oIndex)}
                    className={`p-4 border-2 rounded-xl text-left transition-all duration-200 hover:shadow-md ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 shadow-lg ring-2 ring-primary-500'
                        : 'border-gray-200 hover:border-primary-300'
                    }`}
                  >
                    <div className="flex items-start space-x-4">
                      <span className="text-2xl flex-shrink-0">{option.emoji}</span>
                      <div>
                        <div className="font-semibold text-gray-900 mb-1">
                          {option.id}. {option.text}
                        </div>
                        {/* Afficher un indicateur de sélection */}
                        {isSelected && (
                          <span className="text-sm font-medium text-primary-600">
                            Sélectionné
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-10 flex justify-between items-center">
          {/* Bouton Précédent */}
          <Button
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            variant="outline"
            className="px-6 py-3 text-lg"
          >
            ← Question précédente
          </Button>

          {/* Bouton Suivant / Sauvegarder */}
          {isLastQuestion ? (
            <Button
              onClick={handleSave}
              loading={isSaving}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-8 py-4 text-white font-semibold text-lg"
            >
              {isSaving ? 'Sauvegarde en cours...' : '💾 Sauvegarder et mettre à jour mon DISC'}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              className="bg-primary-500 hover:bg-primary-600 px-6 py-3 text-white font-semibold text-lg"
            >
              Question suivante →
            </Button>
          )}
        </div>

        {/* Bouton de suppression du profil DISC */}
        <div className="mt-10 text-center">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="text-sm" disabled={isDeleting}>
                Supprimer mon profil DISC
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. Toutes vos réponses au questionnaire DISC seront définitivement supprimées.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDelete} 
                  className="bg-red-600 hover:bg-red-700"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Suppression en cours...' : 'Oui, supprimer mon profil'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};

export default UpdateDISC;
