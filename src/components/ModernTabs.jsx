import React from 'react';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs.jsx';
import { BarChart3, Video, Upload, TrendingUp } from 'lucide-react';

const ModernTabs = ({ activeTab, onTabChange, user }) => {
  const tabs = [
    {
      value: 'dashboard',
      label: 'Dashboard',
      icon: BarChart3,
      description: 'Vue d\'ensemble'
    },
    {
      value: 'videos',
      label: 'Mes Vidéos',
      icon: Video,
      description: 'Gestion des vidéos'
    },
    {
      value: 'upload',
      label: 'Upload',
      icon: Upload,
      description: 'Nouvelle vidéo'
    }
  ];

  if (!user) {
    return (
      <div className="flex justify-center mb-8">
        <div className="bg-white/60 backdrop-blur-sm border border-gray-200 shadow-lg rounded-xl p-6 text-center">
          <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Connectez-vous pour accéder à vos données
          </h3>
          <p className="text-gray-500 text-sm">
            Créez un compte ou connectez-vous pour commencer à analyser vos pitchs vidéo
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center mb-8">
      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full max-w-2xl">
        <TabsList className="grid grid-cols-3 bg-white/80 backdrop-blur-sm border border-gray-200 shadow-lg rounded-xl p-1.5 h-auto">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            return (
              <TabsTrigger 
                key={tab.value}
                value={tab.value} 
                className="flex flex-col items-center gap-2 py-3 px-4 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 rounded-lg group"
              >
                <IconComponent className="h-5 w-5 group-data-[state=active]:scale-110 transition-transform duration-200" />
                <div className="text-center">
                  <div className="font-medium text-sm">
                    {tab.label}
                  </div>
                  <div className="text-xs opacity-70 group-data-[state=active]:opacity-90">
                    {tab.description}
                  </div>
                </div>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
    </div>
  );
};

export default ModernTabs;

