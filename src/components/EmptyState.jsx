import React from 'react';
import { Button } from './ui/button.jsx';
import { Card, CardContent } from './ui/card.jsx';
import { Upload, Video, BarChart3, AlertCircle } from 'lucide-react';

const EmptyState = ({ type = 'dashboard', onAction, loading = false }) => {
  const getEmptyStateConfig = () => {
    switch (type) {
      case 'dashboard':
        return {
          icon: BarChart3,
          title: 'Aucune donnée disponible',
          description: 'Commencez par uploader votre première vidéo pour voir vos statistiques apparaître ici.',
          actionLabel: 'Uploader une vidéo',
          actionIcon: Upload
        };
      case 'videos':
        return {
          icon: Video,
          title: 'Aucune vidéo trouvée',
          description: 'Vous n\'avez pas encore uploadé de vidéos. Commencez dès maintenant !',
          actionLabel: 'Uploader ma première vidéo',
          actionIcon: Upload
        };
      case 'error':
        return {
          icon: AlertCircle,
          title: 'Erreur de chargement',
          description: 'Une erreur est survenue lors du chargement des données. Veuillez réessayer.',
          actionLabel: 'Réessayer',
          actionIcon: null
        };
      default:
        return {
          icon: AlertCircle,
          title: 'Aucun contenu',
          description: 'Aucun contenu à afficher pour le moment.',
          actionLabel: null,
          actionIcon: null
        };
    }
  };

  const config = getEmptyStateConfig();
  const IconComponent = config.icon;
  const ActionIconComponent = config.actionIcon;

  return (
    <Card className="border-dashed border-2 border-gray-200">
      <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <IconComponent className="h-8 w-8 text-gray-400" />
        </div>
        
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {config.title}
        </h3>
        
        <p className="text-gray-500 mb-6 max-w-md">
          {config.description}
        </p>
        
        {config.actionLabel && onAction && (
          <Button 
            onClick={onAction}
            disabled={loading}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {ActionIconComponent && <ActionIconComponent className="h-4 w-4 mr-2" />}
            {loading ? 'Chargement...' : config.actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default EmptyState;

