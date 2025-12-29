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
    this.videoGenerators = ['Sora', 'Runway', 'Pika'];
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
      generator = 'Sora',
      style = 'lumi-universe', // Style par défaut mis à jour vers l'univers de Lumi
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
    const styleDescription = this.stylePresets[style];
    
    // Fusion des éléments visuels personnalisés avec les éléments par défaut
    const visualElements = customizations.visualElements || job.visualElements;
    const keyTasks = customizations.keyTasks || job.keyTasks;
    const emergingTech = customizations.emergingTech || job.emergingTech;

    // Construction du prompt structuré
    const prompt = `
PROMPT VIDÉO PINN-LIKE (LUMI EDITION) POUR ${generator.toUpperCase()}
Métier: ${job.title} (Horizon: ${job.year})
Univers: Planète de Lumi (Éco-futurisme Symbiotique)
Durée: ${duration} secondes

=== PROMPT CRÉATIF ET ÉMOTIONNEL ===
${job.basePrompt}

=== CONTRAINTES RÉALISTES (PINN-LIKE) ===
Ces contraintes assurent la crédibilité technique tout en intégrant l'univers de Lumi.

TÂCHES CLÉS À VISUALISER:
${keyTasks}

TECHNOLOGIES ÉMERGENTES À INTÉGRER:
${emergingTech}

ÉLÉMENTS VISUELS DE LA PLANÈTE DE LUMI:
${visualElements}

COMPÉTENCES CORE À SUGGÉRER:
${job.coreSkills}

=== DIRECTIVES DE STYLE ET COLORIMÉTRIE ===
Style visuel: ${styleDescription}
Palette: Prussian Blue, Midnight Green, Sky Blue, touches néon violet/cyan.
Plateforme: ${generator}

=== VÉRIFICATION DE QUALITÉ (LUMI FRAMEWORK) ===
✓ L'interaction doit montrer une émotion humaine authentique (empathie, joie, concentration)
✓ L'environnement doit refléter la symbiose entre nature et technologie avancée
✓ Les structures hexagonales et les motifs de ruche doivent être présents
✓ La technologie doit paraître organique et intégrée (biomimétisme)
✓ Le message doit montrer comment l'humain enrichit l'univers de Lumi par ses émotions

=== NOTES POUR LE GÉNÉRATEUR ===
- Ce prompt est généré par le framework PINN-like enrichi par la vision d'Estelle
- Privilégier les formes asymétriques, sinueuses et organiques
- L'humain est le porteur d'émotions que Lumi est venu chercher
- La lumière doit être traitée comme une "chaleur vitale" plutôt que comme un simple éclairage
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
