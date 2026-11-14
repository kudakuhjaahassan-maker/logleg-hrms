import { useEffect, useState } from "react";
import { api, type LeaderboardEntry, type LeaderboardResponse } from "../api/client";
import { useAuth } from "../api/AuthContext";

export default function LeaderboardCard({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.getLeaderboard();
        if (alive) setData(res);
      } catch (e: any) {
        if (alive) setError(e?.message || "Failed to load leaderboard");
      }
    })();
    return () => { alive = false; };
  }, []);

  if (error) return <div className="card"><h3>Leaderboard</h3><p className="muted">{error}</p></div>;
  if (!data) return <div className="card"><h3>Leaderboard</h3><p className="muted">Loading leaderboard…</p></div>;

  const top = compact ? data.leaderboard.slice(0, 5) : data.leaderboard.slice(0, 10);
  const my = data.myRank;

  return (
    <div className="card">
      <div className="card-header-row">
        <div>
          <h3>Employee Leaderboard</h3>
          <p className="subtle" style={{ margin: 0 }}>Last {data.period.days} days · punctuality & attendance</p>
        </div>
        {my && (
          <div className="my-rank-badge" title="Your rank">
            <span className="my-rank-label">Your rank</span>
            <span className="my-rank-value">#{my.rank}</span>
          </div>
        )}
      </div>

      {top.length === 0 ? (
        <p className="muted">No attendance data yet. Clock-ins will build the scoreboard.</p>
      ) : (
        <div className="leaderboard">
          {top.map((e: LeaderboardEntry) => {
            const isMe = user?.id === e.employeeId;
            return (
              <div key={e.employeeId} className={`leaderboard-row ${isMe ? "is-me" : ""}`}>
                <div className={`leader-rank rank-${e.rank <= 3 ? e.rank : "n"}`}>#{e.rank}</div>
                <div className="leader-main">
                  <div className="leader-name">{e.name}{isMe ? <span className="you-tag">You</span> : null}</div>
                  <div className="subtle">{e.department?.name || "Unassigned"}{e.title ? ` · ${e.title}` : ""}</div>
                </div>
                <div className="leader-metrics">
                  <div className="leader-score">{e.score} pts</div>
                  <div className="subtle">{e.punctualityRate}% on-time · {e.presentDays}d present</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="hint" style={{ marginBottom: 0 }}>Scored from on-time clock-ins, days present, and hours logged ({data.metrics.join(", ")}).</p>
    </div>
  );
}
