-- Add http_extension_available column to videos table
ALTER TABLE public.videos
ADD COLUMN http_extension_available BOOLEAN DEFAULT FALSE;

