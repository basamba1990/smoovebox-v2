// src/hooks/useGiftMoments.js
import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';

export const useGiftMoments = () => {
  const [showGift, setShowGift] = useState(false);
  const [giftTrigger, setGiftTrigger] = useState('surprise');
  const user = useUser();
  const supabase = useSupabaseClient();

  // Vérifier les moments cadeaux
  const checkGiftMoments = async () => {
    if (!user) return;

    try {
      // Vérifier les réalisations de l'utilisateur
      const { data: videos } = await supabase
        .from('videos')
        .select('id, created_at')
        .eq('user_id', user.id);

      const { data: connections } = await supabase
        .from('connections')
        .select('id')
        .eq('requester_id', user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('created_at, gifts_received')
        .eq('id', user.id)
        .single();

      // Logique des moments cadeaux
      const giftsReceived = profile?.gifts_received || [];
      const now = new Date();
      const userCreatedAt = new Date(profile?.created_at);
      const daysSinceJoin = Math.floor((now - userCreatedAt) / (1000 * 60 * 60 * 24));

      // Moment 1: Après 3 vidéos uploadées
      if (videos?.length >= 3 && !giftsReceived.includes('first_3_videos')) {
        setGiftTrigger('achievement');
        setShowGift(true);
        return;
      }

      // Moment 2: Après 5 connexions établies
      if (connections?.length >= 5 && !giftsReceived.includes('first_5_connections')) {
        setGiftTrigger('milestone');
        setShowGift(true);
        return;
      }

      // Moment 3: 7 jours après l'inscription
      if (daysSinceJoin === 7 && !giftsReceived.includes('7_days')) {
        setGiftTrigger('surprise');
        setShowGift(true);
        return;
      }

      // Moment 4: Quand l'utilisateur n'a pas été actif pendant 3 jours
      const lastVideo = videos?.[0]?.created_at;
      if (lastVideo) {
        const lastActivity = new Date(lastVideo);
        const daysSinceLastActivity = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));
        
        if (daysSinceLastActivity >= 3 && !giftsReceived.includes('re_engagement')) {
          setGiftTrigger('reflection');
          setShowGift(true);
        }
      }

    } catch (error) {
      console.error('Erreur vérification moments cadeaux:', error);
    }
  };

  // Marquer un cadeau comme reçu
  const markGiftAsReceived = async (giftType) => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('gifts_received')
        .eq('id', user.id)
        .single();

      const updatedGifts = [...(profile?.gifts_received || []), giftType];

      await supabase
        .from('profiles')
        .update({ gifts_received: updatedGifts })
        .eq('id', user.id);

    } catch (error) {
      console.error('Erreur marquage cadeau:', error);
    }
  };

  useEffect(() => {
    checkGiftMoments();
    
    // Vérifier toutes les heures
    const interval = setInterval(checkGiftMoments, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  return {
    showGift,
    giftTrigger,
    setShowGift,
    markGiftAsReceived
  };
};
