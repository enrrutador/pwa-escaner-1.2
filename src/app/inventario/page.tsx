import { Suspense } from 'react';
import InventarioClient from './InventarioClient';

export default function Inventario() {
  return (
    <Suspense fallback={<div className="screen active"><div className="empty"><p>Cargando...</p></div></div>}>
      <InventarioClient />
    </Suspense>
  );
}