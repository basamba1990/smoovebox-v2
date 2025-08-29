/**
 * @name transcribe-video
 * @description Deno Edge Function pour transcrire des fichiers vidéo en utilisant l'API Whisper d'OpenAI.
 * @author Manus AI (corrigé et commenté)
 * @version 2.0.0
 */

import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'

// --- Constantes et Types --- //

/**
 * Statuts possibles pour une vidéo dans la base de données.
 * L'utilisation de `as const` garantit que ces valeurs sont des types littéraux.
 */
const VIDEO_STATUS = {
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  TRANSCRIBED: 'transcribed',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  PUBLISHED: 'published',
  FAILED: 'failed'
} as const

/**
 * En-têtes CORS pour permettre les requêtes cross-origin.
 * Essentiel pour les fonctions Edge appelées depuis un navigateur.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

/**
 * Configuration des timeouts pour les différentes opérations.
 * Centraliser ces valeurs facilite la maintenance et l'ajustement.
 */
const TIMEOUTS = {
  DATABASE_OPERATION: 10000,    // 10 secondes pour les opérations DB
  FILE_DOWNLOAD: 300000,        // 5 minutes pour le téléchargement
  WHISPER_API: 600000,          // 10 minutes pour la transcription
  FUNCTION_EXECUTION: 900000    // 15 minutes pour l'exécution totale
} as const;

// --- Interfaces --- //

interface AuthResult {
  user: {
    id: string;
    email: string;
    role?: string;
  } | null;
  error?: string;
}

interface TranscriptionResult {
  success: boolean;
  transcription?: any;
  videoId: string;
  metrics?: TranscriptionMetrics;
}

interface TranscriptionMetrics {
  videoId: string;
  userId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  fileSize: number;
  transcriptionLength?: number;
  confidenceScore?: number;
  errorType?: TranscriptionErrorType;
  retryCount: number;
  steps: {
    urlRetrieval: number;
    download: number;
    transcription: number;
    database: number;
  };
}

/**
 * Énumération des types d'erreurs pour une classification et un monitoring précis.
 */
enum TranscriptionErrorType {
  AUTHENTICATION = 'authentication',
  VIDEO_NOT_FOUND = 'video_not_found',
  DOWNLOAD_FAILED = 'download_failed',
  API_RATE_LIMIT = 'api_rate_limit',
  API_ERROR = 'api_error',
  DATABASE_ERROR = 'database_error',
  VALIDATION_ERROR = 'validation_error',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

// --- Classes d'Erreur et de Monitoring --- //

/**
 * Classe d'erreur personnalisée pour mieux gérer les échecs de transcription.
 */
class TranscriptionError extends Error {
  constructor(
    message: string,
    public type: TranscriptionErrorType,
    public retryable: boolean = false,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'TranscriptionError';
  }
}

/**
 * Classe pour collecter et sauvegarder les métriques de performance et d'erreur.
 */
class TranscriptionMonitor {
  private metrics: TranscriptionMetrics;
  
  constructor(videoId: string, userId: string) {
    this.metrics = {
      videoId,
      userId,
      startTime: Date.now(),
      fileSize: 0,
      retryCount: 0,
      steps: {
        urlRetrieval: 0,
        download: 0,
        transcription: 0,
        database: 0
      }
    };
  }
  
  startStep(step: keyof TranscriptionMetrics['steps']): void {
    this.metrics.steps[step] = Date.now();
  }
  
  endStep(step: keyof TranscriptionMetrics['steps']): void {
    if (this.metrics.steps[step] > 0) {
      this.metrics.steps[step] = Date.now() - this.metrics.steps[step];
    }
  }
  
  setFileSize(size: number): void {
    this.metrics.fileSize = size;
  }
  
  setTranscriptionResult(text: string, confidence?: number): void {
    this.metrics.transcriptionLength = text.length;
    this.metrics.confidenceScore = confidence;
  }
  
  incrementRetry(): void {
    this.metrics.retryCount++;
  }
  
  setError(errorType: TranscriptionErrorType): void {
    this.metrics.errorType = errorType;
  }
  
  finish(): TranscriptionMetrics {
    this.metrics.endTime = Date.now();
    this.metrics.duration = this.metrics.endTime - this.metrics.startTime;
    return { ...this.metrics };
  }
  
  async saveMetrics(serviceClient: any): Promise<void> {
    try {
      const { error } = await serviceClient
        .from('transcription_metrics')
        .insert({
          video_id: this.metrics.videoId,
          user_id: this.metrics.userId,
          duration_ms: this.metrics.duration,
          file_size_bytes: this.metrics.fileSize,
          transcription_length: this.metrics.transcriptionLength,
          confidence_score: this.metrics.confidenceScore,
          error_type: this.metrics.errorType,
          retry_count: this.metrics.retryCount,
          step_durations: this.metrics.steps,
          created_at: new Date().toISOString()
        });
      if (error) {
        console.error('Erreur lors de la sauvegarde des métriques:', error);
      }
    } catch (error) {
      console.error('Exception lors de la sauvegarde des métriques:', error);
    }
  }
}

// --- Fonctions Utilitaires --- //

/**
 * Log structuré pour une meilleure observabilité.
 */
function logTranscriptionEvent(
  level: 'info' | 'warn' | 'error',
  event: string,
  videoId: string,
  details?: any
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    videoId,
    details,
    service: 'transcription'
  };
  console.log(JSON.stringify(logEntry));
}

/**
 * Valide une chaîne comme une URL HTTP/HTTPS.
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Classifie une erreur pour déterminer si une nouvelle tentative est possible.
 */
function classifyError(error: any): {
  type: TranscriptionErrorType;
  message: string;
  retryable: boolean;
} {
  const errorMessage = error.message?.toLowerCase() || '';
  
  if (errorMessage.includes('unauthorized') || errorMessage.includes('invalid token')) {
    return {
      type: TranscriptionErrorType.AUTHENTICATION,
      message: 'Erreur d\'authentification - token invalide ou expiré',
      retryable: false
    };
  }
  
  if (errorMessage.includes('rate limit') || error.status === 429) {
    return {
      type: TranscriptionErrorType.API_RATE_LIMIT,
      message: 'Limite de débit API atteinte - retry automatique',
      retryable: true
    };
  }
  
  if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
    return {
      type: TranscriptionErrorType.TIMEOUT,
      message: 'Timeout lors de l\'opération - retry possible',
      retryable: true
    };
  }
  
  if (errorMessage.includes('fetch') || errorMessage.includes('download')) {
    return {
      type: TranscriptionErrorType.DOWNLOAD_FAILED,
      message: 'Échec du téléchargement de la vidéo',
      retryable: true
    };
  }
  
  if (errorMessage.includes('database') || errorMessage.includes('postgres')) {
    return {
      type: TranscriptionErrorType.DATABASE_ERROR,
      message: 'Erreur de base de données',
      retryable: true
    };
  }
  
  if (errorMessage.includes('openai') || errorMessage.includes('whisper')) {
    return {
      type: TranscriptionErrorType.API_ERROR,
      message: 'Erreur de l\'API de transcription',
      retryable: true
    };
  }
  
  return {
    type: TranscriptionErrorType.UNKNOWN,
    message: `Erreur inconnue: ${error.message}`,
    retryable: true // Par défaut, on tente un retry pour les erreurs inconnues
  };
}

/**
 * Tente à nouveau une opération avec un backoff exponentiel en cas d'échec.
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 30000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      const errorClassification = classifyError(error);
      
      if (!errorClassification.retryable || attempt === maxRetries - 1) {
        throw new TranscriptionError(
          errorClassification.message,
          errorClassification.type,
          errorClassification.retryable,
          error
        );
      }
      
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay
      );
      
      logTranscriptionEvent('warn', 'retry_attempt', '', { 
        attempt: attempt + 1, 
        maxRetries, 
        delay, 
        error: error.message 
      });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError; // Ne devrait pas être atteint, mais nécessaire pour la compilation
}

// --- Fonctions Principales --- //

/**
 * Vérifie si un utilisateur a accès à une vidéo spécifique.
 */
async function checkVideoAccess(serviceClient: any, userId: string, videoId: string): Promise<boolean> {
  try {
    const { data: video, error } = await serviceClient
      .from('videos')
      .select('user_id')
      .eq('id', videoId)
      .single();
      
    if (error || !video) {
      if (error) console.error('Erreur lors de la vérification d\'accès:', error);
      return false;
    }
    
    return video.user_id === userId;
  } catch (error) {
    console.error('Exception lors de la vérification d\'accès:', error);
    return false;
  }
}

/**
 * Authentifie une requête en validant le token Bearer.
 */
async function authenticateRequest(req: Request, serviceClient: any): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      user: null,
      error: 'Token d\'authentification requis dans l\'en-tête Authorization'
    };
  }
  
  const token = authHeader.replace('Bearer ', '').trim();
  
  if (!token || token.length < 20) {
    return {
      user: null,
      error: 'Format de token invalide'
    };
  }
  
  try {
    const { data: { user }, error } = await serviceClient.auth.getUser(token);
    
    if (error) {
      console.error('Erreur de validation du token:', error);
      return {
        user: null,
        error: 'Token invalide ou expiré'
      };
    }
    
    if (!user) {
      return {
        user: null,
        error: 'Utilisateur non trouvé'
      };
    }
    
    if (!user.email_confirmed_at) {
      return {
        user: null,
        error: 'Email non confirmé'
      };
    }
    
    // La vérification d'accès à la vidéo est maintenant effectuée dans le handler principal
    
    return {
      user: {
        id: user.id,
        email: user.email!,
        role: user.user_metadata?.role
      }
    };
    
  } catch (authError) {
    console.error('Exception lors de l\'authentification:', authError);
    return {
      user: null,
      error: 'Erreur interne d\'authentification'
    };
  }
}

/**
 * Récupère l'URL de la vidéo, soit depuis la requête, soit depuis la base de données.
 */
async function getVideoUrl(
  serviceClient: any,
  videoId: string,
  providedUrl?: string
): Promise<{ url: string; source: string }> {
  
  if (providedUrl && isValidUrl(providedUrl)) {
    logTranscriptionEvent('info', 'video_url_provided', videoId, { url: providedUrl });
    return { url: providedUrl, source: 'provided' };
  }
  
  const { data: video, error: videoError } = await serviceClient
    .from('videos')
    .select('storage_path, url') // Removed bucket_name from select
    .eq('id', videoId)
    .single();
    
  if (videoError || !video) {
    throw new TranscriptionError(
      `Vidéo non trouvée ou erreur d'accès: ${videoError?.message}`,
      TranscriptionErrorType.VIDEO_NOT_FOUND,
      false
    );
  }
  
  if (video.url && isValidUrl(video.url)) {
    logTranscriptionEvent('info', 'video_url_from_db', videoId, { url: video.url });
    return { url: video.url, source: 'database' };
  }
  
  if (video.storage_path) {
    const bucket = 'videos'; // Hardcoded bucket name as 'videos'
    const signedUrl = await generateSignedUrl(serviceClient, bucket, video.storage_path);
    logTranscriptionEvent('info', 'video_url_signed', videoId);
    return { url: signedUrl, source: 'signed' };
  }
  
  throw new TranscriptionError('Aucune URL valide ou chemin de stockage trouvé pour cette vidéo', TranscriptionErrorType.VIDEO_NOT_FOUND, false);
}

/**
 * Génère une URL signée pour un fichier dans un bucket Supabase.
 */
async function generateSignedUrl(
  serviceClient: any,
  bucket: string,
  filePath: string,
  expiresIn: number = 3600
): Promise<string> {
  
  const cleanPath = filePath.replace(/^\/+/, '').replace(/\/+/g, '/');
  
  // Vérifier si le fichier existe avant de générer l'URL
  const { data: fileList, error: listError } = await serviceClient.storage
    .from(bucket)
    .list(cleanPath.substring(0, cleanPath.lastIndexOf('/')) || undefined, {
      search: cleanPath.substring(cleanPath.lastIndexOf('/') + 1)
    });

  if (listError || !fileList || fileList.length === 0) {
    throw new TranscriptionError(`Fichier non trouvé dans le bucket ${bucket}: ${cleanPath}`, TranscriptionErrorType.VIDEO_NOT_FOUND, false, listError);
  }
  
  const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
    .from(bucket)
    .createSignedUrl(cleanPath, expiresIn);
    
  if (signedUrlError || !signedUrlData?.signedUrl) {
    throw new TranscriptionError(`Impossible de générer l'URL signée: ${signedUrlError?.message}`, TranscriptionErrorType.UNKNOWN, false, signedUrlError);
  }
  
  return signedUrlData.signedUrl;
}

/**
 * Télécharge une vidéo de manière optimisée avec streaming et gestion de la taille.
 */
async function downloadVideoOptimized(videoUrl: string, monitor: TranscriptionMonitor): Promise<Blob> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.FILE_DOWNLOAD);
  
  try {
    logTranscriptionEvent('info', 'download_started', monitor.metrics.videoId, { url: videoUrl });
    
    const headResponse = await fetch(videoUrl, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'SmooveBox-Transcription/1.0',
        'Accept': 'video/*,audio/*'
      }
    });
    
    if (!headResponse.ok) {
      throw new TranscriptionError(`Fichier non accessible (HEAD): ${headResponse.status} ${headResponse.statusText}`, TranscriptionErrorType.DOWNLOAD_FAILED, true);
    }
    
    const contentLength = headResponse.headers.get('content-length');
    const contentType = headResponse.headers.get('content-type');
    
    logTranscriptionEvent('info', 'download_headers', monitor.metrics.videoId, { contentLength, contentType });
    
    const fileSize = contentLength ? parseInt(contentLength, 10) : 0;
    if (fileSize > 100 * 1024 * 1024) { // Limite de 100MB
      throw new TranscriptionError('Fichier trop volumineux (limite: 100MB)', TranscriptionErrorType.VALIDATION_ERROR, false);
    }
    
    const response = await fetch(videoUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SmooveBox-Transcription/1.0',
        'Accept': 'video/*,audio/*'
      }
    });
    
    if (!response.ok) {
      throw new TranscriptionError(`Échec du téléchargement (GET): ${response.status} ${response.statusText}`, TranscriptionErrorType.DOWNLOAD_FAILED, true);
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new TranscriptionError('Impossible de lire le flux de données de la réponse', TranscriptionErrorType.DOWNLOAD_FAILED, false);
    }
    
    const chunks: Uint8Array[] = [];
    let downloadedBytes = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      downloadedBytes += value.length;
    }
    
    const blob = new Blob(chunks, { type: contentType || 'video/mp4' });
    logTranscriptionEvent('info', 'download_completed', monitor.metrics.videoId, { fileSize: blob.size });
    
    return blob;
    
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Appelle l'API Whisper d'OpenAI pour transcrire le fichier audio.
 */
async function callWhisperAPIOptimized(audioBlob: Blob, monitor: TranscriptionMonitor): Promise<any> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new TranscriptionError('Clé API OpenAI (OPENAI_API_KEY) manquante', TranscriptionErrorType.UNKNOWN, false);
  }
  const openai = new OpenAI({ 
    apiKey: openaiApiKey,
    timeout: TIMEOUTS.WHISPER_API
  });
  
  const maxSize = 25 * 1024 * 1024; // Limite de 25MB pour l'API Whisper
  if (audioBlob.size > maxSize) {
    // TODO: Implémenter le découpage du fichier si nécessaire.
    throw new TranscriptionError(
      `Fichier trop volumineux pour l'API Whisper: ${audioBlob.size} bytes (limite: ${maxSize})`,
      TranscriptionErrorType.VALIDATION_ERROR,
      false
    );
  }
  
  // Choisir une extension de fichier appropriée peut aider l'API.
  const fileName = audioBlob.type.includes('mp4') ? 'audio.m4a' : 'audio.mp3';
  const file = new File([audioBlob], fileName, { type: audioBlob.type || 'audio/mpeg' });
  
  logTranscriptionEvent('info', 'whisper_api_call_started', monitor.metrics.videoId, { fileName, fileSize: file.size });
  
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'fr',
      response_format: 'verbose_json',
      temperature: 0.0,
      prompt: 'Ceci est un pitch vidéo en français. Transcrivez avec précision, en incluant la ponctuation.'
    });
    
    logTranscriptionEvent('info', 'whisper_api_call_success', monitor.metrics.videoId, { textLength: transcription.text.length });
    return transcription;
    
  } catch (apiError: any) {
    const errorClassification = classifyError(apiError);
    throw new TranscriptionError(
      `Erreur API OpenAI: ${errorClassification.message}`,
      errorClassification.type,
      errorClassification.retryable,
      apiError
    );
  }
}

/**
 * Calcule un score de confiance moyen basé sur les segments de la transcription.
 */
function calculateConfidenceScore(segments: any[]): number | null {
  if (!segments || !Array.isArray(segments) || segments.length === 0) {
    return null;
  }
  
  const validSegments = segments.filter(seg => typeof seg.avg_logprob === 'number' && !isNaN(seg.avg_logprob));
  
  if (validSegments.length === 0) {
    return null;
  }
  
  const avgLogProb = validSegments.reduce((acc, seg) => acc + seg.avg_logprob, 0) / validSegments.length;
  
  // Convertir le log-probabilité en une échelle de confiance de 0 à 1
  const confidenceScore = Math.exp(avgLogProb);
  
  return Math.round(Math.max(0, Math.min(1, confidenceScore)) * 100) / 100;
}

/**
 * Sauvegarde la transcription en utilisant une transaction RPC dans Supabase.
 */
async function saveTranscriptionOptimized(
  serviceClient: any,
  videoId: string, 
  userId: string, 
  transcription: any
): Promise<void> {
  
  const transcriptionData = {
    video_id: videoId,
    user_id: userId,
    language: transcription.language || 'fr',
    full_text: transcription.text,
    transcription_text: transcription.text, // Peut être différent si on nettoie le texte
    segments: transcription.segments || [],
    duration: transcription.duration || null,
    confidence_score: calculateConfidenceScore(transcription.segments),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  // Valider que la transcription n'est pas vide ou trop courte
  if (!transcriptionData.full_text || transcriptionData.full_text.trim().length < 10) {
    throw new TranscriptionError('Transcription générée trop courte ou vide', TranscriptionErrorType.VALIDATION_ERROR, false);
  }
  
  // Utilisation d'une fonction RPC pour une sauvegarde transactionnelle
  const { error: transactionError } = await serviceClient.rpc('save_transcription_transaction', {
    p_video_id: videoId,
    p_transcription_data: transcriptionData,
    p_video_status: VIDEO_STATUS.TRANSCRIBED
  });
  
  if (transactionError) {
    throw new TranscriptionError(
      `Erreur de sauvegarde de la transaction: ${transactionError.message}`,
      TranscriptionErrorType.DATABASE_ERROR,
      true, // Les erreurs DB sont souvent retryable
      transactionError
    );
  }
  
  logTranscriptionEvent('info', 'transcription_saved', videoId);
}

/**
 * Met à jour le statut de la vidéo, y compris en cas d'erreur.
 */
async function updateVideoStatus(
  serviceClient: any,
  videoId: string,
  status: typeof VIDEO_STATUS[keyof typeof VIDEO_STATUS],
  errorInfo?: { error_message?: string; error_type?: TranscriptionErrorType; error_details?: any }
): Promise<void> {
  try {
    const updateData: any = {
      status: status,
      updated_at: new Date().toISOString()
    };
    if (errorInfo) {
      updateData.error_message = errorInfo.error_message;
      updateData.error_type = errorInfo.error_type;
      updateData.error_details = errorInfo.error_details;
    }

    const { error } = await serviceClient
      .from('videos')
      .update(updateData)
      .eq('id', videoId);

    if (error) {
      logTranscriptionEvent('error', 'update_video_status_failed', videoId, { status, error: error.message });
    } else {
      logTranscriptionEvent('info', 'update_video_status_success', videoId, { status });
    }
  } catch (err) {
    logTranscriptionEvent('error', 'update_video_status_exception', videoId, { status, error: err.message });
  }
}

/**
 * Fonction principale orchestrant le processus de transcription.
 */
async function transcribeVideoWithMonitoring(
  serviceClient: any,
  videoId: string, 
  userId: string,
  providedUrl?: string
): Promise<TranscriptionResult> {
  
  const monitor = new TranscriptionMonitor(videoId, userId);
  
  try {
    logTranscriptionEvent('info', 'transcription_started', videoId, { userId });
    await updateVideoStatus(serviceClient, videoId, VIDEO_STATUS.PROCESSING);

    // 1. Récupérer l'URL de la vidéo
    monitor.startStep('urlRetrieval');
    const { url: videoUrl } = await retryWithBackoff(() => getVideoUrl(serviceClient, videoId, providedUrl));
    monitor.endStep('urlRetrieval');
    
    // 2. Télécharger la vidéo
    monitor.startStep('download');
    const audioBlob = await retryWithBackoff(() => downloadVideoOptimized(videoUrl, monitor), 2, 2000, 60000);
    monitor.endStep('download');
    monitor.setFileSize(audioBlob.size);
    
    // 3. Appeler l'API Whisper
    monitor.startStep('transcription');
    const transcription = await retryWithBackoff(() => callWhisperAPIOptimized(audioBlob, monitor), 3, 5000, 120000);
    monitor.endStep('transcription');
    
    const confidenceScore = calculateConfidenceScore(transcription.segments);
    monitor.setTranscriptionResult(transcription.text, confidenceScore);
    
    // 4. Sauvegarder la transcription en base de données
    monitor.startStep('database');
    await retryWithBackoff(() => saveTranscriptionOptimized(serviceClient, videoId, userId, transcription));
    monitor.endStep('database');
    
    await updateVideoStatus(serviceClient, videoId, VIDEO_STATUS.TRANSCRIBED);

    // 5. Déclencher la fonction d'analyse (de manière asynchrone)
    triggerAnalysis(videoId);

    const finalMetrics = monitor.finish();
    await monitor.saveMetrics(serviceClient);
    logTranscriptionEvent('info', 'transcription_success', videoId, { totalDuration: finalMetrics.duration });

    return {
      success: true,
      transcription,
      videoId,
      metrics: finalMetrics
    };
    
  } catch (error: any) {
    const errorType = error instanceof TranscriptionError ? error.type : TranscriptionErrorType.UNKNOWN;
    monitor.setError(errorType);
    
    logTranscriptionEvent('error', 'transcription_failed', videoId, {
      error: error.message,
      errorType,
      retryCount: monitor.metrics.retryCount
    });
    
    const finalMetrics = monitor.finish();
    await monitor.saveMetrics(serviceClient);
    
    await updateVideoStatus(serviceClient, videoId, VIDEO_STATUS.FAILED, {
      error_message: error.message,
      error_type: errorType,
      error_details: {
        timestamp: new Date().toISOString(),
        retryable: error.retryable || false,
        originalError: error.originalError?.message
      }
    });

    // Renvoyer l'erreur pour que le handler principal puisse la traiter
    throw error;
  }
}

/**
 * Déclenche la fonction d'analyse de manière asynchrone sans bloquer la réponse.
 */
async function triggerAnalysis(videoId: string): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      logTranscriptionEvent('warn', 'trigger_analysis_skipped', videoId, { reason: 'Supabase env vars missing' });
      return;
    }

    const analyzeEndpoint = `${supabaseUrl}/functions/v1/analyze-transcription`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`
    };
    
    logTranscriptionEvent('info', 'trigger_analysis_started', videoId, { endpoint: analyzeEndpoint });
    
    // Ne pas attendre la réponse pour ne pas bloquer le retour de la fonction de transcription
    fetch(analyzeEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ videoId })
    }).then(async response => {
      if (!response.ok) {
        const errorText = await response.text();
        logTranscriptionEvent('error', 'trigger_analysis_failed', videoId, { status: response.status, error: errorText });
      } else {
        logTranscriptionEvent('info', 'trigger_analysis_success', videoId);
      }
    }).catch(invokeError => {
      logTranscriptionEvent('error', 'trigger_analysis_exception', videoId, { error: invokeError.message });
    });

  } catch (e) {
    logTranscriptionEvent('error', 'trigger_analysis_setup_failed', videoId, { error: e.message });
  }
}

// --- Middleware et Handler Principal --- //

/**
 * Middleware pour gérer l'authentification et l'initialisation du client Supabase.
 */
function withAuth(handler: (req: Request, user: any, serviceClient: any) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    // Gérer les requêtes pre-flight CORS
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      logTranscriptionEvent('error', 'env_vars_missing', '', { details: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set' });
      return new Response(
        JSON.stringify({ error: 'Configuration du serveur incomplète' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.DATABASE_OPERATION);
          return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
        }
      }
    });
    
    const authResult = await authenticateRequest(req, serviceClient);
    
    if (!authResult.user) {
      return new Response(
        JSON.stringify({ error: 'Authentification requise', details: authResult.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    
    try {
      return await handler(req, authResult.user, serviceClient);
    } catch (error: any) {
      logTranscriptionEvent('error', 'unhandled_handler_exception', '', { error: error.message, stack: error.stack });
      return new Response(
        JSON.stringify({ error: 'Erreur interne du serveur', details: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  };
}

/**
 * Point d'entrée de la Deno Edge Function.
 */
Deno.serve(withAuth(async (req: Request, user: any, serviceClient: any) => {
  let videoId: string | null = null;
  let providedUrl: string | undefined = undefined;

  try {
    const url = new URL(req.url);
    videoId = url.searchParams.get('videoId');

    if (req.body) {
      const requestBody = await req.json();
      if (requestBody.videoId && !videoId) {
        videoId = requestBody.videoId;
      }
      if (requestBody.videoUrl) {
        providedUrl = requestBody.videoUrl;
      }
    }
  } catch (parseError) {
    // Ignorer l'erreur si le corps est vide ou n'est pas du JSON
    if (!(parseError instanceof SyntaxError)) {
        logTranscriptionEvent('warn', 'request_body_parse_failed', '', { error: parseError.message });
    }
  }

  if (!videoId) {
    return new Response(
      JSON.stringify({ error: 'videoId requis', details: 'Veuillez fournir videoId comme paramètre d\'URL ou dans le corps de la requête JSON' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }

  // Vérifier l'accès à la vidéo après avoir récupéré videoId
  const hasAccess = await checkVideoAccess(serviceClient, user.id, videoId);
  if (!hasAccess) {
      return new Response(
          JSON.stringify({ error: 'Accès non autorisé', details: 'Vous n\'avez pas la permission d\'accéder à cette vidéo.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
  }

  try {
    const result = await transcribeVideoWithMonitoring(serviceClient, videoId, user.id, providedUrl);
    return new Response(
      JSON.stringify({ message: 'Transcription réussie', data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    logTranscriptionEvent('error', 'main_handler_error', videoId, { error: error.message, stack: error.stack });
    const status = error.type === TranscriptionErrorType.AUTHENTICATION ? 401 :
                   error.type === TranscriptionErrorType.VIDEO_NOT_FOUND ? 404 :
                   error.type === TranscriptionErrorType.VALIDATION_ERROR ? 400 :
                   500; // Erreur interne du serveur par défaut
    return new Response(
      JSON.stringify({ error: error.message, details: error.originalError?.message || 'Erreur interne du serveur' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: status }
    );
  }
}));
