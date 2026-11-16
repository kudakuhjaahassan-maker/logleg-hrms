import { useEffect, useMemo, useState } from "react";
import { api, type AttendanceTodayResponse } from "../api/client";

function formatMs(ms: number) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

function formatMinutes(minutes?: number) {
  const total = Math.max(0, Math.floor(minutes ?? 0));
  return `${Math.floor(total / 60)}h ${total % 60}m`;
}

/** Device location for the geofence check; resolves to undefined when unavailable. */
function currentPosition(): Promise<{ latitude: number; longitude: number } | undefined> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(undefined);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export default function ClockWidget() {
  const [data, setData] = useState<AttendanceTodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = async () => {
    try {
      setError(null);
      const res = await api.attendanceToday();
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const worked = useMemo(() => {
    if (!data?.log?.clockIn) return 0;
    if (data.log.clockOut) return data.workedMs;
    return Math.max(0, now - new Date(data.log.clockIn).getTime());
  }, [data, now]);

  const act = async (kind: "in" | "out") => {
    setBusy(true);
    setError(null);
    try {
      if (kind === "in") await api.clockIn(await currentPosition());
      else await api.clockOut();
      await load();
    } catch (e: any) {
      setError(e?.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header-row">
        <h3>Today's Attendance</h3>
        <span className="muted">{data?.date || new Date().toISOString().slice(0, 10)}</span>
      </div>
      {loading ? (
        <div className="empty">Loading...</div>
      ) : (
        <>
          <div className="clock-stats">
            <div className="clock-stat"><span className="label">Clock in</span><strong>{data?.log?.clockIn ? new Date(data.log.clockIn).toLocaleTimeString() : "—"}</strong></div>
            <div className="clock-stat"><span className="label">Clock out</span><strong>{data?.log?.clockOut ? new Date(data.log.clockOut).toLocaleTimeString() : "—"}</strong></div>
            <div className="clock-stat"><span className="label">Worked</span><strong>{formatMs(worked)}</strong></div>
            {data ? <div className="clock-stat"><span className="label">Shift</span><strong>{data.shiftStartTime}–{data.shiftEndTime}</strong></div> : null}
            {data && data.lateMinutes > 0 ? <div className="clock-stat"><span className="label">Late</span><strong>{formatMinutes(data.lateMinutes)}</strong></div> : null}
            {data && data.overtimeMinutes > 0 ? <div className="clock-stat"><span className="label">Overtime</span><strong>{formatMinutes(data.overtimeMinutes)}</strong></div> : null}
            <div className="clock-stat"><span className="label">Status</span>
              <strong>
                {data?.isClockedIn ? <span className="badge status-ACTIVE">Clocked in</span> :
                 data?.log?.clockOut ? <span className="badge">Clocked out</span> :
                 <span className="badge status-INACTIVE">Not clocked in</span>}
              </strong>
            </div>
          </div>
          {error && <div className="alert error" style={{ marginTop: 10 }}>{error}</div>}
          <div className="clock-actions">
            <button className="btn btn-primary" onClick={() => act("in")} disabled={busy || !!data?.log?.clockIn}>
              Clock In
            </button>
            <button className="btn btn-secondary" onClick={() => act("out")} disabled={busy || !data?.log?.clockIn || !!data?.log?.clockOut}>
              Clock Out
            </button>
          </div>
          <p className="hint" style={{ marginBottom: 0 }}>
            Clock-in is verified against your office location when your company has one configured. Working your full shift
            makes up any late arrival; time beyond the shift counts as overtime.
          </p>
        </>
      )}
    </div>
  );
}
