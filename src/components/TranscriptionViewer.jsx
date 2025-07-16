import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { 
  FileText, 
  Brain, 
  Clock, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Play,
  Pause
} from 'lucide-react';

const TranscriptionViewer = () => {
  const [activeTab, setActiveTab] = useState('transcription');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Données de démonstration
  const transcriptionData = {
    duration: 180, // 3 minutes
    segments: [
      {
        id: 1,
        start: 0,
        end: 15,
        text: "Bonjour, je suis ravi de vous présenter notre startup innovante dans le domaine de la technologie verte.",
        confidence: 0.95
      },
      {
        id: 2,
        start: 15,
        end: 35,
        text: "Notre solution révolutionnaire permet de réduire la consommation énergétique des bâtiments de 40%.",
        confidence: 0.92
      },
      {
        id: 3,
        start: 35,
        end: 60,
        text: "Nous avons développé un algorithme d'intelligence artificielle qui optimise automatiquement les systèmes de chauffage et de climatisation.",
        confidence: 0.88
      },
      {
        id: 4,
        start: 60,
        end: 90,
        text: "Notre équipe est composée d'ingénieurs expérimentés et nous avons déjà sécurisé un financement de 500 000 euros.",
        confidence: 0.94
      },
      {
        id: 5,
        start: 90,
        end: 120,
        text: "Nous recherchons maintenant des partenaires stratégiques pour accélérer notre croissance sur le marché européen.",
        confidence: 0.91
      },
      {
        id: 6,
        start: 120,
        end: 150,
        text: "Notre objectif est d'atteindre 1 million d'euros de chiffre d'affaires d'ici la fin de l'année prochaine.",
        confidence: 0.89
      },
      {
        id: 7,
        start: 150,
        end: 180,
        text: "Merci pour votre attention, je serais ravi de répondre à vos questions.",
        confidence: 0.96
      }
    ]
  };

  const aiAnalysis = {
    overallScore: 8.2,
    strengths: [
      "Présentation claire et structurée",
      "Données chiffrées convaincantes",
      "Équipe expérimentée mise en avant"
    ],
    improvements: [
      "Ajouter plus de détails sur la concurrence",
      "Préciser le modèle économique",
      "Mentionner les premiers clients"
    ],
    keywords: [
      { word: "innovation", count: 3, sentiment: "positive" },
      { word: "technologie", count: 4, sentiment: "positive" },
      { word: "croissance", count: 2, sentiment: "positive" },
      { word: "financement", count: 2, sentiment: "neutral" }
    ]
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.8) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="transcription" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Transcription
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Analyse IA
          </TabsTrigger>
          <TabsTrigger value="keywords" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Mots-clés
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transcription" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Transcription automatique</span>
                <Badge variant="outline">
                  Durée: {formatTime(transcriptionData.duration)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Contrôles de lecture */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <Button
                  size="sm"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="flex items-center gap-2"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {isPlaying ? 'Pause' : 'Lecture'}
                </Button>
                <div className="flex-1">
                  <div className="text-sm text-gray-600 mb-1">
                    {formatTime(currentTime)} / {formatTime(transcriptionData.duration)}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${(currentTime / transcriptionData.duration) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Segments de transcription */}
              <div className="space-y-3">
                {transcriptionData.segments.map((segment) => (
                  <div 
                    key={segment.id} 
                    className={`p-4 rounded-lg border ${
                      currentTime >= segment.start && currentTime < segment.end 
                        ? 'bg-blue-50 border-blue-200' 
                        : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-600">
                          {formatTime(segment.start)} - {formatTime(segment.end)}
                        </span>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={getConfidenceColor(segment.confidence)}
                      >
                        {Math.round(segment.confidence * 100)}% confiance
                      </Badge>
                    </div>
                    <p className="text-gray-800">{segment.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Score global
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">
                    {aiAnalysis.overallScore}/10
                  </div>
                  <p className="text-sm text-gray-600">
                    Votre pitch est bien structuré avec des points d'amélioration identifiés
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Points forts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {aiAnalysis.strengths.map((strength, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{strength}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  Suggestions d'amélioration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {aiAnalysis.improvements.map((improvement, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{improvement}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="keywords" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analyse des mots-clés</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aiAnalysis.keywords.map((keyword, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <span className="font-medium">{keyword.word}</span>
                      <Badge 
                        variant={keyword.sentiment === 'positive' ? 'default' : 'outline'}
                        className="ml-2"
                      >
                        {keyword.sentiment}
                      </Badge>
                    </div>
                    <span className="text-sm text-gray-600">
                      {keyword.count} occurrences
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TranscriptionViewer;

