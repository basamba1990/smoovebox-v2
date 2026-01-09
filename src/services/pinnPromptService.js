// Service PINN-like (Physics-Informed Neural Network-like)
// Génère des prompts vidéo en appliquant des contraintes réalistes du marché de l'emploi (WEF)
// et l'univers narratif de la Planète de Lumi (émotions, éco-futurisme).

import { futureJobsData } from '../data/futureJobsData.js';

/**
 * Service de génération de prompts vidéo inspiré des PINN
 * Les "physics" sont les contraintes réalistes du marché de l'emploi
 * Intègre désormais la dimension émotionnelle et l'univers de Lumi.
 */

class PINNPromptService {
  constructor() {
    this.videoGenerators = ['sora', 'runway', 'pika'];
    this.stylePresets = {
      'semi-realistic': 'semi-réaliste, haute définition, lumière naturelle',
      'futuristic': 'futuriste, néon, hologrammes, lumière froide',
      'cinematic': 'cinématique, cinéma 4K, couleurs saturées',
      'documentary': 'documentaire, réaliste, lumière naturelle',
      'abstract': 'abstrait, symbolique, effets visuels avancés',
      'lumi-universe': 'éco-futurisme, Planète de Lumi, couleurs Prussian Blue, Midnight Green et Sky Blue, lumière irisée, structures hexagonales, ambiance organique et technologique'
    };
    this.durations = [15, 20, 25, 30, 45, 60];
  }

  /**
   * Récupère un métier futur par son ID
   */
  getJobById(jobId) {
    return futureJobsData.find(job => job.id === jobId);
  }

  /**
   * Récupère tous les métiers futurs
   */
  getAllJobs() {
    return futureJobsData;
  }

  /**
   * Génère un prompt vidéo avec contraintes PINN-like et émotionnelles
   * @param {number} jobId - ID du métier
   * @param {object} options - Options de génération (generator, style, duration, customizations)
   * @returns {object} - Prompt structuré avec contraintes
   */
  generatePrompt(jobId, options = {}) {
    const job = this.getJobById(jobId);
    if (!job) {
      throw new Error(`Job with ID ${jobId} not found`);
    }

    const {
      generator = 'sora',
      style = 'lumi-universe', // Style par défaut mis à jour vers l'univers de Lumi
      duration = 30,
      customizations = {}
    } = options;

    // Validation
    if (!this.videoGenerators.includes(generator.toLowerCase())) {
      throw new Error(`Generator ${generator} not supported. Use: ${this.videoGenerators.join(', ')}`);
    }
    // Correction: Assurer que le style 'lumi-universe' est utilisé si le style par défaut 'futuristic' est sélectionné
    const finalStyle = style === 'futuristic' ? 'lumi-universe' : style;
    if (!this.stylePresets[finalStyle]) {
      throw new Error(`Style ${style} not supported. Use: ${Object.keys(this.stylePresets).join(', ')}`);
    }
    if (!this.durations.includes(duration)) {
      throw new Error(`Duration ${duration} not supported. Use: ${this.durations.join(', ')}`);
    }

    // Construction du prompt avec contraintes PINN-like et émotionnelles
    const prompt = this._buildPINNPrompt(job, generator, style, duration, customizations);

    return {
      jobId,
      jobTitle: job.title,
      year: job.year,
      generator,
      style,
      duration,
      prompt,
      constraints: {
        keyTasks: job.keyTasks,
        coreSkills: job.coreSkills,
        emergingTech: job.emergingTech,
        visualElements: job.visualElements
      },
      // Ajout du prompt original pour référence
      originalPrompt: job.basePrompt,
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '2.0 (Lumi Edition)'
      }
    };
  }

  /**
   * Construit le prompt PINN-like en appliquant les contraintes réalistes et émotionnelles
   */
  _buildPINNPrompt(job, generator, style, duration, customizations) {
    // ⚠️ CORRECTION CRITIQUE: Traduire et simplifier le prompt pour les modèles IA
    
    // 1. Traduction des éléments clés (pour l'exemple, nous traduisons manuellement le job ID 1)
    // En production, il est fortement recommandé d'ajouter des champs EN dans futureJobsData.js
    const translatedJob = this._translateJobData(job);
    const styleDescription = this.stylePresets[style];
    
    // 2. Construction du prompt unique et narratif en anglais
    const prompt = this._buildCleanEnglishPrompt(translatedJob, styleDescription, duration, generator);

    return prompt;
  }

  /**
   * Traduit manuellement les données du métier pour l'exemple (AI & Machine Learning Specialist - ID 1)
   * En production, cette fonction devrait utiliser un service de traduction ou des données pré-traduites.
   */
  _translateJobData(job) {
    // Fallback pour les autres jobs, mais l'utilisateur doit les traduire
    if (job.id !== 1) {
      return {
        ...job,
        basePromptEn: job.basePrompt, // Non traduit
        keyTasksEn: job.keyTasks,
        emergingTechEn: job.emergingTech,
        visualElementsEn: job.visualElements,
        coreSkillsEn: job.coreSkills
      };
    }

    // Traduction manuelle pour l'exemple "AI & Machine Learning Specialist" (ID 1)
    return {
      ...job,
      basePromptEn: "Generate a video showing an AI specialist inside a GenUp 2050 dome. The environment is composed of bioactive hexagonal structures. The specialist interacts with holographic neural networks whose colors pulse according to the system's emotional activity. The specialist displays an expression of deep concentration and empathy as they adjust parameters for Lumi.",
      keyTasksEn: "Designing and supervising advanced AI models, training neural networks, optimizing algorithms.",
      emergingTechEn: "Generative AI, Collaborative Robots, Autonomous Systems.",
      visualElementsEn: "GenUp 2050 Dome, bioactive hexagonal structures, holographic neural networks reflecting synaptic impulses, iridescent light.",
      coreSkillsEn: "Deep learning, NLP, Frameworks (PyTorch, TensorFlow), Applied Mathematics."
    };
  }

  /**
   * Construit le prompt final propre et optimisé pour les générateurs vidéo.
   */
  _buildCleanEnglishPrompt(job, styleDescription, duration, generator) {
    // 3. Intégration des contraintes dans la narration
    const constraintsNarrative = `The scene must visualize the specialist performing key tasks such as: ${job.keyTasksEn}. The environment should integrate emerging technologies like: ${job.emergingTechEn}. Key visual elements of the Lumi Planet must be present: ${job.visualElementsEn}. The overall message must show how human emotion (empathy, concentration) enriches the Lumi universe.`;

    // 4. Directives de style et techniques
    const styleDirectives = `Style: ${styleDescription}. Palette: Prussian Blue, Midnight Green, Sky Blue, with neon violet/cyan accents. Shot: Cinematic wide shot transitioning to a close-up on the specialist's face, then a slow pan over the holographic network. Lighting: Iridescent, treated as a 'vital warmth'. Duration: ${duration} seconds.`;

    // 5. Assemblage du prompt final (Anglais, sans balises)
    const finalPrompt = `${job.basePromptEn} ${constraintsNarrative} ${styleDirectives}`;

    return finalPrompt.trim();
  }

  /**
   * Génère des prompts en batch pour plusieurs métiers
   */
  generateBatchPrompts(jobIds, options = {}) {
    return jobIds.map(jobId => {
      try {
        return this.generatePrompt(jobId, options);
      } catch (error) {
        return {
          jobId,
          error: error.message
        };
      }
    });
  }

  /**
   * Génère des variantes d'un même prompt
   */
  generatePromptVariants(jobId, variantCount = 3, baseOptions = {}) {
    const job = this.getJobById(jobId);
    if (!job) {
      throw new Error(`Job with ID ${jobId} not found`);
    }

    const styles = Object.keys(this.stylePresets);
    const variants = [];

    for (let i = 0; i < variantCount; i++) {
      const style = styles[i % styles.length];
      const duration = this.durations[i % this.durations.length];
      
      const variant = this.generatePrompt(jobId, {
        ...baseOptions,
        style,
        duration
      });

      variants.push(variant);
    }

    return {
      jobId,
      jobTitle: job.title,
      variantCount,
      variants
    };
  }

  /**
   * Exporte un prompt au format compatible avec Sora/Runway/Pika
   */
  exportForGenerator(promptData, format = 'text') {
    if (format === 'text') {
      return promptData.prompt;
    } else if (format === 'json') {
      return JSON.stringify(promptData, null, 2);
    } else if (format === 'markdown') {
      return this._formatAsMarkdown(promptData);
    } else {
      throw new Error(`Format ${format} not supported. Use: text, json, markdown`);
    }
  }

  /**
   * Formate le prompt en Markdown
   */
  _formatAsMarkdown(promptData) {
    const { jobTitle, year, generator, style, duration, prompt, constraints } = promptData;

    return `
# ${jobTitle} (${year}) - Planète de Lumi
    
## Informations de Génération
- **Générateur**: ${generator}
- **Style**: ${style}
- **Durée**: ${duration}s

## Prompt Final (Copier-coller dans le générateur)
\`\`\`text
${prompt}
\`\`\`

## Contraintes Appliquées
- **Tâches**: ${constraints.keyTasks}
- **Compétences**: ${constraints.coreSkills}
- **Technologies**: ${constraints.emergingTech}
- **Éléments visuels**: ${constraints.visualElements}
    `.trim();
  }
}

// Export singleton
export default new PINNPromptService();
