// Service PINN-like (Physics-Informed Neural Network-like)
// Génère des prompts vidéo en appliquant des contraintes réalistes du marché de l'emploi (WEF)
// et des technologies émergentes pour créer des vidéos crédibles et visuellement riches.

import { futureJobsData } from '../data/futureJobsData.js';

/**
 * Service de génération de prompts vidéo inspiré des PINN
 * Les "physics" sont les contraintes réalistes du marché de l'emploi
 */

class PINNPromptService {
  constructor() {
    this.videoGenerators = ['Sora', 'Runway', 'Pika'];
    this.stylePresets = {
      'semi-realistic': 'semi-réaliste, haute définition, lumière naturelle',
      'futuristic': 'futuriste, néon, hologrammes, lumière froide',
      'cinematic': 'cinématique, cinéma 4K, couleurs saturées',
      'documentary': 'documentaire, réaliste, lumière naturelle',
      'abstract': 'abstrait, symbolique, effets visuels avancés'
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
   * Génère un prompt vidéo avec contraintes PINN-like
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
      generator = 'Sora',
      style = 'futuristic',
      duration = 30,
      customizations = {}
    } = options;

    // Validation
    if (!this.videoGenerators.includes(generator)) {
      throw new Error(`Generator ${generator} not supported. Use: ${this.videoGenerators.join(', ')}`);
    }
    if (!this.stylePresets[style]) {
      throw new Error(`Style ${style} not supported. Use: ${Object.keys(this.stylePresets).join(', ')}`);
    }
    if (!this.durations.includes(duration)) {
      throw new Error(`Duration ${duration} not supported. Use: ${this.durations.join(', ')}`);
    }

    // Construction du prompt avec contraintes PINN-like
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
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0'
      }
    };
  }

  /**
   * Construit le prompt PINN-like en appliquant les contraintes
   */
  _buildPINNPrompt(job, generator, style, duration, customizations) {
    const styleDescription = this.stylePresets[style];
    
    // Fusion des éléments visuels personnalisés avec les éléments par défaut
    const visualElements = customizations.visualElements || job.visualElements;
    const keyTasks = customizations.keyTasks || job.keyTasks;
    const emergingTech = customizations.emergingTech || job.emergingTech;

    // Construction du prompt structuré
    const prompt = `
PROMPT VIDÉO PINN-LIKE POUR ${generator.toUpperCase()}
Métier: ${job.title} (Horizon: ${job.year})
Durée: ${duration} secondes

=== PROMPT CRÉATIF ===
${job.basePrompt}

=== CONTRAINTES RÉALISTES (PINN-LIKE) ===
Ces contraintes sont basées sur les données du Forum Économique Mondial (WEF 2025) 
et doivent être respectées pour assurer la crédibilité et la pertinence de la vidéo.

TÂCHES CLÉS À VISUALISER:
${keyTasks}

TECHNOLOGIES ÉMERGENTES À INTÉGRER:
${emergingTech}

ÉLÉMENTS VISUELS À INCLURE:
${visualElements}

COMPÉTENCES CORE À SUGGÉRER:
${job.coreSkills}

=== DIRECTIVES DE STYLE ===
Style visuel: ${styleDescription}
Durée: ${duration} secondes
Plateforme: ${generator}

=== VÉRIFICATION DE QUALITÉ ===
✓ Le scénario doit montrer concrètement les tâches clés du métier
✓ Les technologies émergentes doivent être visibles et crédibles
✓ L'interaction humain-technologie doit être ergonomique et réaliste
✓ La qualité visuelle doit correspondre au style demandé
✓ Le message doit être inspirant et futuriste, tout en restant crédible

=== NOTES POUR LE GÉNÉRATEUR ===
- Cet prompt est généré par un framework PINN-like qui applique des contraintes réalistes
- Les éléments visuels et les tâches doivent être cohérents avec le marché de l'emploi futur
- Privilégier la clarté et la crédibilité plutôt que l'abstraction pure
- Inclure des interactions humaines authentiques avec la technologie
    `.trim();

    return prompt;
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
# ${jobTitle} (${year})

## Informations
- **Générateur**: ${generator}
- **Style**: ${style}
- **Durée**: ${duration}s

## Prompt Créatif
${prompt}

## Contraintes (PINN-like)
- **Tâches clés**: ${constraints.keyTasks}
- **Compétences**: ${constraints.coreSkills}
- **Technologies**: ${constraints.emergingTech}
- **Éléments visuels**: ${constraints.visualElements}
    `.trim();
  }

  /**
   * Récupère les statistiques sur les métiers futurs
   */
  getJobsStatistics() {
    return {
      totalJobs: futureJobsData.length,
      jobsByYear: this._groupJobsByYear(),
      jobsByTechnology: this._groupJobsByTechnology(),
      allJobs: futureJobsData.map(job => ({
        id: job.id,
        title: job.title,
        year: job.year
      }))
    };
  }

  /**
   * Groupe les métiers par année
   */
  _groupJobsByYear() {
    const grouped = {};
    futureJobsData.forEach(job => {
      if (!grouped[job.year]) {
        grouped[job.year] = [];
      }
      grouped[job.year].push(job.title);
    });
    return grouped;
  }

  /**
   * Groupe les métiers par technologie
   */
  _groupJobsByTechnology() {
    const grouped = {};
    futureJobsData.forEach(job => {
      const techs = job.emergingTech.split(',').map(t => t.trim());
      techs.forEach(tech => {
        if (!grouped[tech]) {
          grouped[tech] = [];
        }
        grouped[tech].push(job.title);
      });
    });
    return grouped;
  }

  /**
   * Recherche des métiers par mot-clé
   */
  searchJobs(keyword) {
    const lowerKeyword = keyword.toLowerCase();
    return futureJobsData.filter(job => 
      job.title.toLowerCase().includes(lowerKeyword) ||
      job.keyTasks.toLowerCase().includes(lowerKeyword) ||
      job.emergingTech.toLowerCase().includes(lowerKeyword)
    );
  }
}

// Export singleton
export default new PINNPromptService();
