// src/pages/future-jobs-generator.jsx (Extrait corrigé de la fonction handleGenerateVideo)

  // ✅ FONCTION PRINCIPALE CORRIGÉE
  const handleGenerateVideo = async () => {
    if (!user) {
      toast.error('Veuillez vous connecter pour générer une vidéo');
      return;
    }

    if (!generatedPrompt || !generatedPrompt.prompt) {
      toast.error('Veuillez d\'abord générer un prompt');
      return;
    }

    setIsGeneratingVideo(true);
    setGenerationStatus('🚀 Démarrage de la génération vidéo...');
    setVideoError(null);
    setVideoResult(null);
    setGenerationTime(Date.now());

    try {
      // ✅ FIX: Utiliser les bons noms de champs attendus par le service et l'Edge Function
      const result = await futureJobsVideoService.generateJobVideo({
        prompt: generatedPrompt.prompt, // ✅ Changé de promptText à prompt
        generator: selectedGenerator,
        style: selectedStyle,
        duration: Number(selectedDuration),
        userId: user.id,
        jobId: selectedJobId
      });

      if (result.success) {
        setVideoResult(result);
        setGenerationStatus('✅ Vidéo générée avec succès !');
        toast.success('Vidéo générée avec succès !');
        
        if (result.metadata?.is_placeholder) {
          toast.info('⚠️ Note: Sora API n\'est pas encore disponible. Une image DALL-E a été générée comme placeholder.');
        }
        
        await loadUserVideos();
      } else {
        throw new Error(result.error || 'Échec de la génération');
      }
    } catch (error) {
      console.error('❌ Erreur génération vidéo:', error);
      setVideoError(error.message);
      setGenerationStatus('❌ Erreur lors de la génération');
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setIsGeneratingVideo(false);
    }
  };
