import { STATUS_MAP } from "../statuses";

export default function StatusBadge({ status }) {
  const info = STATUS_MAP[status] || { label: status, color: "#999" };
  return (
    <span className="badge" style={{ background: `${info.color}1a`, color: info.color }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: info.color }} />
      {info.label}
    </span>
  );
}
