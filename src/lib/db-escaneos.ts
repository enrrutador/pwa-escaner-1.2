// src/lib/db-escaneos.ts
// Repositorio de escaneos: listar, contar, registrar.

import { db } from './db';
import { uid, now } from './utils';
import type { Escaneo, ResultadoEscaneo, OrigenEscaneo } from '@/types';

interface ListarEscaneosArgs {
  limite?: number;
  resultado?: ResultadoEscaneo;
}

export const dbEscaneos = {
  async listar({ limite = 50, resultado }: ListarEscaneosArgs = {}): Promise<Escaneo[]> {
    let coll = db.escaneos.toCollection();
    if (resultado) coll = coll.filter((e) => e.resultado === resultado);
    const todos = await coll.reverse().sortBy('createdAt');
    return todos.slice(0, limite);
  },

  contar(): Promise<number> {
    return db.escaneos.count();
  },

  contarHoy(): Promise<number> {
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    return db.escaneos.filter((e) => e.createdAt >= inicio.getTime()).count();
  },

  async registrar({
    codigo,
    origen,
    resultado,
    productoId = null,
    nombreProducto = null,
    imagen = null,
  }: {
    codigo: string;
    origen: OrigenEscaneo;
    resultado: ResultadoEscaneo;
    productoId?: string | null;
    nombreProducto?: string | null;
    imagen?: string | null;
  }): Promise<Escaneo> {
    const escaneo: Escaneo = {
      id: uid(),
      codigo,
      origen,
      resultado,
      productoId,
      nombreProducto,
      imagen,
      createdAt: now(),
    };
    await db.escaneos.add(escaneo);
    return escaneo;
  },
};
