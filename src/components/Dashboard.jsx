import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { 
  Video, 
  Users, 
  TrendingUp, 
  Clock, 
  Play, 
  Share2, 
  MessageCircle,
  Heart,
  BarChart3
} from 'lucide-react';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [userStats, setUserStats] = useState({
    totalVideos: 12,
    totalViews: 1847,
    followers: 156,
    avgRating: 4.2
  });

  const [recentVideos] = useState([
    {
      id: 1,
      title: 'Pitch Startup GreenTech',
      thumbnail: '/api/placeholder/300/200',
      duration: '2:34',
      views: 234,
      likes: 18,
      comments: 5,
      uploadDate: '2024-01-15',
      status: 'published'
    },
    {
      id: 2,
      title: 'Présentation Produit IA',
      thumbnail: '/api/placeholder/300/200',
      duration: '1:45',
      views: 156,
      likes: 12,
      comments: 3,
      uploadDate: '2024-01-12',
      status: 'published'
    },
    {
      id: 3,
      title: 'Demo Application Mobile',
      thumbnail: '/api/placeholder/300/200',
      duration: '3:12',
      views: 89,
      likes: 7,
      comments: 2,
      uploadDate: '2024-01-10',
      status: 'processing'
    }
  ]);

  const [communityActivity] = useState([
    {
      id: 1,
      type: 'like',
      user: 'Sophie Martin',
      action: 'a aimé votre vidéo',
      target: 'Pitch Startup GreenTech',
      time: '2h'
    },
    {
      id: 2,
      type: 'comment',
      user: 'Thomas Dubois',
      action: 'a commenté',
      target: 'Présentation Produit IA',
      time: '4h'
    },
    {
      id: 3,
      type: 'follow',
      user: 'Marie Leroy',
      action: 'vous suit maintenant',
      target: '',
      time: '1j'
    }
  ]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short'
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'published':
        return <Badge variant="default" className="bg-green-100 text-green-800">Publié</Badge>;
      case 'processing':
        return <Badge variant="default" className="bg-yellow-100 text-yellow-800">En cours</Badge>;
      case 'draft':
        return <Badge variant="outline">Brouillon</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'like':
        return <Heart className="h-4 w-4 text-red-500" />;
      case 'comment':
        return <MessageCircle className="h-4 w-4 text-blue-500" />;
      case 'follow':
        return <Users className="h-4 w-4 text-green-500" />;
      default:
        return <Video className="h-4 w-4" />;
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-600">Gérez vos pitchs et suivez vos performances</p>
        </div>
        <Button className="flex items-center gap-2">
          <Video className="h-4 w-4" />
          Nouveau Pitch
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Vidéos</p>
                <p className="text-2xl font-bold">{userStats.totalVideos}</p>
              </div>
              <Video className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Vues totales</p>
                <p className="text-2xl font-bold">{userStats.totalViews.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Followers</p>
                <p className="text-2xl font-bold">{userStats.followers}</p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Note moyenne</p>
                <p className="text-2xl font-bold">{userStats.avgRating}/5</p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="videos">Mes Vidéos</TabsTrigger>
          <TabsTrigger value="community">Communauté</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Vidéos récentes */}
            <Card>
              <CardHeader>
                <CardTitle>Vidéos récentes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentVideos.slice(0, 3).map((video) => (
                  <div key={video.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="w-16 h-12 bg-gray-200 rounded flex items-center justify-center">
                      <Play className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{video.title}</h4>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        {video.duration}
                        <span>•</span>
                        {video.views} vues
                      </div>
                    </div>
                    {getStatusBadge(video.status)}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Activité communauté */}
            <Card>
              <CardHeader>
                <CardTitle>Activité récente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {communityActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    {getActivityIcon(activity.type)}
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{activity.user}</span>
                        {' '}{activity.action}
                        {activity.target && (
                          <span className="text-blue-600"> {activity.target}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="videos" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentVideos.map((video) => (
              <Card key={video.id} className="overflow-hidden">
                <div className="aspect-video bg-gray-200 flex items-center justify-center">
                  <Play className="h-8 w-8 text-gray-500" />
                </div>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-sm">{video.title}</h3>
                    {getStatusBadge(video.status)}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {video.duration}
                    </span>
                    <span>{video.views} vues</span>
                    <span>{formatDate(video.uploadDate)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {video.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {video.comments}
                      </span>
                    </div>
                    <Button size="sm" variant="outline">
                      <Share2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="community" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Followers récents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium">Utilisateur {i}</p>
                        <p className="text-xs text-gray-500">Entrepreneur</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">Suivre</Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tendances</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>#startup</span>
                    <span className="text-gray-500">1.2k posts</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>#innovation</span>
                    <span className="text-gray-500">856 posts</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>#pitch</span>
                    <span className="text-gray-500">634 posts</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>#fintech</span>
                    <span className="text-gray-500">423 posts</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;

