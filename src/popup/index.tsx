import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ProjectContext, StorageItem } from "../types/storage";

const Popup: React.FC = () => {
  const [contexts, setContexts] = useState<{ [key: string]: ProjectContext }>(
    {}
  );
  const [selectedPort, setSelectedPort] = useState<string | null>(null);

  useEffect(() => {
    // Load contexts from storage
    chrome.storage.local.get("contexts", (result) => {
      setContexts(result.contexts || {});
    });

    // Listen for context updates
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.contexts) {
        setContexts(changes.contexts.newValue);
      }
    });
  }, []);

  const handleContextSelect = (port: string) => {
    setSelectedPort(port);
  };

  const handleClearContext = async (port: string) => {
    const context = contexts[port];
    if (context) {
      // Clear localStorage items
      context.storage
        .filter((item) => item.type === "localStorage")
        .forEach((item) => {
          chrome.storage.local.remove(item.key);
        });

      // Clear cookies
      context.storage
        .filter((item) => item.type === "cookie")
        .forEach((item) => {
          chrome.cookies.remove({
            url: `http://localhost:${port}`,
            name: item.key,
          });
        });

      // Update context
      const newContexts = { ...contexts };
      newContexts[port] = {
        ...context,
        storage: [],
      };
      await chrome.storage.local.set({ contexts: newContexts });
    }
  };

  const handleClearItem = async (port: string, item: StorageItem) => {
    if (item.type === "localStorage") {
      chrome.storage.local.remove(item.key);
    } else if (item.type === "cookie") {
      chrome.cookies.remove({
        url: `http://localhost:${port}`,
        name: item.key,
      });
    }
  };

  return (
    <div style={{ width: "400px", padding: "16px" }}>
      <h2>Local Development Storage Manager</h2>

      <div style={{ marginBottom: "16px" }}>
        <h3>Active Projects</h3>
        {Object.entries(contexts).map(([port, context]) => (
          <div
            key={port}
            style={{
              padding: "8px",
              margin: "4px 0",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: "pointer",
              backgroundColor: selectedPort === port ? "#e6f3ff" : "white",
            }}
            onClick={() => handleContextSelect(port)}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
              <div>
                <strong>{context.name}</strong>
                <div>Port: {port}</div>
                <div>
                  Items: {context.storage.length} (
                  {
                    context.storage.filter(
                      (item) => item.type === "localStorage"
                    ).length
                  }{" "}
                  localStorage,{" "}
                  {
                    context.storage.filter((item) => item.type === "cookie")
                      .length
                  }{" "}
                  cookies)
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearContext(port);
                }}
                style={{
                  padding: "4px 8px",
                  backgroundColor: "#ff4444",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}>
                Clear All
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedPort && contexts[selectedPort] && (
        <div>
          <h3>Storage Items</h3>
          <div style={{ marginBottom: "8px" }}>
            <strong>LocalStorage Items:</strong>
          </div>
          {contexts[selectedPort].storage
            .filter((item) => item.type === "localStorage")
            .map((item, index) => (
              <div
                key={index}
                style={{
                  padding: "8px",
                  margin: "4px 0",
                  border: "1px solid #eee",
                  borderRadius: "4px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                <div>
                  <div>
                    <strong>{item.key}</strong>
                  </div>
                  <div>Value: {JSON.stringify(item.value)}</div>
                </div>
                <button
                  onClick={() => handleClearItem(selectedPort, item)}
                  style={{
                    padding: "4px 8px",
                    backgroundColor: "#ff4444",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}>
                  Clear
                </button>
              </div>
            ))}

          <div style={{ marginTop: "16px", marginBottom: "8px" }}>
            <strong>Cookies:</strong>
          </div>
          {contexts[selectedPort].storage
            .filter((item) => item.type === "cookie")
            .map((item, index) => (
              <div
                key={index}
                style={{
                  padding: "8px",
                  margin: "4px 0",
                  border: "1px solid #eee",
                  borderRadius: "4px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                <div>
                  <div>
                    <strong>{item.key}</strong>
                  </div>
                  <div>Value: {JSON.stringify(item.value)}</div>
                  <div style={{ fontSize: "0.8em", color: "#666" }}>
                    Domain: {item.domain}
                  </div>
                </div>
                <button
                  onClick={() => handleClearItem(selectedPort, item)}
                  style={{
                    padding: "4px 8px",
                    backgroundColor: "#ff4444",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}>
                  Clear
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<Popup />);
