import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Progress } from '@/components/ui/progress.jsx';
import { Upload, Video, CheckCircle, AlertCircle } from 'lucide-react';
import { uploadVideo, getTranscription } from "../lib/supabase.js";

const UploadVideoMobile = () => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, success, error
  const [videoFile, setVideoFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validation du fichier
      if (file.type.startsWith('video/')) {
        if (file.size <= 50 * 1024 * 1024) { // 50MB max
          setVideoFile(file);
          setUploadStatus('idle');
        } else {
          setUploadStatus('error');
          alert('La vidéo ne doit pas dépasser 50 Mo');
        }
      } else {
        setUploadStatus('error');
        alert('Veuillez sélectionner un fichier vidéo');
      }
    }
  };



  const handleUpload = async () => {
    if (!videoFile) return;

    try {
      // Ici on intégrerait la compression avec FFmpeg et l'upload vers Supabase
      const userId = "test_user_id"; // Remplacez par l'ID utilisateur réel
      const { success, error } = await uploadVideo(videoFile, userId);

      if (success) {
        setUploadStatus("success");
        // Call transcription after successful upload
        setIsUploading(true);
        setUploadStatus("uploading"); // Indicate transcription is in progress
        const { success: transcriptionSuccess, data: transcriptionData, error: transcriptionError } = await getTranscription(videoFile);
        setIsUploading(false);

        if (transcriptionSuccess) {
          console.log("Transcription réussie:", transcriptionData);
          // Here you would typically pass the transcription to the next component or state
          setUploadStatus("success"); // Or a new status like 'transcription_success'
        } else {
          console.error("Erreur de transcription:", transcriptionError);
          setUploadStatus("error");
        }
      } else {
        throw new Error(error);
      }
    } catch (error) {
      setUploadStatus('error');
      setIsUploading(false);
    }
  };

  const resetUpload = () => {
    setVideoFile(null);
    setUploadProgress(0);
    setUploadStatus('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Upload Vidéo Mobile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!videoFile && (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-sm text-gray-600 mb-4">
              Sélectionnez une vidéo (max 50 Mo, 2 min)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button 
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
            >
              Choisir une vidéo
            </Button>
          </div>
        )}

        {videoFile && uploadStatus === 'idle' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <Video className="h-5 w-5 text-blue-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">{videoFile.name}</p>
                <p className="text-xs text-gray-500">
                  {(videoFile.size / (1024 * 1024)).toFixed(1)} Mo
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleUpload} className="flex-1">
                Uploader
              </Button>
              <Button onClick={resetUpload} variant="outline">
                Annuler
              </Button>
            </div>
          </div>
        )}

        {uploadStatus === 'uploading' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Video className="h-5 w-5 text-blue-500 animate-pulse" />
              <span className="text-sm">Compression et upload en cours...</span>
            </div>
            <Progress value={uploadProgress} className="w-full" />
            <p className="text-xs text-gray-500 text-center">
              {uploadProgress}% - Optimisation pour mobile
            </p>
          </div>
        )}

        {uploadStatus === 'success' && (
          <div className="text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <p className="text-sm text-green-600 font-medium">
              Vidéo uploadée avec succès !
            </p>
            <Button onClick={resetUpload} variant="outline" className="w-full">
              Uploader une autre vidéo
            </Button>
          </div>
        )}

        {uploadStatus === 'error' && (
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <p className="text-sm text-red-600 font-medium">
              Erreur lors de l'upload
            </p>
            <Button onClick={resetUpload} variant="outline" className="w-full">
              Réessayer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UploadVideoMobile;

