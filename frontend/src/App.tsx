import React, { createContext, useContext, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import { api, User } from "./api";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Team from "./pages/Team";
import UsersAdmin from "./pages/Admin/Users";
import Webhooks from "./pages/Admin/Webhooks";
import WebhookLogs from "./pages/Admin/WebhookLogs";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true, refresh: async () => {} });
export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const { user } = await api.me();
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return <AuthContext.Provider value={{ user, loading, refresh }}>{children}</AuthContext.Provider>;
}

function Protected({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-gray-500">Загрузка...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Nav() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const logout = async () => {
    await api.logout();
    await refresh();
    navigate("/login");
  };

  return (
    <nav className="bg-slate-900 text-white px-6 py-3 flex items-center gap-6">
      <span className="font-semibold">Team Tasks</span>
      <Link to="/" className="hover:underline">
        Сегодня
      </Link>
      <Link to="/history" className="hover:underline">
        История
      </Link>
      {(user.role === "ADMIN" || user.role === "MANAGER") && (
        <Link to="/team" className="hover:underline">
          Команда
        </Link>
      )}
      {user.role === "ADMIN" && (
        <>
          <Link to="/admin/users" className="hover:underline">
            Пользователи
          </Link>
          <Link to="/admin/webhooks" className="hover:underline">
            Webhooks
          </Link>
          <Link to="/admin/webhook-logs" className="hover:underline">
            Webhook Logs
          </Link>
        </>
      )}
      <span className="ml-auto text-sm text-slate-300">
        {user.firstName} {user.lastName} ({user.role})
      </span>
      <button onClick={logout} className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded">
        Выйти
      </button>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Nav />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <Protected>
                <Dashboard />
              </Protected>
            }
          />
          <Route
            path="/history"
            element={
              <Protected>
                <History />
              </Protected>
            }
          />
          <Route
            path="/team"
            element={
              <Protected roles={["ADMIN", "MANAGER"]}>
                <Team />
              </Protected>
            }
          />
          <Route
            path="/admin/users"
            element={
              <Protected roles={["ADMIN"]}>
                <UsersAdmin />
              </Protected>
            }
          />
          <Route
            path="/admin/webhooks"
            element={
              <Protected roles={["ADMIN"]}>
                <Webhooks />
              </Protected>
            }
          />
          <Route
            path="/admin/webhook-logs"
            element={
              <Protected roles={["ADMIN"]}>
                <WebhookLogs />
              </Protected>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
