// src/components/RequireAuth.jsx
// Authentication guard component

import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import LoadingScreen from "./LoadingScreen.jsx";

/**
 * Component that protects routes requiring authentication
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components to render if authenticated
 * @param {string} props.fallbackPath - Path to redirect to if not authenticated (default: "/login")
 */
export const RequireAuth = ({ children, fallbackPath = "/login" }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate(fallbackPath, { replace: true });
    }
  }, [user, loading, navigate, fallbackPath]);

  if (loading && !user) {
    return (
      <LoadingScreen
        message="Vérification de sécurité..."
        subtitle="Authentification en cours"
      />
    );
  }

  return user ? children : <Navigate to={fallbackPath} replace />;
};

export default RequireAuth;

