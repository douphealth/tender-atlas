// Local-first workspace: saved tenders and searches live only in this browser.
import { useCallback, useEffect, useState } from "react";
import type { Notice } from "./procurement/sources";

export type SavedNotice = Pick<Notice, "id" | "source" | "noticeId" | "title" | "buyer" | "deadlineAt" | "url"> & { savedAt: string; stage: string; note?: string };
export type SavedSearch = { id: string; label: string; params: Record<string, string>; savedAt: string };
const KEY_N = "tenderatlas.saved.v1";
const KEY_S = "tenderatlas.searches.v1";
const EVT = "tenderatlas:workspace";

function read<T>(k: string): T[] {
  try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch { return []; }
}
function write<T>(k: string, v: T[]) {
  localStorage.setItem(k, JSON.stringify(v));
  window.dispatchEvent(new Event(EVT));
}

export function useWorkspace() {
  const [notices, setNotices] = useState<SavedNotice[]>([]);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => { setNotices(read(KEY_N)); setSearches(read(KEY_S)); setReady(true); };
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, []);
  const isSaved = useCallback((id: string) => notices.some((n) => n.id === id), [notices]);
  const toggle = useCallback((n: Notice) => {
    const cur = read<SavedNotice>(KEY_N);
    write(KEY_N, cur.some((x) => x.id === n.id) ? cur.filter((x) => x.id !== n.id)
      : [{ id: n.id, source: n.source, noticeId: n.noticeId, title: n.title, buyer: n.buyer, deadlineAt: n.deadlineAt, url: n.url, savedAt: new Date().toISOString(), stage: "reviewing" }, ...cur]);
  }, []);
  const update = useCallback((id: string, patch: Partial<SavedNotice>) => write(KEY_N, read<SavedNotice>(KEY_N).map((x) => (x.id === id ? { ...x, ...patch } : x))), []);
  const remove = useCallback((id: string) => write(KEY_N, read<SavedNotice>(KEY_N).filter((x) => x.id !== id)), []);
  const saveSearch = useCallback((label: string, params: Record<string, string>) => write(KEY_S, [{ id: crypto.randomUUID(), label, params, savedAt: new Date().toISOString() }, ...read<SavedSearch>(KEY_S)]), []);
  const removeSearch = useCallback((id: string) => write(KEY_S, read<SavedSearch>(KEY_S).filter((x) => x.id !== id)), []);
  const exportAll = useCallback(() => JSON.stringify({ notices: read(KEY_N), searches: read(KEY_S) }, null, 2), []);
  return { ready, notices, searches, isSaved, toggle, update, remove, saveSearch, removeSearch, exportAll };
}
