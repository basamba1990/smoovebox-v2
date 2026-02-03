// src/pages/SpotCoach.jsx

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Label } from '../components/ui/label.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { DatePicker } from '../components/ui/date-picker.jsx';
import { TimePicker } from '../components/ui/time-picker.jsx';
import { CityAutocomplete } from '../components/ui/city-autocomplete.jsx';
import { spotCoachService } from '../services/spotCoachService.js';
import { toast } from 'sonner';
import OdysseyLayout from '../components/OdysseyLayout.jsx';
import { getOdysseyStepById } from '../config/odysseyConfig.js';

const initialState = {
  name: '',
  birthDate: '',
  birthTime: '',
  birthCity: '',
  latitude: '',
  longitude: '',
  timezone: '',
  passions: '',
  talents: '',
  intentions: '',
};

function parseMultiline(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

const STEP_2 = getOdysseyStepById(2);
const ODYSSEY_STEP_2_PATH = STEP_2?.path || '/scan-elements'; // Le scan des 4 éléments

export default function SpotCoach() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingExisting(true);
      try {
        const existing = await spotCoachService.getExistingProfile();
        if (!mounted) return;
        if (existing) {
          const passions = Array.isArray(existing.passions)
            ? existing.passions
            : typeof existing.passions === 'string'
              ? (() => {
                  try {
                    const parsed = JSON.parse(existing.passions);
                    return Array.isArray(parsed) ? parsed : [existing.passions];
                  } catch {
                    return [existing.passions];
                  }
                })()
              : [];

          const mapped = {
            mode: 'persisted',
            profile: {
              phrase_synchronie: existing.phrase_synchronie ?? '',
              archetype: existing.archetype ?? '',
              element: existing.element ?? '',
              signe_soleil: existing.signe_soleil ?? '',
              signe_lune: existing.signe_lune ?? '',
              signe_ascendant: existing.signe_ascendant ?? '',
              profile_text: existing.profile_text ?? '',
              passions,
            },
            stored: existing,
          };
          setResult(mapped);
          setForm((prev) => ({
            ...prev,
            name: existing.name ?? '',
            birthDate: existing.date ?? '',
            birthTime: existing.time ?? '',
            birthCity: existing.city ?? '',
            latitude: existing.lat ?? '',
            longitude: existing.lon ?? '',
            timezone: existing.timezone ?? '',
          }));
          setShowForm(false);
        } else {
          setShowForm(true);
          setResult(null);
        }
      } catch (err) {
        console.error('[SpotCoach] Load existing profile error:', err);
        setShowForm(true);
        setResult(null);
      } finally {
        if (mounted) setLoadingExisting(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const narrativeSections = useMemo(() => {
    const text = result?.profile?.profile_text;
    if (!text) return [];

    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const sections = [];
    let current = null;

    const isTitle = (line) =>
      line.includes('—') || /^points forts$/i.test(line) || /^conclusion$/i.test(line);

    lines.forEach((line) => {
      if (isTitle(line)) {
        current = { title: line, rows: [] };
        sections.push(current);
      } else if (current) {
        current.rows.push(line);
      }
    });

    return sections;
  }, [result]);

  const inputClass = 'bg-white/90 border-slate-300 text-slate-800 placeholder:text-slate-500 focus:border-teal-600 focus:ring-teal-500/30';

  const isSubmitDisabled = useMemo(() => {
    if (!form.name || !form.birthDate || !form.birthTime || !form.latitude || !form.longitude || !form.timezone) {
      return true;
    }
    return loading;
  }, [form.name, form.birthDate, form.birthTime, form.latitude, form.longitude, form.timezone, loading]);

  const handleChange = (field) => (event) => {
    const value = event?.target ? event.target.value : event;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCityCoordinates = ({ latitude, longitude }) => {
    setForm((prev) => ({ 
      ...prev, 
      latitude: latitude?.toString() || prev.latitude,
      longitude: longitude?.toString() || prev.longitude
    }));
  };

  const handleTimezoneChange = (timezone) => {
    if (timezone) {
      setForm((prev) => ({ 
        ...prev, 
        timezone: timezone
      }));
    }
  };

  const buildPayload = () => {
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);

    return {
      name: form.name || undefined,
      birth: {
        date: form.birthDate,
        time: form.birthTime || null,
        city: form.birthCity || undefined,
        latitude: Number.isFinite(latitude) ? latitude : undefined,
        longitude: Number.isFinite(longitude) ? longitude : undefined,
        timezone: form.timezone || undefined,
      },
    };
  };


  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setResult(null);

    try {
      setLoading(true);
      const startedAt = Date.now();
      const payload = buildPayload();
      console.log('[SpotCoach] Full payload before sending:', JSON.stringify(payload, null, 2));
      console.log('[SpotCoach] submit start', { payloadSnapshot: {
        name: payload?.name,
        birth: payload?.birth,
      }});

      const response = await spotCoachService.generateSymbolicProfile(payload);

      console.log('[SpotCoach] submit success', { ms: Date.now() - startedAt, mode: response?.mode });
      setResult(response);
      setShowForm(false);
    } catch (err) {
      console.error('[SpotCoach] Form submission error:', err);
      try { console.error('[SpotCoach] Form submission error (json):', JSON.stringify(err)); } catch {}
      try { console.error('[SpotCoach] Form submission error (toString):', String(err)); } catch {}
      try { console.error('[SpotCoach] Form submission error (props):', {
        name: err?.name,
        message: err?.message,
        status: err?.status,
        cause: err?.cause,
      }); } catch {}
      try { console.dir(err); } catch {}
      const message = err?.message || err?.error || 'Impossible de générer le profil symbolique.';
      setError(message);
    } finally {
      console.log('[SpotCoach] submit finished');
      setLoading(false);
    }
  };

  return (
    <OdysseyLayout
      currentStep={1}
      title="le sas d'accueil : Radar de naissance"
      maxWidthClass="max-w-6xl"
    >
      <p className="text-white/90 text-center my-6 max-w-2xl mx-auto">
        {result?.profile
          ? 'Ton Radar de naissance est enregistré. Consulte ton profil ci-dessous.'
          : 'Renseigne ta date, heure et lieu de naissance pour calculer ton Radar de naissance.'}
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {showForm && (
            <Card className="lg:col-span-2 bg-white/95 border border-slate-200 shadow-lg backdrop-blur">
              <CardHeader>
                <CardTitle className="text-slate-800">Questionnaire &amp; Informations</CardTitle>
                <CardDescription className="text-slate-600">
                  Fournis des données précises pour une lecture symbolique pertinente. Les champs latitude / longitude sont requis.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingExisting ? (
                  <div className="text-sm text-slate-600">Chargement du profil…</div>
                ) : (
                <form className="space-y-6" onSubmit={handleSubmit}>
                    <section className="space-y-4">
                      <h2 className="text-lg font-semibold text-slate-800">Identité &amp; Naissance</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="coach-name" className="text-slate-800 font-medium">Nom *</Label>
                          <Input
                            id="coach-name"
                            placeholder="Ex: Alex Dupont"
                            value={form.name}
                            onChange={handleChange('name')}
                            className={inputClass}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="coach-date" className="text-slate-800 font-medium">Date de naissance *</Label>
                          <DatePicker
                            value={form.birthDate}
                            onChange={handleChange('birthDate')}
                            placeholder="Sélectionner votre date de naissance"
                            required
                            maxDate={new Date()} // Can't select future dates
                            className="bg-white/90 border-slate-300 text-slate-800 hover:bg-slate-50"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="coach-time" className="text-slate-800 font-medium">Heure de naissance *</Label>
                          <TimePicker
                            value={form.birthTime}
                            onChange={handleChange('birthTime')}
                            placeholder="Sélectionner l'heure de naissance"
                            step={1}
                            required
                            className="bg-white/90 border-slate-300 text-slate-800 hover:bg-slate-50"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="coach-city" className="text-slate-800 font-medium">Ville de naissance</Label>
                          <CityAutocomplete
                            value={form.birthCity}
                            onChange={handleChange('birthCity')}
                            onCoordinatesChange={handleCityCoordinates}
                            onTimezoneChange={handleTimezoneChange}
                            placeholder="Ex: Paris, France"
                            className={inputClass}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="coach-lat" className="text-slate-800 font-medium">Latitude *</Label>
                          <Input
                            id="coach-lat"
                            type="number"
                            step="0.000001"
                            placeholder="48.856613"
                            value={form.latitude}
                            onChange={handleChange('latitude')}
                            required
                            disabled
                            className={inputClass}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="coach-lon" className="text-slate-800 font-medium">Longitude *</Label>
                          <Input
                            id="coach-lon"
                            type="number"
                            step="0.000001"
                            placeholder="2.352222"
                            value={form.longitude}
                            onChange={handleChange('longitude')}
                            required
                            disabled
                            className={inputClass}
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="coach-timezone" className="text-slate-800 font-medium">Fuseau horaire *</Label>
                          <Input
                            id="coach-timezone"
                            placeholder="Sélectionnez une ville pour détecter automatiquement"
                            value={form.timezone}
                            onChange={handleChange('timezone')}
                            required
                            disabled
                            className={inputClass}
                          />
                          {form.timezone && (
                            <p className="text-xs text-slate-600">Détecté automatiquement depuis la ville sélectionnée</p>
                          )}
                        </div>
                      </div>
                    </section>

                    {/* Sections removed per request: Passions & Talents, Intentions, and Preview toggle */}

                    <div className="flex items-center gap-3">
                      <Button type="submit" disabled={isSubmitDisabled} className="bg-teal-600 hover:bg-teal-700 text-white font-semibold">
                        {loading ? 'Génération en cours…' : 'Générer et sauvegarder'}
                      </Button>
                      <Button type="button" variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-100" onClick={() => setForm(initialState)} disabled={loading}>
                        Réinitialiser
                      </Button>
                    </div>

                    {error && (
                      <div className="rounded-lg border border-red-300 bg-red-50 text-red-800 px-4 py-3 text-sm">
                        {error}
                      </div>
                    )}
                  </form>
                )}
              </CardContent>
            </Card>
          )}

          <Card className={showForm ? "bg-white/95 border border-slate-200 shadow-lg backdrop-blur h-max sticky top-6" : "lg:col-span-3 bg-white/95 border border-slate-200 shadow-lg backdrop-blur"}>
            <CardHeader>
              <CardTitle className="text-slate-800">Résultat SpotCoach</CardTitle>
              <CardDescription className="text-slate-600">
                Le profil généré par l&apos;IA sera affiché ici. En mode sauvegarde, il est également enregistré dans la table `profiles_symboliques`.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!result && !loading && !loadingExisting && (
                <div className="text-sm text-slate-600">
                  Complète le formulaire et lance la génération pour découvrir le profil symbolique personnalisé.
                </div>
              )}

              {loading && (
                <div className="text-sm text-teal-700 animate-pulse">
                  Analyse symbolique en cours… SpotCoach fusionne les données et tes intentions.
                </div>
              )}

              {result && result.profile && (
                <div className="space-y-6 text-sm text-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/80">
                      <p className="text-xs uppercase text-slate-500">Mode</p>
                      <p className="text-slate-800">{result.mode === 'preview' ? 'Prévisualisation (non sauvegardée)' : 'Profil enregistré'}</p>
                    </div>
                    <div className="border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/80">
                      <p className="text-xs uppercase text-slate-500">Élément</p>
                      <p className="font-medium text-slate-800">{result.profile.element}</p>
                    </div>
                    <div className="border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/80">
                      <p className="text-xs uppercase text-slate-500">Phrase de synchronie</p>
                      <p className="font-medium text-teal-700 italic">{result.profile.phrase_synchronie}</p>
                    </div>
                    <div className="border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/80">
                      <p className="text-xs uppercase text-slate-500">Archétype</p>
                      <p className="font-medium text-slate-800">{result.profile.archetype}</p>
                    </div>
                    <div className="border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/80">
                      <p className="text-xs uppercase text-slate-500">Soleil</p>
                      <p className="font-medium text-slate-800">{result.profile.signe_soleil}</p>
                    </div>
                    <div className="border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/80">
                      <p className="text-xs uppercase text-slate-500">Lune</p>
                      <p className="font-medium text-slate-800">{result.profile.signe_lune}</p>
                    </div>
                    <div className="border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/80">
                      <p className="text-xs uppercase text-slate-500">Ascendant</p>
                      <p className="font-medium text-slate-800">{result.profile.signe_ascendant}</p>
                    </div>
                  </div>

                  {result.profile.profile_text && (
                    <div className="border border-slate-200 rounded-lg px-4 py-4 bg-slate-50/80">
                      <p className="text-xs uppercase tracking-wide text-slate-500 mb-3">Profil symbolique</p>
                      <div className="text-slate-700 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                        {result.profile.profile_text}
                      </div>
                    </div>
                  )}

                  {Array.isArray(result.profile.passions) && result.profile.passions.length > 0 && (
                    <div className="border border-slate-200 rounded-lg px-4 py-3 bg-slate-50/80">
                      <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Passions clés</p>
                      <ul className="list-disc list-inside text-slate-700 space-y-1">
                        {result.profile.passions.map((passion, index) => (
                          <li key={`${passion}-${index}`}>{passion}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {narrativeSections.map((section) => {
                    const isPointsForts = /^points forts$/i.test(section.title);
                    const isConclusion = /^conclusion$/i.test(section.title);
                    return (
                      <div key={section.title} className="border border-slate-200 rounded-lg px-4 py-3 bg-slate-50/80 space-y-2">
                        <h3 className="text-sm font-semibold text-teal-700">{section.title}</h3>
                        {isPointsForts ? (
                          <ul className="list-disc list-inside space-y-1 text-slate-700">
                            {section.rows.map((row, idx) => (
                              <li key={idx}>{row.replace(/^[-•]\s*/, '')}</li>
                            ))}
                          </ul>
                        ) : isConclusion ? (
                          <p className="text-slate-700">{section.rows.join(' ')}</p>
                        ) : (
                          section.rows.map((row, idx) => (
                            <p key={idx} className="text-slate-700 leading-relaxed">
                              {row}
                            </p>
                          ))
                        )}
                      </div>
                    );
                  })}


                  {result.stored && (
                    <div className="text-xs text-slate-600 border-t border-slate-200 pt-3">
                      Profil sauvegardé le {new Date(result.stored.updated_at).toLocaleString()}.
                    </div>
                  )}

                  {result && !showForm && (
                    <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center gap-3">
                      <Button
                        onClick={() => navigate(ODYSSEY_STEP_2_PATH)}
                        className="bg-teal-600 hover:bg-teal-700 text-white font-semibold"
                      >
                        Continuer →
                      </Button>
                      <Button 
                        onClick={async () => {
                          if (confirm('Êtes-vous sûr de vouloir supprimer ce profil ? Cette action est irréversible.')) {
                            setLoading(true);
                            const deleteResult = await spotCoachService.deleteProfile();
                            setLoading(false);
                            
                            if (deleteResult.success) {
                              setResult(null);
                              setShowForm(true);
                              setForm(initialState);
                              toast.success('Profil supprimé avec succès');
                            } else {
                              toast.error(deleteResult.error || 'Erreur lors de la suppression');
                            }
                          }
                        }}
                        variant="outline"
                        className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
                        disabled={loading}
                      >
                        Supprimer le profil
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
    </OdysseyLayout>
  );
}


