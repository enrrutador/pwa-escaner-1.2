// src/types/index.ts
// Tipos, enums y constantes del dominio StockMaster.

/* ============ ENUMS ============ */
export type TipoMovimiento = 'entrada' | 'salida' | 'ajuste' | 'conteo';
export type TipoUbicacion =
  | 'deposito'
  | 'sucursal'
  | 'pasillo'
  | 'gondola'
  | 'estante'
  | 'posicion';
export type TipoConteo = 'completo' | 'parcial' | 'ciclico';
export type RolUsuario = 'admin' | 'operador' | 'viewer';

export type TipoAlerta = 'stock_bajo' | 'sin_stock';
export type EstadoConteo = 'abierto' | 'en_progreso' | 'finalizado' | 'cancelado';
export type ResultadoEscaneo = 'encontrado' | 'no_encontrado' | 'pendiente';
export type OrigenEscaneo = 'camara' | 'manual';

/* ============ INTERFACES ============ */
export interface Producto {
  id: string;
  plu: string;
  codigoBarras: string;
  nombre: string;
  descripcion?: string;
  categoria: string;
  marca: string;
  ubicacionId: string | null;
  precioCompra: number;
  precioVenta: number;
  stockActual: number;
  stockMinimo: number;
  imagen?: string;
  activo: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Ubicacion {
  id: string;
  nombre: string;
  parentId: string | null;
  tipo: TipoUbicacion;
  activo: boolean;
  createdAt: number;
  // Campos para layout visual (salon/deposito)
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // Datos del dibujo (JSON con formas, paths, etc.)
  layout?: UbicacionLayout;
}

export interface UbicacionLayout {
  version: number;
  shapes: LayoutShape[];
  background?: string; // color o imagen base64
}

export interface LayoutShape {
  id: string;
  type: 'rect' | 'circle' | 'path' | 'text' | 'image';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  points?: number[]; // para path/polígono
  text?: string;
  fontSize?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  rotation?: number;
  data?: Record<string, any>; // datos extra (ej: productoId si marca posición)
}

export interface UbicacionConHijos extends Ubicacion {
  hijos: UbicacionConHijos[];
}

export interface Movimiento {
  id: string;
  productoId: string;
  tipo: TipoMovimiento;
  cantidad: number;
  stockAntes: number;
  stockDespues: number;
  motivo?: string;
  usuarioId: string;
  conteoId?: string | null;
  createdAt: number;
}

export interface Usuario {
  id: string;
  nombre: string;
  pinHash: string;
  rol: RolUsuario;
  activo: boolean;
  createdAt: number;
}

export interface Conteo {
  id: string;
  nombre: string;
  tipo: TipoConteo;
  estado: EstadoConteo;
  usuarioId: string;
  createdAt: number;
  finalizadoAt?: number | null;
}

export interface ConteoItem {
  id: string;
  conteoId: string;
  productoId: string;
  cantidadSistema: number;
  cantidadFisica: number | null;
}

export interface Alerta {
  id: string;
  productoId: string;
  tipo: TipoAlerta;
  leida: boolean;
  createdAt: number;
}

export interface Escaneo {
  id: string;
  codigo: string;
  origen: OrigenEscaneo;
  resultado: ResultadoEscaneo;
  productoId?: string | null;
  nombreProducto?: string | null;
  imagen?: string | null;
  createdAt: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  pagina: number;
  limite: number;
  hasMore: boolean;
}

export interface ResultadoBusqueda {
  nombre: string;
  codigoBarras?: string;
  imagen?: string;
  descripcion?: string;
  precio?: number;
  marca?: string;
  fuente: string;
}

/* ============ PERMISOS ============ */
export const PERMISOS_DISPONIBLES = [
  'productos:ver',
  'productos:crear',
  'productos:editar',
  'productos:eliminar',
  'stock:ajustar',
  'conteos:gestionar',
  'alertas:ver',
  'usuarios:gestionar',
] as const;

export type Permiso = (typeof PERMISOS_DISPONIBLES)[number];

export const PERMISOS_POR_ROL: Record<RolUsuario, Permiso[]> = {
  admin: [...PERMISOS_DISPONIBLES],
  operador: [
    'productos:ver',
    'productos:crear',
    'productos:editar',
    'stock:ajustar',
    'conteos:gestionar',
    'alertas:ver',
  ],
  viewer: ['productos:ver', 'alertas:ver'],
};

/* ============ CONSTANTES UI ============ */
export const TIPOS_UBICACION: { value: TipoUbicacion; label: string }[] = [
  { value: 'deposito', label: 'Depósito' },
  { value: 'sucursal', label: 'Sucursal' },
  { value: 'pasillo', label: 'Pasillo' },
  { value: 'gondola', label: 'Góndola' },
  { value: 'estante', label: 'Estante' },
  { value: 'posicion', label: 'Posición' },
];

export const PAGE_SIZE_DEFAULT = 50;
