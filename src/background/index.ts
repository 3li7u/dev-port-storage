import { StorageContext, ProjectContext, StorageItem } from "../types/storage";

class StorageManager {
  private contexts: StorageContext = {};

  constructor() {
    this.initializeListeners();
    this.loadContexts();
  }

  private async loadContexts() {
    const result = await chrome.storage.local.get("contexts");
    this.contexts = result.contexts || {};
  }

  private async saveContexts() {
    await chrome.storage.local.set({ contexts: this.contexts });
  }

  private initializeListeners() {
    // Listen for web requests to localhost
    chrome.webRequest.onBeforeRequest.addListener(
      (details) => {
        const url = new URL(details.url);
        if (url.hostname === "localhost") {
          this.handleLocalhostRequest(url.port);
        }
      },
      { urls: ["http://localhost/*"] }
    );

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local") {
        this.handleStorageChanges(changes);
      }
    });

    // Listen for cookie changes
    chrome.cookies.onChanged.addListener((changeInfo) => {
      const cookie = changeInfo.cookie;
      if (cookie.domain.includes("localhost")) {
        this.handleCookieChange(cookie, changeInfo.removed);
      }
    });
  }

  private handleLocalhostRequest(port: string) {
    if (!this.contexts[port]) {
      this.contexts[port] = {
        port,
        name: `Project on port ${port}`,
        storage: [],
        lastAccessed: Date.now(),
      };
      this.saveContexts();
    } else {
      this.contexts[port].lastAccessed = Date.now();
      this.saveContexts();
    }
  }

  private handleStorageChanges(changes: {
    [key: string]: chrome.storage.StorageChange;
  }) {
    // Handle localStorage changes
    Object.entries(changes).forEach(([key, change]) => {
      const port = this.getCurrentPort();
      if (port && this.contexts[port]) {
        const storageItem: StorageItem = {
          key,
          value: change.newValue,
          type: "localStorage",
          domain: "localhost",
          port,
        };
        this.updateStorageItem(port, storageItem);
      }
    });
  }

  private handleCookieChange(cookie: chrome.cookies.Cookie, removed: boolean) {
    const port = cookie.domain.split(":")[1] || "80";
    if (this.contexts[port]) {
      const storageItem: StorageItem = {
        key: cookie.name,
        value: removed ? null : cookie.value,
        type: "cookie",
        domain: cookie.domain,
        port,
      };
      this.updateStorageItem(port, storageItem);
    }
  }

  private updateStorageItem(port: string, item: StorageItem) {
    const context = this.contexts[port];
    const existingIndex = context.storage.findIndex(
      (s) => s.key === item.key && s.type === item.type
    );

    if (existingIndex >= 0) {
      if (item.value === null) {
        context.storage.splice(existingIndex, 1);
      } else {
        context.storage[existingIndex] = item;
      }
    } else if (item.value !== null) {
      context.storage.push(item);
    }

    this.saveContexts();
  }

  private getCurrentPort(): string | null {
    // This would need to be implemented to get the current port
    // from the active tab or request
    return null;
  }
}

// Initialize the storage manager
const storageManager = new StorageManager();
