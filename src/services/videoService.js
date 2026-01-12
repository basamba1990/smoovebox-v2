// src/services/videoService.js
// Service for video-related operations

import { supabase } from '../lib/supabase.js';

/**
 * Check if user has any video with profile_information and extract age
 * @param {string} userId - User ID
 * @returns {Promise<{hasProfileInfo: boolean, age?: number, ageRange?: string}>}
 */
export async function checkVideoProfileInformation(userId) {
  try {
    if (!userId) {
      return { hasProfileInfo: false };
    }

    // Get all videos with profile_information
    const { data: videos, error } = await supabase
      .from('videos')
      .select('profile_information')
      .eq('user_id', userId)
      .not('profile_information', 'is', null);

    if (error) {
      console.error('[videoService] Error checking profile_information:', error);
      return { hasProfileInfo: false };
    }

    if (!videos || videos.length === 0) {
      return { hasProfileInfo: false };
    }

    // Loop through videos to find one with age
    for (const video of videos) {
      const profileInfo = video.profile_information;
      
      if (profileInfo && typeof profileInfo === 'object') {
        // Try different possible age field names
        const ageValue = profileInfo.age || 
                        profileInfo.age_years || 
                        profileInfo.ageNumber ||
                        profileInfo.age_number ||
                        profileInfo.approx_age;
        
        // Convert to number if it's a string
        const age = typeof ageValue === 'string' ? parseInt(ageValue, 10) : ageValue;
        
        if (age && typeof age === 'number' && !isNaN(age) && age > 0) {
          // Determine age range
          let ageRange = null;
          if (age >= 16 && age <= 20) ageRange = '16-20';
          else if (age >= 21 && age <= 30) ageRange = '21-30';
          else if (age >= 31 && age <= 45) ageRange = '31-45';
          else if (age >= 46) ageRange = '46+';

          return {
            hasProfileInfo: true,
            age: age,
            ageRange: ageRange,
          };
        }
      }
    }

    // Found videos with profile_information but no age
    return { hasProfileInfo: true, age: null, ageRange: null };
  } catch (error) {
    console.error('[videoService] Exception checking profile_information:', error);
    return { hasProfileInfo: false };
  }
}

// Original videoService object for backward compatibility
export const videoService = {
  /**
   * Get analysis for a video
   * @param {string} videoId - Video ID
   * @returns {Promise<any>}
   */
  async getAnalysis(videoId) {
    try {
      const { data, error } = await supabase
        .from('analyses')
        .select('*')
        .eq('video_id', videoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(`Error fetching analysis: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('[videoService] Error in getAnalysis:', error);
      throw error;
    }
  },

  /**
   * Upload a video
   * @param {Blob} blob - Video blob
   * @param {object} metadata - Video metadata
   * @param {function} onProgress - Progress callback
   * @returns {Promise<object>}
   */
  async uploadVideo(blob, metadata, onProgress) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const userId = session.user.id;
      const fileExt = blob.type.split('/')[1] || 'mp4';
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `videos/${fileName}`;

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Upload error: ${uploadError.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);

      // Create video record
      const { data: videoData, error: insertError } = await supabase
        .from(\'videos\')
        .insert({
          user_id: userId,
          title: metadata.title || \'Untitled Video\',
          description: metadata.description || \'\',
          storage_path: filePath, // Utiliser storage_path
          video_url: publicUrl, // Utiliser video_url
          file_size_bytes: blob.size, // Nouvelle colonne
          duration_seconds: metadata.duration, // Assumer que la durée est passée en metadata
          video_format: blob.type.split(\'/\')[1] || \'mp4\', // Nouvelle colonne
          status: \'uploaded\',
          tags: metadata.tags || [], // Nouvelle colonne
          use_avatar: metadata.useAvatar || false, // Nouvelle colonne
          // Les champs transcription_text, analysis, ai_score, profile_information, error_message
          // seront mis à jour par les Edge Functions.
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Error creating video record: ${insertError.message}`);
      }

      if (onProgress) {
        onProgress({ loaded: blob.size, total: blob.size });
      }

      return videoData;
    } catch (error) {
      console.error('[videoService] Error in uploadVideo:', error);
      throw error;
    }
  },

  /**
   * Transcribe a video
   * @param {string} videoId - Video ID
   * @returns {Promise<any>}
   */
  async transcribeVideo(videoId) {
    try {
      const { data, error } = await supabase.functions.invoke('transcribe-video', {
        body: { video_id: videoId },
      });

      if (error) {
        throw new Error(`Transcription error: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('[videoService] Error in transcribeVideo:', error);
      throw error;
    }
  },

  /**
   * Get public video by ID
   * @param {string} videoId - Video ID
   * @returns {Promise<object>}
   */
  async getPublicVideoById(videoId) {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .single();

      if (error) {
        throw new Error(`Error fetching video: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('[videoService] Error in getPublicVideoById:', error);
      throw error;
    }
  },
};
