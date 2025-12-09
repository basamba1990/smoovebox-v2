// src/constants/personas.js

// Les 7 Personas-Archétypes de SpotBulle, extraits des messages d'Estelle.
export const PERSONAS = [
  {
    id: 'jeune_talent',
    name: 'Le·la Jeune Talent (12–25 ans)',
    description: 'Objectif: se découvrir, se valoriser, trouver une direction. Offre SpotBulle: "Je découvre qui je suis et je deviens visible".',
    model_type: 'master',
    icon: '👶'
  },
  {
    id: 'adulte_reconversion',
    name: 'L’Adulte en reconversion (25–45 ans)',
    description: 'Objectif: retrouver du sens, pivoter, se réinventer. Offre SpotBulle: "Je reconnecte mon histoire, mes passions et un futur viable".',
    model_type: 'master',
    icon: '🔄'
  },
  {
    id: 'mentor_senior',
    name: 'Le Mentor Senior (50–75 ans)',
    description: 'Objectif: transmettre, soutenir la jeunesse. Offre SpotBulle: "Je transmets mon expérience et je laisse une trace positive".',
    model_type: 'master',
    icon: '👴'
  },
  {
    id: 'chef_entreprise',
    name: 'Le Chef d’entreprise / Entrepreneur',
    description: 'Objectif: recruter, communiquer, moderniser son image. Offre SpotBulle: "Je repère les talents, je m’engage, je gagne en visibilité".',
    model_type: 'master',
    icon: '💼'
  },
  {
    id: 'collectivite',
    name: 'La Collectivité / Institution',
    description: 'Objectif: soutenir la jeunesse, dynamiser le territoire. Offre SpotBulle: "Votre région valorise ses jeunes et devient pionnière des compétences 2050".',
    model_type: 'master',
    icon: '🏛️'
  },
  {
    id: 'sponsor',
    name: 'Le Sponsor / Banque / Entreprise tech',
    description: 'Objectif: associer leur marque à un projet visionnaire utile. Offre SpotBulle: "Nous sponsorisons l’émergence de la génération 2050".',
    model_type: 'master',
    icon: '💰'
  },
  {
    id: 'partenaire_educatif',
    name: 'Le Partenaire Éducatif',
    description: 'Objectif: offrir des outils d’orientation et valoriser les parcours élèves. Offre SpotBulle: "Nous révélons les talents et construisons des trajectoires".',
    model_type: 'master',
    icon: '🎓'
  },
];

// Modèles M/T (Maître/Test) mentionnés par Estelle
export const MODEL_TYPES = {
  MASTER: 'master',
  TEST: 'test',
  DESCRIPTION: {
    master: 'Modèle Maître (M) - Recommandé pour la production et l\'alignement au protocole SPOT.',
    test: 'Modèle Test (T) - Pour l\'expérimentation et les nouvelles fonctionnalités (multipotentialité, hybridation).',
  }
};

// Exportation par défaut pour une importation facile
export default {
  PERSONAS,
  MODEL_TYPES
};
