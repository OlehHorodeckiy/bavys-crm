import { useState } from "react";
import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import { useAuth } from "./AuthProvider.jsx";
import Logo from "./components/Logo.jsx";
import { IconOverview, IconGift, IconLayers, IconUsers, IconCoins, IconClock, IconMenu, IconTrend, IconCalculator } from "./components/icons.jsx";
import { useBodyScrollLock } from "./useBodyScrollLock.js";
import Dashboard from "./pages/Dashboard.jsx";
import Orders from "./pages/Orders.jsx";
import Calculator from "./pages/Calculator.jsx";
import Statuses from "./pages/Statuses.jsx";
import Clients from "./pages/Clients.jsx";
import ClientDetail from "./pages/ClientDetail.jsx";
import Finance from "./pages/Finance.jsx";
import PL from "./pages/PL.jsx";
import History from "./pages/History.jsx";

const NAV_ITEMS = [
  { to: "/", label: "Дашборд", icon: IconOverview, end: true },
  { to: "/orders", label: "Замовлення", icon: IconGift },
  { to: "/calculator", label: "Підрахунок", icon: IconCalculator },
  { to: "/statuses", label: "Статуси замовлень", icon: IconLayers },
  { to: "/clients", label: "Клієнти", icon: IconUsers },
  { to: "/finance", label: "Доходи", icon: IconCoins },
  { to: "/pl", label: "P&L / Фінанси", icon: IconTrend },
  { to: "/history", label: "Історія", icon: IconClock },
];

function Layout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  useBodyScrollLock(menuOpen);

  return (
    <div className="app-shell">
      <header className="mobile-topbar">
        <Logo height={22} color="var(--on-dark)" />
        <button className="hamburger-btn" onClick={() => setMenuOpen(true)} aria-label="Відкрити меню">
          <IconMenu size={18} />
        </button>
      </header>

      <div className="nav-backdrop" style={{ display: menuOpen ? "block" : "none" }} onClick={() => setMenuOpen(false)} />

      <aside className={`sidebar${menuOpen ? " open" : ""}`}>
        <button className="sidebar-close-btn" onClick={() => setMenuOpen(false)} aria-label="Закрити меню">✕</button>
        <div className="brand"><Logo height={26} color="var(--on-dark)" /></div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              <span className="nav-icon"><item.icon size={18} /></span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ marginTop: "auto", padding: "12px 16px", fontSize: "0.8rem", color: "var(--muted)" }}>
          <div style={{ marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
          <button type="button" className="btn-ghost" style={{ height: 28, padding: "0 10px" }} onClick={logout}>
            Вийти
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/calculator" element={<Calculator />} />
          <Route path="/statuses" element={<Statuses />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/pl" element={<PL />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
