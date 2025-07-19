import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card.jsx';
import { Button } from './ui/button.jsx';
import { Upload, Video, CheckCircle, AlertCircle } from 'lucide-react';

const UploadVideoMobile = () => {
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, success, error
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setUploadStatus('idle');
    }
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    
    setUploadStatus('uploading');
    
    // Simulation d'upload
    setTimeout(() => {
      setUploadStatus('success');
    }, 3000);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Upload Vidéo Mobile
          </CardTitle>
          <CardDescription>
            Uploadez vos pitchs vidéo avec compression automatique et optimisation mobile
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Zone de drop */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <div className="space-y-2">
              <p className="text-lg font-medium text-gray-900">
                Glissez votre vidéo ici ou cliquez pour sélectionner
              </p>
              <p className="text-sm text-gray-500">
                Formats supportés: MP4, MOV, AVI (max 100 Mo)
              </p>
            </div>
            <input
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
              id="video-upload"
            />
            <label
              htmlFor="video-upload"
              className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors"
            >
              Sélectionner une vidéo
            </label>
          </div>

          {/* Fichier sélectionné */}
          {selectedFile && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Video className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} Mo
                    </p>
                  </div>
                </div>
                {uploadStatus === 'success' && (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                )}
                {uploadStatus === 'error' && (
                  <AlertCircle className="h-6 w-6 text-red-600" />
                )}
              </div>
            </div>
          )}

          {/* Statut d'upload */}
          {uploadStatus === 'uploading' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Upload en cours...</span>
                <span>65%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full w-2/3 transition-all duration-300"></div>
              </div>
            </div>
          )}

          {uploadStatus === 'success' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <p className="text-green-800 font-medium">Upload réussi !</p>
              </div>
              <p className="text-green-700 text-sm mt-1">
                Votre vidéo a été uploadée et compressée avec succès.
              </p>
            </div>
          )}

          {uploadStatus === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <p className="text-red-800 font-medium">Erreur d'upload</p>
              </div>
              <p className="text-red-700 text-sm mt-1">
                Une erreur s'est produite lors de l'upload. Veuillez réessayer.
              </p>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex gap-3">
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploadStatus === 'uploading'}
              className="flex-1"
            >
              {uploadStatus === 'uploading' ? 'Upload en cours...' : 'Uploader la vidéo'}
            </Button>
            {uploadStatus === 'success' && (
              <Button variant="outline" className="flex-1">
                Analyser avec l'IA
              </Button>
            )}
          </div>

          {/* Informations techniques */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Optimisations automatiques</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Compression H.264 pour une qualité optimale</li>
              <li>• Résolution adaptée aux appareils mobiles</li>
              <li>• Réduction de la taille de fichier jusqu'à 70%</li>
              <li>• Préservation de la qualité audio</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UploadVideoMobile;

