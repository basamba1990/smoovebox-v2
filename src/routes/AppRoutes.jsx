  {/* Routes d'authentification */}
  <Route path="/login" element={<Login />} />
  <Route path="/auth/callback" element={<AuthCallback />} />
  <Route path="/reset-password" element={<ResetPassword />} />
  <Route path="/transformation-demo" element={<TransformationDemo />} />
  {/* Company authentication routes */}
  <Route path="/company-signup" element={<CompanySignup />} />
  <Route path="/company-signin" element={<CompanySignin />} />
  {/* Legacy PSG routes - redirect to company routes */}
  <Route path="/psg-signup" element={<CompanySignup />} />
  <Route path="/psg-signin" element={<CompanySignin />} />
  {/* Company recording page - only for company users */}
  <Route
    path="/company-record"
    element={
      <RequireAuth>
        <CompanyRecord />
      </RequireAuth>
    }
  />
  <Route path="/test-chat" element={<FootballChatTest />} />
  {/* NOUVELLE ROUTE POUR L'ANALYSE DE PITCH */}
  <Route
    path="/pitch-analysis"
    element={
      <RequireAuth>
        <PitchAnalysisPage />
      </RequireAuth>
    }
  />
  <Route path="/premium" element={<SpotBullePremium />} />
  <Route
    path="/spotcoach"
    element={
      <RequireAuth>
        <SpotCoach />
      </RequireAuth>
    }
  />
  <Route
    path="/lumi/onboarding"
    element={
      <RequireAuth>
        <LumiOnboarding />
      </RequireAuth>
    }
  />
  <Route
    path="/lumi/profile"
    element={
      <RequireAuth>
        <LumiUnifiedProfile />
      </RequireAuth>
    }
  />

  {/* ✅ Nouvelle Route DISC */}
  <Route
    path="/update-disc"
    element={
      <RequireAuth>
        <UpdateDISC user={user} profile={profile} onSignOut={onSignOut} />
      </RequireAuth>
    }
  />

  {/* Routes protégées */}
  <Route
    path="/record-video"
    element={
      <RequireAuth>
        <EnhancedRecordVideo
          user={user}
          profile={profile}
          onSignOut={onSignOut}
          onVideoUploaded={handleVideoUploaded}
          cameraChecked={cameraChecked}
        />
      </RequireAuth>
    }
  />

  <Route
    path="/dashboard"
    element={
      <RequireAuth>
        <Dashboard
          refreshKey={Date.now()}
          onVideoUploaded={handleVideoUploaded}
          userProfile={profile}
        />
      </RequireAuth>
    }
  />

  <Route
    path="/video-vault"
    element={
      <RequireAuth>
        <VideoVault
          user={user}
          profile={profile}
          onSignOut={onSignOut}
          onVideoAdded={handleVideoUploaded}
        />
      </RequireAuth>
    }
  />

  <Route
    path="/video-analysis/:videoId"
    element={
      <RequireAuth>
        <VideoAnalysisPage
          user={user}
          profile={profile}
          onSignOut={onSignOut}
        />
      </RequireAuth>
    }
  />

  {/* Route /personality-test dépréciée, redirige vers /update-disc */}
  <Route path="/personality-test" element={<Navigate to="/update-disc" replace />} />

  <Route
    path="/seminars"
    element={
      <RequireAuth>
        <SeminarsList user={user} profile={profile} onSignOut={onSignOut} />
      </RequireAuth>
    }
  />

  <Route
    path="/certification"
    element={
      <RequireAuth>
        <Certification
          user={user}
          profile={profile}
          onSignOut={onSignOut}
        />
      </RequireAuth>
    }
  />

  {/* Routes de compatibilité */}
  <Route
    path="/classic"
    element={
      <RequireAuth>
        <Home
          user={user}
          profile={profile}
          connectionStatus={connectionStatus}
          onSignOut={onSignOut}
          dashboardData={dashboardData}
          dashboardLoading={dashboardLoading}
        />
      </RequireAuth>
    }
  />

  <Route
    path="/video-success"
    element={
      <RequireAuth>
        <VideoSuccess />
      </RequireAuth>
    }
  />

  <Route
    path="/directory"
    element={
      <RequireAuth>
        <Directory />
      </RequireAuth>
    }
  />

  {/* Routes de démonstration */}
  <Route path="/demo" element={<WelcomeAgent demoMode={true} />} />
  <Route path="/features" element={<WelcomeAgent showFeatures={true} />} />

  {/* Gestion des erreurs 404 */}
  <Route
    path="/404"
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

  {/* Redirection catch-all */}
  <Route path="*" element={<Navigate to="/404" replace />} />
</Routes>
