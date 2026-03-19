const API_BASE = import.meta.env.VITE_API_URL;

//All data sent from client in CamelCase and received from Server in snake_case
// Helper function to convert to camelCase, no snake_case conversion needed as server handles that
const toCamelCase = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (obj === null || typeof obj !== 'object') return obj;
  
  return Object.keys(obj).reduce((result, key) => {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = toCamelCase(obj[key]);
    return result;
  }, {} as any);
};

export const api = {
  // Upload image to backend for Cloudinary upload
  async uploadImage(file: File) {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: form
    });

    if (!res.ok) {
      throw new Error('Image upload failed');
    }

    const data = await res.json();
    return data.imageUrl; // Returns the Cloudinary URL
  },

  // Get all threds for a specific board
  async fetchThreds(boardType: string) {
    const res = await fetch(`${API_BASE}/boards/${boardType}/threds`);
    const data = await res.json();
    return Array.isArray(data) ? data.map(toCamelCase) : toCamelCase(data);
  },

  // Create a new thread
  async createThread(boardType: string, data: { subject: string; content: string; imageUrl?: string }) {
    const res = await fetch(`${API_BASE}/boards/${boardType}/threds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const thread = await res.json();
    return toCamelCase(thread);
  },

  // Get a single thread with its posts
  async fetchThread(id: string) {
    const res = await fetch(`${API_BASE}/threds/${id}`);
    const thread = await res.json();
    return toCamelCase(thread);
  },

  // Add a reply to a thread
  async createPost(threadId: string, data: { content: string; replyToId?: string; imageUrl?: string }) {
    const res = await fetch(`${API_BASE}/threds/${threadId}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const post = await res.json();
    return toCamelCase(post);
  },

  // Check if Rails backend is online
  async checkStatus() {
    try {
      const res = await fetch(`${API_BASE}/up`, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  }
};