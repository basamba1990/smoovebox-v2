import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card.jsx';
import { Button } from './ui/button.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs.jsx';
import { FileText, Brain, Play, Pause, RotateCcw } from 'lucide-react';

const TranscriptionViewer = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalysis, setHasAnalysis] = useState(false);

  const mockTranscription = `Bonjour, je m'appelle Marie et je suis la fondatrice de EcoTech Solutions. Notre startup développe des solutions innovantes pour réduire l'empreinte carbone des entreprises. 

Nous avons identifié un problème majeur : 80% des PME ne savent pas comment mesurer et réduire efficacement leur impact environnemental. Notre plateforme utilise l'intelligence artificielle pour analyser les données de consommation et proposer des actions concrètes.

En seulement 6 mois, nous avons aidé 50 entreprises à réduire leurs émissions de 25% en moyenne. Nous recherchons 500k€ pour accélérer notre développement et conquérir le marché européen.`;

  const mockAnalysis = {
    score: 8.2,
    strengths: [
      "Introduction claire et personnelle",
      "Problème bien identifié avec des chiffres",
      "Solution concrète et différenciante",
      "Résultats mesurables présentés"
    ],
    improvements: [
      "Améliorer le contact visuel avec la caméra",
      "Ralentir légèrement le débit de parole",
      "Ajouter plus d'émotion dans la voix",
      "Structurer davantage la conclusion"
    ],
    keywords: ["EcoTech", "intelligence artificielle", "empreinte carbone", "PME", "500k€"],
    sentiment: "Positif et confiant",
    duration: "2:34"
  };

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      setHasAnalysis(true);
    }, 3000);
  };

  return (
    <div className="space-y-6">
      {/* Sélection de vidéo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Sélectionner une vidéo à analyser
          </CardTitle>
          <CardDescription>
            Choisissez une vidéo uploadée pour obtenir la transcription et l'analyse IA
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors">
              <div className="aspect-video bg-gray-200 rounded mb-3 flex items-center justify-center">
                <Play className="h-8 w-8 text-gray-400" />
              </div>
              <h4 className="font-medium">Pitch Startup EcoTech</h4>
              <p className="text-sm text-gray-500">Uploadé il y a 2h • 2:34</p>
            </div>
            
            <div className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors opacity-50">
              <div className="aspect-video bg-gray-200 rounded mb-3 flex items-center justify-center">
                <Play className="h-8 w-8 text-gray-400" />
              </div>
              <h4 className="font-medium">Présentation Produit</h4>
              <p className="text-sm text-gray-500">Uploadé hier • 3:12</p>
            </div>
            
            <div className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors opacity-50">
              <div className="aspect-video bg-gray-200 rounded mb-3 flex items-center justify-center">
                <Play className="h-8 w-8 text-gray-400" />
              </div>
              <h4 className="font-medium">Demo Technique</h4>
              <p className="text-sm text-gray-500">Uploadé il y a 3 jours • 4:45</p>
            </div>
          </div>
          
          <div className="mt-6 flex gap-3">
            <Button 
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="flex items-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <RotateCcw className="h-4 w-4 animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4" />
                  Analyser avec l'IA
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Résultats d'analyse */}
      {(hasAnalysis || isAnalyzing) && (
        <Card>
          <CardHeader>
            <CardTitle>Résultats de l'analyse</CardTitle>
            <CardDescription>
              Transcription automatique et suggestions d'amélioration par IA
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isAnalyzing ? (
              <div className="text-center py-8">
                <RotateCcw className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
                <p className="text-lg font-medium">Analyse en cours...</p>
                <p className="text-gray-500">Transcription et analyse IA de votre pitch</p>
              </div>
            ) : (
              <Tabs defaultValue="transcription" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="transcription">Transcription</TabsTrigger>
                  <TabsTrigger value="analysis">Analyse IA</TabsTrigger>
                  <TabsTrigger value="metrics">Métriques</TabsTrigger>
                </TabsList>
                
                <TabsContent value="transcription" className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium mb-3">Transcription automatique</h4>
                    <div className="prose prose-sm max-w-none">
                      <p className="whitespace-pre-line text-gray-700">{mockTranscription}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <FileText className="h-4 w-4 mr-2" />
                      Exporter en PDF
                    </Button>
                    <Button variant="outline" size="sm">
                      Copier le texte
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="analysis" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg text-green-600">Points forts</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {mockAnalysis.strengths.map((strength, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                              <span className="text-sm">{strength}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg text-orange-600">Améliorations</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {mockAnalysis.improvements.map((improvement, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                              <span className="text-sm">{improvement}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Mots-clés détectés</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {mockAnalysis.keywords.map((keyword, index) => (
                          <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="metrics" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Score global</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center">
                          <div className="text-4xl font-bold text-blue-600 mb-2">
                            {mockAnalysis.score}/10
                          </div>
                          <p className="text-sm text-gray-500">Très bon pitch</p>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Sentiment</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600 mb-2">
                            {mockAnalysis.sentiment}
                          </div>
                          <p className="text-sm text-gray-500">Ton général</p>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Durée</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600 mb-2">
                            {mockAnalysis.duration}
                          </div>
                          <p className="text-sm text-gray-500">Durée optimale</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TranscriptionViewer;

