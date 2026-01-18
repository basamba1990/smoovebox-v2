/**
 * Logger sécurisé pour éviter l'erreur "qg.info is not a function"
 * Fournit un fallback vers console si l'objet global qg est absent ou mal formé.
 */
const safeLog = (method, ...args) => {
  // Vérifie si qg existe sur window et possède la méthode demandée
  const hasGlobalQg = typeof window !== 'undefined' && window.qg && typeof window.qg[method] === 'function';
  
  if (hasGlobalQg) {
    window.qg[method](...args);
  } else {
    // Fallback sur console standard
    const consoleMethod = console[method] || console.log;
    consoleMethod(...args);
  }
};

export const qg = {
  info: (...args) => safeLog('info', ...args),
  warn: (...args) => safeLog('warn', ...args),
  error: (...args) => safeLog('error', ...args),
  debug: (...args) => safeLog('debug', ...args),
  log: (...args) => safeLog('log', ...args)
};

export default qg;
