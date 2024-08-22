// src/lib/utils/cache.js

// Save data to localStorage with expiration
export function saveToCache(key, data) {
  const cache = {
    timestamp: Date.now(),
    data,
  };
  localStorage.setItem(key, JSON.stringify(cache));
}

// Get data from localStorage with expiration check
export function getFromCache(key, expirationMinutes = 30) {
  // Default to 30 minutes
  const expirationTime = expirationMinutes * 60 * 1000; // Convert minutes to milliseconds
  const cache = JSON.parse(localStorage.getItem(key));
  if (cache && Date.now() - cache.timestamp < expirationTime) {
    return cache.data;
  }
  return null;
}

// Remove data from localStorage
export function removeFromCache(key) {
  localStorage.removeItem(key);
}
