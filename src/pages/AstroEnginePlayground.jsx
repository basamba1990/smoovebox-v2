// src/pages/AstroEnginePlayground.jsx

import React, { useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Label } from "../components/ui/label.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { DatePicker } from "../components/ui/date-picker.jsx";
import { CityAutocomplete } from "../components/ui/city-autocomplete.jsx";

export default function AstroEnginePlayground() {
  const [form, setForm] = useState({
    birthDate: "",
    birthCity: "",
    latitude: "",
    longitude: "",
    timezone: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const inputClass =
    "bg-slate-900/60 border-white/15 text-slate-100 placeholder:text-slate-400 focus:border-teal-400 focus:ring-teal-500/40";

  const isSubmitDisabled = useMemo(() => {
    if (!form.birthDate || !form.latitude || !form.longitude || !form.timezone) {
      return true;
    }
    return loading;
  }, [form.birthDate, form.latitude, form.longitude, form.timezone, loading]);

  const handleChange = (field) => (event) => {
    const value = event?.target ? event.target.value : event;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCityCoordinates = ({ latitude, longitude }) => {
    setForm((prev) => ({
      ...prev,
      latitude: latitude?.toString() || prev.latitude,
      longitude: longitude?.toString() || prev.longitude,
    }));
  };

  const handleTimezoneChange = (timezone) => {
    if (timezone) {
      setForm((prev) => ({
        ...prev,
        timezone,
      }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setResult(null);

    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);

    if (!form.birthDate || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setError("Merci de choisir une ville valide (latitude / longitude) et une date de naissance.");
      return;
    }

    try {
      setLoading(true);
      const { data, error: fnError } = await supabase.functions.invoke(
        "test-astro-engine",
        {
          body: {
            date: form.birthDate,
            time: null,
            latitude,
            longitude,
            timezone: form.timezone || null,
          },
        },
      );

      if (fnError) {
        throw fnError;
      }

      if (!data?.success) {
        throw new Error(data?.error || "L'appel de la fonction de calcul a échoué.");
      }

      setResult(data.astro ?? data);
    } catch (err) {
      const message =
        err?.message ||
        err?.error ||
        "Erreur lors de l'appel de la fonction de calcul.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex items-start justify-center py-10">
      <div className="w-full max-w-3xl px-4">
        <Card className="border border-slate-200 shadow-sm rounded-2xl bg-white">
          <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
            <CardTitle className="text-xl sm:text-2xl font-bold text-slate-900">
              Test de calcul
            </CardTitle>
            <CardDescription className="text-slate-500">
              Page blanche simple pour tester la fonction de calcul distante, sans sauvegarde en base.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-5">
            <form
              onSubmit={handleSubmit}
              className="space-y-6"
            >
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">Identité &amp; Naissance</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="astro-date" className="text-slate-900 font-medium">
                      Date de naissance *
                    </Label>
                    <DatePicker
                      value={form.birthDate}
                      onChange={handleChange("birthDate")}
                      placeholder="Sélectionner votre date de naissance"
                      required
                      maxDate={new Date()}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="astro-city" className="text-slate-900 font-medium">
                      Ville de naissance
                    </Label>
                    <CityAutocomplete
                      id="astro-city"
                      value={form.birthCity}
                      onChange={handleChange("birthCity")}
                      onCoordinatesChange={handleCityCoordinates}
                      onTimezoneChange={handleTimezoneChange}
                      placeholder="Ex: Paris, France"
                      className={inputClass}
                    />
                  </div>
                  <div className="hidden md:col-span-2 md:grid md:grid-cols-3 md:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="astro-lat" className="text-slate-900 font-medium">
                        Latitude *
                      </Label>
                      <Input
                        id="astro-lat"
                        type="number"
                        step="0.000001"
                        placeholder="48.856613"
                        value={form.latitude}
                        onChange={handleChange("latitude")}
                        required
                        disabled
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="astro-lon" className="text-slate-900 font-medium">
                        Longitude *
                      </Label>
                      <Input
                        id="astro-lon"
                        type="number"
                        step="0.000001"
                        placeholder="2.352222"
                        value={form.longitude}
                        onChange={handleChange("longitude")}
                        required
                        disabled
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="astro-tz" className="text-slate-900 font-medium">
                        Fuseau horaire *
                      </Label>
                      <Input
                        id="astro-tz"
                        placeholder="Sélectionnez une ville pour détecter automatiquement"
                        value={form.timezone}
                        onChange={handleChange("timezone")}
                        required
                        disabled
                        className={inputClass}
                      />
                      {form.timezone && (
                        <p className="text-xs text-slate-500">
                          Détecté automatiquement depuis la ville sélectionnée
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  disabled={isSubmitDisabled}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                >
                  {loading ? "Appel en cours…" : "Lancer le calcul"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  className="border-slate-300 text-slate-700 hover:bg-slate-100"
                  onClick={() => {
                    setForm({
                      date: "",
                      time: "",
                      latitude: "",
                      longitude: "",
                      timezone: "",
                    });
                    setError(null);
                    setResult(null);
                  }}
                >
                  Réinitialiser
                </Button>
              </div>

              {error && (
                <div className="rounded-lg border border-red-300 bg-red-50 text-red-800 px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              <div className="mt-6 space-y-2">
                <h2 className="text-sm font-medium text-slate-900">
                  Résultat brut de la fonction
                </h2>
                {!result && !loading && (
                  <div className="text-sm text-slate-500">
                    Lance un calcul pour voir les données renvoyées par la fonction distante.
                  </div>
                )}
                {loading && (
                  <div className="text-sm text-slate-700 animate-pulse">
                    Appel de la fonction en cours…
                  </div>
                )}
                {result && (
                  <div className="min-h-[120px] bg-slate-950/80 text-slate-50 rounded-xl p-3 text-xs font-mono overflow-auto">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

