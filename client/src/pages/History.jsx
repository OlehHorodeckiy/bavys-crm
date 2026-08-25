import { Link } from "react-router-dom";
import { api } from "../api";
import { useLiveData } from "../useLiveData";
import { Loading, ErrorBanner } from "../components/LoadError.jsx";
import { IconPhone, IconMessage, IconNote, IconRefresh } from "../components/icons.jsx";
import { formatDate } from "../statuses";

const TYPE_ICON = { call: IconPhone, message: IconMessage, note: IconNote, status_change: IconRefresh };
const TYPE_LABEL = { call: "Дзвінок", message: "Повідомлення", note: "Нотатка", status_change: "Зміна статусу" };

export default function History() {
  const interactions = useLiveData(api.getInteractions);

  if (interactions.loading) return <Loading />;
  if (interactions.error) return <ErrorBanner message={interactions.error} />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Історія замовлень та взаємодій</h1>
          <p>Останні події по всіх клієнтах — дзвінки, повідомлення, нотатки, зміни статусів</p>
        </div>
      </div>

      <div className="card">
        {interactions.data.length === 0 ? (
          <div className="empty-state">Подій ще немає</div>
        ) : (
          <div className="timeline">
            {interactions.data.map((i) => {
              const Icon = TYPE_ICON[i.type] || IconNote;
              return (
                <div className="timeline-item" key={i.id}>
                  <div className="timeline-dot"><Icon size={15} /></div>
                  <div>
                    <div className="timeline-text">
                      <Link className="client-link" to={`/clients/${i.client_id}`}>{i.client_name}</Link>
                      {" — "}{i.text}
                    </div>
                    <div className="timeline-meta">
                      {TYPE_LABEL[i.type] || i.type} · {formatDate(i.created_at)} · {i.created_by}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
