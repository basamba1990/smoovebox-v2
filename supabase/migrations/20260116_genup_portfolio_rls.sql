-- Script SQL pour configurer les politiques RLS pour le bucket 'videos'
-- Assurez-vous que le bucket 'videos' existe avant d'exécuter ce script.

-- 1. Activer RLS sur le bucket 'videos' (si ce n'est pas déjà fait)
-- NOTE: Cette commande est exécutée via l'interface Supabase, mais elle est incluse ici pour la complétude.
-- SELECT storage.enable_row_level_security('videos');

-- 2. Créer une politique pour permettre aux utilisateurs authentifiés de TÉLÉCHARGER (INSERT)
-- uniquement dans leur propre dossier 'genup_videos/{user_id}/'
CREATE POLICY "Allow authenticated users to upload their own videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'videos' AND
  -- Le chemin doit commencer par 'genup_videos/' suivi de l'ID de l'utilisateur authentifié
  -- L'expression 'auth.uid()::text' convertit l'UUID de l'utilisateur en texte pour la comparaison
  (storage.foldername(name))[1] = 'genup_videos' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- 3. Créer une politique pour permettre aux utilisateurs authentifiés de LIRE (SELECT)
-- uniquement les fichiers qui se trouvent dans leur propre dossier 'genup_videos/{user_id}/'
CREATE POLICY "Allow authenticated users to read their own videos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'videos' AND
  (storage.foldername(name))[1] = 'genup_videos' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- 4. Créer une politique pour permettre aux utilisateurs authentifiés de METTRE À JOUR (UPDATE)
-- uniquement les fichiers qui se trouvent dans leur propre dossier 'genup_videos/{user_id}/'
CREATE POLICY "Allow authenticated users to update their own videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'videos' AND
  (storage.foldername(name))[1] = 'genup_videos' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- 5. Créer une politique pour permettre aux utilisateurs authentifiés de SUPPRIMER (DELETE)
-- uniquement les fichiers qui se trouvent dans leur propre dossier 'genup_videos/{user_id}/'
CREATE POLICY "Allow authenticated users to delete their own videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'videos' AND
  (storage.foldername(name))[1] = 'genup_videos' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Note: Les fonctions storage.foldername(name) et auth.uid() sont des fonctions Supabase
-- qui facilitent la gestion des chemins et l'identification de l'utilisateur.
