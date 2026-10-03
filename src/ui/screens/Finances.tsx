import { useState } from "react";
import {
  CREDIT_RATE,
  STATUS_LABELS,
  agencyCosts,
  agencyIncome,
  agencyProfit,
  borrow,
  creditLimit,
  extendContract,
  repay,
  weeklyForecast,
  weeklyRunningCosts,
  weeklyScoutCost,
  type AgencyLedger,
  type World,
} from "../../season";
import { money } from "../format";
import type { Game } from "../useGame";
import { Portrait } from "../components/Portrait";

const cash = (n: number) => (n < 0 ? `−${money(-n)}` : money(n));
const short = (v: number) => (v >= 1e6 || v <= -1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1e3)}k`);

/** The agency's books: this season, a forecast, the bank over time, credit, contracts and past seasons. */
export function Finances({ world, game }: { world: World; game: Game }) {
  const [page, setPage] = useState<"overview" | "desk">("overview");
  const L = world.agency.ledger;
  const profit = agencyProfit(L);
  const scouts = weeklyScoutCost(world);
  const forecast = weeklyForecast(world, scouts);
  const runway = forecast.net < 0 ? Math.max(0, Math.floor(world.agency.bank / -forecast.net)) : null;
  const health = forecast.net >= 0 ? "Thriving" : (runway ?? 0) >= 16 ? "Stable" : (runway ?? 0) >= 8 ? "Tight" : "At risk";
  return (
    <main className="finance-page">
      <nav className="finance-page-tabs" aria-label="Finance pages">
        <button className={page === "overview" ? "active" : ""} onClick={() => setPage("overview")}><span>▥</span><b>Overview &amp; forecasting</b><small>Balance, profit and runway</small></button>
        <button className={page === "desk" ? "active" : ""} onClick={() => setPage("desk")}><span>▣</span><b>Contracts &amp; credit</b><small>Loans, renewals and client money</small></button>
      </nav>

      {page === "overview" ? <>
      <section className="finance-hero finance-overview-hero">
        <img src="/art/finance/finance-overview.png" alt="Illustrated agency finance desk overlooking a golf course" />
        <div className="finance-hero-shade" />
        <div className="finance-hero-title"><span>FINANCIAL OVERVIEW</span><h1>Run the agency by the numbers</h1><p>Track the season, protect the bank and plan the next investment.</p></div>
      </section>
      <section className="finance-metrics" aria-label="Financial summary">
        <Metric icon="●" label="Bank balance" value={money(world.agency.bank)} />
        <Metric icon="↘" label="Weekly cash flow" value={cash(forecast.net)} tone={forecast.net < 0 ? "bad" : "good"} />
        <Metric icon="♛" label="Season profit" value={cash(profit)} tone={profit < 0 ? "bad" : "good"} />
        <Metric icon="▤" label="Credit owed" value={money(world.agency.loan ?? 0)} tone={(world.agency.loan ?? 0) > 0 ? "bad" : undefined} />
      </section>
      <div className="grid-2">
        <section className="panel">
          <div className="panel-head"><h2>{world.agency.name}: season {world.season}</h2></div>
          <LedgerTable l={L} />
          <p className={`small ${profit >= 0 ? "good-text" : "bad-text"}`}><strong>Profit so far {cash(profit)}</strong></p>
          <p className="muted small" style={{ marginBottom: 0 }}>Running costs: {money(weeklyRunningCosts(world, scouts))} a week during the season.</p>
        </section>
        <ForecastPanel world={world} />
      </div>

      <BankChart world={world} />
      <PastSeasons world={world} />
      </> : <>
        <section className="finance-hero finance-vault-hero">
          <img src="/art/finance/contracts-credit.png" alt="Illustrated golf agency bank vault and contract office" />
          <div className="finance-hero-shade" />
          <div className="finance-hero-title"><span>CONTRACTS &amp; CREDIT</span><h1>Protect the players. Fund the plan.</h1><p>Renew the right clients and borrow only when the agency needs room to move.</p></div>
          <div className={`finance-health ${health === "At risk" ? "danger" : ""}`}><small>FINANCIAL HEALTH</small><strong>{health}</strong><span>{runway === null ? "Positive weekly flow" : `${runway} weeks of runway`}</span></div>
        </section>
        <div className="grid-2 finance-desk-grid">
          <CreditPanel world={world} game={game} />
          <ContractDesk world={world} game={game} />
        </div>
        <ClientMoney world={world} />
      </>}
    </main>
  );
}

function Metric({ icon, label, value, tone }: { icon: string; label: string; value: string; tone?: "good" | "bad" }) {
  return <article className={`finance-metric ${tone ?? ""}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></article>;
}

function ClientMoney({ world }: { world: World }) {
  return <section className="panel client-money-panel">
    <div className="panel-head"><h2>Clients' money this season</h2><span className="muted small">From earnings through expenses and commission to take-home pay</span></div>
    {world.clientIds.length === 0 ? <p className="empty">No clients.</p> : <div className="client-money-list">
      {world.clientIds.map((id) => {
        const wp = world.players[id]!;
        const f = wp.client!.finances;
        const expenses = f.caddie + f.travel + f.coaching + (f.training ?? 0) + (f.equipment ?? 0);
        const net = f.prizeMoney + f.endorsements - expenses - f.commission;
        return <article className="client-money-card" key={id}>
          <div className="client-money-person"><Portrait player={wp.player} size={70} title={wp.player.name} /><strong>{wp.player.name}</strong></div>
          <MoneyStep icon="♛" label="Prize money" value={money(f.prizeMoney)} />
          <b className="money-arrow">+</b><MoneyStep icon="◆" label="Endorsements" value={money(f.endorsements)} />
          <b className="money-arrow">−</b><MoneyStep icon="▤" label="Player expenses" value={money(expenses)} bad />
          <b className="money-arrow">−</b><MoneyStep icon="●" label="Agency commission" value={money(f.commission)} bad />
          <b className="money-arrow">→</b><MoneyStep icon="▣" label="Take-home" value={cash(net)} good={net >= 0} bad={net < 0} />
        </article>;
      })}
    </div>}
  </section>;
}

function MoneyStep({ icon, label, value, good, bad }: { icon: string; label: string; value: string; good?: boolean; bad?: boolean }) {
  return <div className={`money-step ${good ? "good" : ""} ${bad ? "bad" : ""}`}><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div>;
}

function LedgerTable({ l }: { l: AgencyLedger }) {
  const rows: [string, number, boolean][] = [
    ["Commission on prize money", l.prizeCommission, true],
    ["Commission on endorsements", l.endorsementCommission, true],
    ["Brand partnerships", l.brands ?? 0, false],
    ["Agency events", l.events ?? 0, false],
    ["Office and headquarters", -l.office, true],
    ["Agency staff", -(l.staff ?? 0), false],
    ["Scouts", -l.scouts, true],
    ["Performance Center", -(l.facility ?? 0), false],
    ["Client development you fund", -(l.development ?? 0), false],
    ["Interest", -(l.interest ?? 0), false],
    ["Client care (inbox decisions)", -(l.clientCare ?? 0), false],
  ];
  return (
    <table>
      <tbody>
        {rows.filter(([, v, always]) => always || v !== 0).map(([label, v]) => (
          <tr key={label}><td>{label}</td><td className={`num ${v < 0 ? "bad-text" : ""}`}>{cash(v)}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function ForecastPanel({ world }: { world: World }) {
  const f = weeklyForecast(world, weeklyScoutCost(world));
  const weeks = 10;
  const projected = world.agency.bank + f.net * weeks;
  return (
    <section className="panel">
      <div className="panel-head"><h2>Cash-flow forecast</h2><span className="muted small">A typical season week, from your clients' levels</span></div>
      <table>
        <tbody>
          <tr><td>Commission coming in</td><td className="num">{money(f.income)}</td></tr>
          <tr><td>Running costs and funded development</td><td className="num bad-text">{cash(-f.costs)}</td></tr>
          <tr><td><strong>Net a week</strong></td><td className={`num ${f.net >= 0 ? "good-text" : "bad-text"}`}><strong>{cash(f.net)}</strong></td></tr>
        </tbody>
      </table>
      <p className="small" style={{ marginBottom: 0 }}>
        In {weeks} weeks the bank would be about <strong className={projected < 0 ? "bad-text" : ""}>{cash(projected)}</strong>.
        {projected < 0 && " Cut costs, or draw on the credit line before you go into the red."}
      </p>
      <p className="muted small" style={{ marginBottom: 0 }}>Prize money arrives in lumps: a good week can be worth a month of costs, and a bad run worth nothing.</p>
    </section>
  );
}

const W = 640;
const H = 200;
const PAD = { l: 56, r: 12, t: 12, b: 24 };

function BankChart({ world }: { world: World }) {
  const h = world.agency.bankHistory ?? [];
  if (h.length < 2) {
    return (
      <section className="panel">
        <div className="panel-head"><h2>Bank balance</h2></div>
        <p className="empty">The chart fills in week by week.</p>
      </section>
    );
  }
  const values = h.map((p) => p.bank);
  const lo = Math.min(0, ...values);
  const hi = Math.max(...values, 1);
  const x = (i: number) => PAD.l + (i / (h.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + ((hi - v) / (hi - lo || 1)) * (H - PAD.t - PAD.b);
  const ticks = [lo, (lo + hi) / 2, hi];
  const path = h.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.bank).toFixed(1)}`).join("");
  const starts = h.map((p, i) => ({ p, i })).filter(({ p, i }) => i === 0 || h[i - 1]!.season !== p.season);
  return (
    <section className="panel">
      <div className="panel-head"><h2>Bank balance</h2><span className="muted small">End of each week · now {cash(world.agency.bank)}</span></div>
      <svg className="sg-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Bank balance over ${h.length} weeks, now ${cash(world.agency.bank)}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" className="chart-axis">{short(t)}</text>
          </g>
        ))}
        {lo < 0 && <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} className="chart-zero" />}
        {starts.map(({ p, i }) => (
          <g key={p.season}>
            {i > 0 && <line x1={x(i)} x2={x(i)} y1={PAD.t} y2={H - PAD.b} className="chart-season" />}
            <text x={x(i) + 3} y={H - 6} className="chart-axis">Season {p.season}</text>
          </g>
        ))}
        <path d={path} className="chart-line" />
      </svg>
    </section>
  );
}

function CreditPanel({ world, game }: { world: World; game: Game }) {
  const limit = creditLimit(world);
  const owed = world.agency.loan ?? 0;
  const amounts = [100_000, 250_000, 500_000];
  return (
    <section className="panel">
      <div className="panel-head"><h2>Credit line</h2><span className="muted small">{Math.round(CREDIT_RATE * 100)}% a year, charged weekly</span></div>
      <table>
        <tbody>
          <tr><td>Limit (grows with reputation)</td><td className="num">{money(limit)}</td></tr>
          <tr><td>Owed</td><td className={`num ${owed ? "bad-text" : ""}`}>{money(owed)}</td></tr>
          <tr><td>Interest a week</td><td className="num">{money(Math.round((owed * CREDIT_RATE) / 41))}</td></tr>
        </tbody>
      </table>
      <div className="btn-row" style={{ marginTop: 10 }}>
        {amounts.map((a) => (
          <button key={`b${a}`} className="btn btn-small" disabled={owed + a > limit} onClick={() => game.act((w) => borrow(w, a))}>Borrow {money(a)}</button>
        ))}
      </div>
      <div className="btn-row" style={{ marginTop: 6 }}>
        {amounts.map((a) => (
          <button key={`r${a}`} className="btn btn-small" disabled={owed <= 0 || world.agency.bank <= 0} onClick={() => game.act((w) => repay(w, a))}>Repay {money(a)}</button>
        ))}
      </div>
    </section>
  );
}

/** Contracts and sponsorships coming up for renewal, with a quick renewal on the current terms. */
function ContractDesk({ world, game }: { world: World; game: Game }) {
  const [message, setMessage] = useState<string | null>(null);
  const rows = world.clientIds.map((id) => world.players[id]!).sort((a, b) => a.client!.contract.untilSeason - b.client!.contract.untilSeason);
  return (
    <section className="panel">
      <div className="panel-head"><h2>Contract desk</h2><span className="muted small">Soonest first</span></div>
      {rows.length === 0 ? (
        <p className="empty">No clients.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Client</th><th>Contract</th><th className="num">Mood</th><th>Sponsors ending</th><th /></tr></thead>
            <tbody>
              {rows.map((wp) => {
                const m = wp.client!;
                const ending = m.contract.untilSeason <= world.season;
                const risk = ending && m.happiness < 50;
                const sponsorsEnding = m.sponsors.filter((s) => s.untilSeason <= world.season).length;
                return (
                  <tr key={wp.player.id}>
                    <td>{wp.player.name}</td>
                    <td className={ending ? "bad-text" : ""}>{Math.round(m.contract.commission * 100)}% · {ending ? "ends this season" : `to S${m.contract.untilSeason}`}</td>
                    <td className={`num ${risk ? "bad-text" : ""}`}>{Math.round(m.happiness)}{risk ? " · may leave" : ""}</td>
                    <td>{sponsorsEnding ? `${sponsorsEnding} this season` : "–"}</td>
                    <td>
                      {ending && (
                        <button className="btn btn-small" onClick={() => game.act((w) => setMessage(extendContract(w, wp.player.id, { commission: m.contract.commission, years: 2 }).message))}>Renew 2 seasons</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {message && <p className="small" role="status">{message}</p>}
      <p className="muted small" style={{ marginBottom: 0 }}>A contract that ends is lost unless he agrees to a new one. For other terms use Extend on the Roster.</p>
    </section>
  );
}

const PW = 640;
const PH = 180;

function PastSeasons({ world }: { world: World }) {
  const seasons = world.pastSeasons;
  if (seasons.length === 0) {
    return (
      <section className="panel">
        <div className="panel-head"><h2>Past seasons</h2></div>
        <p className="empty">Your first season is still under way.</p>
      </section>
    );
  }
  const profits = seasons.map((s) => agencyProfit(s.agency.ledger));
  const top = Math.max(1, ...profits.map(Math.abs));
  const slot = (PW - 20) / Math.max(seasons.length, 6);
  const mid = PH / 2;
  const bar = Math.min(30, slot * 0.6);
  return (
    <section className="panel">
      <div className="panel-head"><h2>Past seasons</h2><span className="muted small">Profit by season</span></div>
      <svg className="sg-chart" viewBox={`0 0 ${PW} ${PH}`} role="img" aria-label={`Profit by season: ${seasons.map((s, i) => `season ${s.season} ${cash(profits[i]!)}`).join(", ")}`}>
        <line x1={10} x2={PW - 10} y1={mid} y2={mid} className="chart-zero" />
        {seasons.map((s, i) => {
          const v = profits[i]!;
          const hgt = (Math.abs(v) / top) * (mid - 24);
          const cx = 10 + slot * (i + 0.5);
          return (
            <g key={s.season}>
              <rect x={cx - bar / 2} y={v >= 0 ? mid - hgt : mid} width={bar} height={Math.max(1, hgt)} rx="2" className={v >= 0 ? "chart-bar-pos" : "chart-bar-neg"} />
              <text x={cx} y={v >= 0 ? mid - hgt - 4 : mid + hgt + 12} textAnchor="middle" className="chart-axis chart-strong">{short(v)}</text>
              <text x={cx} y={PH - 4} textAnchor="middle" className="chart-axis">S{s.season}</text>
            </g>
          );
        })}
      </svg>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Season</th><th>Clients</th><th className="num">Income</th><th className="num">Costs</th><th className="num">Profit</th><th className="num">Reputation</th><th>Departures</th></tr></thead>
          <tbody>
            {seasons.map((s) => {
              const l = s.agency.ledger;
              const p = agencyProfit(l);
              return (
                <tr key={s.season}>
                  <td>{s.season}</td>
                  <td className="small">{s.clients.map((c) => `${c.name} (#${c.pointsRank ?? "–"}, ${STATUS_LABELS[c.statusAfter].toLowerCase()})`).join("; ")}</td>
                  <td className="num">{money(agencyIncome(l))}</td>
                  <td className="num">{cash(-agencyCosts(l))}</td>
                  <td className={`num ${p >= 0 ? "good-text" : "bad-text"}`}>{cash(p)}</td>
                  <td className="num">{Math.round(s.agency.reputationBefore)} → {Math.round(s.agency.reputationAfter)}</td>
                  <td className="small">{s.agency.departures.join(", ") || "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
