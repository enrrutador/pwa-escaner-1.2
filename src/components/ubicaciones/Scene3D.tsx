'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { Object3D as Object3DType } from '@/types';
import { uid } from '@/lib/utils';

const FLOOR_SIZE = 20;
const GRID_DIV = 20;
const COLORS = [
  'oklch(62% 0.17 258)',
  'oklch(55% 0.22 270)',
  'oklch(60% 0.18 145)',
  'oklch(65% 0.20 30)',
  'oklch(70% 0.15 85)',
  'oklch(68% 0.18 320)',
  'oklch(62% 0.16 200)',
  'oklch(72% 0.12 60)',
];

function oklchToHex(css: string): string {
  try {
    const el = typeof document !== 'undefined' ? document.createElement('div') : null;
    if (!el) return '#5588cc';
    el.style.color = css;
    document.body.appendChild(el);
    const computed = getComputedStyle(el).color;
    document.body.removeChild(el);
    return computed || '#5588cc';
  } catch {
    return '#5588cc';
  }
}

function ShelfObject({ obj, isSelected, onSelect, onDelete, products, colorHex }: {
  obj: Object3DType;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  products: { id: string; nombre: string; color?: string }[];
  colorHex: string;
}) {
  const shelfColor = colorHex;
  const emitColor = isSelected ? '#334466' : '#111122';

  return (
    <group
      position={[obj.x, 0, obj.z]}
      rotation={[0, obj.rotation, 0]}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      {/* Cuerpo del estante */}
      <mesh position={[0, obj.height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[obj.width, obj.height, obj.depth]} />
        <meshStandardMaterial
          color={shelfColor}
          roughness={0.5}
          metalness={0.2}
          emissive={emitColor}
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
      </mesh>

      {/* Bordes iluminados */}
      <lineSegments position={[0, obj.height / 2, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(obj.width, obj.height, obj.depth)]} />
        <lineBasicMaterial color={isSelected ? '#8aacc8' : '#445566'} />
      </lineSegments>

      {/* Estantes internos (separadores) */}
      {obj.height > 3 && (
        <>
          {Array.from({ length: Math.min(Math.floor(obj.height / 2), 4) }, (_, i) => {
            const shelfY = -obj.height / 2 + 2 + i * 2;
            return (
              <mesh key={`shelf-${i}`} position={[0, shelfY, 0]} receiveShadow>
                <boxGeometry args={[obj.width - 0.2, 0.1, obj.depth - 0.2]} />
                <meshStandardMaterial color="#334455" roughness={0.8} />
              </mesh>
            );
          })}
        </>
      )}

      {/* Productos en estantes */}
      {products.map((p, i) => {
        const shelfIdx = Math.min(i % Math.min(Math.floor(obj.height / 2), 4), 3);
        const shelfY = -obj.height / 2 + 2 + shelfIdx * 2 + 0.6;
        const cols = Math.max(Math.floor(obj.width / 0.6), 1);
        const col = i % cols;
        const xOffset = -obj.width / 2 + 0.4 + col * 0.6;
        return (
          <mesh key={p.id} position={[xOffset, shelfY, obj.depth / 2 - 0.3]} castShadow>
            <boxGeometry args={[0.4, 0.8, 0.3]} />
            <meshStandardMaterial
              color={p.color || '#7788aa'}
              roughness={0.4}
              metalness={0.1}
            />
          </mesh>
        );
      })}

      {/*Etiqueta si tiene label */}
      {obj.label && (
        <mesh position={[0, obj.height + 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[obj.width * 0.7, 0.4]} />
          <meshBasicMaterial color="#223344" transparent opacity={0.8} />
        </mesh>
      )}

      {/*Eliminar button indicator */}
      {isSelected && (
        <mesh
          position={[0, obj.height + 1.2, 0]}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#cc3333" emissive="#881111" emissiveIntensity={0.5} />
        </mesh>
      )}
    </group>
  );
}

function Floor({ onFloorClick, activeTool }: {
  onFloorClick: (pos: { x: number; z: number }) => void;
  activeTool: 'add' | 'select';
}) {
  const HALF = FLOOR_SIZE / 2;

  return (
    <group>
      {/*Suelo */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.05, 0]}
        receiveShadow
        onClick={(e) => {
          if (activeTool === 'add') {
            onFloorClick({ x: e.point.x, z: e.point.z });
          }
        }}
      >
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
        <meshStandardMaterial
          color="#1a1a2e"
          roughness={0.9}
          metalness={0}
        />
      </mesh>

      {/*Grilla */}
      {Array.from({ length: GRID_DIV + 1 }, (_, i) => {
        const offset = -HALF + (i / GRID_DIV) * FLOOR_SIZE;
        return (
          <group key={i}>
            <Line
              points={[[offset, 0, -HALF], [offset, 0, HALF]]}
              color="#223344"
              lineWidth={0.5}
            />
            <Line
              points={[[-HALF, 0, offset], [HALF, 0, offset]]}
              color="#223344"
              lineWidth={0.5}
            />
          </group>
        );
      })}

      {/*Bordes del piso */}
      <Line
        points={[[-HALF, 0.01, -HALF], [-HALF, 0.01, HALF], [HALF, 0.01, HALF], [HALF, 0.01, -HALF], [-HALF, 0.01, -HALF]]}
        color="#556677"
        lineWidth={1}
      />
    </group>
  );
}

export default function Scene3D({
  objects,
  onObjectsChange,
  selectedId,
  onSelectId,
  productData,
}: {
  objects: Object3DType[];
  onObjectsChange: (objs: Object3DType[]) => void;
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  productData: Record<string, { id: string; nombre: string; color?: string }[]>;
}) {
  const [activeTool, setActiveTool] = useState<'select' | 'add'>('select');
  const [addColor, setAddColor] = useState(COLORS[0]);
  const orbitRef = useRef<any>(null);
  const colorRef = useRef<HTMLDivElement>(null);

  // Convert OKLCH to hex for Three.js
  const [colorHexes, setColorHexes] = useState<Record<string, string>>({});

  useEffect(() => {
    const hexes: Record<string, string> = {};
    COLORS.forEach(c => { hexes[c] = oklchToHex(c); });
    setColorHexes(hexes);
  }, []);

  const handleFloorClick = useCallback((pos: { x: number; z: number }) => {
    if (activeTool !== 'add') return;
    const newObj: Object3DType = {
      id: uid(),
      type: 'estante',
      x: Math.round(pos.x),
      z: Math.round(pos.z),
      rotation: 0,
      width: 2,
      depth: 1,
      height: 4,
      color: addColor,
      label: '',
    };
    onObjectsChange([...objects, newObj]);
    onSelectId(newObj.id);
  }, [activeTool, addColor, objects, onObjectsChange, onSelectId]);

  const handleSelect = useCallback((id: string) => {
    onSelectId(id);
    setActiveTool('select');
  }, [onSelectId]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return;
    onObjectsChange(objects.filter(o => o.id !== selectedId));
    onSelectId(null);
  }, [selectedId, objects, onObjectsChange, onSelectId]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: 'oklch(12% 0.02 262)' }}>
      {/* Toolbar */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setActiveTool('select')}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--r-lg)',
              border: `1px solid ${activeTool === 'select' ? 'var(--primary)' : 'var(--line-soft)'}`,
              background: activeTool === 'select' ? 'oklch(62% 0.17 258 / .16)' : 'var(--surface)',
              color: activeTool === 'select' ? 'var(--primary)' : 'var(--text-dim)',
              fontWeight: 600,
              fontSize: '.8rem',
              cursor: 'pointer',
              transition: 'all .15s',
            }}
          >
            Seleccionar
          </button>
          <button
            onClick={() => setActiveTool('add')}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--r-lg)',
              border: `1px solid ${activeTool === 'add' ? 'var(--cyan)' : 'var(--line-soft)'}`,
              background: activeTool === 'add' ? 'oklch(83% 0.14 190 / .14)' : 'var(--surface)',
              color: activeTool === 'add' ? 'var(--cyan)' : 'var(--text-dim)',
              fontWeight: 600,
              fontSize: '.8rem',
              cursor: 'pointer',
              transition: 'all .15s',
            }}
          >
            Agregar estante
          </button>
        </div>

        {activeTool === 'add' && (
          <div style={{
            display: 'flex', gap: 6, flexWrap: 'wrap', padding: 8,
            background: 'var(--surface)', borderRadius: 'var(--r-lg)',
            border: '1px solid var(--line-soft)',
          }}>
            <span style={{ fontSize: '.72rem', color: 'var(--text-faint)', fontWeight: 600, marginBottom: 2, width: '100%' }}>
              Color
            </span>
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setAddColor(c)}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: colorHexes[c] || '#5588cc',
                  border: `3px solid ${addColor === c ? 'var(--primary)' : 'transparent'}`,
                  boxShadow: addColor === c ? '0 0 6px var(--primary)' : 'none',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        )}

        {selectedId && (
          <div style={{
            display: 'flex', gap: 6,
          }}>
            <button
              onClick={() => { onSelectId(null); setActiveTool('select'); }}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--r-lg)',
                border: '1px solid var(--line-soft)',
                background: 'var(--surface)',
                color: 'var(--text-dim)',
                fontWeight: 600,
                fontSize: '.75rem',
                cursor: 'pointer',
              }}
            >
              Quitar selección
            </button>
            <button
              onClick={handleDeleteSelected}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--r-lg)',
                border: '1px solid var(--danger)',
                background: 'oklch(72% 0.14 25 / .14)',
                color: 'var(--danger)',
                fontWeight: 600,
                fontSize: '.75rem',
                cursor: 'pointer',
              }}
            >
              Eliminar estante
            </button>
          </div>
        )}
      </div>

      {/* Hint */}
      {activeTool === 'add' && (
        <div style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          padding: '8px 16px',
          borderRadius: 'var(--r-full)',
          background: 'oklch(31% 0.04 262 / .85)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--line-soft)',
          color: 'var(--text-dim)',
          fontSize: '.85rem',
          fontWeight: 600,
        }}>
          Click en el piso para colocar estante
        </div>
      )}

      {/* Canvas 3D */}
      <Canvas
        shadows
        camera={{ position: [12, 10, 12], fov: 50, near: 0.5, far: 80 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1,
        }}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Luces */}
        <ambientLight intensity={0.5} color="#334466" />
        <directionalLight
          position={[15, 20, 10]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-radius={2}
          color="#8899cc"
        />
        <pointLight position={[0, 6, 0]} intensity={0.4} color="#556688" />
        <hemisphereLight intensity={0.3} color="#8899bb" groundColor="#111122" />

        {/* Suelo + Grilla */}
        <Floor onFloorClick={handleFloorClick} activeTool={activeTool} />

        {/* Estantes */}
        {objects.map(obj => {
          const prods = productData[obj.id] || [];
          return (
            <ShelfObject
              key={obj.id}
              obj={obj}
              isSelected={obj.id === selectedId}
              onSelect={() => handleSelect(obj.id)}
              onDelete={() => {
                onObjectsChange(objects.filter(o => o.id !== obj.id));
                onSelectId(null);
              }}
              products={prods}
              colorHex={colorHexes[obj.color] || '#5588cc'}
            />
          );
        })}

        {/* Controles de cámara */}
        <OrbitControls
          ref={orbitRef}
          enableDamping
          dampingFactor={0.12}
          minDistance={3}
          maxDistance={35}
          maxPolarAngle={Math.PI / 2.1}
          target={[0, 1, 0]}
          enableRotate={activeTool === 'select'}
          enablePan={true}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.PAN,
          }}
        />

        <fog attach="fog" args={['#111122', 10, 40]} />
      </Canvas>
    </div>
  );
}