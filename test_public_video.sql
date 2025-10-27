-- SQL Script to create and populate public_videos table for testing
-- Run this in your Supabase SQL Editor

-- First, create the public_videos table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.public_videos (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    file_path TEXT,
    public_url TEXT,
    thumbnail_url TEXT,
    duration INTEGER,
    file_size BIGINT,
    format TEXT DEFAULT 'mp4',
    status TEXT DEFAULT 'published',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.public_videos ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access
CREATE POLICY "Public videos are viewable by everyone" 
ON public.public_videos 
FOR SELECT 
USING (is_active = true);

-- Insert test video with ID 1 (the one your component is looking for)
INSERT INTO public.public_videos (
    id,
    title,
    description,
    file_path,
    public_url,
    thumbnail_url,
    duration,
    file_size,
    format,
    status,
    is_active
) VALUES (
    1,
    'Transformation Demo - Can to Ball',
    'Découvrez la magie de SpotBulle avec cette démonstration créative où une canette se transforme en ballon de football, symbolisant la transformation et l''innovation de notre plateforme.',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
    596,
    15728640,
    'mp4',
    'published',
    true
) ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    file_path = EXCLUDED.file_path,
    public_url = EXCLUDED.public_url,
    thumbnail_url = EXCLUDED.thumbnail_url,
    duration = EXCLUDED.duration,
    file_size = EXCLUDED.file_size,
    format = EXCLUDED.format,
    status = EXCLUDED.status,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Insert additional test videos for variety
INSERT INTO public.public_videos (
    title,
    description,
    file_path,
    public_url,
    thumbnail_url,
    duration,
    file_size,
    format,
    status,
    is_active
) VALUES 
(
    'SpotBulle Community Introduction',
    'Présentation de la communauté SpotBulle et de ses valeurs.',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg',
    653,
    12582912,
    'mp4',
    'published',
    true
),
(
    'Innovation Showcase',
    'Découvrez les innovations de SpotBulle en action.',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
    15,
    1572864,
    'mp4',
    'published',
    true
);

-- Verify the data was inserted correctly
SELECT 
    id,
    title,
    description,
    duration,
    file_size,
    format,
    status,
    is_active,
    created_at
FROM public.public_videos 
ORDER BY id;

-- Optional: Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_public_videos_active 
ON public.public_videos(is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_public_videos_status 
ON public.public_videos(status) 
WHERE status = 'published';
