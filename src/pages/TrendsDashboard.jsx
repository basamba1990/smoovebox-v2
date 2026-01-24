import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar 
} from 'recharts';
import { LayoutDashboard, TrendingUp, Users, Zap, Target } from 'lucide-react';
import { motion } from 'framer-motion';

const skillData = [
  { subject: 'Créativité', A: 120, fullMark: 150 },
  { subject: 'Esprit Critique', A: 98, fullMark: 150 },
  { subject: 'Coopération', A: 86, fullMark: 150 },
  { subject: 'IA Augmentée', A: 99, fullMark: 150 },
  { subject: 'Leadership', A: 85, fullMark: 150 },
  { subject: 'Adaptabilité', A: 110, fullMark: 150 },
];

const trajectoryData = [
  { stage: 'Passions', value: 100 },
  { stage: 'Émotions', value: 85 },
  { stage: 'Talents', value: 70 },
  { stage: 'Compétences', value: 60 },
  { stage: 'Projets', value: 45 },
];

const TrendsDashboard = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100
      }
    }
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-8 bg-[#00172e] text-white min-h-screen font-sans"
    >
      <motion.div variants={itemVariants} className="flex items-center justify-between mb-10 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <LayoutDashboard className="text-cyan-400" />
            Tableau de Bord Opérationnel SpotBulle 2035
          </h1>
          <p className="text-slate-400 mt-2">Pilotage de l'hybridation des métiers et de la dynamique des talents</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white/5 px-4 py-2 rounded-lg border border-white/10">
            <span className="text-xs text-slate-400 block uppercase">Statut Système</span>
            <span className="text-green-400 font-medium flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              Opérationnel
            </span>
          </div>
        </div>
      </motion.div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Radar de Compétences 2035 */}
        <motion.div variants={itemVariants} className="lg:col-span-1 bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Target className="text-pink-500 w-5 h-5" />
            Radar des Compétences Hybrides
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={skillData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                <Radar
                  name="Profil Type 2035"
                  dataKey="A"
                  stroke="#22d3ee"
                  fill="#22d3ee"
                  fillOpacity={0.5}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Dynamique de Transformation */}
        <motion.div variants={itemVariants} className="lg:col-span-2 bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <TrendingUp className="text-cyan-400 w-5 h-5" />
            Dynamique Vivante : Passions → Projets
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trajectoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="stage" stroke="#94a3b8" axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                />
                <Bar 
                  dataKey="value" 
                  fill="url(#colorBar)" 
                  radius={[4, 4, 0, 0]} 
                  barSize={60}
                />
                <defs>
                  <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.2}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Métiers Hybrides Identifiés', value: '12', icon: Zap, color: 'text-yellow-400' },
          { label: 'Collectifs en Formation', value: '08', icon: Users, color: 'text-purple-400' },
          { label: 'Taux d\'Hybridation', value: '64%', icon: TrendingUp, color: 'text-green-400' },
          { label: 'Projets Actifs', value: '24', icon: Target, color: 'text-blue-400' },
        ].map((stat, i) => (
          <motion.div 
            key={i} 
            variants={itemVariants}
            whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.08)' }}
            className="bg-white/5 p-5 rounded-xl border border-white/10 cursor-default transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <stat.icon className={`${stat.color} w-5 h-5`} />
              <span className="text-xs text-slate-500 font-mono">REF-2035-{i+1}</span>
            </div>
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-sm text-slate-400 mt-1">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      <motion.div variants={itemVariants} className="mt-8 bg-white/5 p-6 rounded-2xl border border-white/10">
        <h2 className="text-xl font-semibold mb-6">Matrice des Métiers Hybrides SpotBulle</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 text-sm uppercase tracking-wider">
                <th className="pb-4 font-medium">Métier Hybride</th>
                <th className="pb-4 font-medium">Cœur Stratégique</th>
                <th className="pb-4 font-medium">Indice de Demande</th>
                <th className="pb-4 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                { name: 'Architecte de trajectoires', core: 'Passions → Projets', demand: '98%', status: 'Prioritaire' },
                { name: 'Designer de récits vivants', core: 'Identité en mouvement', demand: '92%', status: 'Actif' },
                { name: 'Facilitateur humain–IA', core: 'Médiation technologique', demand: '85%', status: 'En déploiement' },
                { name: 'Assembleur de collectifs', core: 'Synergie de talents', demand: '89%', status: 'Actif' },
                { name: 'Éclaireur de compétences', core: 'Prospective stratégique', demand: '94%', status: 'Prioritaire' },
              ].map((job, i) => (
                <motion.tr 
                  key={i} 
                  whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                  className="transition-colors"
                >
                  <td className="py-4 font-medium text-cyan-400">{job.name}</td>
                  <td className="py-4 text-slate-300">{job.core}</td>
                  <td className="py-4">
                    <div className="w-full bg-white/10 rounded-full h-1.5 max-w-[100px]">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: job.demand }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className="bg-cyan-400 h-1.5 rounded-full"
                      ></motion.div>
                    </div>
                  </td>
                  <td className="py-4">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                      job.status === 'Prioritaire' ? 'bg-pink-500/20 text-pink-500' : 'bg-cyan-500/20 text-cyan-500'
                    }`}>
                      {job.status}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default TrendsDashboard;
