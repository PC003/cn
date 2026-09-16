import { useEffect, useState } from "react";
import { api, type ProjectInfoResponse } from "../services/api";

type Status = "checking" | "online" | "offline";

export function useBackendStatus() {
  const [status, setStatus] = useState<Status>("checking");
  const [info, setInfo] = useState<ProjectInfoResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .info()
      .then((data) => {
        if (cancelled) return;
        setInfo(data);
        setStatus("online");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("offline");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { status, info };
}
