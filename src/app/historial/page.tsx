'use client';

import { useEffect, useState, useRef } from 'react';
import { formatMoney } from '@/lib/utils';
import { dbProductos } from '@/lib/db-productos';
import { dbMovimientos } from '@/lib/db-movimientos';

export default function Historial() {
  const [stats, setStats] = useState({ total: 0, valorTotal: 0, stockOptimo: 0, stockBajo: 0, sinStock: 0 });
  const [cargando, setCargando] = useState(true);
  const donutRef = useRef<HTMLCanvasElement>(null);
  const barsRef = useRef<HTMLCanvasElement>(null);
  const lineRef = useRef<HTMLCanvasElement>(null);
  const charted = useRef(false);

  useEffect(() => {
    const cargar = async () => {
      const res = await dbProductos.listar({ limite: 1000 });
      const productos = res.items;
      const total = productos.length;
      const valorTotal = productos.reduce((s, p) => s + p.precioVenta * p.stockActual, 0);
      const stockOptimo = productos.filter((p) => p.stockActual > p.stockMinimo).length;
      const stockBajo = productos.filter((p) => p.stockActual > 0 && p.stockActual <= p.stockMinimo).length;
      const sinStock = productos.filter((p) => p.stockActual === 0).length;
      setStats({ total, valorTotal, stockOptimo, stockBajo, sinStock });
      setCargando(false);
    };
    cargar();
  }, []);

  useEffect(() => {
    if (cargando || charted.current) return;
    if (!donutRef.current || !barsRef.current || !lineRef.current) return;

    const loadCharts = async () => {
      const Chart = (await import('chart.js/auto')).default;
      const cs = getComputedStyle(document.documentElement);
      const C = (n: string) => cs.getPropertyValue(n).trim();
      const grid = 'oklch(38% 0.03 262 / .3)';
      const tick = C('--text-faint');

      Chart.defaults.font.family = 'Inter';
      Chart.defaults.color = tick;

      new Chart(donutRef.current!, {
        type: 'doughnut',
        data: {
          labels: ['Óptimo', 'Bajo', 'Sin stock'],
          datasets: [{
            data: [stats.stockOptimo, stats.stockBajo, stats.sinStock],
            backgroundColor: [C('--primary'), C('--warn'), C('--danger')],
            borderWidth: 0,
          }],
        },
        options: {
          cutout: '72%',
          plugins: { legend: { display: false } },
          responsive: true,
          maintainAspectRatio: false,
        },
      });

      new Chart(barsRef.current!, {
        type: 'bar',
        data: {
          labels: ['Electrónica', 'Herramientas', 'Accesorios', 'Repuestos'],
          datasets: [{
            data: [450, 320, 210, 150],
            backgroundColor: C('--primary'),
            borderRadius: 6,
            barThickness: 26,
          }],
        },
        options: {
          indexAxis: 'y',
          plugins: { legend: { display: false } },
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { grid: { color: grid }, ticks: { color: tick } },
            y: { grid: { display: false }, ticks: { color: C('--text-dim'), font: { weight: 'bold' as const } } },
          },
        },
      });

      new Chart(lineRef.current!, {
        type: 'line',
        data: {
          labels: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
          datasets: [
            { label: 'Entradas', data: [20, 40, 30, 70, 60, 90, 80], borderColor: C('--primary'), tension: 0.4, pointRadius: 0, borderWidth: 2.5 },
            { label: 'Salidas', data: [10, 15, 50, 35, 25, 40, 45], borderColor: C('--warn'), borderDash: [5, 4], tension: 0.4, pointRadius: 0, borderWidth: 2 },
          ],
        },
        options: {
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', font: { size: 11 } } },
          },
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { grid: { display: false }, ticks: { color: tick } },
            y: { grid: { color: grid }, ticks: { color: tick } },
          },
        },
      });

      charted.current = true;
    };

    loadCharts();
  }, [cargando, stats]);

  return (
    <div className="screen active">
      <div>
        <p className="eyebrow">Dashboard general</p>
        <h1 className="h-page">Métricas</h1>
      </div>

      <div className="metric-grid">
        <div className="metric hl">
          <div className="m-top">
            <span className="m-label">Valor total</span>
            <span className="m-chip">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
              2.4%
            </span>
          </div>
          <div className="m-val">{formatMoney(stats.valorTotal)}</div>
        </div>
        <div className="metric">
          <div className="m-top">
            <span className="m-label">Items totales</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-faint)' }}><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
          </div>
          <div className="m-val">{stats.total.toLocaleString('es-AR')}</div>
        </div>
      </div>

      <div className="panel">
        <div className="p-head">
          <h2>Estado del stock</h2>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
        </div>
        <div className="donut-wrap">
          <canvas ref={donutRef} />
          <div className="donut-center">
            <div>
              <div className="dc-val">{stats.total.toLocaleString('es-AR')}</div>
              <div className="dc-lbl">Total</div>
            </div>
          </div>
        </div>
        <div className="legend">
          <div className="li">
            <div className="l-name"><span className="sw" style={{ background: 'var(--primary)' }} />Stock óptimo</div>
            <span className="l-val">{stats.total > 0 ? Math.round((stats.stockOptimo / stats.total) * 100) : 0}% · {stats.stockOptimo}</span>
          </div>
          <div className="li">
            <div className="l-name"><span className="sw" style={{ background: 'var(--warn)' }} />Stock bajo</div>
            <span className="l-val">{stats.total > 0 ? Math.round((stats.stockBajo / stats.total) * 100) : 0}% · {stats.stockBajo}</span>
          </div>
          <div className="li">
            <div className="l-name"><span className="sw" style={{ background: 'var(--danger)' }} />Sin stock</div>
            <span className="l-val">{stats.total > 0 ? Math.round((stats.sinStock / stats.total) * 100) : 0}% · {stats.sinStock}</span>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="p-head">
          <h2>Top categorías</h2>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg>
        </div>
        <div className="chart-wrap"><canvas ref={barsRef} /></div>
      </div>

      <div className="panel">
        <div className="p-head">
          <h2>Tendencia (7 días)</h2>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </div>
        <div className="chart-wrap"><canvas ref={lineRef} /></div>
      </div>
    </div>
  );
}
