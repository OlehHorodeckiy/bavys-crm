export function Loading() {
  return <div className="loading">Завантаження…</div>;
}

export function ErrorBanner({ message }) {
  return <div className="error-banner">Помилка: {message}</div>;
}
