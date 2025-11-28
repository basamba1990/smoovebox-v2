// src/lib/routeUtils.jsx
// Utilities for rendering routes from configuration

import React from "react";
import { Route, Navigate } from "react-router-dom";
import { RequireAuth } from "../components/RequireAuth.jsx";

/**
 * Renders a route element from route configuration
 * @param {Object} routeConfig - Route configuration object
 * @param {string} routeConfig.path - Route path
 * @param {React.Component} routeConfig.element - Component to render
 * @param {boolean} routeConfig.requiresAuth - Whether route requires authentication
 * @param {Object} routeConfig.props - Props to pass to the component
 * @param {boolean} routeConfig.isCustom - Whether this is a custom route (like 404)
 * @param {boolean} routeConfig.isConditional - Whether route has conditional rendering (like root route)
 * @param {Function} navigate - Navigation function for custom routes
 * @param {Function} getContext - Function to get current app context (for conditional routes)
 * @returns {React.ReactElement} Route element
 */
export const renderRoute = (routeConfig, navigate, getContext) => {
  if (!routeConfig || !routeConfig.path) {
    console.error("Invalid route config:", routeConfig);
    return null;
  }

  const {
    path,
    element: Component,
    requiresAuth,
    props = {},
    isCustom,
    isConditional,
  } = routeConfig;

  console.log("Rendering route:", path, "Component:", Component?.name || "Unknown");

  // Handle custom routes (like 404)
  if (isCustom && path === "/404") {
    return (
      <Route
        key={path}
        path={path}
        element={
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
            <div className="text-center text-white">
              <h1 className="text-6xl font-bold mb-4">404</h1>
              <p className="text-xl mb-8">Page non trouvée</p>
              <button
                onClick={() => navigate("/")}
                style={{
                  padding: "10px 20px",
                  background: "hsl(222.2 84% 4.9%)",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Retour à l'accueil
              </button>
            </div>
          </div>
        }
      />
    );
  }

  // Handle conditional routes (like root route)
  if (isConditional && path === "/") {
    // For root route, we need to render conditionally based on current user state
    // Use a wrapper component that checks user state dynamically
    const RootRouteWrapper = () => {
      if (!getContext) {
        console.error("getContext function not provided for root route");
        return null;
      }
      
      const context = getContext();
      const { user } = context || {};
      
      // Get the appropriate component and props based on auth state
      const AuthenticatedComponent = routeConfig.conditionalElement || Component;
      const GuestComponent = routeConfig.conditionalElementGuest;
      const authenticatedProps = routeConfig.conditionalProps || {};
      const guestProps = routeConfig.conditionalPropsGuest || {};

      if (user) {
        // User is authenticated - show SimplifiedHome
        if (!AuthenticatedComponent) {
          console.error("No authenticated component found for root route");
          return null;
        }
        return (
          <RequireAuth>
            <AuthenticatedComponent {...authenticatedProps} />
          </RequireAuth>
        );
      } else {
        // User is not authenticated - show WelcomeAgent
        if (!GuestComponent) {
          console.error("No guest component found for root route");
          return null;
        }
        return <GuestComponent {...guestProps} />;
      }
    };

    return (
      <Route
        key={path}
        path={path}
        element={<RootRouteWrapper />}
      />
    );
  }

  // Handle routes without component (shouldn't happen, but safety check)
  if (!Component) {
    return null;
  }

  // Create element with props
  const element = <Component {...props} />;

  // Wrap with RequireAuth if needed
  const wrappedElement = requiresAuth ? (
    <RequireAuth>{element}</RequireAuth>
  ) : (
    element
  );

  return (
    <Route
      key={path}
      path={path}
      element={wrappedElement}
    />
  );
};

/**
 * Renders all routes from configuration
 * @param {Array} routes - Array of route configurations
 * @param {Function} navigate - Navigation function
 * @param {Function} getContext - Function to get current app context
 * @returns {Array} Array of Route elements
 */
export const renderRoutes = (routes, navigate, getContext) => {
  if (!routes || !Array.isArray(routes)) {
    console.error("renderRoutes: routes is not an array", routes);
    return [
      <Route key="error" path="*" element={<div>Error: No routes configured</div>} />,
    ];
  }

  const renderedRoutes = routes
    .map((route, index) => {
      try {
        return renderRoute(route, navigate, getContext);
      } catch (error) {
        console.error(`Error rendering route ${route?.path || index}:`, error);
        return null;
      }
    })
    .filter(Boolean); // Remove null routes

  console.log("renderRoutes: rendered", renderedRoutes.length, "routes");

  return renderedRoutes.concat([
    // Add catch-all route at the end
    <Route key="catch-all" path="*" element={<Navigate to="/404" replace />} />,
  ]);
};

