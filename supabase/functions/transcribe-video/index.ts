import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'

// Valeurs exactes autorisées pour le statut dans la base de données
const VIDEO_STATUS = {
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  TRANSCRIBED: 'transcribed',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  PUBLISHED: 'published',
  FAILED: 'failed'
} as const

// En-têtes CORS pour permettre les requêtes cross-origin
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

// Timeout global pour l'exécution de la fonction
const EXECUTION_TIMEOUT = 300000; // 5 minutes

// Configuration des timeouts adaptés selon le type d'opération
const TIMEOUTS = {
  DATABASE_OPERATION: 10000,    // 10 secondes pour les opérations DB
  FILE_DOWNLOAD: 300000,        // 5 minutes pour le téléchargement
  WHISPER_API: 600000,          // 10 minutes pour la transcription
  FUNCTION_EXECUTION: 900000    // 15 minutes pour l'exécution totale
} as const;

// Helper function pour valider et construire une URL complète
function buildCompleteUrl(supabaseUrl: string, bucket: string, filePath: string): string {
  const cleanPath = filePath.replace(/^\/+/, '');
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
  console.log(`URL construite: ${publicUrl}`);
  return publicUrl;
}

// Helper function pour valider qu'une URL est complète et valide
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Helper function pour valider les données de transcription avant insertion
function validateTranscriptionData(transcription: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!transcription.text || typeof transcription.text !== 'string') {
    errors.push('Le texte de transcription est requis et doit être une chaîne');
  }
  
  if (transcription.duration !== null && transcription.duration !== undefined) {
    if (typeof transcription.duration !== 'number' || transcription.duration < 0) {
      errors.push('La durée doit être un nombre positif ou null');
    }
  }
  
  if (transcription.segments && !Array.isArray(transcription.segments)) {
    errors.push('Les segments doivent être un tableau');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Interface pour les résultats d'authentification
interface AuthResult {
  user: {
    id: string;
    email: string;
    role?: string;
  } | null;
  error?: string;
}

// Interface pour les résultats de transcription
interface TranscriptionResult {
  success: boolean;
  transcription?: any;
  videoId: string;
  metrics?: TranscriptionMetrics;
}

// Interface pour les métriques de transcription
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

// Énumération des types d'erreurs pour une meilleure classification
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

// Classe d'erreur personnalisée pour la transcription
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

// Classe pour collecter les métriques
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
      await serviceClient
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
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des métriques:', error);
    }
  }
}

// Fonction de logging structuré
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

// Fonction de classification des erreurs
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
    retryable: true
  };
}

// Fonction de retry avec backoff exponentiel et classification d'erreurs
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 30000
): Promise<T> {
  let lastError: Error;
  
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
      
      console.log(`Tentative ${attempt + 1}/${maxRetries} échouée, retry dans ${delay}ms: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Fonction pour vérifier l'accès à une vidéo
async function checkVideoAccess(serviceClient: any, userId: string, videoId: string): Promise<boolean> {
  try {
    const { data: video, error } = await serviceClient
      .from('videos')
      .select('user_id')
      .eq('id', videoId)
      .single();
      
    if (error || !video) {
      return false;
    }
    
    return video.user_id === userId;
  } catch (error) {
    console.error('Erreur lors de la vérification d\'accès:', error);
    return false;
  }
}

// Fonction d'authentification simplifiée et sécurisée
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
    
    const url = new URL(req.url);
    const videoId = url.searchParams.get('videoId');
    
    if (videoId) {
      const hasAccess = await checkVideoAccess(serviceClient, user.id, videoId);
      if (!hasAccess) {
        return {
          user: null,
          error: 'Accès non autorisé à cette vidéo'
        };
      }
    }
    
    return {
      user: {
        id: user.id,
        email: user.email,
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

// Middleware d'authentification réutilisable
function withAuth(handler: (req: Request, user: any, serviceClient: any) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Variables d\'environnement manquantes pour Supabase');
      return new Response(
        JSON.stringify({
          error: 'Configuration incomplète',
          details: "Variables d'environnement Supabase manquantes"
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.DATABASE_OPERATION);
          
          return fetch(input, {
            ...init,
            signal: controller.signal
          }).finally(() => clearTimeout(timeoutId));
        }
      }
    });
    
    const authResult = await authenticateRequest(req, serviceClient);
    
    if (!authResult.user) {
      return new Response(
        JSON.stringify({
          error: 'Authentification requise',
          details: authResult.error
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        }
      );
    }
    
    try {
      return await handler(req, authResult.user, serviceClient);
    } catch (error: any) {
      console.error('Erreur dans le handler:', error);
      return new Response(
        JSON.stringify({
          error: 'Erreur interne du serveur',
          details: error.message || 'Une erreur inattendue est survenue.'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }
  };
}

// Nouvelle fonction simplifiée pour récupérer l'URL de la vidéo
async function getVideoUrl(
  serviceClient: any,
  videoId: string,
  providedUrl?: string
): Promise<{ url: string; source: string }> {
  
  if (providedUrl && isValidUrl(providedUrl)) {
    console.log(`URL valide fournie: ${providedUrl}`);
    return { url: providedUrl, source: 'provided' };
  }
  
  const { data: video, error: videoError } = await serviceClient
    .from('videos')
    .select('storage_path, url, bucket_name')
    .eq('id', videoId)
    .single();
    
  if (videoError) {
    throw new Error(`Impossible de récupérer les informations de la vidéo: ${videoError.message}`);
  }
  
  if (video.url && isValidUrl(video.url)) {
    console.log(`URL trouvée en base de données: ${video.url}`);
    return { url: video.url, source: 'database' };
  }
  
  if (video.storage_path) {
    const bucket = video.bucket_name || 'videos';
    const signedUrl = await generateSignedUrl(serviceClient, bucket, video.storage_path);
    console.log(`URL signée générée: ${signedUrl}`);
    return { url: signedUrl, source: 'signed' };
  }
  
  throw new Error('Aucune URL valide trouvée pour cette vidéo');
}

// Fonction améliorée pour générer une URL signée
async function generateSignedUrl(
  serviceClient: any,
  bucket: string,
  filePath: string,
  expiresIn: number = 3600
): Promise<string> {
  
  const cleanPath = filePath.replace(/^\/+/, '').replace(/\/+/g, '/');
  
  const { data: fileExists, error: existsError } = await serviceClient.storage
    .from(bucket)
    .list(cleanPath.split('/').slice(0, -1).join('/') || undefined, {
      search: cleanPath.split('/').pop()
    });
    
  if (existsError || !fileExists?.length) {
    throw new Error(`Fichier non trouvé dans le bucket ${bucket}: ${cleanPath}`);
  }
  
  const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
    .from(bucket)
    .createSignedUrl(cleanPath, expiresIn);
    
  if (signedUrlError || !signedUrlData?.signedUrl) {
    throw new Error(`Impossible de générer l'URL signée: ${signedUrlError?.message}`);
  }
  
  return signedUrlData.signedUrl;
}

// Fonction de téléchargement optimisée avec streaming
async function downloadVideoOptimized(videoUrl: string): Promise<Blob> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.FILE_DOWNLOAD);
  
  try {
    console.log(`Début du téléchargement: ${videoUrl}`);
    
    const headResponse = await fetch(videoUrl, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'SmooveBox-Transcription/1.0',
        'Accept': 'video/*,audio/*'
      }
    });
    
    if (!headResponse.ok) {
      throw new Error(`Fichier non accessible: ${headResponse.status} ${headResponse.statusText}`);
    }
    
    const contentLength = headResponse.headers.get('content-length');
    const contentType = headResponse.headers.get('content-type');
    
    console.log(`Taille du fichier: ${contentLength} bytes, Type: ${contentType}`);
    
    if (contentLength && parseInt(contentLength) > 100 * 1024 * 1024) {
      throw new Error('Fichier trop volumineux (limite: 100MB)');
    }
    
    const response = await fetch(videoUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SmooveBox-Transcription/1.0',
        'Accept': 'video/*,audio/*'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Échec du téléchargement: ${response.status} ${response.statusText}`);
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Impossible de lire le flux de données');
    }
    
    const chunks: Uint8Array[] = [];
    let downloadedBytes = 0;
    const totalBytes = contentLength ? parseInt(contentLength) : 0;
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value);
      downloadedBytes += value.length;
      
      if (downloadedBytes % (10 * 1024 * 1024) === 0 || downloadedBytes === totalBytes) {
        const progress = totalBytes ? (downloadedBytes / totalBytes * 100).toFixed(1) : 'N/A';
        console.log(`Téléchargement: ${downloadedBytes} bytes (${progress}%)`);
      }
    }
    
    const blob = new Blob(chunks, { type: contentType || 'video/mp4' });
    console.log(`Téléchargement terminé: ${blob.size} bytes`);
    
    return blob;
    
  } finally {
    clearTimeout(timeoutId);
  }
}

// Fonction d'appel à l'API Whisper optimisée
async function callWhisperAPIOptimized(audioBlob: Blob): Promise<any> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new TranscriptionError('Clé API OpenAI manquante', TranscriptionErrorType.UNKNOWN);
  }
  const openai = new OpenAI({ 
    apiKey: openaiApiKey,
    timeout: TIMEOUTS.WHISPER_API
  });
  
  const maxSize = 25 * 1024 * 1024; // 25MB limite OpenAI
  if (audioBlob.size > maxSize) {
    throw new TranscriptionError(
      `Fichier trop volumineux pour l'API Whisper: ${audioBlob.size} bytes (limite: ${maxSize})`,
      TranscriptionErrorType.VALIDATION_ERROR
    );
  }
  
  const fileName = audioBlob.size > 10 * 1024 * 1024 ? 'audio.m4a' : 'audio.mp3';
  const file = new File([audioBlob], fileName, { 
    type: audioBlob.type || 'audio/mpeg' 
  });
  
  console.log(`Envoi à Whisper: ${file.name}, taille: ${file.size} bytes`);
  
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'fr',
      response_format: 'verbose_json',
      temperature: 0.0,
      prompt: 'Ceci est un pitch vidéo en français. Transcrivez avec précision.'
    });
    
    console.log(`Transcription réussie: ${transcription.text.length} caractères`);
    return transcription;
    
  } catch (apiError: any) {
    if (apiError.status === 429) {
      throw new TranscriptionError(
        'Limite de débit API atteinte',
        TranscriptionErrorType.API_RATE_LIMIT,
        true,
        apiError
      );
    } else if (apiError.status >= 500) {
      throw new TranscriptionError(
        'Erreur serveur OpenAI',
        TranscriptionErrorType.API_ERROR,
        true,
        apiError
      );
    } else {
      throw new TranscriptionError(
        `Erreur API OpenAI: ${apiError.message}`,
        TranscriptionErrorType.API_ERROR,
        false,
        apiError
      );
    }
  }
}

// Fonction pour calculer le score de confiance
function calculateConfidenceScore(segments: any[]): number | null {
  if (!segments || !Array.isArray(segments) || segments.length === 0) {
    return null;
  }
  
  const validSegments = segments.filter(seg => 
    seg.avg_logprob !== undefined && 
    seg.avg_logprob !== null && 
    !isNaN(seg.avg_logprob)
  );
  
  if (validSegments.length === 0) {
    return null;
  }
  
  const avgLogProb = validSegments.reduce((acc, seg) => acc + seg.avg_logprob, 0) / validSegments.length;
  
  const confidenceScore = Math.max(0, Math.min(1, Math.exp(avgLogProb)));
  
  return Math.round(confidenceScore * 100) / 100;
}

// Fonction de sauvegarde optimisée avec transaction
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
    transcription_text: transcription.text,
    segments: transcription.segments || [],
    duration: transcription.duration || null,
    confidence_score: calculateConfidenceScore(transcription.segments),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  if (!transcriptionData.full_text || transcriptionData.full_text.length < 10) {
    throw new TranscriptionError(
      'Transcription trop courte ou vide',
      TranscriptionErrorType.VALIDATION_ERROR,
      false
    );
  }
  
  const { error: transactionError } = await serviceClient.rpc('save_transcription_transaction', {
    p_video_id: videoId,
    p_transcription_data: transcriptionData,
    p_video_status: VIDEO_STATUS.TRANSCRIBED
  });
  
  if (transactionError) {
    throw new TranscriptionError(
      `Erreur de sauvegarde: ${transactionError.message}`,
      TranscriptionErrorType.DATABASE_ERROR,
      true,
      transactionError
    );
  }
  
  console.log(`Transcription sauvegardée avec succès pour la vidéo ${videoId}`);
}

// Fonction pour mettre à jour le statut de la vidéo
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
    if (errorInfo?.error_message) updateData.error_message = errorInfo.error_message;
    if (errorInfo?.error_type) updateData.error_type = errorInfo.error_type;
    if (errorInfo?.error_details) updateData.error_details = errorInfo.error_details;

    const { error } = await serviceClient
      .from('videos')
      .update(updateData)
      .eq('id', videoId);

    if (error) {
      console.error(`Erreur lors de la mise à jour du statut de la vidéo ${videoId} à ${status}:`, error);
    } else {
      console.log(`Statut de la vidéo ${videoId} mis à jour à '${status}'`);
    }
  } catch (err) {
    console.error(`Exception lors de la mise à jour du statut de la vidéo ${videoId}:`, err);
  }
}

// Fonction principale de transcription avec monitoring intégré
async function transcribeVideoWithMonitoring(
  serviceClient: any,
  videoId: string, 
  userId: string,
  providedUrl?: string
): Promise<TranscriptionResult> {
  
  const monitor = new TranscriptionMonitor(videoId, userId);
  
  try {
    logTranscriptionEvent('info', 'transcription_started', videoId, { userId, providedUrl });
    
    await updateVideoStatus(serviceClient, videoId, VIDEO_STATUS.PROCESSING);

    monitor.startStep('urlRetrieval');
    const { url: videoUrl } = await retryWithBackoff(async () => {
      monitor.incrementRetry();
      return await getVideoUrl(serviceClient, videoId, providedUrl);
    });
    monitor.endStep('urlRetrieval');
    
    logTranscriptionEvent('info', 'url_retrieved', videoId, { url: videoUrl });
    
    monitor.startStep('download');
    const audioBlob = await retryWithBackoff(async () => {
      return await downloadVideoOptimized(videoUrl);
    }, 2, 2000, 60000);
    monitor.endStep('download');
    monitor.setFileSize(audioBlob.size);
    
    logTranscriptionEvent('info', 'download_completed', videoId, { 
      fileSize: audioBlob.size,
      downloadDuration: monitor.metrics.steps.download 
    });
    
    monitor.startStep('transcription');
    const transcription = await retryWithBackoff(async () => {
      return await callWhisperAPIOptimized(audioBlob);
    }, 3, 5000, 120000);
    monitor.endStep('transcription');
    
    const confidenceScore = calculateConfidenceScore(transcription.segments);
    monitor.setTranscriptionResult(transcription.text, confidenceScore);
    
    logTranscriptionEvent('info', 'transcription_completed', videoId, {
      textLength: transcription.text.length,
      duration: transcription.duration,
      confidenceScore,
      transcriptionDuration: monitor.metrics.steps.transcription
    });
    
    monitor.startStep('database');
    await retryWithBackoff(async () => {
      return await saveTranscriptionOptimized(serviceClient, videoId, userId, transcription);
    });
    monitor.endStep('database');
    
    logTranscriptionEvent('info', 'transcription_saved', videoId);
    
    const finalMetrics = monitor.finish();
    await monitor.saveMetrics(serviceClient);
    
    logTranscriptionEvent('info', 'transcription_success', videoId, {
      totalDuration: finalMetrics.duration,
      retryCount: finalMetrics.retryCount
    });

    await updateVideoStatus(serviceClient, videoId, VIDEO_STATUS.TRANSCRIBED);

    // Déclencher la fonction d'analyse
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const analyzeEndpoint = `${supabaseUrl}/functions/v1/analyze-transcription`;
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      };
      
      console.log(`Appel de la fonction analyze-transcription via fetch à ${analyzeEndpoint}`);
      
      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ videoId })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Erreur de la fonction d'analyse (${response.status}): ${errorText}`);
        throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
      }
      
      const responseData = await response.json();
      console.log('Analyse démarrée avec succès:', responseData);
    } catch (invokeError) {
      console.error("Erreur lors de l'invocation de la fonction d'analyse:", invokeError)
    }
    
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
      retryCount: monitor.metrics.retryCount,
      duration: Date.now() - monitor.metrics.startTime
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

    throw error;
  }
}

Deno.serve(withAuth(async (req: Request, user: any, serviceClient: any) => {
  const url = new URL(req.url);
  let videoId = url.searchParams.get('videoId');
  let providedUrl: string | undefined = undefined;

  if (!videoId) {
    try {
      const requestBody = await req.text();
      if (requestBody.trim()) {
        const requestData = JSON.parse(requestBody);
        if (requestData.videoId) {
          videoId = requestData.videoId;
        }
        if (requestData.videoUrl) {
          providedUrl = requestData.videoUrl;
        }
      }
    } catch (parseError) {
      console.warn('Impossible de parser le corps de la requête:', parseError);
    }
  }

  if (!videoId) {
    return new Response(
      JSON.stringify({
        error: 'videoId requis',
        details: 'Veuillez fournir videoId comme paramètre d\'URL ou dans le corps de la requête'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
  
  try {
    const result = await transcribeVideoWithMonitoring(serviceClient, videoId, user.id, providedUrl);
    
    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error: any) {
    console.error('Erreur lors de l\'exécution de la transcription:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Erreur interne du serveur',
        details: error.originalError?.message || 'Une erreur inattendue est survenue.',
        type: error.type || TranscriptionErrorType.UNKNOWN
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
}));
