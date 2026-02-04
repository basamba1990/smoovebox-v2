// src/pages/LaboTransformation.jsx
// Step 4 – Le labo de transformation (Odyssée de Lumi)

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@supabase/auth-helpers-react";
import OdysseyLayout from "../components/OdysseyLayout.jsx";
import { Button } from "../components/ui/button.jsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card.jsx";
import { getOdysseyStepById } from "../config/odysseyConfig.js";
import { spotCoachService } from "../services/spotCoachService.js";
import { getMyLumiProfile } from "../services/lumiService.js";
import { supabase } from "../lib/supabase.js";
import { videoService } from "../services/videoService.js";
import FutureJobsGptPanel from "../components/FutureJobsGptPanel.jsx";

const STEP_3 = getOdysseyStepById(3);
const STEP_3_PATH = STEP_3?.path ?? "/module-mimetique";

export default function LaboTransformation() {
  const navigate = useNavigate();
  const user = useUser();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [symbolicProfile, setSymbolicProfile] = useState(null);
  const [lumiProfile, setLumiProfile] = useState(null);
  const [videoAnalysis, setVideoAnalysis] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 1) Symbolic profile (SpotCoach)
        const existingSymbolic = await spotCoachService.getExistingProfile();
        if (!cancelled) setSymbolicProfile(existingSymbolic || null);

        // 2) Lumi profile (DISC)
        const lumiResult = await getMyLumiProfile();
        if (!cancelled) {
          setLumiProfile(lumiResult?.success ? lumiResult.profile || null : null);
        }

        // 3) Latest analyzed video (optional)
        const { data: latestVideo, error: latestError } = await supabase
          .from("videos")
          .select("*")
          .eq("user_id", user.id)
          .in("status", ["analyzed", "COMPLETED"])
          .not("analysis", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestError) {
          console.error("[LaboTransformation] Error fetching latest video:", latestError);
        }

        if (!cancelled && latestVideo?.id) {
          let analysis = latestVideo.analysis || null;
          if (!analysis) {
            try {
              analysis = await videoService.getAnalysis(latestVideo.id);
            } catch (err) {
              console.error("[LaboTransformation] Error fetching analysis:", err);
            }
          }
          if (analysis) setVideoAnalysis({ video: latestVideo, analysis });
        }
      } catch (err) {
        console.error("[LaboTransformation] load error:", err);
        if (!cancelled) setError(err?.message || "Erreur lors du chargement.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return (
    <OdysseyLayout
      currentStep={4}
      title="Le labo de transformation"
      maxWidthClass="max-w-4xl"
    >
      <p className="text-white/90 text-center my-6 max-w-2xl mx-auto">
        Métiers du futur (GPT) : explore 10 pistes avec Spot Coach.
      </p>

      <Card className="bg-white/95 border border-slate-200 shadow-lg backdrop-blur">
        <CardHeader>
          <CardTitle className="text-2xl text-slate-800">
            Métiers du futur (GPT)
          </CardTitle>
          <CardDescription className="text-slate-600">
            Spot Coach te pose quelques questions puis te propose 10 idées de métiers
            du futur basées sur ton profil (symbolique, DISC, vidéo si dispo).
          </CardDescription>
        </CardHeader>
        <CardContent className="text-slate-700">
          {loading ? (
            <p>Chargement…</p>
          ) : error ? (
            <p className="text-red-700">{error}</p>
          ) : (
            <>
              <p className="mb-4">
                Utilise le bouton{" "}
                <span className="font-semibold">“Parler avec Spot Coach”</span> ci-dessous
                pour lancer la génération.
              </p>
              <FutureJobsGptPanel
                inline
                user={user}
                symbolicProfile={symbolicProfile}
                lumiProfile={lumiProfile}
                videoAnalysis={videoAnalysis}
              />
            </>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 flex justify-between items-center">
        <Button
          onClick={() => navigate(STEP_3_PATH)}
          size="lg"
          className="bg-teal-600 hover:bg-teal-500 text-white px-8"
        >
          ← Précédent
        </Button>
      </div>

      {/* Future jobs task is rendered inline inside the card */}
    </OdysseyLayout>
  );
}
