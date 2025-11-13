// lib/config.ts

// Use hostname from the current browser or default to localhost
const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";

// Use the correct protocol
const protocol =
  typeof window !== "undefined" && window.location.protocol === "https:"
    ? "https"
    : "http";

// Optional: you can define port and path in .env.local
const port = process.env.NEXT_PUBLIC_API_PORT ?? "3001";
const path = process.env.NEXT_PUBLIC_API_PATH ?? "";

// Adaptive HTTP API URL
export const API_URL = `${protocol}://${hostname}:${port}${path}`;

// Adaptive WebSocket URL
export const WS_URL = `${protocol === "https" ? "wss" : "ws"}://${hostname}:${port}${path}`;
