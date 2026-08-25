import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import Logo from "./components/Logo.jsx";
import { IconOverview, IconGift, IconLayers, IconUsers, IconCoins, IconClock } from "./components/icons.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Orders from "./pages/Orders.jsx";
import Statuses from "./pages/Statuses.jsx";
import Clients from "./pages/Clients.jsx";
import ClientDetail from "./pages/ClientDetail.jsx";
import Finance from "./pages/Finance.jsx";
import History from "./pages/History.jsx";

const NAV_ITEMS = [
  { to: "/", label: "Дашборд", icon: IconOverview, end: true },
  { to: "/orders", label: "Замовлення", icon: IconGift },
  { to: "/statuses", label: "Статуси замовлень", icon: IconLayers },
  { to: "/clients", label: "Клієнти", icon: IconUsers },
  { to: "/finance", label: "Доходи", icon: IconCoins },
  { to: "/history", label: "Історія", icon: IconClock },
];

function Layout({ children }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><Logo height={26} color="var(--on-dark)" /></div>
        <div className="brand-sub">CRM розваг та аніматорів</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              <span className="nav-icon"><item.icon size={18} /></span>
              {item.label}
            </NavLink>
          ))}
        </nav>
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
          <Route path="/statuses" element={<Statuses />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
