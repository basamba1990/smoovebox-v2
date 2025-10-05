import React from 'react';
import { Button } from './ui/button-enhanced.jsx';

const RestitutionBadge = ({ user, profile, questionnaireResults, videoAnalysis }) => {
  const dominantColor = questionnaireResults?.dominant_color || 'blue';
  const colorProfiles = {
    red: { name: 'Rouge - Leader passionné', color: 'from-red-500 to-red-600', badge: '🔴' },
    blue: { name: 'Bleu - Stratège rigoureux', color: 'from-blue-500 to-blue-600', badge: '🔵' },
    green: { name: 'Vert - Équipier empathique', color: 'from-green-500 to-green-600', badge: '🟢' },
    yellow: { name: 'Jaune - Créatif enthousiaste', color: 'from-yellow-500 to-yellow-600', badge: '🟡' }
  };

  const profileInfo = colorProfiles[dominantColor];

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="text-center">
        <h2 className="text-3xl font-french font-bold text-white mb-2">
          🏆 Votre Restitution SpotBulle
        </h2>
        <p className="text-gray-300">
          Félicitations ! Voici votre profil personnalisé et votre badge d'accomplissement
        </p>
      </div>

      {/* Badge principal */}
      <div className="card-spotbulle-dark p-8 bg-gray-800 border-gray-700 text-center">
        <div className={`mx-auto w-32 h-32 bg-gradient-to-br ${profileInfo.color} rounded-full flex items-center justify-center text-4xl mb-6 shadow-2xl`}>
          {profileInfo.badge}
        </div>
        
        <h3 className="text-2xl font-bold text-white mb-2">{profileInfo.name}</h3>
        <p className="text-gray-300 mb-6">
          Votre profil unique a été identifié grâce à votre parcours immersion
        </p>

        {/* QR Code de restitution */}
        <div className="bg-white p-4 rounded-lg inline-block mb-6">
          <div className="w-48 h-48 bg-gray-200 flex items-center justify-center text-gray-500">
            {/* Placeholder pour le QR code */}
            <div className="text-center">
              <div className="text-4xl mb-2">📱</div>
              <p className="text-sm">QR Code Restitution</p>
            </div>
          </div>
        </div>

        <p className="text-gray-400 text-sm mb-6">
          Scannez ce QR code pour accéder à votre analyse complète
        </p>

        <div className="flex gap-4 justify-center">
          <Button className="btn-spotbulle-dark bg-blue-600 hover:bg-blue-700">
            📥 Télécharger le rapport
          </Button>
          <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
            📤 Partager sur les réseaux
          </Button>
        </div>
      </div>

      {/* Détails du profil */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-spotbulle-dark p-6 bg-gray-800 border-gray-700">
          <h4 className="text-lg font-semibold text-white mb-4">🎯 Vos forces naturelles</h4>
          <div className="space-y-3">
            {dominantColor === 'red' && (
              <>
                <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white">💪</div>
                  <div>
                    <div className="text-white font-medium">Leadership naturel</div>
                    <div className="text-red-300 text-sm">Vous prenez facilement les décisions</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white">⚡</div>
                  <div>
                    <div className="text-white font-medium">Orientation résultats</div>
                    <div className="text-red-300 text-sm">Vous êtes motivé par les challenges</div>
                  </div>
                </div>
              </>
            )}
            {dominantColor === 'blue' && (
              <>
                <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white">📊</div>
                  <div>
                    <div className="text-white font-medium">Pensée analytique</div>
                    <div className="text-blue-300 text-sm">Vous analysez avant d'agir</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white">🎯</div>
                  <div>
                    <div className="text-white font-medium">Précision et rigueur</div>
                    <div className="text-blue-300 text-sm">Vous êtes attentif aux détails</div>
                  </div>
                </div>
              </>
            )}
            {/* Ajouter les autres profils de couleur... */}
          </div>
        </div>

        <div className="card-spotbulle-dark p-6 bg-gray-800 border-gray-700">
          <h4 className="text-lg font-semibold text-white mb-4">📈 Votre progression</h4>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm text-gray-300 mb-1">
                <span>Expression orale</span>
                <span>85%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '85%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm text-gray-300 mb-1">
                <span>Confiance en soi</span>
                <span>78%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '78%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm text-gray-300 mb-1">
                <span>Communication non-verbale</span>
                <span>92%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: '92%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommandations */}
      <div className="card-spotbulle-dark p-6 bg-gray-800 border-gray-700">
        <h4 className="text-lg font-semibold text-white mb-4">🚀 Prochaines étapes recommandées</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border border-gray-600 rounded-lg hover:border-blue-500 transition-all cursor-pointer">
            <div className="text-blue-400 text-lg mb-2">🎯 Objectif court terme</div>
            <p className="text-gray-300 text-sm">
              Pratiquez l'expression orale 2 fois par semaine pour renforcer votre aisance
            </p>
          </div>
          <div className="p-4 border border-gray-600 rounded-lg hover:border-green-500 transition-all cursor-pointer">
            <div className="text-green-400 text-lg mb-2">🌟 Objectif moyen terme</div>
            <p className="text-gray-300 text-sm">
              Participez à 3 événements communautaires dans les 2 prochains mois
            </p>
          </div>
        </div>
      </div>

      {/* Partage communautaire */}
      <div className="card-spotbulle-dark p-6 bg-gray-800 border-gray-700 text-center">
        <h4 className="text-lg font-semibold text-white mb-4">👥 Rejoignez la communauté</h4>
        <p className="text-gray-300 mb-4">
          Connectez-vous avec d'autres membres partageant votre profil et vos passions
        </p>
        <div className="flex gap-4 justify-center">
          <Button className="btn-spotbulle-dark bg-gradient-to-r from-blue-600 to-purple-600">
            👥 Explorer l'annuaire
          </Button>
          <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
            💬 Discuter en groupe
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RestitutionBadge;
