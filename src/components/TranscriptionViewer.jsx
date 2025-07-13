import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { FileText, Lightbulb, Clock, TrendingUp } from 'lucide-react';

const TranscriptionViewer = () => {
  const [activeTab, setActiveTab] = useState('transcription');

  // Données d'exemple
  const transcriptionData = {
    text: "Bonjour, je m'appelle Marie et je vous présente aujourd'hui notre startup innovante dans le domaine de la technologie verte. Notre solution révolutionnaire permet de réduire la consommation énergétique des bâtiments de 40%. Nous avons déjà validé notre concept avec trois clients pilotes et nous recherchons maintenant un financement de 500 000 euros pour accélérer notre développement commercial.",
    timestamps: [
      { start: 0, end: 8, text: "Bonjour, je m'appelle Marie et je vous présente aujourd'hui notre startup innovante" },
      { start: 8, end: 16, text: "dans le domaine de la technologie verte. Notre solution révolutionnaire" },
      { start: 16, end: 24, text: "permet de réduire la consommation énergétique des bâtiments de 40%." },
      { start: 24, end: 32, text: "Nous avons déjà validé notre concept avec trois clients pilotes" },
      { start: 32, end: 40, text: "et nous recherchons maintenant un financement de 500 000 euros pour accélérer notre développement commercial." }
    ],
    duration: 40
  };

  const nlpSuggestions = [
    {
      type: 'amélioration',
      title: 'Rythme de parole',
      description: 'Ralentissez légèrement votre débit pour améliorer la compréhension',
      priority: 'high'
    },
    {
      type: 'contenu',
      title: 'Données chiffrées',
      description: 'Ajoutez plus de métriques concrètes pour renforcer votre crédibilité',
      priority: 'medium'
    },
    {
      type: 'structure',
      title: 'Call-to-action',
      description: 'Terminez par un appel à l\'action plus précis et engageant',
      priority: 'medium'
    }
  ];

  const analytics = {
    wordsPerMinute: 180,
    pauseCount: 3,
    fillerWords: 2,
    sentiment: 'positif',
    confidence: 85
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Analyse de Pitch - Transcription & Suggestions IA
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="transcription">Transcription</TabsTrigger>
            <TabsTrigger value="suggestions">Suggestions IA</TabsTrigger>
            <TabsTrigger value="analytics">Analytiques</TabsTrigger>
          </TabsList>

          <TabsContent value="transcription" className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium mb-3">Transcription complète</h3>
              <p className="text-sm leading-relaxed">{transcriptionData.text}</p>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium">Transcription avec timestamps</h3>
              {transcriptionData.timestamps.map((segment, index) => (
                <div key={index} className="flex gap-3 p-2 hover:bg-gray-50 rounded">
                  <Badge variant="outline" className="text-xs">
                    {formatTime(segment.start)}
                  </Badge>
                  <p className="text-sm flex-1">{segment.text}</p>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="suggestions" className="space-y-4">
            <div className="grid gap-4">
              {nlpSuggestions.map((suggestion, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="h-5 w-5 text-yellow-500 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{suggestion.title}</h4>
                        <Badge variant={getPriorityColor(suggestion.priority)}>
                          {suggestion.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{suggestion.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">💡 Conseil IA</h3>
              <p className="text-sm text-blue-800">
                Votre pitch est bien structuré ! Pour maximiser l'impact, 
                concentrez-vous sur le rythme et ajoutez des preuves sociales concrètes.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4 text-center">
                <Clock className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold">{analytics.wordsPerMinute}</p>
                <p className="text-xs text-gray-600">Mots/minute</p>
              </Card>
              
              <Card className="p-4 text-center">
                <TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold">{analytics.confidence}%</p>
                <p className="text-xs text-gray-600">Confiance</p>
              </Card>
              
              <Card className="p-4 text-center">
                <div className="h-6 w-6 mx-auto mb-2 bg-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">⏸</span>
                </div>
                <p className="text-2xl font-bold">{analytics.pauseCount}</p>
                <p className="text-xs text-gray-600">Pauses</p>
              </Card>
              
              <Card className="p-4 text-center">
                <div className="h-6 w-6 mx-auto mb-2 bg-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">~</span>
                </div>
                <p className="text-2xl font-bold">{analytics.fillerWords}</p>
                <p className="text-xs text-gray-600">Mots de remplissage</p>
              </Card>
            </div>
            
            <Card className="p-4">
              <h3 className="font-medium mb-3">Analyse du sentiment</h3>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{ width: `${analytics.confidence}%` }}
                  ></div>
                </div>
                <Badge variant="outline" className="text-green-600">
                  {analytics.sentiment}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Votre ton est globalement positif et engageant, ce qui est excellent pour un pitch.
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default TranscriptionViewer;

