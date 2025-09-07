// src/pages/api/tts.ts
import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

// Initialiser OpenAI avec votre clé API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Vérifier la méthode HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Texte requis' });
    }

    // Générer l'audio avec OpenAI TTS
    const mp3 = await openai.audio.speech.create({
      model: "tts-1-hd",
      voice: "nova", // Voix chaleureuse et claire
      input: text,
      speed: 1.0,
    });

    // Convertir la réponse en buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());
    
    // Définir les en-têtes de réponse
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    
    // Envoyer l'audio
    res.status(200).send(buffer);
  } catch (error) {
    console.error('Erreur TTS:', error);
    res.status(500).json({ error: 'Erreur lors de la synthèse vocale' });
  }
}
