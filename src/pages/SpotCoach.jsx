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

  const inputClass = 'bg-slate-950/60 border-slate-800 focus:border-cyan-500 text-slate-100 placeholder:text-slate-500';

  const isSubmitDisabled = useMemo(() => {
    if (!form.birthDate || !form.latitude || !form.longitude) {
      return true;
    }
    return loading;
  }, [form.birthDate, form.latitude, form.longitude, loading]);

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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 py-10">
      <div className="max-w-6xl mx-auto px-4 space-y-10">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
            >
              ← Retour à l'accueil
            </Button>
          </div>
          <div className="text-center space-y-3">
            <h1 className="text-3xl md:text-4xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400">
              SpotCoach – Profil Symbolique Personnalisé
            </h1>
            <p className="text-slate-300 max-w-3xl mx-auto">
              Renseigne les informations de naissance, réponds aux mini-questionnaires passions / talents et partage tes intentions.
              SpotCoach combinera ces données avec l&apos;analyse symbolique pour générer un profil aligné sur ton essence.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 bg-slate-900/60 border border-slate-800 backdrop-blur">
            <CardHeader>
              <CardTitle>Questionnaire &amp; Informations</CardTitle>
              <CardDescription>
                Fournis des données précises pour une lecture symbolique pertinente. Les champs latitude / longitude sont requis.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingExisting ? (
                <div className="text-sm text-slate-400">Chargement du profil…</div>
              ) : showForm ? (
                <form className="space-y-6" onSubmit={handleSubmit}>
                    <section className="space-y-4">
                      <h2 className="text-lg font-semibold text-slate-100">Identité &amp; Naissance</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="coach-name" className="text-white font-medium">Nom (optionnel)</Label>
                          <Input
                            id="coach-name"
                            placeholder="Ex: Alex Dupont"
                            value={form.name}
                            onChange={handleChange('name')}
                            className={inputClass}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="coach-date" className="text-white font-medium">Date de naissance *</Label>
                          <DatePicker
                            value={form.birthDate}
                            onChange={handleChange('birthDate')}
                            placeholder="Sélectionner votre date de naissance"
                            required
                            maxDate={new Date()} // Can't select future dates
                            className="bg-slate-950/60 border-slate-800 text-slate-100 hover:bg-slate-900"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="coach-time" className="text-white font-medium">Heure de naissance (optionnelle)</Label>
                          <TimePicker
                            value={form.birthTime}
                            onChange={handleChange('birthTime')}
                            placeholder="Sélectionner l'heure de naissance"
                            step={1}
                            className="bg-slate-950/60 border-slate-800 text-slate-100 hover:bg-slate-900"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="coach-city" className="text-white font-medium">Ville de naissance</Label>
                          <CityAutocomplete
                            value={form.birthCity}
                            onChange={handleChange('birthCity')}
                            onCoordinatesChange={handleCityCoordinates}
                            placeholder="Ex: Paris, France"
                            className={inputClass}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="coach-lat" className="text-white font-medium">Latitude *</Label>
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
                          <Label htmlFor="coach-lon" className="text-white font-medium">Longitude *</Label>
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
                          <Label htmlFor="coach-timezone" className="text-white font-medium">Fuseau horaire (optionnel)</Label>
                          <Input
                            id="coach-timezone"
                            placeholder="Ex: Europe/Paris"
                            value={form.timezone}
                            onChange={handleChange('timezone')}
                            className={inputClass}
                          />
                        </div>
                      </div>
                    </section>

                    {/* Sections removed per request: Passions & Talents, Intentions, and Preview toggle */}

                    <div className="flex items-center gap-3">
                      <Button type="submit" disabled={isSubmitDisabled} className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold">
                        {loading ? 'Génération en cours…' : 'Générer et sauvegarder'}
                      </Button>
                      <Button type="button" variant="outline" className="border-slate-700 text-slate-300 hover:text-white" onClick={() => setForm(initialState)} disabled={loading}>
                        Réinitialiser
                      </Button>
                    </div>

                    {error && (
                      <div className="rounded-lg border border-red-500/40 bg-red-500/10 text-red-200 px-4 py-3 text-sm">
                        {error}
                      </div>
                    )}
                  </form>
              ) : (
                <div className="space-y-4 text-sm text-slate-300">
                  <p>Un profil existe déjà pour cet utilisateur. Tu peux le consulter à droite ou le régénérer si besoin.</p>
                  <Button onClick={() => { setShowForm(true); setError(null); }} className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold">
                    Régénérer le profil symbolique
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border border-slate-800 backdrop-blur h-max sticky top-6">
            <CardHeader>
              <CardTitle>Résultat SpotCoach</CardTitle>
              <CardDescription>
                Le profil généré par l&apos;IA sera affiché ici. En mode sauvegarde, il est également enregistré dans la table `profiles_symboliques`.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!result && !loading && !loadingExisting && (
                <div className="text-sm text-slate-400">
                  Complète le formulaire et lance la génération pour découvrir le profil symbolique personnalisé.
                </div>
              )}

              {loading && (
                <div className="text-sm text-cyan-300 animate-pulse">
                  Analyse symbolique en cours… SpotCoach fusionne les données et tes intentions.
                </div>
              )}

              {result && result.profile && (
                <div className="space-y-6 text-sm text-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="border border-slate-800 rounded-lg px-3 py-2">
                      <p className="text-xs uppercase text-slate-500">Mode</p>
                      <p>{result.mode === 'preview' ? 'Prévisualisation (non sauvegardée)' : 'Profil enregistré'}</p>
                    </div>
                    <div className="border border-slate-800 rounded-lg px-3 py-2">
                      <p className="text-xs uppercase text-slate-500">Élément</p>
                      <p className="font-medium text-slate-100">{result.profile.element}</p>
                    </div>
                    <div className="border border-slate-800 rounded-lg px-3 py-2">
                      <p className="text-xs uppercase text-slate-500">Phrase de synchronie</p>
                      <p className="font-medium text-cyan-200 italic">{result.profile.phrase_synchronie}</p>
                    </div>
                    <div className="border border-slate-800 rounded-lg px-3 py-2">
                      <p className="text-xs uppercase text-slate-500">Archétype</p>
                      <p className="font-medium text-slate-100">{result.profile.archetype}</p>
                    </div>
                    <div className="border border-slate-800 rounded-lg px-3 py-2">
                      <p className="text-xs uppercase text-slate-500">Soleil</p>
                      <p className="font-medium text-slate-100">{result.profile.signe_soleil}</p>
                    </div>
                    <div className="border border-slate-800 rounded-lg px-3 py-2">
                      <p className="text-xs uppercase text-slate-500">Lune</p>
                      <p className="font-medium text-slate-100">{result.profile.signe_lune}</p>
                    </div>
                    <div className="border border-slate-800 rounded-lg px-3 py-2">
                      <p className="text-xs uppercase text-slate-500">Ascendant</p>
                      <p className="font-medium text-slate-100">{result.profile.signe_ascendant}</p>
                    </div>
                  </div>

                  {Array.isArray(result.profile.passions) && result.profile.passions.length > 0 && (
                    <div className="border border-slate-800 rounded-lg px-4 py-3 bg-slate-900/50">
                      <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Passions clés</p>
                      <ul className="list-disc list-inside text-slate-200 space-y-1">
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
                      <div key={section.title} className="border border-slate-800 rounded-lg px-4 py-3 bg-slate-900/40 space-y-2">
                        <h3 className="text-sm font-semibold text-cyan-100">{section.title}</h3>
                        {isPointsForts ? (
                          <ul className="list-disc list-inside space-y-1 text-slate-200">
                            {section.rows.map((row, idx) => (
                              <li key={idx}>{row.replace(/^[-•]\s*/, '')}</li>
                            ))}
                          </ul>
                        ) : isConclusion ? (
                          <p className="text-slate-200">{section.rows.join(' ')}</p>
                        ) : (
                          section.rows.map((row, idx) => (
                            <p key={idx} className="text-slate-200 leading-relaxed">
                              {row}
                            </p>
                          ))
                        )}
                      </div>
                    );
                  })}


                  {result.stored && (
                    <div className="text-xs text-slate-500 border-t border-slate-800 pt-3">
                      Profil sauvegardé le {new Date(result.stored.updated_at).toLocaleString()}.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


