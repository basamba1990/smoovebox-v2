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
    },
    {
      value: 'progress',
      label: 'Progression',
      icon: TrendingUp,
      description: 'Mes progrès'
    }
  ];

  if (!user) {
    return (
      <div className="flex justify-center mb-6 sm:mb-8 px-2 sm:px-4">
        <div className="bg-white/60 backdrop-blur-sm border border-gray-200 shadow-lg rounded-xl p-4 sm:p-6 text-center max-w-md">
          <TrendingUp className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
            Connectez-vous pour accéder à vos données
          </h3>
          <p className="text-gray-500 text-xs sm:text-sm">
            Créez un compte ou connectez-vous pour commencer à analyser vos pitchs vidéo
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center mb-6 sm:mb-8 px-2 sm:px-4">
      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full max-w-2xl">
        <TabsList className="grid grid-cols-4 bg-white/80 backdrop-blur-sm border border-gray-200 shadow-lg rounded-xl p-1 sm:p-1.5 h-auto">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            return (
              <TabsTrigger 
                key={tab.value}
                value={tab.value} 
                className="flex flex-col items-center gap-1 sm:gap-2 py-2 sm:py-3 px-2 sm:px-4 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 rounded-lg group"
              >
                <IconComponent className="h-4 w-4 sm:h-5 sm:w-5 group-data-[state=active]:scale-110 transition-transform duration-200" />
                <div className="text-center">
                  <div className="font-medium text-xs sm:text-sm">
                    {tab.label}
                  </div>
                  <div className="text-xs opacity-70 group-data-[state=active]:opacity-90 hidden sm:block">
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

