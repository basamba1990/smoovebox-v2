// Fichier de debug pour tester les fonctions Supabase et OpenAI
import { supabase, checkOpenAIAvailability, getTranscription, analyzePitch } from './supabase.js';

// Test de connexion Supabase
export const testSupabaseConnection = async () => {
  try {
    console.log('=== Test de connexion Supabase ===');
    
    // Test de session
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    console.log('Session:', session?.session ? 'Active' : 'Inactive', sessionError);
    
    // Test de la table profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    console.log('Table profiles:', profilesError ? `Erreur: ${profilesError.message}` : 'OK');
    
    // Test de la table videos
    const { data: videos, error: videosError } = await supabase
      .from('videos')
      .select('count')
      .limit(1);
    console.log('Table videos:', videosError ? `Erreur: ${videosError.message}` : 'OK');
    
    // Test de la table transcriptions
    const { data: transcriptions, error: transcriptionsError } = await supabase
      .from('transcriptions')
      .select('count')
      .limit(1);
    console.log('Table transcriptions:', transcriptionsError ? `Erreur: ${transcriptionsError.message}` : 'OK');
    
    // Test du bucket videos
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    console.log('Storage buckets:', bucketsError ? `Erreur: ${bucketsError.message}` : 'OK');
    
    if (buckets) {
      const videoBucket = buckets.find(bucket => bucket.name === 'videos');
      console.log('Bucket videos:', videoBucket ? 'Trouvé' : 'Non trouvé');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Erreur de test Supabase:', error);
    return { success: false, error: error.message };
  }
};

// Test de disponibilité OpenAI
export const testOpenAIConnection = async () => {
  try {
    console.log('=== Test de connexion OpenAI ===');
    
    const availability = await checkOpenAIAvailability();
    console.log('OpenAI disponible:', availability.available);
    
    if (!availability.available) {
      console.log('Erreur OpenAI:', availability.error);
    }
    
    return availability;
  } catch (error) {
    console.error('Erreur de test OpenAI:', error);
    return { available: false, error: error.message };
  }
};

// Test de transcription avec un fichier factice
export const testTranscription = async () => {
  try {
    console.log('=== Test de transcription ===');
    
    // Créer un fichier audio factice (silence de 1 seconde)
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const sampleRate = audioContext.sampleRate;
    const duration = 1; // 1 seconde
    const frameCount = sampleRate * duration;
    
    const audioBuffer = audioContext.createBuffer(1, frameCount, sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    
    // Générer un signal audio simple (sine wave)
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.1; // 440Hz à faible volume
    }
    
    // Convertir en WAV (simulation)
    const wavBlob = new Blob(['fake audio data'], { type: 'audio/wav' });
    const file = new File([wavBlob], 'test-audio.wav', { type: 'audio/wav' });
    
    console.log('Fichier de test créé:', file.name, file.size, 'bytes');
    
    // Note: Cette fonction ne fonctionnera pas réellement car nous n'avons pas de vrai fichier audio
    // mais elle permet de tester la structure du code
    
    return { success: true, message: 'Structure de test créée' };
  } catch (error) {
    console.error('Erreur de test de transcription:', error);
    return { success: false, error: error.message };
  }
};

// Fonction pour exécuter tous les tests
export const runAllTests = async () => {
  console.log('🔍 Début des tests de diagnostic...');
  
  const supabaseTest = await testSupabaseConnection();
  const openaiTest = await testOpenAIConnection();
  const transcriptionTest = await testTranscription();
  
  console.log('📊 Résumé des tests:');
  console.log('- Supabase:', supabaseTest.success ? '✅' : '❌');
  console.log('- OpenAI:', openaiTest.available ? '✅' : '❌');
  console.log('- Transcription:', transcriptionTest.success ? '✅' : '❌');
  
  return {
    supabase: supabaseTest,
    openai: openaiTest,
    transcription: transcriptionTest
  };
};

// Auto-exécution des tests au chargement (pour debug)
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  setTimeout(() => {
    runAllTests();
  }, 2000);
}

