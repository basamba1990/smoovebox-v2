import React, { useState, useEffect } from "react";
import { videoService } from "../services/videoService";

export const TransformationDemo = () => {
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        setLoading(true);
        const videoData = await videoService.getPublicVideoById("1");
        setVideo(videoData);
      } catch (err) {
        console.error("Error fetching video:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchVideo();
  }, []);

  if (loading) {
    return (
      <div className="app-container min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg text-gray-300">Chargement de la vidéo...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center p-8">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-4 text-red-400">Erreur</h2>
          <p className="text-gray-300 mb-4">{error}</p>
          <p className="text-sm text-gray-400">
            Vidéo avec l'ID "1" non trouvée
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center p-8">
      <div className="relative max-w-6xl w-full   rounded-3xl  text-center">
        <div className="mb-8">
          <div className="flex justify-center items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-blue-500 rounded-full shadow-md"></div>
            <div className="w-12 h-12 bg-white rounded-full border-2 border-blue-400 shadow-md"></div>
            <div className="w-12 h-12 bg-blue-600 rounded-full shadow-md"></div>
          </div>
          <h1 className="text-5xl md:text-6xl font-french font-bold mb-6 text-white">
            🇫🇷🇲🇦 SpotBulle
          </h1>
          <p className="text-xl md:text-2xl text-blue-400 mb-4 font-medium">
            La communauté qui connecte la France et le Maroc
          </p>
        </div>

        {/* Video Display Section */}
        {video && (
          <div className="bg-gray-700/50 rounded-xl p-6 mb-8 border border-gray-600 hover:border-blue-500 hover:shadow-lg transition-all duration-300 shadow-sm">
            <h2 className="text-2xl font-bold mb-4 text-white">
              {video.title || "Transformation Demo"}
            </h2>

            {video.description && (
              <p className="text-gray-300 mb-6">{video.description}</p>
            )}

            {/* Video Player */}
            {video.url || video.file_path ? (
              <div className="relative w-full max-w-4xl mx-auto">
                <video
                  className="w-full h-auto rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300"
                  controls
                  preload="metadata"
                  poster={video.thumbnail_url || undefined}
                >
                  <source
                    src={video.url || video.file_path}
                    type={`video/${video.format || "mp4"}`}
                  />
                  Votre navigateur ne supporte pas la lecture vidéo.
                </video>
              </div>
            ) : (
              <div className="bg-gray-600 rounded-lg p-8 text-gray-400">
                <p>URL vidéo non disponible</p>
              </div>
            )}

            {/* Video Info */}
            <div className="mt-4 text-sm text-gray-400">
              {video.duration && (
                <span className="mr-4">
                  Durée: {Math.round(video.duration)}s
                </span>
              )}
              {video.file_size && (
                <span>
                  Taille: {(video.file_size / (1024 * 1024)).toFixed(1)} MB
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 text-center text-gray-400 text-sm">
        <p>SpotBulle - Connecter, Partager, Grandir ensemble 🇫🇷🇲🇦</p>
      </div>
    </div>
  );
};
