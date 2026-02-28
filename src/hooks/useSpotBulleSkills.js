import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useSpotBulleSkills(userId) {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const fetchEvaluations = async () => {
      try {
        const { data, error } = await supabase
          .from('skills_evaluations')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setEvaluations(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchEvaluations();
  }, [userId]);

  return { evaluations, loading, error };
}
