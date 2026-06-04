import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

export const getMonsters = (params = {}) =>
  api.get('/monsters', { params }).then(r => r.data);

export const getMonster = (name) =>
  api.get(`/monsters/${encodeURIComponent(name)}`).then(r => r.data);

export const getMonstersByGame = (game) =>
  api.get(`/monsters/game/${encodeURIComponent(game)}`).then(r => r.data);

export const getMonsterImageUrl = (name) =>
  `${API_BASE}/monsters/${encodeURIComponent(name)}/image`;

const imageCache = new Map()

export function preloadImage(url) {
  if (imageCache.has(url)) return imageCache.get(url)

  const promise = new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(url)
    img.onerror = () => reject()
    img.src = url
  })

  imageCache.set(url, promise)
  return promise
}

export default api;