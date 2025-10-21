// src/lib/video-compressor.js - Version complète
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

class VideoCompressor {
  constructor() {
    this.ffmpeg = new FFmpeg();
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return;

    try {
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.loaded = true;
      console.log('✅ FFmpeg loaded successfully');
    } catch (error) {
      console.error('❌ FFmpeg loading failed:', error);
      throw error;
    }
  }

  async compressVideo(inputBlob, options = {}) {
    await this.load();

    const {
      crf = 28,
      preset = 'medium',
      maxWidth = 1280,
      maxHeight = 720
    } = options;

    try {
      // Écrire le fichier d'entrée
      await this.ffmpeg.writeFile('input.mp4', await fetchFile(inputBlob));

      // Configuration de compression optimisée pour la parole
      const args = [
        '-i', 'input.mp4',
        '-c:v', 'libx264',
        '-crf', crf.toString(),
        '-preset', preset,
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-vf', `scale='min(${maxWidth},iw)':'min(${maxHeight},ih)':force_original_aspect_ratio=decrease`,
        '-y', // Overwrite output file
        'output.mp4'
      ];

      await this.ffmpeg.exec(args);

      // Lire le fichier de sortie
      const data = await this.ffmpeg.readFile('output.mp4');
      const compressedBlob = new Blob([data.buffer], { type: 'video/mp4' });

      // Nettoyer les fichiers temporaires
      await this.ffmpeg.deleteFile('input.mp4');
      await this.ffmpeg.deleteFile('output.mp4');

      console.log(`✅ Compression réussie: ${inputBlob.size} → ${compressedBlob.size} bytes`);
      
      return {
        blob: compressedBlob,
        reduction: ((inputBlob.size - compressedBlob.size) / inputBlob.size * 100).toFixed(1)
      };

    } catch (error) {
      console.error('❌ Erreur compression:', error);
      throw new Error(`Échec de la compression: ${error.message}`);
    }
  }

  // Méthode rapide pour compression basique
  async quickCompress(inputBlob) {
    return this.compressVideo(inputBlob, {
      crf: 32,
      preset: 'fast',
      maxWidth: 854,
      maxHeight: 480
    });
  }
}

export const videoCompressor = new VideoCompressor();
