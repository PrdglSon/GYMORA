import { useCallback, useEffect, useRef, useState } from 'react';
import api, { errMsg } from '../api';

export default function useFetch(url, { params, initial = null } = {}) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState(null);
  const key = JSON.stringify(params || {});
  const alive = useRef(true);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const reload = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    try {
      const res = await api.get(url, { params: paramsRef.current });
      if (alive.current) {
        setData(res.data);
        setError(null);
      }
    } catch (e) {
      if (alive.current) setError(errMsg(e));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [url, key]);

  useEffect(() => {
    alive.current = true;
    reload();
    return () => {
      alive.current = false;
    };
  }, [reload]);

  return { data, setData, loading, error, reload };
}
