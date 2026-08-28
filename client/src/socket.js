import { io } from "socket.io-client";

// In dev, the API runs on a separate port (Vite's websocket proxy is unreliable),
// so connect straight to it. In production the API and the built frontend are
// served from the same origin, so no explicit host/port is needed.
const SOCKET_URL = import.meta.env.DEV
  ? `${window.location.protocol}//${window.location.hostname}:4000`
  : undefined;

export const socket = io(SOCKET_URL, { transports: ["websocket", "polling"], withCredentials: true });
