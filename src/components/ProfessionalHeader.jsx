import React from 'react';
import { Button } from './ui/button.jsx';
import { Badge } from './ui/badge.jsx';
import { Video, LogOut, Wifi, WifiOff, User, Settings } from 'lucide-react';

const ProfessionalHeader = ({ 
  user, 
  profile, 
  connectionStatus = 'connected', 
  onSignOut, 
  onAuthModalOpen 
}) => {
  return (
    <header className="bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo et branding */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300">
                <Video className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full animate-pulse"></div>
            </div>
            
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                SpotBulle
              </h1>
              <p className="text-xs text-gray-500 -mt-1 font-medium">
                Analyse IA • Pitch Vidéo
              </p>
            </div>
          </div>
          
          {/* Navigation et actions */}
          <div className="flex items-center gap-4">
            {/* Indicateur de statut */}
            <Badge 
              variant={connectionStatus === 'connected' ? 'default' : 'destructive'}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1 ${
                connectionStatus === 'connected' 
                  ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {connectionStatus === 'connected' ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              <span className="text-xs font-medium">
                {connectionStatus === 'connected' ? 'Connecté' : 'Hors ligne'}
              </span>
            </Badge>
            
            {user ? (
              <div className="flex items-center gap-3">
                {/* Profil utilisateur */}
                <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-full border border-blue-100">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900 leading-none">
                      {profile?.full_name || user.email?.split('@')[0] || 'Utilisateur'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {user.email}
                    </p>
                  </div>
                </div>
                
                {/* Actions utilisateur */}
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="hidden sm:flex hover:bg-gray-100 text-gray-600 hover:text-gray-900"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={onSignOut}
                    className="hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all duration-200"
                  >
                    <LogOut className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Déconnexion</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={onAuthModalOpen}
                  className="hover:bg-blue-50 hover:text-blue-600 transition-all duration-200"
                >
                  Connexion
                </Button>
                <Button 
                  size="sm"
                  onClick={onAuthModalOpen}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  S'inscrire
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default ProfessionalHeader;

