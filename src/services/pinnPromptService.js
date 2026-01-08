// src/services/pinnPromptService.js
// IMPORTATION CORRIGÉE : Utilise le nom de fichier standard du projet
import { futureJobsData } from '../data/futureJobsData.js';

class PINNPromptService {
  constructor() {
    this.videoGenerators = ['SORA', 'RUNWAY', 'PIKA'];
    this.stylePresets = {
      'SEMI-REALISTIC': 'semi-realistic, high definition, natural lighting',
      'FUTURISTIC': 'futuristic, neon, holograms, cold light',
      'CINEMATIC': 'cinematic, 4K cinema, saturated colors',
      'DOCUMENTARY': 'documentary, realistic, natural light',
      'ABSTRACT': 'abstract, symbolic, advanced visual effects',
      'LUMI-UNIVERSE': 'eco-futurism, Planet Lumi, Prussian Blue, Midnight Green and Sky Blue colors, iridescent light, hexagonal structures, organic and technological atmosphere'
    };
    this.durations = [15, 20, 25, 30, 45, 60];
  }

  getJobById(jobId) {
    // Conversion en string pour assurer la comparaison
    return futureJobsData.find(job => String(job.id) === String(jobId));
  }

  generatePrompt(jobId, options = {}) {
    const job = this.getJobById(jobId);
    if (!job) throw new Error(`Job with ID ${jobId} not found`);

    const generator = (options.generator || 'SORA').toUpperCase();
    const style = (options.style || 'LUMI-UNIVERSE').toUpperCase();
    const duration = Number(options.duration || 30);

    const styleDescription = this.stylePresets[style] || this.stylePresets['LUMI-UNIVERSE'];
    
    const prompt = this._buildCleanEnglishPrompt(job, styleDescription, duration, generator);

    return {
      jobId,
      jobTitle: job.title,
      generator,
      style,
      duration,
      prompt,
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '2.2 (Build Fix)'
      }
    };
  }

  _buildCleanEnglishPrompt(job, styleDescription, duration, generator) {
    const base = job.basePromptEn || job.basePrompt;
    const tasks = job.keyTasksEn || job.keyTasks;
    const tech = job.emergingTechEn || job.emergingTech;
    const visual = job.visualElementsEn || job.visualElements;

    const constraints = `Tasks: ${tasks}. Tech: ${tech}. Visuals: ${visual}.`;
    const styleDirectives = `Style: ${styleDescription}. Duration: ${duration}s. Generator: ${generator}.`;

    return `${base} ${constraints} ${styleDirectives}`.trim();
  }
}

export default new PINNPromptService();
