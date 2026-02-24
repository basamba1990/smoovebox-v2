import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase, invokeEdgeFunctionWithRetry } from "../lib/supabase";
import { Button } from "../components/ui/button-enhanced.jsx";
import { toast } from "sonner";
const VideoVault = ({ user, profile, onSignOut, onVideoAdded, embedInOdyssey }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [viewMode, setViewMode] = useState("grid");
  const [filter, setFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState(null);
  const [profileMessage, setProfileMessage] = useState(null);

  // ✅ Références pour les inputs file
  const fileInputRef = useRef(null);
  const emptyFileInputRef = useRef(null);

  // ✅ Fonction pour déclencher l'input file
  const triggerFileInput = (isEmptySection = false) => {
    console.log("🎯 Déclenchement du file input");
    const inputRef = isEmptySection ? emptyFileInputRef : fileInputRef;

    if (inputRef.current) {
      inputRef.current.disabled = false;
      inputRef.current.click();
      console.log("✅ Input file déclenché avec succès");
    } else {
      console.error("❌ Référence input file non disponible");
    }
  };

  // ✅ Chargement des vidéos
  const loadVideos = useCallback(async () => {
    if (!user) {
      console.log("❌ Aucun utilisateur connecté");
      return;
    }

    try {
      setLoading(true);
      console.log("🔄 Chargement des vidéos pour:", user.id);

      let userVideos = [];
      let error = null;

      try {
        const response = await supabase
          .from("videos")
          .select(
            `
            *,
            transcriptions(*),
            analysis_data
          `
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        userVideos = response.data || [];
        error = response.error;
      } catch (dbError) {
        console.error("❌ Erreur base de données avec jointures:", dbError);
        try {
          const simpleResponse = await supabase
            .from("videos")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

          userVideos = simpleResponse.data || [];
          error = simpleResponse.error;
        } catch (simpleError) {
          console.error("❌ Erreur même avec requête simple:", simpleError);
          userVideos = [];
        }
      }

      if (error) {
        console.error("❌ Erreur chargement vidéos:", error);
      }

      console.log("✅ Vidéos chargées:", userVideos.length);

      const formattedVideos = (userVideos || []).map((video) => ({
        id: video.id,
        title:
          video.title ||
          `Vidéo ${new Date(video.created_at).toLocaleDateString("fr-FR")}`,
        type: "spotbulle",
        description: video.description || "Aucune description",
        thumbnail_url: video.thumbnail_url,
        duration: video.duration || 0,
        file_size: video.file_size,
        created_at: video.created_at,
        status: video.status || "uploaded",
        public_url: video.public_url,
        video_url: video.video_url || video.public_url,
        format: video.format || "mp4",
        performance_score:
          video.performance_score ||
          (video.analysis_data
            ? Math.round((video.analysis_data.confidence || 0) * 100)
            : null),
        tags: video.tags || [],
        analysis_data: video.analysis_data,
        transcription_data: video.transcription_data,
        user_id: video.user_id,
        file_path: video.file_path || video.storage_path,
      }));

      setVideos(formattedVideos);
    } catch (error) {
      console.error("❌ Erreur critique chargement vidéos:", error);
      toast.error("Erreur lors du chargement des vidéos");
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    console.log("🎯 Initialisation VideoVault - User:", user?.id);
    loadVideos();
  }, [loadVideos]);

  // ✅ Fonction d'upload
  const handleFileUpload = async (event) => {
    console.log(
      "✅✅✅ onChange DÉCLENCHÉ ! Fichiers:",
      event.target.files?.length
    );

    const files = Array.from(event.target.files || []);

    if (!files.length || !user) {
      toast.error("Aucun fichier sélectionné ou utilisateur non connecté");
      return;
    }

    setTimeout(() => {
      event.target.value = "";
    }, 100);

    setUploading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Utilisateur non authentifié");
      }

      let successCount = 0;
      let errorCount = 0;

      for (const file of files) {
        try {
          if (!file.type.startsWith("video/")) {
            console.warn(`❌ Fichier ${file.name} n'est pas une vidéo`);
            toast.error(`Le fichier ${file.name} n'est pas une vidéo`);
            errorCount++;
            continue;
          }

          if (file.size > 100 * 1024 * 1024) {
            console.warn(
              `❌ Fichier ${file.name} trop volumineux: ${file.size} bytes`
            );
            toast.error(
              `La vidéo ${file.name} est trop volumineuse (max 100MB)`
            );
            errorCount++;
            continue;
          }

          console.log("📤 Upload du fichier:", file.name, file.size);

          const fileName = `external-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 15)}-${file.name.replace(/\s+/g, "-")}`;
          const filePath = `${user.id}/external/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("videos")
            .upload(filePath, file, {
              cacheControl: "3600",
              upsert: false,
            });

          if (uploadError) {
            console.error("❌ Erreur upload storage:", uploadError);
            throw new Error(`Erreur upload: ${uploadError.message}`);
          }

          console.log("✅ Fichier uploadé dans storage:", filePath);

          const { data: urlData } = supabase.storage
            .from("videos")
            .getPublicUrl(filePath);

          console.log("✅ URL publique générée:", urlData.publicUrl);

          const videoInsertData = {
            title: file.name.replace(/\.[^/.]+$/, "").substring(0, 100),
            description: `Vidéo importée - ${file.name}`,
            file_path: filePath,
            storage_path: filePath,
            file_size: file.size,
            duration: null,
            user_id: user.id,
            status: "uploaded",
            public_url: urlData.publicUrl,
            video_url: urlData.publicUrl,
            format: file.type.split("/")[1] || "mp4",
            tags: ["importé"],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          console.log(
            "📝 Insertion en base de données:",
            videoInsertData.title
          );

          const { data: videoData, error: insertError } = await supabase
            .from("videos")
            .insert(videoInsertData)
            .select()
            .single();

          if (insertError) {
            console.error("❌ Erreur insertion vidéo:", insertError);

            if (insertError.code === "23503") {
              console.warn(
                "⚠️ Violation de clé étrangère, réessayer avec données minimales"
              );

              const minimalData = {
                title: file.name.replace(/\.[^/.]+$/, "").substring(0, 100),
                user_id: user.id,
                status: "uploaded",
                file_path: filePath,
                created_at: new Date().toISOString(),
              };

              const { data: retryData, error: retryError } = await supabase
                .from("videos")
                .insert(minimalData)
                .select()
                .single();

              if (retryError) {
                console.error(
                  "❌ Échec création vidéo même avec données minimales:",
                  retryError
                );
                throw new Error(`Échec création vidéo: ${retryError.message}`);
              }

              console.log(
                "✅ Vidéo créée avec données minimales:",
                retryData.id
              );
              toast.success(
                `Vidéo ${file.name} uploadée avec données minimales !`
              );
            } else {
              throw new Error(`Erreur création vidéo: ${insertError.message}`);
            }
          } else {
            console.log("✅ Vidéo créée en base:", videoData.id);
            successCount++;
          }
        } catch (fileError) {
          console.error(`❌ Erreur sur le fichier ${file.name}:`, fileError);
          errorCount++;
          toast.error(`Erreur avec ${file.name}: ${fileError.message}`);
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} vidéo(s) importée(s) avec succès !`);
        await loadVideos();
        if (onVideoAdded) {
          onVideoAdded();
        }
      }

      if (errorCount > 0) {
        toast.warning(`${errorCount} fichier(s) n'ont pas pu être importés`);
      }
    } catch (error) {
      console.error("❌ Erreur upload complète:", error);
      toast.error(`Échec de l'import: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // ✅ Voir une vidéo
  const handleViewVideo = async (video) => {
    console.log("👁️ Voir vidéo:", video.id);
    setActionLoading(video.id);

    try {
      const videoUrl = video.video_url || video.public_url;
      if (videoUrl) {
        window.open(videoUrl, "_blank");
        toast.info(`Ouverture de: ${video.title}`);
      } else {
        toast.error("URL vidéo non disponible");
      }
    } catch (error) {
      console.error("Erreur ouverture vidéo:", error);
      toast.error("Impossible d'ouvrir la vidéo");
    } finally {
      setActionLoading(null);
    }
  };

  // ✅ Analyser une vidéo
  const handleAnalyzeVideo = async (video) => {
    console.log("📊 Analyser vidéo:", video.id);
    setActionLoading(video.id);

    try {
      if (!video.video_url && !video.public_url) {
        throw new Error("URL vidéo manquante pour l'analyse");
      }

      // Get session for auth
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession();
      if (authError || !session?.access_token) {
        throw new Error("Session non valide, veuillez vous reconnecter");
      }

      // Check if video has transcription
      let transcriptionText = video.transcription_text;
      if (!transcriptionText && video.transcription_data) {
        try {
          const transcriptionData =
            typeof video.transcription_data === "string"
              ? JSON.parse(video.transcription_data)
              : video.transcription_data;
          transcriptionText =
            transcriptionData?.text || transcriptionData?.full_text;
        } catch (e) {
          console.warn("Error parsing transcription_data:", e);
        }
      }

      // If no transcription, transcribe first
      if (!transcriptionText || transcriptionText.trim().length < 20) {
        console.log("📝 Video needs transcription first...");
        toast.loading("Transcription en cours...", { id: "transcribe-toast" });

        const { data: transcribeData, error: transcribeError } = await supabase.functions.invoke('transcribe-video', {
          body: {
            videoId: video.id,
            userId: video.user_id,
            videoUrl: video.video_url || video.public_url,
          }
        });

        if (transcribeError) {
          console.error("❌ Erreur transcription:", transcribeError);
          toast.error(`Erreur transcription: ${transcribeError.message}`, {
            id: "transcribe-toast",
          });
          throw new Error(transcribeError.message || "Erreur lors de la transcription");
        }

        toast.success(
          "Transcription démarrée. L'analyse commencera automatiquement.",
          { id: "transcribe-toast" }
        );
        return; // Exit - user needs to wait for transcription, then analyze again
      }

      // Video has transcription, proceed with analysis
      console.log("🔍 Starting analysis with transcription...");
      toast.loading("Démarrage de l'analyse IA...", { id: "analyze-toast" });

      // ✅ Use robust invoker with direct HTTPS fallback
      const result = await invokeEdgeFunctionWithRetry('analyze-transcription', {
        videoId: video.id,
        transcriptionText: transcriptionText.trim(),
        userId: video.user_id,
      });

      if (!result.success) {
        console.error("❌ Edge Function Failure:", result.error);
        toast.error(`Erreur analyse: ${result.error}`, { id: "analyze-toast" });
        throw new Error(result.error || "Erreur lors de l'analyse");
      }

      console.log("✅ Analysis Result:", result.data);
      toast.success(`Analyse démarrée pour: ${video.title}`);

      const updatedVideos = videos.map((v) =>
        v.id === video.id ? { ...v, status: "analyzing" } : v
      );
      setVideos(updatedVideos);
    } catch (error) {
      console.error("Erreur analyse vidéo:", error);
      toast.error(`Échec de l'analyse: ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // ✅ FONCTION COMPARER - CRITIQUE
  const compareVideos = () => {
    if (selectedVideos.length !== 2) {
      toast.error("Sélectionnez exactement 2 vidéos pour comparer");
      return;
    }

    setActionLoading("comparison");
    try {
      const video1 = videos.find((v) => v.id === selectedVideos[0]);
      const video2 = videos.find((v) => v.id === selectedVideos[1]);

      console.log("🔍 Comparaison entre:", video1?.title, "et", video2?.title);

      toast.success(
        `Comparaison lancée entre "${video1?.title}" et "${video2?.title}"`
      );
    } catch (error) {
      console.error("Erreur comparaison:", error);
      toast.error("Erreur lors de la comparaison");
    } finally {
      setActionLoading(null);
    }
  };

  const handleTestProfile = async (video) => {
    try {
      setActionLoading(video.id);
      setProfileMessage(null);

      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession();
      if (authError || !session?.access_token) {
        throw new Error("Session non valide, veuillez vous reconnecter");
      }

      const { data: result, error: extractError } = await supabase.functions.invoke('extract-profile-information', {
        body: {
          videoId: video.id,
          user_id: video.user_id,
        }
      });

      if (extractError) {
        throw new Error(extractError.message || "Erreur lors de l'extraction");
      }

      setProfileMessage(`Profil IA mis à jour pour "${video.title}".`);

      await loadVideos();
    } catch (error) {
      console.error("Erreur extraction profil:", error);
      setProfileMessage(
        error.message || "Erreur lors de l’extraction du profil."
      );
      toast.error("Erreur lors de l’extraction du profil");
    } finally {
      setActionLoading(null);
    }
  };

  // ✅ Supprimer une vidéo
  const handleDeleteVideo = async (video) => {
    if (
      !confirm(
        `Êtes-vous sûr de vouloir supprimer "${video.title}" ? Cette action est irréversible.`
      )
    ) {
      return;
    }

    setActionLoading(video.id);

    try {
      const { data: connections, error: connectionsError } = await supabase
        .from("connections")
        .select("id")
        .eq("video_id", video.id)
        .limit(1);

      if (connectionsError) {
        console.warn("⚠️ Erreur vérification connections:", connectionsError);
      }

      if (connections && connections.length > 0) {
        toast.warning(
          "Cette vidéo est utilisée dans des connections. Suppression des références..."
        );

        const { error: deleteConnectionsError } = await supabase
          .from("connections")
          .delete()
          .eq("video_id", video.id);

        if (deleteConnectionsError) {
          throw new Error(
            `Impossible de supprimer les références: ${deleteConnectionsError.message}`
          );
        }
      }

      if (video.file_path) {
        const { error: storageError } = await supabase.storage
          .from("videos")
          .remove([video.file_path]);

        if (storageError) {
          console.warn(
            "⚠️ Impossible de supprimer le fichier storage:",
            storageError
          );
        }
      }

      const { error: deleteError } = await supabase
        .from("videos")
        .delete()
        .eq("id", video.id);

      if (deleteError) {
        if (deleteError.code === "23503") {
          throw new Error(
            "Impossible de supprimer: vidéo utilisée dans d'autres tables"
          );
        }
        throw deleteError;
      }

      toast.success("Vidéo supprimée avec succès");
      await loadVideos();
    } catch (error) {
      console.error("Erreur suppression vidéo:", error);
      toast.error(`Erreur lors de la suppression: ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleVideoSelection = (videoId) => {
    setSelectedVideos((prev) =>
      prev.includes(videoId)
        ? prev.filter((id) => id !== videoId)
        : [...prev, videoId]
    );
  };

  const clearSelection = () => {
    setSelectedVideos([]);
  };

  const filteredVideos = videos.filter((video) => {
    if (filter === "all") return true;
    if (filter === "spotbulle") return video.type === "spotbulle";
    if (filter === "analyzed") return video.analysis_data;
    if (filter === "transcribed") return video.transcription_data;
    return true;
  });

  const getVideoStats = () => {
    const totalVideos = videos.length;
    const analyzedCount = videos.filter((v) => v.analysis_data).length;
    const transcribedCount = videos.filter((v) => v.transcription_data).length;
    const totalDuration = videos.reduce(
      (sum, video) => sum + (video.duration || 0),
      0
    );

    return { totalVideos, analyzedCount, transcribedCount, totalDuration };
  };

  const stats = getVideoStats();

  if (loading) {
    return (
      <div className={embedInOdyssey ? "space-y-6" : "min-h-screen bg-slate-900"}>
        <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-slate-300">
              Chargement de votre coffre-fort...
            </p>
        </div>
      </div>
    );
  }

  return (
    <div className={embedInOdyssey ? "space-y-6" : "min-h-screen bg-slate-900"}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*"
        onChange={handleFileUpload}
        className="hidden"
        disabled={uploading}
      />
      <input
        ref={emptyFileInputRef}
        type="file"
        multiple
        accept="video/*"
        onChange={handleFileUpload}
        className="hidden"
        disabled={uploading}
      />

      <div className="mb-8 glass-card border-white/10 rounded-3xl p-6 shadow-xl">
          <h3 className="text-[10px] font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
            📁 Mon Coffre-fort Vidéo
          </h3>
          <div className="p-4 bg-teal-500/5 border border-teal-500/10 rounded-2xl mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
              <p className="text-teal-100/80 text-sm leading-relaxed italic flex-1">
                Gère toutes tes vidéos SpotBulle en un seul endroit
              </p>
              <Button
                onClick={() => triggerFileInput(false)}
                disabled={uploading}
                className="border border-teal-500/30 text-teal-400 bg-transparent hover:bg-teal-500/10 hover:text-teal-200 rounded-xl text-[10px] font-bold uppercase tracking-widest px-4 py-2"
              >
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-400"></div>
                    Upload en cours...
                  </span>
                ) : (
                  "📱 Importer une vidéo"
                )}
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-900/40 border border-teal-500/10 rounded-2xl">
                <div className="text-2xl font-bold text-white">
                  {stats.totalVideos}
                </div>
                <div className="text-teal-100/60 text-sm">Total vidéos</div>
              </div>
              <div className="p-4 bg-slate-900/40 border border-teal-500/10 rounded-2xl">
                <div className="text-2xl font-bold text-blue-400">
                  {stats.analyzedCount}
                </div>
                <div className="text-teal-100/60 text-sm">Vidéos analysées</div>
              </div>
              <div className="p-4 bg-slate-900/40 border border-teal-500/10 rounded-2xl">
                <div className="text-2xl font-bold text-green-400">
                  {stats.transcribedCount}
                </div>
                <div className="text-teal-100/60 text-sm">Transcriptions</div>
              </div>
              <div className="p-4 bg-slate-900/40 border border-teal-500/10 rounded-2xl">
                <div className="text-2xl font-bold text-purple-400">
                  {Math.round(stats.totalDuration / 60)}min
                </div>
                <div className="text-teal-100/60 text-sm">Durée totale</div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card border-white/10 rounded-xl p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="border border-white/20 rounded-lg px-3 py-2 bg-slate-800 text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="all" className="bg-slate-800 text-white">Toutes les vidéos</option>
                <option value="spotbulle" className="bg-slate-800 text-white">Vidéos SpotBulle</option>
                <option value="analyzed" className="bg-slate-800 text-white">Vidéos analysées</option>
                <option value="transcribed" className="bg-slate-800 text-white">Vidéos transcrites</option>
              </select>

              <div className="flex border border-white/20 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 px-4 text-sm font-medium ${
                    viewMode === "grid"
                      ? "bg-teal-600 text-white"
                      : "text-slate-300 hover:bg-white/5"
                  } transition-colors`}
                >
                  ⬜ Grille
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 px-4 text-sm font-medium ${
                    viewMode === "list"
                      ? "bg-teal-600 text-white"
                      : "text-slate-300 hover:bg-white/5"
                  } transition-colors`}
                >
                  ☰ Liste
                </button>
              </div>
            </div>

            {selectedVideos.length > 0 && (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-slate-300">
                  {selectedVideos.length} vidéo(s) sélectionnée(s)
                </span>
                {/* ✅ CORRECTION : Commentaire déplacé avant le bouton */}
                <Button
                  onClick={compareVideos}
                  disabled={
                    selectedVideos.length !== 2 ||
                    actionLoading === "comparison"
                  }
                  variant="outline"
                  className="border-teal-500/50 text-teal-300 hover:bg-teal-500/10 bg-transparent"
                >
                  {actionLoading === "comparison" ? "🔄..." : "📊 Comparer"}
                </Button>
                <Button
                  onClick={clearSelection}
                  variant="outline"
                  className="border-white/20 text-slate-300 hover:bg-white/5"
                >
                  ✕ Annuler
                </Button>
              </div>
            )}
          </div>
        </div>

        {filteredVideos.length === 0 ? (
          <div className="glass-card border-white/10 rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">🎥</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Votre coffre-fort est vide
            </h3>
            <p className="text-slate-300 mb-6">
              {filter === "all"
                ? "Commencez par enregistrer votre première vidéo ou importer des vidéos existantes"
                : "Aucune vidéo ne correspond à ce filtre"}
            </p>
            <Button
              onClick={() => triggerFileInput(true)}
              className="bg-primary-600 hover:bg-primary-700 px-6 py-3 text-white font-semibold"
            >
              📱 Importer ma première vidéo
            </Button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVideos.map((video) => (
              <div
                key={video.id}
                className={`glass-card border-white/10 rounded-xl overflow-hidden transition-all duration-200 ${
                  selectedVideos.includes(video.id)
                    ? "ring-2 ring-teal-500 shadow-md"
                    : "hover:shadow-md"
                }`}
              >
                <div className="p-4">
                  <h3 className="font-semibold text-white mb-2 line-clamp-2">
                    {video.title}
                  </h3>

                  <p className="text-sm text-slate-300 mb-2 line-clamp-2">
                    {video.description}
                  </p>

                  <div className="flex items-center justify-between text-sm text-slate-400 mb-3">
                    <span>
                      {new Date(video.created_at).toLocaleDateString("fr-FR")}
                    </span>
                    {video.performance_score && (
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          video.performance_score >= 80
                            ? "bg-green-500/20 text-green-300"
                            : video.performance_score >= 60
                            ? "bg-yellow-500/20 text-yellow-300"
                            : "bg-red-500/20 text-red-300"
                        }`}
                      >
                        Score: {video.performance_score}%
                      </span>
                    )}
                  </div>

                  {video.tags && video.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {video.tags.slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className="text-slate-300 px-2 py-1 rounded text-xs"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-white/20 text-slate-300 hover:bg-white/5"
                      onClick={() => handleViewVideo(video)}
                      disabled={actionLoading === video.id}
                    >
                      {actionLoading === video.id ? "🔄" : "👁️ Voir"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-white/20 text-slate-300 hover:bg-white/5"
                      onClick={() => handleAnalyzeVideo(video)}
                      disabled={
                        actionLoading === video.id ||
                        video.status === "analyzing" ||
                        video.status === "analyzed"
                      }
                    >
                      {actionLoading === video.id
                        ? "🔄"
                        : video.status === "analyzed"
                        ? "✅ Analysée"
                        : video.status === "analyzing"
                        ? "⏳ En cours"
                        : "📊 Analyser"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/20 text-slate-300 hover:bg-white/5"
                      onClick={() => handleTestProfile(video)}
                      disabled={actionLoading === video.id}
                    >
                      🧪 Profil
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-400 border-red-500/50 hover:bg-red-500/10"
                      onClick={() => handleDeleteVideo(video)}
                      disabled={actionLoading === video.id}
                    >
                      {actionLoading === video.id ? "🔄" : "🗑️"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card border-white/10 rounded-xl overflow-hidden">
            {profileMessage && (
              <div className="px-6 py-3 bg-teal-500/10 border-b border-white/10 text-sm text-teal-300">
                {profileMessage}
              </div>
            )}
            <table className="w-full">
              <thead className="">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Sélection
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Vidéo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Durée
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredVideos.map((video) => (
                  <tr key={video.id} className="hover:bg-white/5">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedVideos.includes(video.id)}
                        onChange={() => toggleVideoSelection(video.id)}
                        className="w-4 h-4 rounded border-white/30 bg-slate-800 text-teal-500 focus:ring-teal-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded flex items-center justify-center">
                          🎬
                        </div>
                        <div>
                          <div className="font-medium text-white">
                            {video.title}
                          </div>
                          <div className="text-sm text-slate-400 mt-1">
                            {video.description}
                          </div>
                          {video.tags && (
                            <div className="flex space-x-1 mt-1">
                              {video.tags.slice(0, 2).map((tag, index) => (
                                <span
                                  key={index}
                                  className="bg-white/5 text-slate-300 px-2 py-0.5 rounded text-xs"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          video.status === "analyzed"
                            ? "bg-green-500/20 text-green-300"
                            : video.status === "analyzing"
                            ? "bg-yellow-500/20 text-yellow-300"
                            : "bg-blue-500/20 text-blue-300"
                        }`}
                      >
                        {video.status === "analyzed"
                          ? "Analysée"
                          : video.status === "analyzing"
                          ? "En analyse"
                          : "Uploadée"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-white">
                      {video.duration
                        ? `${Math.floor(video.duration / 60)}:${(
                            video.duration % 60
                          )
                            .toString()
                            .padStart(2, "0")}`
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4">
                      {video.performance_score ? (
                        <div
                          className={`w-16 text-center px-2 py-1 rounded-full text-xs font-medium ${
                            video.performance_score >= 80
                              ? "bg-green-500/20 text-green-300"
                              : video.performance_score >= 60
                              ? "bg-yellow-500/20 text-yellow-300"
                              : "bg-red-500/20 text-red-300"
                          }`}
                        >
                          {video.performance_score}%
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-white">
                      {new Date(video.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-white/20 text-slate-300 hover:bg-white/5"
                          onClick={() => handleViewVideo(video)}
                          disabled={actionLoading === video.id}
                        >
                          {actionLoading === video.id ? "🔄" : "👁️"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-white/20 text-slate-300 hover:bg-white/5"
                          onClick={() => handleAnalyzeVideo(video)}
                          disabled={
                            actionLoading === video.id ||
                            video.status === "analyzing" ||
                            video.status === "analyzed"
                          }
                        >
                          {actionLoading === video.id ? "🔄" : "📊"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-white/20 text-slate-300 hover:bg-white/5"
                          onClick={() => handleTestProfile(video)}
                          disabled={actionLoading === video.id}
                        >
                          🧪 Profil
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-400 border-red-500/50 hover:bg-red-500/10"
                          onClick={() => handleDeleteVideo(video)}
                          disabled={actionLoading === video.id}
                        >
                          {actionLoading === video.id ? "🔄" : "🗑️"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
};

export default VideoVault;
