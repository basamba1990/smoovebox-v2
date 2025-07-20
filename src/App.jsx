import { useAuth } from './context/AuthContext'
import { useEffect } from 'react'

function App() {
  const { user, loading } = useAuth()

  useEffect(() => {
    console.log('État utilisateur:', user)
  }, [user])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-xl font-semibold">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Votre contenu principal ici */}
      {user ? (
        <div>Bienvenue {user.email}</div>
      ) : (
        <div>Veuillez vous connecter</div>
      )}
    </div>
  )
}

export default App
