import { Fragment, useState } from "react";
import type { PlayerEventResult, TournamentResult } from "../../engine";
import { money, toPar } from "../format";
import { Scorecard } from "./Scorecard";
import { SgChart } from "./SgChart";

interface Props {
  result: TournamentResult;
  clientId: string;
  /** Show only the first N rows (plus the client) until expanded. */
  limit?: number;
}

export function Leaderboard({ result, clientId, limit }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(!limit);
  const rows = result.leaderboard;
  const shown = all ? rows : rows.filter((r, i) => i < (limit ?? rows.length) || r.player.id === clientId);
  const firstMc = rows.findIndex((r) => !r.madeCut);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Pos</th>
            <th>Player</th>
            <th className="num">To par</th>
            {[1, 2, 3, 4].map((r) => <th className="num" key={r}>R{r}</th>)}
            <th className="num">Total</th>
            <th className="num">Earnings</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const idx = rows.indexOf(r);
            return (
              <Fragment key={r.player.id}>
                {idx === firstMc && all && (
                  <tr className="divider"><td colSpan={9}>Missed the cut{result.cutLine !== null ? ` (cut ${toPar(result.cutLine)})` : ""}</td></tr>
                )}
                <Row r={r} me={r.player.id === clientId} onClick={() => setOpen(open === r.player.id ? null : r.player.id)} />
                {open === r.player.id && (
                  <tr>
                    <td colSpan={9} style={{ whiteSpace: "normal", background: "var(--surface-2)" }}>
                      <Detail r={r} result={result} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {limit && rows.length > limit && (
        <button className="linkish" style={{ marginTop: 8 }} onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${rows.length} players`}
        </button>
      )}
      <p className="muted small">Click a player for their scorecard and strokes gained.</p>
    </div>
  );
}

function Row({ r, me, onClick }: { r: PlayerEventResult; me: boolean; onClick: () => void }) {
  return (
    <tr className={`clickable${me ? " me" : ""}`} onClick={onClick}>
      <td>{r.positionLabel}</td>
      <td>
        {r.player.name} <span className="muted small">{r.player.nationality}</span>
      </td>
      <td className={`num ${r.toPar < 0 ? "good-text" : r.toPar > 0 ? "bad-text" : ""}`}>{toPar(r.toPar)}</td>
      {[0, 1, 2, 3].map((i) => <td className="num" key={i}>{r.rounds[i] ?? "–"}</td>)}
      <td className="num">{r.total}</td>
      <td className="num">{r.earnings ? money(r.earnings) : "–"}</td>
    </tr>
  );
}

function Detail({ r, result }: { r: PlayerEventResult; result: TournamentResult }) {
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", padding: "8px 0" }}>
      <div>
        <h3 style={{ marginBottom: 8 }}>Scorecard · {r.player.name}</h3>
        <Scorecard course={result.course} rounds={r.holes} />
      </div>
      <div>
        <h3 style={{ marginBottom: 8 }}>Strokes gained</h3>
        <SgChart sg={r.sg} rounds={r.rounds.length} />
        <p className="small secondary">Tee times: {r.waves.map((w, i) => `R${i + 1} ${w}`).join(" · ")}</p>
      </div>
    </div>
  );
}
