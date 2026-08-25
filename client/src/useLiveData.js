import { useCallback, useEffect, useState } from "react";
import { socket } from "./socket";

export function useLiveData(fetchFn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    fetchFn()
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    reload();
    socket.on("data:changed", reload);
    return () => socket.off("data:changed", reload);
  }, [reload]);

  return { data, error, loading, reload };
}
