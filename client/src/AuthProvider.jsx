import { createContext, useContext, useEffect, useState } from "react";
import { Loading } from "./components/LoadError.jsx";
import LoginScreen from "./LoginScreen.jsx";

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = checking, null = signed out
  const [error, setError] = useState(null);

  function checkSession() {
    setUser(undefined);
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setUser(data))
      .catch(() => setUser(null));
  }

  useEffect(checkSession, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  }

  if (user === undefined) return <Loading />;

  if (user === null) {
    return <LoginScreen onSignedIn={checkSession} error={error} setError={setError} />;
  }

  return <AuthContext.Provider value={{ user, logout }}>{children}</AuthContext.Provider>;
}
