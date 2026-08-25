export default function StatCard({ icon, iconBg, iconColor, label, value, sub }) {
  return (
    <div className="card kpi-card">
      <div className="kpi-icon" style={{ background: iconBg, color: iconColor }}>{icon}</div>
      <div>
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
        {sub && <div style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{sub}</div>}
      </div>
    </div>
  );
}
