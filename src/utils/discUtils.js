// smoovebox-v2/src/utils/discUtils.js
import { DISC_QUESTIONS } from '../constants/discData';

/**
 * Calcule la couleur dominante à partir d'un tableau d'index de réponses.
 * @param {number[]} answers - Tableau des index d'options sélectionnées (0 à 3) pour chaque question.
 * @returns {string} La couleur dominante ('red', 'blue', 'green', 'yellow').
 */
export const calculateDominantColor = (answers) => {
  const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
  
  answers.forEach((answerIndex, questionIndex) => {
    if (answerIndex !== null && questionIndex < DISC_QUESTIONS.length) {
      const question = DISC_QUESTIONS[questionIndex];
      const selectedOption = question.options[answerIndex];
      if (selectedOption) {
        counts[selectedOption.type]++;
      }
    }
  });

  let dominantType = 'red';
  let maxCount = 0;

  Object.entries(counts).forEach(([type, count]) => {
    if (count > maxCount) {
      maxCount = count;
      dominantType = type;
    }
  });

  return dominantType;
};
