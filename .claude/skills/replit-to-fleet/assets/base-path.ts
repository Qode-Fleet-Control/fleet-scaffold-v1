// Vite bakes `base` from BASE_PATH at build time (vite.config.ts). Under a fleet
// preview that is /direct/<agent>:<port>/; everywhere else it is "/".
export const basePath = import.meta.env.BASE_URL.replace(/\/+$/, "");

// CLMS calls its API with root-absolute "/api/..." URLs throughout. Prefix them
// with the base path so they reach this app when it is served under a prefix.
export function installApiBasePath(): void {
  if (!basePath) return;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string" && input.startsWith("/api/")) {
      return nativeFetch(basePath + input, init);
    }
    return nativeFetch(input, init);
  };
}
