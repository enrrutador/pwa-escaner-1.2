'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { dbUbicaciones } from '@/lib/db-ubicaciones';
import { dbProductos } from '@/lib/db-productos';
import { formatMoney } from '@/lib/utils';
import type { Ubicacion, UbicacionLayout, LayoutShape, TipoUbicacion, Producto } from '@/types';
import { uid, now } from '@/lib/utils';

const TIPOS_SALON: { value: TipoUbicacion; label: string; icon: string }[] = [
  { value: 'sucursal', label: 'Sucursal', icon: '🏢' },
  { value: 'pasillo', label: 'Pasillo', icon: '🛣️' },
  { value: 'gondola', label: 'Góndola', icon: '📦' },
  { value: 'estante', label: 'Estante', icon: '🗄️' },
  { value: 'posicion', label: 'Posición', icon: '📍' },
];

const TIPOS_DEPOSITO: { value: TipoUbicacion; label: string; icon: string }[] = [
  { value: 'deposito', label: 'Depósito', icon: '🏭' },
  { value: 'pasillo', label: 'Pasillo', icon: '🛣️' },
  { value: 'estante', label: 'Estante', icon: '🗄️' },
  { value: 'posicion', label: 'Posición', icon: '📍' },
];

const COLORS = [
  'oklch(62% 0.17 258)', // naranja
  'oklch(55% 0.22 270)', // azul
  'oklch(60% 0.18 145)', // verde
  'oklch(65% 0.20 30)',  // rojo
  'oklch(70% 0.15 85)',  // amarillo
  'oklch(68% 0.18 320)', // rosa
  'oklch(62% 0.16 200)', // cian
  'oklch(72% 0.12 60)',  // dorado
];

function IconButton({ children, onClick, title, disabled, className = '', style }: {
  children: React.ReactNode;
  onClick: (e: any) => void;
  title: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      className={`icon-btn${disabled ? ' disabled' : ''} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{ width: 36, height: 36, ...style }}
    >
      {children}
    </button>
  );
}

function ColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {COLORS.map(c => (
        <button
          key={c}
          onClick={() => onChange(c)}
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: c, border: `3px solid ${color === c ? 'var(--primary)' : 'transparent'}`,
            boxShadow: color === c ? '0 0 0 2px var(--bg), 0 0 0 4px var(--primary)' : 'none',
            cursor: 'pointer', transition: 'transform .15s',
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.9)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        />
      ))}
    </div>
  );
}

function ShapeToolbar({ 
  selectedTool, 
  onToolChange, 
  strokeColor, 
  onStrokeChange,
  fillColor,
  onFillChange,
  strokeWidth,
  onStrokeWidthChange,
}: {
  selectedTool: string;
  onToolChange: (t: string) => void;
  strokeColor: string;
  onStrokeChange: (c: string) => void;
  fillColor: string;
  onFillChange: (c: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (w: number) => void;
}) {
  const tools = [
    { id: 'select', icon: '🖱️', label: 'Seleccionar' },
    { id: 'rect', icon: '⬜', label: 'Rectángulo' },
    { id: 'circle', icon: '⭕', label: 'Círculo' },
    { id: 'path', icon: '✏️', label: 'Línea libre' },
    { id: 'text', icon: '📝', label: 'Texto' },
  ];

  return (
    <div className="layout-toolbar">
      <div className="toolbar-group">
        {tools.map(t => (
          <button
            key={t.id}
            className={`tool-btn${selectedTool === t.id ? ' active' : ''}`}
            onClick={() => onToolChange(t.id)}
            title={t.label}
          >
            <span style={{ fontSize: 18 }}>{t.icon}</span>
          </button>
        ))}
      </div>
      <div className="toolbar-divider" />
      <div className="toolbar-group">
        <label style={{ fontSize: 11, color: 'var(--text-faint)' }}>Trazo</label>
        <ColorPicker color={strokeColor} onChange={onStrokeChange} />
      </div>
      <div className="toolbar-group">
        <label style={{ fontSize: 11, color: 'var(--text-faint)' }}>Relleno</label>
        <ColorPicker color={fillColor} onChange={onFillChange} />
      </div>
      <div className="toolbar-group">
        <label style={{ fontSize: 11, color: 'var(--text-faint)' }}>Grosor</label>
        <input type="range" min="1" max="8" value={strokeWidth} onChange={e => onStrokeWidthChange(Number(e.target.value))} style={{ width: 80 }} />
      </div>
    </div>
  );
}

function Canvas({ 
  ubicacion, 
  onUpdate, 
  tool, 
  strokeColor, 
  fillColor, 
  strokeWidth,
  scale,
  onScaleChange,
}: {
  ubicacion: Ubicacion;
  onUpdate: (layout: UbicacionLayout) => void;
  tool: string;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  scale: number;
  onScaleChange: (s: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [shapes, setShapes] = useState<LayoutShape[]>(ubicacion.layout?.shapes || []);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ shapeId: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [drawing, setDrawing] = useState<{ points: number[]; startX: number; startY: number } | null>(null);
  const [resizing, setResizing] = useState<{ shapeId: string; handle: string; startX: number; startY: number; orig: LayoutShape } | null>(null);

  // Sync shapes from ubicacion
  useEffect(() => {
    setShapes(ubicacion.layout?.shapes || []);
  }, [ubicacion.layout?.shapes]);

  const saveShapes = useCallback((newShapes: LayoutShape[]) => {
    setShapes(newShapes);
    onUpdate({
      version: (ubicacion.layout?.version || 0) + 1,
      shapes: newShapes,
      background: ubicacion.layout?.background,
    });
  }, [ubicacion.layout, onUpdate]);

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    const rect = canvas!.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  };

  const hitTest = (x: number, y: number, shape: LayoutShape): string | null => {
    const { type, x: sx, y: sy, width, height, radius, points } = shape;
    if (type === 'rect' || type === 'text' || type === 'image') {
      if (x >= sx && x <= sx + (width || 0) && y >= sy && y <= sy + (height || 0)) return 'move';
      // Check resize handles
      const handles = ['tl', 'tr', 'bl', 'br'];
      for (const h of handles) {
        const hx = sx + (h.includes('l') ? 0 : width || 0);
        const hy = sy + (h.includes('t') ? 0 : height || 0);
        if (Math.hypot(x - hx, y - hy) < 8 / scale) return h;
      }
    } else if (type === 'circle') {
      if (Math.hypot(x - sx, y - sy) <= (radius || 0)) return 'move';
    } else if (type === 'path' && points) {
      // Simplified: check distance to path segments
      for (let i = 0; i < points.length - 2; i += 2) {
        const x1 = points[i], y1 = points[i + 1];
        const x2 = points[i + 2], y2 = points[i + 3];
        const dist = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) / Math.hypot(x2 - x1, y2 - y1);
        if (dist < 5 / scale) return 'move';
      }
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    const pt = getCanvasPoint(e);
    // Check selection
    for (let i = shapes.length - 1; i >= 0; i--) {
      const hit = hitTest(pt.x, pt.y, shapes[i]);
      if (hit) {
        setSelectedShapeId(shapes[i].id);
        if (hit !== 'move') {
          setResizing({ shapeId: shapes[i].id, handle: hit, startX: pt.x, startY: pt.y, orig: { ...shapes[i] } });
        } else {
          setDragging({ shapeId: shapes[i].id, startX: pt.x, startY: pt.y, origX: shapes[i].x, origY: shapes[i].y });
        }
        return;
      }
    }
    setSelectedShapeId(null);
    // Start drawing
    if (tool === 'rect' || tool === 'circle') {
      setDrawing({ points: [pt.x, pt.y], startX: pt.x, startY: pt.y });
    } else if (tool === 'path') {
      setDrawing({ points: [pt.x, pt.y, pt.x, pt.y], startX: pt.x, startY: pt.y });
    } else if (tool === 'text') {
      const newShape: LayoutShape = {
        id: uid(), type: 'text', x: pt.x, y: pt.y, width: 120, height: 30,
        text: 'Texto', fontSize: 14, fill: strokeColor, stroke: 'transparent', strokeWidth: 1,
      };
      saveShapes([...shapes, newShape]);
      setSelectedShapeId(newShape.id);
    }
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    const pt = getCanvasPoint(e);
    if (dragging) {
      const dx = pt.x - dragging.startX;
      const dy = pt.y - dragging.startY;
      saveShapes(shapes.map(s => s.id === dragging.shapeId ? { ...s, x: dragging.origX + dx, y: dragging.origY + dy } : s));
    } else if (resizing) {
      const shape = shapes.find(s => s.id === resizing.shapeId);
      if (!shape) return;
      const dx = pt.x - resizing.startX;
      const dy = pt.y - resizing.startY;
      const updated = { ...shape };
      const h = resizing.handle;
      if (h.includes('l')) { updated.x = resizing.orig.x + dx; updated.width = Math.max(10, (resizing.orig.width || 0) - dx); }
      else { updated.width = Math.max(10, (resizing.orig.width || 0) + dx); }
      if (h.includes('t')) { updated.y = resizing.orig.y + dy; updated.height = Math.max(10, (resizing.orig.height || 0) - dy); }
      else { updated.height = Math.max(10, (resizing.orig.height || 0) + dy); }
      saveShapes(shapes.map(s => s.id === resizing.shapeId ? updated : s));
    } else if (drawing) {
      if (tool === 'rect') {
        const w = pt.x - drawing.startX;
        const h = pt.y - drawing.startY;
        saveShapes([...shapes, { id: 'preview', type: 'rect', x: drawing.startX, y: drawing.startY, width: w, height: h, fill: fillColor, stroke: strokeColor, strokeWidth }]);
      } else if (tool === 'circle') {
        const r = Math.hypot(pt.x - drawing.startX, pt.y - drawing.startY);
        saveShapes([...shapes, { id: 'preview', type: 'circle', x: drawing.startX, y: drawing.startY, radius: r, fill: fillColor, stroke: strokeColor, strokeWidth }]);
      } else if (tool === 'path') {
        const newPoints = [...drawing.points, pt.x, pt.y];
        setDrawing({ ...drawing, points: newPoints });
        saveShapes([...shapes, { id: 'preview', type: 'path', x: 0, y: 0, points: newPoints, stroke: strokeColor, strokeWidth, fill: 'transparent' }]);
      }
    }
  };

  const handleMouseUp = () => {
    if (drawing && drawing.points.length > 2) {
      const preview = shapes.find(s => s.id === 'preview');
      if (preview) {
        const finalShape = { ...preview, id: uid() };
        saveShapes(shapes.filter(s => s.id !== 'preview').concat(finalShape));
        setSelectedShapeId(finalShape.id);
      }
    } else if (drawing) {
      saveShapes(shapes.filter(s => s.id !== 'preview'));
    }
    setDrawing(null);
    setDragging(null);
    setResizing(null);
  };

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.parentElement!.clientWidth;
    const height = canvas.parentElement!.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      // Grid
      ctx.strokeStyle = 'var(--line-soft)';
      ctx.lineWidth = 1;
      const gridSize = 20;
      for (let x = 0; x <= width; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
      for (let y = 0; y <= height; y += gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }

      // Shapes
      shapes.forEach(s => {
        if (s.id === 'preview') return;
        ctx.save();
        ctx.translate(s.x, s.y);
        if (s.rotation) ctx.rotate(s.rotation);
        
        const isSelected = s.id === selectedShapeId;
        ctx.fillStyle = s.fill || 'transparent';
        ctx.strokeStyle = s.stroke || strokeColor;
        ctx.lineWidth = s.strokeWidth || strokeWidth;
        ctx.font = `${s.fontSize || 14}px system-ui`;

        if (s.type === 'rect' || s.type === 'text' || s.type === 'image') {
          const w = s.width || 0, h = s.height || 0;
          if (s.fill !== 'transparent') ctx.fillRect(0, 0, w, h);
          if (s.stroke !== 'transparent') ctx.strokeRect(0, 0, w, h);
          if (s.type === 'text' && s.text) {
            ctx.fillStyle = s.fill || strokeColor;
            ctx.fillText(s.text, 4, s.fontSize || 14);
          }
        } else if (s.type === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, s.radius || 0, 0, Math.PI * 2);
          if (s.fill !== 'transparent') ctx.fill();
          if (s.stroke !== 'transparent') ctx.stroke();
        } else if (s.type === 'path' && s.points) {
          ctx.beginPath();
          ctx.moveTo(s.points[0], s.points[1]);
          for (let i = 2; i < s.points.length; i += 2) {
            ctx.lineTo(s.points[i], s.points[i + 1]);
          }
          ctx.stroke();
        }

        // Selection handles
        if (isSelected && (s.type === 'rect' || s.type === 'text' || s.type === 'image')) {
          ctx.fillStyle = 'var(--primary)';
          ctx.strokeStyle = 'var(--bg)';
          ctx.lineWidth = 2;
          const w = s.width || 0, h = s.height || 0;
          [-w/2, w/2].forEach(hx => [-h/2, h/2].forEach(hy => {
            ctx.beginPath();
            ctx.arc(hx, hy, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }));
        }
        ctx.restore();
      });

      // Preview shape (while drawing)
      const preview = shapes.find(s => s.id === 'preview');
      if (preview) {
        ctx.save();
        ctx.translate(preview.x, preview.y);
        ctx.strokeStyle = preview.stroke || strokeColor;
        ctx.fillStyle = preview.fill || 'transparent';
        ctx.lineWidth = preview.strokeWidth || strokeWidth;
        ctx.setLineDash([5, 5]);
        if (preview.type === 'rect') {
          ctx.strokeRect(0, 0, preview.width || 0, preview.height || 0);
        } else if (preview.type === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, preview.radius || 0, 0, Math.PI * 2);
          ctx.stroke();
        } else if (preview.type === 'path' && preview.points) {
          ctx.beginPath();
          ctx.moveTo(preview.points[0], preview.points[1]);
          for (let i = 2; i < preview.points.length; i += 2) {
            ctx.lineTo(preview.points[i], preview.points[i + 1]);
          }
          ctx.stroke();
        }
        ctx.restore();
      }
    };
    draw();
  }, [shapes, selectedShapeId, scale, strokeColor, fillColor, strokeWidth]);

  return (
    <div className="canvas-container" ref={containerRef} onWheel={e => {
      e.preventDefault();
      onScaleChange(Math.max(0.25, Math.min(3, scale - e.deltaY * 0.001)));
    }}>
      <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp} style={{ touchAction: 'none', cursor: tool === 'select' ? 'default' : 'crosshair' }} />
    </div>
  );
}

function UbicacionTree({ 
  ubicaciones, 
  selectedId, 
  onSelect, 
  onCreate, 
  onEdit, 
  onDelete,
  filterTipo,
  productCounts,
}: {
  ubicaciones: Ubicacion[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (parentId: string | null, tipo: TipoUbicacion) => void;
  onEdit: (u: Ubicacion) => void;
  onDelete: (id: string) => void;
  filterTipo: TipoUbicacion[];
  productCounts: Record<string, number>;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const renderNode = (u: Ubicacion, depth: number) => {
    if (filterTipo.length && !filterTipo.includes(u.tipo)) return null;
    const hasChildren = ubicaciones.some(x => x.parentId === u.id);
    const isExpanded = expanded.has(u.id);
    
    return (
      <div key={u.id} style={{ paddingLeft: depth * 16 }}>
        <div className={`tree-node${selectedId === u.id ? ' selected' : ''}`} onClick={() => onSelect(u.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8 }}>
          {hasChildren && (
            <button onClick={e => { e.stopPropagation(); setExpanded(prev => { const n = new Set(prev); isExpanded ? n.delete(u.id) : n.add(u.id); return n; }); }} style={{ width: 20, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          <span style={{ fontSize: 14, fontWeight: 500, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nombre}</span>
          {productCounts[u.id] ? (
            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 'var(--r-full)', background: 'oklch(62% 0.17 258 / .18)', color: 'var(--primary)', fontWeight: 700 }}>{productCounts[u.id]}</span>
          ) : null}
          <span className="badge" style={{ fontSize: 10, padding: '2px 6px' }}>{u.tipo}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <IconButton onClick={e => { e.stopPropagation(); onCreate(u.id, u.tipo === 'sucursal' || u.tipo === 'deposito' ? 'pasillo' : 'posicion'); }} title="Añadir hijo" ><span style={{fontSize:16}}>+</span></IconButton>
            <IconButton onClick={e => { e.stopPropagation(); onEdit(u); }} title="Editar" ><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg></IconButton>
            <IconButton onClick={e => { e.stopPropagation(); if (confirm('Eliminar esta ubicación y sus hijos?')) onDelete(u.id); }} title="Eliminar" style={{color:'var(--danger)'}} ><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></IconButton>
          </div>
        </div>
        {isExpanded && hasChildren && (
          <div>{ubicaciones.filter(x => x.parentId === u.id).map(c => renderNode(c, depth + 1))}</div>
        )}
      </div>
    );
  };

  return <div className="ubicacion-tree">{ubicaciones.filter(u => !u.parentId).map(u => renderNode(u, 0))}</div>;
}

function LayoutEditor({ ubicacion, onSave }: { ubicacion: Ubicacion; onSave: (u: Partial<Ubicacion>) => void }) {
  const [tool, setTool] = useState('select');
  const [strokeColor, setStrokeColor] = useState('oklch(62% 0.17 258)');
  const [fillColor, setFillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [scale, setScale] = useState(1);
  const [showGrid, setShowGrid] = useState(true);

  return (
    <div className="layout-editor">
      <ShapeToolbar 
        selectedTool={tool} onToolChange={setTool}
        strokeColor={strokeColor} onStrokeChange={setStrokeColor}
        fillColor={fillColor} onFillChange={setFillColor}
        strokeWidth={strokeWidth} onStrokeWidthChange={setStrokeWidth}
      />
      <div className="canvas-wrapper">
        <Canvas 
          ubicacion={ubicacion} 
          onUpdate={layout => onSave({ layout })}
          tool={tool}
          strokeColor={strokeColor}
          fillColor={fillColor}
          strokeWidth={strokeWidth}
          scale={scale}
          onScaleChange={setScale}
        />
      </div>
      <div className="canvas-status">
        <span>Zoom: {Math.round(scale * 100)}%</span>
        <label><input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} /> Cuadrícula</label>
      </div>
    </div>
  );
}

export default function UbicacionesPage() {
  return (
    <Suspense fallback={<div className="screen active"><div className="empty"><p>Cargando...</p></div></div>}>
      <UbicacionesInner />
    </Suspense>
  );
}

function UbicacionesInner() {
  const { usuario, tienePermiso } = useAuthStore();
  const { mostrarToast } = useUIStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'salon' | 'deposito'>('salon');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Ubicacion | null>(null);
  const [formData, setFormData] = useState({ nombre: '', tipo: 'pasillo' as TipoUbicacion, parentId: null as string | null });
  const [filterTipo, setFilterTipo] = useState<TipoUbicacion[]>([]);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [selectedProducts, setSelectedProducts] = useState<Producto[]>([]);

  useEffect(() => {
    dbUbicaciones.listar().then(setUbicaciones);
  }, []);

  // Load product counts per ubicacion
  useEffect(() => {
    if (ubicaciones.length === 0) return;
    const loadCounts = async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        ubicaciones.map(async (u) => {
          const count = await dbProductos.contarPorUbicacion(u.id);
          if (count > 0) counts[u.id] = count;
        })
      );
      setProductCounts(counts);
    };
    loadCounts();
  }, [ubicaciones]);

  // Auto-select from ?ubicacion= param
  useEffect(() => {
    const ubId = searchParams.get('ubicacion');
    if (ubId && ubicaciones.length > 0) {
      setSelectedId(ubId);
      const u = ubicaciones.find(x => x.id === ubId);
      if (u) {
        const isSalon = ['sucursal', 'pasillo', 'gondola', 'estante', 'posicion'].includes(u.tipo);
        setActiveTab(isSalon ? 'salon' : 'deposito');
      }
    }
  }, [searchParams, ubicaciones]);

  // Load products when selected ubicacion changes
  useEffect(() => {
    if (!selectedId) { setSelectedProducts([]); return; }
    dbProductos.obtenerPorUbicacion(selectedId).then(setSelectedProducts);
  }, [selectedId]);

  const selectedUbicacion = ubicaciones.find(u => u.id === selectedId);

  const handleCreate = (parentId: string | null, tipo: TipoUbicacion) => {
    setFormData({ nombre: '', tipo, parentId });
    setEditing(null);
    setModalOpen(true);
  };

  const handleEdit = (u: Ubicacion) => {
    setFormData({ nombre: u.nombre, tipo: u.tipo, parentId: u.parentId });
    setEditing(u);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    await dbUbicaciones.eliminar(id);
    setUbicaciones(prev => prev.filter(u => u.id !== id));
    if (selectedId === id) setSelectedId(null);
    mostrarToast('exito', 'Ubicación eliminada');
  };

  const handleSaveModal = async () => {
    if (!formData.nombre.trim()) { mostrarToast('error', 'El nombre es obligatorio'); return; }
    try {
      if (editing) {
        await dbUbicaciones.actualizar(editing.id, { nombre: formData.nombre, tipo: formData.tipo, parentId: formData.parentId });
        setUbicaciones(prev => prev.map(u => u.id === editing.id ? { ...u, ...formData } : u));
        mostrarToast('exito', 'Ubicación actualizada');
      } else {
        const nueva = await dbUbicaciones.crear({ ...formData, activo: true });
        setUbicaciones(prev => [...prev, nueva]);
        setSelectedId(nueva.id);
        mostrarToast('exito', 'Ubicación creada');
      }
      setModalOpen(false);
    } catch (e: any) { mostrarToast('error', e.message); }
  };

  const currentTipos = activeTab === 'salon' ? TIPOS_SALON : TIPOS_DEPOSITO;

  return (
    <div className="screen active">
      <div>
        <p className="eyebrow">Ubicaciones</p>
        <h1 className="h-page">Plano Salón / Depósito</h1>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab${activeTab === 'salon' ? ' active' : ''}`} onClick={() => setActiveTab('salon')}>
          <span style={{fontSize:18}}>🏪</span> Salón
        </button>
        <button className={`tab${activeTab === 'deposito' ? ' active' : ''}`} onClick={() => setActiveTab('deposito')}>
          <span style={{fontSize:18}}>🏭</span> Depósito
        </button>
      </div>

      <div className="ubi-layout">
        {/* Sidebar - Tree */}
        <div className="panel" style={{ overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 12, borderBottom: '1px solid var(--line-soft)' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button className="btn-primary" style={{ flex: 1, fontSize: 13 }} onClick={() => handleCreate(null, activeTab === 'salon' ? 'sucursal' : 'deposito')}>
                + Nueva raíz
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {currentTipos.map(t => (
                <label key={t.value} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}>
                  <input type="checkbox" checked={filterTipo.includes(t.value)} onChange={e => setFilterTipo(prev => e.target.checked ? [...prev, t.value] : prev.filter(x => x !== t.value))} />
                  <span>{t.icon} {t.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, padding: 8, overflow: 'auto' }}>
            <UbicacionTree 
              ubicaciones={ubicaciones} 
              selectedId={selectedId} 
              onSelect={setSelectedId} 
              onCreate={handleCreate} 
              onEdit={handleEdit} 
              onDelete={handleDelete}
              filterTipo={filterTipo}
              productCounts={productCounts}
            />
          </div>
        </div>

        {/* Main - Layout Editor or Empty State */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedUbicacion ? (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ fontSize: 1.1, fontWeight: 700 }}>{selectedUbicacion.nombre}</h2>
                  <span className="badge">{selectedUbicacion.tipo}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <IconButton onClick={() => handleEdit(selectedUbicacion)} title="Editar info"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg></IconButton>
                  <IconButton onClick={() => handleCreate(selectedUbicacion.id, selectedUbicacion.tipo === 'sucursal' || selectedUbicacion.tipo === 'deposito' ? 'pasillo' : 'posicion')} title="Añadir hijo"><span style={{fontSize:16}}>+</span></IconButton>
                </div>
              </div>
              <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                <LayoutEditor ubicacion={selectedUbicacion} onSave={async (patch) => {
                  await dbUbicaciones.actualizar(selectedUbicacion.id, patch);
                  setUbicaciones(prev => prev.map(u => u.id === selectedUbicacion.id ? { ...u, ...patch } : u));
                  mostrarToast('exito', 'Plano guardado');
                }} />
              </div>
              {selectedProducts.length > 0 && (
                <div style={{ borderTop: '1px solid var(--line-soft)', padding: 12, maxHeight: 200, overflow: 'auto' }}>
                  <div style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                    {selectedProducts.length} producto{selectedProducts.length !== 1 ? 's' : ''} en esta ubicación
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedProducts.map(p => (
                      <Link key={p.id} href={`/producto/${p.id}/editar`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--surface-high)', borderRadius: 'var(--r-lg)', border: '1px solid var(--line-soft)', textDecoration: 'none', color: 'var(--text)', transition: 'background .15s' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 'var(--r-lg)', background: 'var(--surface)', display: 'grid', placeItems: 'center', flexShrink: 0, border: '1px solid var(--line-soft)' }}>
                          {p.imagen ? (
                            <img src={p.imagen} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 'var(--r-lg)' }} />
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-faint)' }}><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</div>
                          <div style={{ fontSize: '.72rem', color: 'var(--text-faint)' }}>PLU: {p.plu || '—'} · Stock: {p.stockActual}</div>
                        </div>
                        <span style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--cyan)' }}>{formatMoney(p.precioVenta)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="empty" style={{ flex: 1 }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-faint)', opacity: 0.5 }}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>
              <p>Seleccioná una ubicación para editar su plano</p>
              <p style={{ fontSize: '.85rem', color: 'var(--text-faint)', marginTop: 4 }}>Creá ubicaciones en el panel izquierdo</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Crear/Editar */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>{editing ? 'Editar ubicación' : 'Nueva ubicación'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '.8rem', color: 'var(--text-faint)', marginBottom: 4 }}>Nombre *</label>
                <input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} placeholder="Ej: Pasillo 1, Estante A" style={{ width: '100%', padding: '12px', borderRadius: 'var(--r-lg)', border: '1px solid var(--line)', background: 'var(--surface)', fontSize: '1rem' }} autoFocus />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '.8rem', color: 'var(--text-faint)', marginBottom: 4 }}>Tipo</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {currentTipos.map(t => (
                    <button key={t.value} type="button" onClick={() => setFormData({...formData, tipo: t.value})} className={`chip${formData.tipo === t.value ? ' active' : ''}`} style={{ padding: 10, justifyContent: 'center' }}>
                      <span style={{fontSize:16}}>{t.icon}</span> {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '.8rem', color: 'var(--text-faint)', marginBottom: 4 }}>Ubicación padre (opcional)</label>
                <select value={formData.parentId || ''} onChange={e => setFormData({...formData, parentId: e.target.value || null})} style={{ width: '100%', padding: '12px', borderRadius: 'var(--r-lg)', border: '1px solid var(--line)', background: 'var(--surface)', fontSize: '1rem' }}>
                  <option value="">— Ninguna (raíz) —</option>
                  {ubicaciones.filter(u => u.tipo !== 'posicion' && u.id !== editing?.id).map(u => (
                    <option key={u.id} value={u.id}>{u.nombre} ({u.tipo})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 20px', borderTop: '1px solid var(--line-soft)' }}>
              <button className="btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSaveModal}>{editing ? 'Guardar cambios' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}