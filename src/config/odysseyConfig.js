// src/config/odysseyConfig.js
// Central configuration for the SpotBulle V2 "Odyssée de Lumi" journey.

import { Rocket, LayoutGrid, Video, Brain, Handshake, BookOpen, Sparkles } from 'lucide-react';

// For now, only steps 1 and 2 have implemented pages/routes.
// Future steps keep their titles and icons but no path yet.
export const ODYSSEY_STEPS = [
  {
    id: 1,
    key: 'embark',
    title: "Le sas d'accueil",
    path: '/embark',
    Icon: Rocket,
  },
  {
    id: 2,
    key: 'scan-elements',
    title: 'Le scan des 4 éléments',
    path: '/scan-elements',
    Icon: LayoutGrid,
  },
  {
    id: 3,
    key: 'module-mimetique',
    title: 'Le module mimétique',
    path: '/module-mimetique',
    Icon: Video,
  },
  {
    id: 4,
    key: 'labo-transformation',
    title: 'Le labo de transformation',
    path: '/labo-transformation',
    Icon: Brain,
  },
  {
    id: 5,
    key: 'carte-galactique',
    title: 'La carte galactique',
    path: null,
    Icon: Handshake,
  },
  {
    id: 6,
    key: 'journal-mission',
    title: 'Le journal de mission',
    path: null,
    Icon: BookOpen,
  },
  {
    id: 7,
    key: 'portail-lumi',
    title: 'Portail vers la planète Lumi',
    path: null,
    Icon: Sparkles,
  },
];

export function getOdysseyStepById(id) {
  return ODYSSEY_STEPS.find((step) => step.id === id) || null;
}

