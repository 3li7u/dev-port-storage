import { StorageContext, ProjectContext, StorageItem } from "../types/storage";

declare global {
  interface Window {
    __allTokensInjected?: boolean;
  }
}

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
          this.handleLocalhostRequest(url.port || "80");
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

    // Listen for cookie changes with more detailed logging
    chrome.cookies.onChanged.addListener((changeInfo) => {
      const cookie = changeInfo.cookie;
      console.log("[All Tokens] Cookie change detected:", {
        cookie,
        removed: changeInfo.removed,
        cause: changeInfo.cause,
        domain: cookie.domain,
        path: cookie.path,
      });

      if (cookie.domain.includes("localhost")) {
        this.handleCookieChange(cookie, changeInfo.removed);
      }
    });

    // Add message listener for localStorage changes
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "localStorageChange" && sender.tab) {
        const url = new URL(sender.tab.url || "");
        if (url.hostname === "localhost") {
          this.handleLocalStorageChange(
            url.port || "80",
            message.key,
            message.value
          );
        }
      }
    });
  }

  private handleLocalhostRequest(port: string) {
    console.log("[All Tokens] Handling localhost request for port:", port);

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

    // Get initial cookies for this port
    this.loadInitialCookies(port);

    // Inject content script to monitor localStorage
    chrome.tabs.query({ url: `http://localhost:${port}/*` }, async (tabs) => {
      console.log("[All Tokens] Found tabs for port:", port, tabs);
      for (const tab of tabs) {
        if (tab.id) {
          try {
            // Check if script is already injected
            const results = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => window.hasOwnProperty("__allTokensInjected"),
            });

            if (!results[0].result) {
              console.log("[All Tokens] Injecting monitor into tab:", tab.id);
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                  if (!window.hasOwnProperty("__allTokensInjected")) {
                    window.__allTokensInjected = true;

                    // Override localStorage methods to detect changes
                    const originalSetItem = localStorage.setItem;
                    const originalRemoveItem = localStorage.removeItem;
                    const originalClear = localStorage.clear;

                    localStorage.setItem = function (
                      key: string,
                      value: string
                    ) {
                      console.log("[All Tokens] localStorage.setItem called:", {
                        key,
                        value,
                      });

                      // Skip if this is our own storage data
                      if (key === "contexts") {
                        return originalSetItem.call(this, key, value);
                      }

                      originalSetItem.call(this, key, value);
                      chrome.runtime.sendMessage({
                        type: "localStorageChange",
                        key,
                        value,
                      });
                    };

                    localStorage.removeItem = function (key: string) {
                      console.log(
                        "[All Tokens] localStorage.removeItem called:",
                        { key }
                      );

                      // Skip if this is our own storage data
                      if (key === "contexts") {
                        return originalRemoveItem.call(this, key);
                      }

                      originalRemoveItem.call(this, key);
                      chrome.runtime.sendMessage({
                        type: "localStorageChange",
                        key,
                        value: null,
                      });
                    };

                    localStorage.clear = function () {
                      console.log("[All Tokens] localStorage.clear called");

                      originalClear.call(this);
                      chrome.runtime.sendMessage({
                        type: "localStorageChange",
                        key: null,
                        value: null,
                      });
                    };

                    // Send initial localStorage items
                    try {
                      console.log(
                        "[All Tokens] Reading initial localStorage items"
                      );
                      for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key !== "contexts") {
                          const value = localStorage.getItem(key);
                          console.log("[All Tokens] Found initial item:", {
                            key,
                            value,
                          });
                          chrome.runtime.sendMessage({
                            type: "localStorageChange",
                            key,
                            value,
                          });
                        }
                      }
                    } catch (error) {
                      console.error(
                        "[All Tokens] Error reading localStorage:",
                        error
                      );
                    }
                  }
                },
              });
            } else {
              console.log(
                "[All Tokens] Monitor already injected in tab:",
                tab.id
              );
            }
          } catch (error) {
            console.error("[All Tokens] Error injecting script:", error);
          }
        }
      }
    });
  }

  private async loadInitialCookies(port: string) {
    try {
      // Get all cookies for localhost with different variations
      const cookies = await Promise.all([
        chrome.cookies.getAll({ domain: "localhost" }),
        chrome.cookies.getAll({ domain: `.localhost` }),
        chrome.cookies.getAll({ url: `http://localhost:${port}` }),
        chrome.cookies.getAll({ url: `http://localhost:${port}/` }),
      ]);

      // Flatten and deduplicate cookies
      const uniqueCookies = new Map();
      cookies.flat().forEach((cookie) => {
        uniqueCookies.set(cookie.name, cookie);
      });

      console.log(
        "[All Tokens] Found initial cookies:",
        Array.from(uniqueCookies.values())
      );

      for (const cookie of uniqueCookies.values()) {
        const storageItem: StorageItem = {
          key: cookie.name,
          value: cookie.value,
          type: "cookie",
          domain: cookie.domain,
          port,
        };
        this.updateStorageItem(port, storageItem);
      }
    } catch (error) {
      console.error("[All Tokens] Error loading initial cookies:", error);
    }
  }

  private handleCookieChange(cookie: chrome.cookies.Cookie, removed: boolean) {
    // Try to determine the port from various sources
    let port = "80";

    // Try to get port from domain
    if (cookie.domain.includes(":")) {
      port = cookie.domain.split(":")[1];
    }

    // If no port in domain, try to get from cookie's domain
    if (port === "80") {
      const cookieUrl = `http://${cookie.domain}${cookie.path}`;
      try {
        const url = new URL(cookieUrl);
        if (url.port) {
          port = url.port;
        }
      } catch (e) {
        console.error("[All Tokens] Error parsing cookie domain:", e);
      }
    }

    console.log("[All Tokens] Handling cookie change:", {
      cookie,
      port,
      removed,
      domain: cookie.domain,
      path: cookie.path,
    });

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

  private handleLocalStorageChange(
    port: string,
    key: string | null,
    value: string | null
  ) {
    console.log("[All Tokens] Handling localStorage change:", {
      port,
      key,
      value,
    });

    // Skip if this is our own storage data
    if (key === "contexts") {
      return;
    }

    if (!this.contexts[port]) {
      console.log("[All Tokens] Creating new context for port:", port);
      this.contexts[port] = {
        port,
        name: `Project on port ${port}`,
        storage: [],
        lastAccessed: Date.now(),
      };
    }

    if (key === null) {
      // Clear all storage items for this port
      console.log("[All Tokens] Clearing all storage for port:", port);
      this.contexts[port].storage = [];
    } else {
      const storageItem: StorageItem = {
        key,
        value,
        type: "localStorage",
        domain: "localhost",
        port,
      };
      console.log("[All Tokens] Updating storage item:", storageItem);
      this.updateStorageItem(port, storageItem);
    }

    this.saveContexts();
  }

  private async handleStorageChanges(changes: {
    [key: string]: chrome.storage.StorageChange;
  }) {
    // Handle localStorage changes
    const port = await this.getCurrentPort();
    if (port && this.contexts[port]) {
      Object.entries(changes).forEach(([key, change]) => {
        // Skip if this is our own storage data
        if (key === "contexts") {
          return;
        }

        const storageItem: StorageItem = {
          key,
          value: change.newValue,
          type: "localStorage",
          domain: "localhost",
          port,
        };
        this.updateStorageItem(port, storageItem);
      });
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

  private async getCurrentPort(): Promise<string | null> {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url) {
          const url = new URL(tabs[0].url);
          if (url.hostname === "localhost") {
            resolve(url.port || "80");
          }
        }
        resolve(null);
      });
    });
  }
}

// Initialize the storage manager
const storageManager = new StorageManager();
