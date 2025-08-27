import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Video, 
  Eye, 
  TrendingUp, 
  Clock, 
  Play,
  BarChart3,
  Calendar,
  Award,
  Target,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal
} from 'lucide-react';
import { StatsCard, Card, CardContent, CardHeader, CardTitle } from './ui/card-enhanced';
import { Button } from './ui/button-enhanced';
import { TooltipWrapper } from './ui/tooltip-enhanced';
import { SkeletonDashboard } from './ui/skeleton';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const DashboardEnhanced = ({ data, loading = false, onRefresh }) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState('30d');
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    setAnimationKey(prev => prev + 1);
  }, [data]);

  if (loading) {
    return <SkeletonDashboard />;
  }

  if (!data || data.isEmpty) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-12"
      >
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Video className="w-8 h-8 text-primary-600" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Aucune donnée disponible
        </h3>
        <p className="text-muted-foreground mb-6">
          Commencez par télécharger votre première vidéo pour voir vos statistiques
        </p>
        <Button variant="default">
          Télécharger une vidéo
        </Button>
      </motion.div>
    );
  }

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const getTrendIcon = (value, previousValue) => {
    if (value > previousValue) {
      return <ArrowUpRight className="w-4 h-4 text-success-600" />;
    } else if (value < previousValue) {
      return <ArrowDownRight className="w-4 h-4 text-error-600" />;
    }
    return null;
  };

  const statsCards = [
    {
      title: 'Total Vidéos',
      value: data.totalVideos,
      description: 'Vidéos téléchargées',
      icon: Video,
      trend: 'up',
      trendValue: '+12%'
    },
    {
      title: 'Vues Totales',
      value: formatNumber(data.totalViews),
      description: 'Vues cumulées',
      icon: Eye,
      trend: 'up',
      trendValue: '+8%'
    },
    {
      title: 'Score Moyen',
      value: `${Math.round(data.avgEngagement)}%`,
      description: 'Engagement moyen',
      icon: TrendingUp,
      trend: data.avgEngagement > 70 ? 'up' : 'down',
      trendValue: '+5%'
    },
    {
      title: 'Temps Total',
      value: formatDuration(data.totalDuration),
      description: 'Contenu créé',
      icon: Clock,
      trend: 'up',
      trendValue: '+15%'
    }
  ];

  const statusColors = {
    ready: '#10b981',
    processing: '#f59e0b',
    failed: '#ef4444',
    analyzing: '#3b82f6'
  };

  const statusData = Object.entries(data.videosByStatus || {}).map(([status, count]) => ({
    name: status,
    value: count,
    color: statusColors[status] || '#6b7280'
  }));

  const timeRanges = [
    { value: '7d', label: '7 jours' },
    { value: '30d', label: '30 jours' },
    { value: '90d', label: '3 mois' },
    { value: '1y', label: '1 an' }
  ];

  return (
    <motion.div
      key={animationKey}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Aperçu de vos performances et analyses
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-neutral-100 rounded-lg p-1">
            {timeRanges.map((range) => (
              <button
                key={range.value}
                onClick={() => setSelectedTimeRange(range.value)}
                className={`px-3 py-1 text-sm rounded-md transition-all ${
                  selectedTimeRange === range.value
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          
          <TooltipWrapper content="Actualiser les données">
            <Button
              variant="outline"
              size="icon"
              onClick={onRefresh}
              icon={<BarChart3 className="w-4 h-4" />}
            />
          </TooltipWrapper>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <StatsCard
              title={stat.title}
              value={stat.value}
              description={stat.description}
              icon={<stat.icon className="w-4 h-4" />}
              trend={stat.trend}
              trendValue={stat.trendValue}
              className="hover-lift"
            />
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Chart */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card variant="elevated" hover="glow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary-600" />
                  Performance dans le temps
                </CardTitle>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.performanceData || []}>
                    <defs>
                      <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#6b7280"
                      fontSize={12}
                      tickFormatter={(value) => new Date(value).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis stroke="#6b7280" fontSize={12} />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                      labelFormatter={(value) => new Date(value).toLocaleDateString('fr-FR')}
                    />
                    <Area
                      type="monotone"
                      dataKey="avgEngagement"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorEngagement)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Status Distribution */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card variant="elevated" hover="glow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5 text-primary-600" />
                Statut des vidéos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="flex flex-wrap gap-4 mt-4">
                {statusData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-muted-foreground capitalize">
                      {item.name} ({item.value})
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Videos */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card variant="elevated">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5 text-primary-600" />
                Vidéos récentes
              </CardTitle>
              <Button variant="outline" size="sm">
                Voir tout
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(data.recentVideos || []).map((video, index) => (
                <motion.div
                  key={video.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
                      <Video className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">{video.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {new Date(video.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {video.views}
                    </div>
                    <div className="flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      {Math.round(video.engagement_score)}%
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      video.status === 'ready' 
                        ? 'bg-success-100 text-success-700'
                        : video.status === 'processing'
                        ? 'bg-warning-100 text-warning-700'
                        : 'bg-error-100 text-error-700'
                    }`}>
                      {video.status}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card variant="gradient">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Prêt pour votre prochain pitch ?
                </h3>
                <p className="text-muted-foreground">
                  Téléchargez une nouvelle vidéo et obtenez une analyse détaillée en quelques minutes.
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline">
                  <Calendar className="w-4 h-4 mr-2" />
                  Planifier
                </Button>
                <Button variant="default">
                  <Zap className="w-4 h-4 mr-2" />
                  Nouvelle vidéo
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default DashboardEnhanced;

