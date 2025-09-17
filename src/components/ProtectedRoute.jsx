// src/components/ProtectedRoute.jsx
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="text-white text-center p-8">Chargement...</div>;
  }

  if (!user) {
    toast.error('Veuillez vous connecter pour accéder à cette page.');
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
