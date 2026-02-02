// src/config/routes.js
// Centralized route configuration

import Login from "@/pages/login.jsx";
import AuthCallback from "@/pages/AuthCallback.jsx";
import ResetPassword from "@/pages/ResetPassword.jsx";
import { TransformationDemo } from "@/pages/TransformationDemo.jsx";
import { CompanySignup } from "@/pages/company-signup.jsx";
import { CompanySignin } from "@/pages/company-signin.jsx";
import { CompanyRecord } from "@/pages/company-record.jsx";
import FootballChatTest from "@/pages/FootballChatTest.jsx";
import SpotBullePremium from "@/pages/SpotBullePremium.jsx";
import SpotCoach from "@/pages/SpotCoach.jsx";
import EnhancedRecordVideo from "@/pages/enhanced-record-video.jsx";
import Dashboard from "@/components/Dashboard.jsx";
import VideoVault from "@/pages/video-vault.jsx";
import VideoAnalysisPage from "@/pages/video-analysis.jsx";
import FourColorsTest from "@/components/FourColorsTest.jsx";
import SeminarsList from "@/components/SeminarsList.jsx";
import Certification from "@/components/Certification.jsx";
import Home from "@/pages/home.jsx";
import VideoSuccess from "@/pages/video-success.jsx";
import Directory from "@/pages/directory.jsx";
import SimplifiedHome from "@/pages/SimplifiedHome.jsx";
import WelcomeAgent from "@/components/WelcomeAgent.jsx";
import LumiOnboarding from "@/pages/lumi-onboarding.jsx";
import UpdateDISC from "@/pages/UpdateDISC.jsx";

/**
 * Route configuration
 * @param {Object} context - App context (user, profile, handlers, etc.)
 * @param {Function} navigate - Navigation function
 * @param {Function} setIsAuthModalOpen - Function to open auth modal
 * @returns {Array} Array of route definitions
 */
export const createRoutes = (context, navigate, setIsAuthModalOpen) => {
  const {
    user,
    profile,
    connectionStatus,
    onSignOut,
    dashboardData,
    dashboardLoading,
    handleVideoUploaded,
    cameraChecked,
  } = context;

  return [
    // Root route - logic now handled directly in AppRoutes (redirect to /login or /embark)
    {
      path: "/",
      element: SimplifiedHome,
      requiresAuth: false,
    },

    // Auth routes (public)
    {
      path: "/login",
      element: Login,
      requiresAuth: false,
    },
    {
      path: "/auth/callback",
      element: AuthCallback,
      requiresAuth: false,
    },
    {
      path: "/reset-password",
      element: ResetPassword,
      requiresAuth: false,
    },
    {
      path: "/company-signup",
      element: CompanySignup,
      requiresAuth: false,
    },
    {
      path: "/company-signin",
      element: CompanySignin,
      requiresAuth: false,
    },
    // Legacy PSG routes - redirect to company routes
    {
      path: "/psg-signup",
      element: CompanySignup,
      requiresAuth: false,
    },
    {
      path: "/psg-signin",
      element: CompanySignin,
      requiresAuth: false,
    },
    {
      path: "/company-record",
      element: CompanyRecord,
      requiresAuth: true,
    },

    // Demo/Test routes (public)
    {
      path: "/transformation-demo",
      element: TransformationDemo,
      requiresAuth: false,
    },
    {
      path: "/test-chat",
      element: FootballChatTest,
      requiresAuth: false,
    },
    {
      path: "/premium",
      element: SpotBullePremium,
      requiresAuth: false,
    },
    {
      path: "/demo",
      element: WelcomeAgent,
      requiresAuth: false,
      props: {
        demoMode: true,
      },
    },
    {
      path: "/features",
      element: WelcomeAgent,
      requiresAuth: false,
      props: {
        showFeatures: true,
      },
    },

    // Protected routes
    {
      path: "/lumi/onboarding",
      element: LumiOnboarding,
      requiresAuth: true,
    },
    {
      path: "/embark",
      element: SpotCoach,
      requiresAuth: true,
    },
    {
      path: "/record-video",
      element: EnhancedRecordVideo,
      requiresAuth: true,
      props: {
        user,
        profile,
        onSignOut,
        onVideoUploaded: handleVideoUploaded,
        cameraChecked,
      },
    },
    {
      path: "/video-vault",
      element: VideoVault,
      requiresAuth: true,
      props: {
        user,
        profile,
        onSignOut,
        onVideoAdded: handleVideoUploaded,
      },
    },
    {
      path: "/video-analysis/:videoId",
      element: VideoAnalysisPage,
      requiresAuth: true,
      props: {
        user,
        profile,
        onSignOut,
      },
    },
    {
      path: "/personality-test",
      element: FourColorsTest,
      requiresAuth: true,
      props: {
        user,
        profile,
        onSignOut,
      },
    },
    {
      path: "/update-disc",
      element: UpdateDISC,
      requiresAuth: true,
      props: {
        user,
        profile,
        onSignOut,
      },
    },
    {
      path: "/seminars",
      element: SeminarsList,
      requiresAuth: true,
      props: {
        user,
        profile,
        onSignOut,
      },
    },
    {
      path: "/certification",
      element: Certification,
      requiresAuth: true,
      props: {
        user,
        profile,
        onSignOut,
      },
    },
    {
      path: "/classic",
      element: Home,
      requiresAuth: true,
      props: {
        user,
        profile,
        connectionStatus,
        onSignOut,
        dashboardData,
        dashboardLoading,
      },
    },
    {
      path: "/video-success",
      element: VideoSuccess,
      requiresAuth: true,
    },
    {
      path: "/directory",
      element: Directory,
      requiresAuth: true,
    },
    {
      path: "/old",
      element: SimplifiedHome,
      requiresAuth: true,
      props: {
        user,
        profile,
        connectionStatus,
        onSignOut,
        dashboardData,
        dashboardLoading,
      },
    },

    // Error routes
    {
      path: "/404",
      element: null, // Custom component, handled separately
      requiresAuth: false,
      isCustom: true, // Flag for custom 404 handling
    },
  ];
};
