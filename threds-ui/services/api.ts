const API_BASE = import.meta.env.VITE_API_URL;
const API_TIMEOUT_MS = 4000;
const HEALTH_CHECK_TIMEOUT_MS = 250;

// Simple in-memory cache for fast instant rendering on board/thread navigation
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 30000; // 30 seconds TTL

const fetchWithTimeout = async <T>(url: string, init: RequestInit = {}, timeoutMs = API_TIMEOUT_MS): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || `Request failed: ${res.status}`);
    }

    const text = await res.text();
    if (!text) {
      return null as T;
    }

    return JSON.parse(text) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The site is in hibernate mode.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

// Optimized helper function to convert to camelCase
const toCamelCase = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase);
  }
  
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const camelKey = key.includes('_') 
      ? key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      : key;
    result[camelKey] = toCamelCase(obj[key]);
  }
  return result;
};

export const api = {
  clearCache(keyPrefix?: string) {
    if (!keyPrefix) {
      cache.clear();
      return;
    }
    for (const key of cache.keys()) {
      if (key.startsWith(keyPrefix)) {
        cache.delete(key);
      }
    }
  },

  // Upload image to backend for Cloudinary upload
  async uploadImage(file: File) {
    const form = new FormData();
    form.append("file", file);

    const data = await fetchWithTimeout<{ imageUrl: string }>(`${API_BASE}/upload`, {
      method: 'POST',
      body: form,
      cache: 'no-store'
    });

    return data.imageUrl; // Returns the Cloudinary URL
  },

  // Get all threds for a specific board with client-side caching
  async fetchThreds(boardType: string, forceRefresh = false) {
    const cacheKey = `board_${boardType}`;
    const cached = cache.get(cacheKey);

    if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    const data = await fetchWithTimeout<any>(`${API_BASE}/boards/${boardType}/threds`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' }
    });
    const formatted = Array.isArray(data) ? data.map(toCamelCase) : toCamelCase(data);
    cache.set(cacheKey, { data: formatted, timestamp: Date.now() });
    return formatted;
  },

  // Create a new thread
  async createThread(boardType: string, data: { subject: string; content: string; imageUrl?: string }) {
    const thread = await fetchWithTimeout<any>(`${API_BASE}/boards/${boardType}/threds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify(data),
      cache: 'no-store'
    });
    const formatted = toCamelCase(thread);
    // Invalidate board cache on creation
    this.clearCache(`board_${boardType}`);
    return formatted;
  },

  // Get a single thread with its posts with client-side caching
  async fetchThread(id: string, forceRefresh = false) {
    const cacheKey = `thread_${id}`;
    const cached = cache.get(cacheKey);

    if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    const thread = await fetchWithTimeout<any>(`${API_BASE}/threds/${id}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' }
    });
    const formatted = toCamelCase(thread);
    cache.set(cacheKey, { data: formatted, timestamp: Date.now() });
    return formatted;
  },

  // Add a reply to a thread
  async createPost(threadId: string, data: { content: string; replyToId?: string; imageUrl?: string }) {
    const post = await fetchWithTimeout<any>(`${API_BASE}/threds/${threadId}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify(data),
      cache: 'no-store'
    });
    const formatted = toCamelCase(post);
    // Invalidate thread cache on reply
    this.clearCache(`thread_${threadId}`);
    return formatted;
  },

  // Check if Rails backend is online
  async checkStatus() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

    try {
      const res = await fetch(`${API_BASE}/up`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });

      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }
};
