(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.assets = DR.assets || {};

  class AssetSystem {
    constructor(options = {}) {
      this.baseUrl = options.baseUrl || './';
      this.jsonCache = new Map();
      this.imageCache = new Map();
    }

    resolveUrl(path) {
      const value = String(path || '').trim();
      if (!value) return '';
      if (/^(https?:|data:|blob:)/i.test(value)) return value;
      if (value.startsWith('./') || value.startsWith('../') || value.startsWith('/')) return value;
      return `${this.baseUrl}${value}`;
    }

    async loadJson(path, options = {}) {
      const url = this.resolveUrl(path);
      if (!url) return null;
      if (!options.forceReload && this.jsonCache.has(url)) return this.jsonCache.get(url);
      try {
        const response = await fetch(url, { cache: options.cache || 'default' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        this.jsonCache.set(url, json);
        return json;
      } catch (err) {
        if (!options.silent) console.warn(`[AssetSystem] Failed to load JSON ${url}:`, err);
        return null;
      }
    }

    loadImage(path, options = {}) {
      const url = this.resolveUrl(path);
      if (!url) return Promise.resolve(null);
      if (!options.forceReload && this.imageCache.has(url)) return this.imageCache.get(url);
      const promise = new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = err => {
          if (!options.silent) console.warn(`[AssetSystem] Failed to load image ${url}:`, err);
          resolve(null);
        };
        img.src = url;
      });
      this.imageCache.set(url, promise);
      return promise;
    }

    clear() {
      this.jsonCache.clear();
      this.imageCache.clear();
    }
  }

  DR.assets.AssetSystem = AssetSystem;
  DR.AssetSystem = AssetSystem;
})();
