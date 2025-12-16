// smoovebox-v2/src/pages/UpdateDISC.jsx
import React, { useState, useEffect } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Button } from '../components/ui/button-enhanced.jsx';
import { toast } from 'sonner';
import ProfessionalHeader from '../components/ProfessionalHeader.jsx';
import { DISC_QUESTIONS, DISC_PROFILES } from '../constants/discData';
import { calculateDominantColor } from '../utils/discUtils';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const UpdateDISC = ({ profile, onSignOut }) => {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState(Array(DISC_QUESTIONS.length).fill(null));
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadAnswers();
    }
  }, [user]);

  const loadAnswers = async () => {
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
        // S'assurer que le tableau a la bonne taille
        const loadedAnswers = data.color_quiz.slice(0, DISC_QUESTIONS.length);
        while (loadedAnswers.length < DISC_QUESTIONS.length) {
          loadedAnswers.push(null);
        }
        setAnswers(loadedAnswers);
      } else {
        toast.info("Aucun DISC trouvé. Redirection vers le test.");
        navigate('/update-disc');
      }
    } catch (error) {
      console.error('Erreur chargement réponses:', error);
      toast.error('Erreur lors du chargement de vos réponses.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionIndex, optionIndex) => {
    const newAnswers = [...answers];
    newAnswers[questionIndex] = optionIndex;
    setAnswers(newAnswers);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Vérifier que toutes les questions ont une réponse
      if (answers.some(answer => answer === null)) {
        toast.error("Veuillez répondre à toutes les questions avant de sauvegarder.");
        setIsSaving(false);
        return;
      }

      // 2. Calculer le nouveau profil dominant
      const dominantType = calculateDominantColor(answers);

      // 3. Sauvegarder les nouvelles réponses
      const { error: saveError } = await supabase
        .from('questionnaire_responses')
        .upsert({
          user_id: user.id,
          dominant_color: dominantType,
          color_quiz: answers,
          completed_at: new Date().toISOString()
        });

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
      navigate('/update-disc'); 

    } catch (error) {
      console.error('Erreur sauvegarde DISC:', error);
      toast.error('Erreur lors de la mise à jour du DISC.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-xl text-gray-600">Chargement de votre DISC...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <ProfessionalHeader user={user} profile={profile} onSignOut={onSignOut} />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            📝 Voir / Mettre à jour mon DISC
          </h1>
          <p className="text-xl text-gray-600">
            Modifiez vos réponses ci-dessous et sauvegardez pour mettre à jour votre profil.
          </p>
        </div>

        <div className="space-y-8">
          {DISC_QUESTIONS.map((question, qIndex) => (
            <div key={question.id} className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {qIndex + 1}. {question.question}
              </h2>
              
              <div className="grid grid-cols-1 gap-3">
                {question.options.map((option, oIndex) => (
                  <button
                    key={option.id}
                    onClick={() => handleAnswerChange(qIndex, oIndex)}
                    className={`p-4 border-2 rounded-xl text-left transition-all duration-200 hover:shadow-md ${
                      answers[qIndex] === oIndex
                        ? 'border-blue-600 bg-blue-50 shadow-lg ring-2 ring-blue-600'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start space-x-4">
                      <span className="text-2xl flex-shrink-0">{option.emoji}</span>
                      <div>
                        <div className="font-semibold text-gray-900 mb-1">
                          {option.id}. {option.text}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Button
            onClick={handleSave}
            loading={isSaving}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-8 py-4 text-white font-semibold text-lg"
          >
            {isSaving ? 'Sauvegarde en cours...' : '💾 Sauvegarder et mettre à jour mon DISC'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UpdateDISC;
