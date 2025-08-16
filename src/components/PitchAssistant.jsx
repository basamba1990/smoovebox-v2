import React, { useState, useEffect } from 'react';
import { Button } from './ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx';
import { Badge } from './ui/badge.jsx';
import { Progress } from './ui/progress.jsx';
import { MessageCircle, Clock, User, Trophy, Heart, Users, CheckCircle, ArrowRight, Lightbulb } from 'lucide-react';
import { supabase } from '../lib/supabase.js';

const PitchAssistant = ({ onComplete, onSkip, isVisible = true, userId }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(60); // 1 minute par défaut
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSaving, setSaving] = useState(false);

  const questions = [
    {
      id: 'identity',
      icon: User,
      title: 'Qui es-tu ?',
      subtitle: 'Présente-toi brièvement',
      placeholder: 'Ex: Je suis Marie, 16 ans, passionnée de basketball...',
      tips: ['Dis ton prénom et ton âge', 'Mentionne ton sport favori', 'Reste naturel et souriant'],
      category: 'Présentation'
    },
    {
      id: 'passion',
      icon: Heart,
      title: 'Quel sport te passionne ?',
      subtitle: 'Parle de ta passion sportive',
      placeholder: 'Ex: Le football me passionne depuis que j\'ai 8 ans...',
      tips: ['Explique pourquoi tu aimes ce sport', 'Raconte depuis quand tu le pratiques', 'Partage une émotion forte'],
      category: 'Passion'
    },
    {
      id: 'dream',
      icon: Trophy,
      title: 'Quel est ton rêve ?',
      subtitle: 'Partage ton objectif ou ton rêve sportif',
      placeholder: 'Ex: Mon rêve est de jouer en équipe nationale...',
      tips: ['Sois ambitieux mais réaliste', 'Explique pourquoi c\'est important', 'Montre ta détermination'],
      category: 'Ambition'
    },
    {
      id: 'impact',
      icon: Users,
      title: 'Quel impact ton club a-t-il ?',
      subtitle: 'Décris l\'influence de ton club ou équipe',
      placeholder: 'Ex: Mon club aide les jeunes de mon quartier à...',
      tips: ['Parle de l\'esprit d\'équipe', 'Mentionne l\'impact social', 'Évoque la solidarité'],
      category: 'Collectif'
    }
  ];

  useEffect(() => {
    if (!isVisible) return;
    
    // Essayer de charger les réponses sauvegardées si elles existent
    const loadSavedAnswers = async () => {
      if (!userId) return;
      
      try {
        const { data,
