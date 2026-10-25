'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import type { VisitorStats } from '@/lib/visitor-analytics';

const formatDate = (day: string) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'Asia/Taipei' }).format(new Date(`${day}T00:00:00+08:00`));
const number = (value: number) => value.toLocaleString('en');
const countries = new Intl.DisplayNames(['en'], { type: 'region' });
const countryName = (code: string | null) => code ? countries.of(code) ?? code : 'Unknown';
const percent = (value: number) => new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 1 }).format(value);

export function VisitorAnalytics({ refreshKey }: { refreshKey: number }) {
  const [stats, setStats] = useState<VisitorStats | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/visitors/', { signal: controller.signal, credentials: 'same-origin', cache: 'no-store' })
      .then(async response => {
        if (response.status === 401) window.location.assign('/admin/login/');
        if (!response.ok) throw new Error('Unavailable');
        return response.json() as Promise<VisitorStats>;
      })
      .then(data => { setStats(data); setError(false); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [refreshKey, retry]);

  const max = Math.max(1, ...stats?.days.map(day => day.visitors) ?? []);
  return <section className="admin-panel visitor-analytics" aria-label="Website visitors">
    <div className="admin-panel-heading"><div><span className="admin-eyebrow">WEBSITE TRAFFIC</span><h2>Unique visitors</h2></div><Users size={21}/></div>
    {error ? <div className="visitor-error" role="alert"><p>Visitor statistics could not be loaded.</p><button className="admin-secondary small" onClick={() => setRetry(value => value + 1)}>Try again</button></div> : !stats ? <p className="admin-loading">Loading visitor statistics…</p> : <>
      <div className="visitor-metrics">
        {[{ label: 'Today', value: stats.today, dates: formatDate(stats.days[29].day) }, { label: 'Last 7 days', value: stats.last7Days, dates: `${formatDate(stats.days[23].day)} – ${formatDate(stats.days[29].day)}` }, { label: 'Last 30 days', value: stats.last30Days, dates: `${formatDate(stats.days[0].day)} – ${formatDate(stats.days[29].day)}` }].map(metric => <div key={metric.label}><span>{metric.label}</span><strong>{number(metric.value)}</strong><small>{metric.dates}</small></div>)}
      </div>
      <div className="visitor-chart-wrap">
        <div className="visitor-chart-heading"><h3>Daily visitors</h3><span>Last 30 days · Taipei time</span></div>
        {stats.last30Days === 0 && <p className="visitor-empty">No visitors recorded yet. Counts begin with this update; earlier visits are not available.</p>}
        <figure className="visitor-chart">
          <figcaption className="sr-only">Daily unique visitors for the last 30 days.</figcaption>
          {stats.days.map(day => <div className="visitor-bar-column" key={day.day} title={`${formatDate(day.day)}: ${number(day.visitors)} visitors`}><span className="sr-only">{formatDate(day.day)}: {number(day.visitors)} visitors.</span><div className={`visitor-bar${day.visitors ? '' : ' visitor-bar-zero'}`} style={{ height: `${Math.max(2, day.visitors / max * 100)}%` }}/></div>)}
        </figure>
        <div className="visitor-chart-dates"><span>{formatDate(stats.days[0].day)}</span><span>{formatDate(stats.days[29].day)}</span></div>
        <section className="visitor-countries" aria-labelledby="visitor-countries-title">
          <div className="visitor-chart-heading"><h3 id="visitor-countries-title">Visitors by country</h3><span>Last 30 days · {number(stats.last30Days)} unique visitors</span></div>
          {stats.countries.length ? <div className="admin-table-wrap"><table>
            <caption className="sr-only">Unique visitors by latest known country in the last 30 days</caption>
            <thead><tr><th scope="col">Country</th><th scope="col">Unique visitors</th><th scope="col">Share</th></tr></thead>
            <tbody>{stats.countries.map(row => {
              const share = stats.last30Days ? row.visitors / stats.last30Days : 0;
              return <tr key={row.country ?? 'unknown'}>
                <th scope="row" aria-label={countryName(row.country)}><span className="visitor-country-code" aria-hidden="true">{row.country ?? '—'}</span>{countryName(row.country)}</th>
                <td>{number(row.visitors)}</td>
                <td aria-label={percent(share)}><div className="visitor-country-share"><span className="visitor-country-track" aria-hidden="true"><span style={{ width: `${share * 100}%` }}/></span><span>{percent(share)}</span></div></td>
              </tr>;
            })}</tbody>
          </table></div> : <p className="visitor-empty">Country statistics will appear after the first eligible visit.</p>}
          <p className="visitor-country-note">Each visitor is counted once, under their latest known country. Location is approximate and may reflect a VPN. Unknown includes earlier visits and visits without country data.</p>
        </section>
        <p className="visitor-explanation">Each browser counts once per period, even if it returns on several days. Different devices or cleared browser storage may count as another visitor. Admin sessions, known bots and visitors who opt out are excluded; these are estimates, not a count of identifiable people.</p>
        <p className="visitor-timestamp">{stats.startedAt ? `Tracking since ${new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'Asia/Taipei' }).format(stats.startedAt)} · ` : ''}Updated {new Intl.DateTimeFormat('en', { timeStyle: 'short', timeZone: 'Asia/Taipei' }).format(stats.updatedAt)} · UTC+8</p>
      </div>
    </>}
  </section>;
}
