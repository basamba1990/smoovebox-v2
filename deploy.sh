#!/bin/bash

# Script de déploiement automatisé pour SmooveBox V2
# Usage: ./deploy.sh [environment]
# Environments: staging, production

set -e

ENVIRONMENT=${1:-production}
PROJECT_NAME="smoovebox-v2"

echo "🚀 Déploiement de $PROJECT_NAME en environnement: $ENVIRONMENT"

# Vérification des prérequis
echo "📋 Vérification des prérequis..."

if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI n'est pas installé. Installez-le avec: npm install -g supabase"
    exit 1
fi

if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI n'est pas installé. Installez-le avec: npm install -g vercel"
    exit 1
fi

# Vérification des variables d'environnement
echo "🔐 Vérification des variables d'environnement..."

if [ ! -f ".env" ]; then
    echo "❌ Fichier .env manquant. Copiez .env.example vers .env et configurez les variables."
    exit 1
fi

# Source des variables d'environnement
source .env

required_vars=("VITE_SUPABASE_URL" "VITE_SUPABASE_ANON_KEY" "VITE_OPENAI_API_KEY" "SUPABASE_SERVICE_ROLE_KEY")

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Variable d'environnement manquante: $var"
        exit 1
    fi
done

echo "✅ Toutes les variables d'environnement sont configurées"

# Build du frontend
echo "🔨 Construction du frontend..."
npm install
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Échec de la construction du frontend"
    exit 1
fi

echo "✅ Frontend construit avec succès"

# Déploiement des Edge Functions
echo "🔧 Déploiement des Edge Functions Supabase..."

# Vérification de la connexion Supabase
if ! supabase status &> /dev/null; then
    echo "🔗 Connexion au projet Supabase..."
    supabase link --project-ref $(echo $VITE_SUPABASE_URL | sed 's/.*\/\/\([^.]*\).*/\1/')
fi

# Configuration des secrets
echo "🔐 Configuration des secrets Supabase..."
supabase secrets set OPENAI_API_KEY="$VITE_OPENAI_API_KEY" --project-ref $(echo $VITE_SUPABASE_URL | sed 's/.*\/\/\([^.]*\).*/\1/')
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" --project-ref $(echo $VITE_SUPABASE_URL | sed 's/.*\/\/\([^.]*\).*/\1/')

# Déploiement des fonctions
echo "📤 Déploiement des fonctions Edge..."
supabase functions deploy process-video --project-ref $(echo $VITE_SUPABASE_URL | sed 's/.*\/\/\([^.]*\).*/\1/')
supabase functions deploy storage-webhook --project-ref $(echo $VITE_SUPABASE_URL | sed 's/.*\/\/\([^.]*\).*/\1/')

if [ $? -ne 0 ]; then
    echo "❌ Échec du déploiement des Edge Functions"
    exit 1
fi

echo "✅ Edge Functions déployées avec succès"

# Déploiement des migrations de base de données
echo "🗄️ Application des migrations de base de données..."
supabase db push --project-ref $(echo $VITE_SUPABASE_URL | sed 's/.*\/\/\([^.]*\).*/\1/')

if [ $? -ne 0 ]; then
    echo "❌ Échec de l'application des migrations"
    exit 1
fi

echo "✅ Migrations appliquées avec succès"

# Déploiement du frontend
echo "🌐 Déploiement du frontend sur Vercel..."

if [ "$ENVIRONMENT" = "production" ]; then
    vercel --prod --yes
else
    vercel --yes
fi

if [ $? -ne 0 ]; then
    echo "❌ Échec du déploiement du frontend"
    exit 1
fi

echo "✅ Frontend déployé avec succès"

# Tests post-déploiement
echo "🧪 Exécution des tests post-déploiement..."

# Test de santé des Edge Functions
echo "🔍 Test des Edge Functions..."
FUNCTION_URL="$VITE_SUPABASE_URL/functions/v1/process-video"

# Test simple de la fonction (devrait retourner 405 pour GET)
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FUNCTION_URL")

if [ "$HTTP_STATUS" = "405" ]; then
    echo "✅ Edge Function process-video répond correctement"
else
    echo "⚠️ Edge Function process-video retourne un statut inattendu: $HTTP_STATUS"
fi

echo ""
echo "🎉 Déploiement terminé avec succès!"
echo ""
echo "📊 Résumé du déploiement:"
echo "   - Environnement: $ENVIRONMENT"
echo "   - Frontend: Déployé sur Vercel"
echo "   - Backend: Edge Functions déployées sur Supabase"
echo "   - Base de données: Migrations appliquées"
echo ""
echo "🔗 Liens utiles:"
echo "   - Application: $(vercel --scope $(vercel whoami) ls $PROJECT_NAME --meta url 2>/dev/null | tail -1 || echo 'URL non disponible')"
echo "   - Dashboard Supabase: $VITE_SUPABASE_URL"
echo "   - Logs Edge Functions: supabase functions logs process-video"
echo ""
echo "📝 Prochaines étapes:"
echo "   1. Tester l'application en production"
echo "   2. Surveiller les logs pour détecter d'éventuels problèmes"
echo "   3. Configurer le monitoring et les alertes"

