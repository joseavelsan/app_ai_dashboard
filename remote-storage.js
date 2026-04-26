(function () {
  "use strict";

  if (typeof window === "undefined" || !window.localStorage || !window.XMLHttpRequest) {
    return;
  }

  const MANAGED_KEYS = [
    "ai-stack-v1",
    "ai_stack_ext_v1",
    "ai-tools-v1",
    "ai_tools_ext_v1",
    "ai_update_sources",
    "ai_update_recents",
    "ai_update_ext_v1",
    "ia-webs-v1",
    "ia_webs_ext_v1",
    "ai_notas_v1",
    "ai-stack-proxy-url",
    "ai-stack-claude-model",
    "ai-tools-proxy-url",
    "ai-tools-claude-model"
  ];

  const managed = new Set(MANAGED_KEYS);
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  const originalClear = Storage.prototype.clear;

  function syncPut(key, value) {
    fetch("/api/state/" + encodeURIComponent(key), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value })
    }).catch(() => {});
  }

  function syncDelete(key) {
    fetch("/api/state/" + encodeURIComponent(key), {
      method: "DELETE"
    }).catch(() => {});
  }

  function bulkPush(data) {
    fetch("/api/state/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data })
    }).catch(() => {});
  }

  function hydrateFromServerSync() {
    try {
      const keyList = encodeURIComponent(MANAGED_KEYS.join(","));
      const xhr = new XMLHttpRequest();
      xhr.open("GET", "/api/state?keys=" + keyList, false);
      xhr.send(null);
      if (xhr.status < 200 || xhr.status >= 300) return;

      const resp = JSON.parse(xhr.responseText || "{}");
      const remoteData = (resp && resp.data && typeof resp.data === "object") ? resp.data : {};
      const missingInRemote = {};

      MANAGED_KEYS.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(remoteData, key) && typeof remoteData[key] === "string") {
          originalSetItem.call(localStorage, key, remoteData[key]);
        } else {
          const localVal = localStorage.getItem(key);
          if (localVal !== null) {
            missingInRemote[key] = localVal;
          }
        }
      });

      if (Object.keys(missingInRemote).length) {
        bulkPush(missingInRemote);
      }
    } catch (_err) {
      // Keep local-only behavior if API is down.
    }
  }

  hydrateFromServerSync();

  Storage.prototype.setItem = function (key, value) {
    const k = String(key);
    const v = String(value);
    originalSetItem.call(this, k, v);
    if (this === localStorage && managed.has(k)) {
      syncPut(k, v);
    }
  };

  Storage.prototype.removeItem = function (key) {
    const k = String(key);
    originalRemoveItem.call(this, k);
    if (this === localStorage && managed.has(k)) {
      syncDelete(k);
    }
  };

  Storage.prototype.clear = function () {
    if (this !== localStorage) {
      originalClear.call(this);
      return;
    }
    MANAGED_KEYS.forEach((key) => {
      originalRemoveItem.call(localStorage, key);
      syncDelete(key);
    });
  };
})();
