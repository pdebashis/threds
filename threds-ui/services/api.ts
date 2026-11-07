import { fetchJson, toCamelCase } from './http.ts';
import type { SketchObject } from '../sketch.ts';

const API_BASE = import.meta.env?.VITE_API_URL || '';

// Simple in-memory cache for fast instant rendering on board/thread navigation
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 30000; // 30 seconds TTL
const STATUS_TIMEOUT_MS = 30000;

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

  // Upload media to Cloudinary; the returned URL is the untransformed original.
  async uploadMedia(file: File, threadId?: string, threadKey?: string) {
    const form = new FormData();
    form.append("file", file);
    if (threadId) form.append("thread_id", threadId);

    const data = await fetchJson<{ imageUrl: string }>(`${API_BASE}/upload`, {
      method: 'POST',
      body: form,
      headers: threadKey ? { 'X-Thred-Key': threadKey } : undefined,
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

    const data = await fetchJson<any>(`${API_BASE}/boards/${boardType}/threds`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' }
    });
    const formatted = Array.isArray(data) ? data.map(toCamelCase) : toCamelCase(data);
    cache.set(cacheKey, { data: formatted, timestamp: Date.now() });
    return formatted;
  },

  // Create a new thread
  async createThread(boardType: string, data: {
    subject: string;
    content: string;
    imageUrl?: string;
    protectionStatus?: 'public' | 'code_protected';
    threadCode?: string;
  }) {
    const thread = await fetchJson<any>(`${API_BASE}/boards/${boardType}/threds`, {
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

    const thread = await fetchJson<any>(`${API_BASE}/threds/${id}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' }
    });
    const formatted = toCamelCase(thread);
    cache.set(cacheKey, { data: formatted, timestamp: Date.now() });
    return formatted;
  },

  // Add a reply to a thread
  async createPost(
    threadId: string,
    data: { content: string; replyToId?: string; imageUrl?: string },
    threadCode?: string,
  ) {
    const post = await fetchJson<any>(`${API_BASE}/threds/${threadId}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        ...(threadCode ? { 'X-Thred-Key': threadCode } : {}),
      },
      body: JSON.stringify(data),
      cache: 'no-store'
    });
    const formatted = toCamelCase(post);
    // Invalidate thread cache on reply
    this.clearCache(`thread_${threadId}`);
    return formatted;
  },

  async fetchSketch(threadId: string) {
    const data = await fetchJson<{ objects: SketchObject[] }>(`${API_BASE}/threds/${threadId}/sketch`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' }
    });
    return data.objects;
  },

  async createSketchObject(
    threadId: string,
    operation: Pick<SketchObject, 'operationId' | 'type' | 'data'>,
    threadKey?: string,
  ) {
    const result = await fetchJson<{ operation: SketchObject }>(`${API_BASE}/threds/${threadId}/sketch/objects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        ...(threadKey ? { 'X-Thred-Key': threadKey } : {}),
      },
      body: JSON.stringify(operation),
      cache: 'no-store'
    });
    return result.operation;
  },

  async reportPost(postId: string, reason: string, customReason?: string) {
    const payload = {
      reason,
      ...(customReason && customReason.trim() ? { custom_reason: customReason } : {})
    };

    const result = await fetchJson<any>(`${API_BASE}/posts/${postId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify(payload),
      cache: 'no-store'
    });

    return toCamelCase(result);
  },

  // Check if Rails backend is online
  async checkStatus() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);

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
