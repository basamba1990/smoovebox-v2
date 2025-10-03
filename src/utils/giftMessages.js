// src/utils/giftMessages.js
export const getGiftMessage = (trigger, achievement = null) => {
  const messages = {
    achievement: {
      title: "🎉 Félicitations !",
      message: `Bravo pour ${achievement || 'cette belle réalisation'} ! En cadeau, choisissez une expérience qui vous inspirera.`
    },
    milestone: {
      title: "🏆 Objectif Atteint !", 
      message: "Vous progressez magnifiquement ! Offrez-vous un moment de découverte personnelle."
    },
    surprise: {
      title: "🎁 Petite Surprise !",
      message: "Nous avons pensé à vous ! Un cadeau pour enrichir votre aventure SpotBulle."
    },
    reflection: {
      title: "🤔 Moment de Réflexion ?",
      message: "Prenez un moment pour vous. Ces expériences pourraient vous éclairer sur votre chemin."
    },
    welcome: {
      title: "🌸 Bienvenue dans l'Aventure !",
      message: "Pour célébrer votre arrivée, nous vous offrons une expérience de découverte personnelle."
    }
  };

  return messages[trigger] || messages.surprise;
};
