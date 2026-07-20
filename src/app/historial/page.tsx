'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { formatMoney } from '@/lib/utils';
import { dbProductos } from '@/lib/db-productos';
import { dbMovimientos } from '@/lib/db-movimientos';
import { eventBus } from '@/lib/eventBus';

interface Stats {
  total: number;
  valorTotal: number;
  valorTotalPrev: number;
  valorPct: number;
  stockOptimo: number;
  stockBajo: number;
  sinStock: number;
  catsData: { nombre: string; valor: number }[];
  TrendData: { labels: string[]; entradas: number[]; salidas: number[] };
  movimientosTotales: { entradas: number; salidas: number };
}

export default function Historial() {
  const [stats, setStats] = useState<Stats>({
    total: 0, valorTotal: 0, valorTotalPrev: 0, valorPct: 0,
    stockOptimo: 0, stockBajo: 0, sinStock: 0,
    catsData: [], TrendData: { labels: [], entradas: [], salidas: [] },
    movimientosTotales: { entradas: 0, salidas: 0 },
  });
  const [cargando, setCargando] = useState(true);
  const donutRef = useRef<HTMLCanvasElement>(null);
  const barsRef = useRef<HTMLCanvasElement>(null);
  const lineRef = useRef<HTMLCanvasElement>(null);
  const chartsRef = useRef<any[]>([]);

  useEffect(() => {
    const cargar = async () => {
      const res = await dbProductos.listar({ limite: 9999 });
      const productos = res.items;
      const total = productos.length;
      const valorTotal = productos.reduce((s, p) => s + p.precioVenta * p.stockActual, 0);
      const stockOptimo = productos.filter((p) => p.stockActual > p.stockMinimo).length;
      const stockBajo = productos.filter((p) => p.stockActual > 0 && p.stockActual <= p.stockMinimo).length;
      const sinStock = productos.filter((p) => p.stockActual === 0).length;

      // Valor total previo (hace 7 dias) basado en movimientos
      const ahora = Date.now();
      const hace7dias = ahora - 7 * 24 * 60 * 60 * 1000;
      const movsSemana = await dbMovimientos.listar({ desde: hace7dias, limite: 9999 });
      const movsArr = movsSemana.items;
      // Calcular valor previo: valorTotalactual +/- movimientos de la semana
      let deltaValor = 0;
      for (const m of movsArr) {
        const p = productos.find(x => x.id === m.productoId);
        const precio = p?.precioVenta ?? 0;
        if (m.tipo === 'entrada') deltaValor += precio * m.cantidad;
        else if (m.tipo === 'salida') deltaValor -= precio * m.cantidad;
        // ajuste/conteo: diferencia entre stockDespues y stockAntes
        else deltaValor += precio * (m.stockDespues - m.stockAntes);
      }
      const valorTotalPrev = Math.max(0, valorTotal - deltaValor);
      const valorPct = valorTotalPrev > 0
        ? ((valorTotal - valorTotalPrev) / valorTotalPrev) * 100
        : (valorTotal > 0 ? 100 : 0);

      // Top categorias desde productos reales
      const catMap = new Map<string, number>();
      for (const p of productos) {
        const cat = p.categoria || 'Sin categoría';
        catMap.set(cat, (catMap.get(cat) || 0) + 1);
      }
      const catsData = [...catMap.entries()]
        .map(([nombre, valor]) => ({ nombre, valor }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 6);

      // Totales de movimientos (entradas vs salidas) para tendencia
      let totalEntradas = 0;
      let totalSalidas = 0;
      for (const m of movsArr) {
        if (m.tipo === 'entrada') totalEntradas += m.cantidad;
        else if (m.tipo === 'salida') totalSalidas += m.cantidad;
        else totalEntradas += Math.max(0, m.stockDespues - m.stockAntes); // ajustes/conteo
      }

setStats({
        total, valorTotal, valorTotalPrev, valorPct,
        stockOptimo, stockBajo, sinStock,
        catsData,
        TrendData: { labels: [], entradas: [], salidas: [] },
        movimientosTotales: { entradas: totalEntradas, salidas: totalSalidas },
      });
      setCargando(false);
    };
    cargar();

    // Escuchar cambios en DB para recalcular métricas
    const unsub = eventBus.on(cargar);
    return () => unsub();
  }, []);

  // Renderizar gráficos
  useEffect(() => {
    if (cargando) return;
    if (!donutRef.current || !barsRef.current || !lineRef.current) return;

    const renderCharts = async () => {
      const Chart = (await import('chart.js/auto')).default;
      const cs = getComputedStyle(document.documentElement);
      const C = (n: string) => cs.getPropertyValue(n).trim();
      const grid = 'oklch(38% 0.03 262 / .3)';
      const ticks = C('--text-faint');

      Chart.defaults.font.family = 'Inter';
      Chart.defaults.color = ticks;

      // Distinct colors for each category (oklch-based palette)
      const categoryColors = [
        C('--primary'),        // Azul
        C('--cyan'),           // Cian
        C('--ok'),             // Verde
        C('--warn'),           // Amarillo/Naranja
        'oklch(60% 0.25 300)', // Magenta
        'oklch(70% 0.2 50)',   // Naranja
      ];

      // Destruir gráficos anteriores
      chartsRef.current.forEach(c => c?.destroy?.());
      chartsRef.current = [];

      // Donut: estado del stock
      chartsRef.current.push(new Chart(donutRef.current!, {
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
      }));

      // Bars: top categorías con colores distintos por categoría
      const catsConData = stats.catsData.length > 0 ? stats.catsData : [{ nombre: 'Sin datos', valor: 0 }];
      chartsRef.current.push(new Chart(barsRef.current!, {
        type: 'bar',
        data: {
          labels: catsConData.map(c => c.nombre),
          datasets: [{
            data: catsConData.map(c => c.valor),
            backgroundColor: catsConData.map((_, i) => categoryColors[i % categoryColors.length]),
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
            x: { grid: { color: grid }, ticks: { color: ticks, precision: 0 } },
            y: { grid: { display: false }, ticks: { color: C('--text-dim'), font: { weight: 'bold' as const } } },
          },
        },
      }));

      // Horizontal bar: Entradas vs Salidas totales (reemplaza línea 7 días)
      const totalEntradas = stats.movimientosTotales?.entradas || 0;
      const totalSalidas = stats.movimientosTotales?.salidas || 0;
      chartsRef.current.push(new Chart(lineRef.current!, {
        type: 'bar',
        data: {
          labels: ['Movimientos'],
          datasets: [
            { label: 'Entradas', data: [totalEntradas], backgroundColor: C('--primary'), borderRadius: 8 },
            { label: 'Salidas', data: [totalSalidas], backgroundColor: C('--warn'), borderRadius: 8 },
          ],
        },
        options: {
          indexAxis: 'y',
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} unidades`,
              },
            },
          },
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { grid: { color: grid }, ticks: { color: ticks, precision: 0 }, stacked: true },
            y: { grid: { display: false }, ticks: { display: false } },
          },
        },
      }));
    };

    renderCharts();
    return () => {
      chartsRef.current.forEach(c => c?.destroy?.());
      chartsRef.current = [];
    };
  }, [cargando, stats]);

  const pctColor = stats.valorPct > 0 ? 'var(--ok)' : stats.valorPct < 0 ? 'var(--danger)' : 'var(--text-faint)';
  const pctSign = stats.valorPct > 0 ? '+' : '';

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
            <span className="m-chip" style={{ color: pctColor }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {stats.valorPct >= 0 ? (
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
                ) : (
                  <polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/>
                )}
                <polyline points={stats.valorPct >= 0 ? "16 7 22 7 22 13" : "16 17 22 17 22 11"} />
              </svg>
              {pctSign}{stats.valorPct.toFixed(1)}%
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
          <h2>Movimientos totales</h2>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </div>
        <div className="chart-wrap"><canvas ref={lineRef} /></div>
      </div>
    </div>
  );
}
