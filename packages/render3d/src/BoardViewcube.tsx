import type { ThreeEvent } from '@react-three/fiber';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import { CanvasTexture, SRGBColorSpace, Vector3 } from 'three';

type ViewcubeClick = (event: ThreeEvent<MouseEvent>) => null;

interface BoardViewcubeProps {
  onClick: ViewcubeClick;
  color?: string;
  hoverColor?: string;
  textColor?: string;
  strokeColor?: string;
  font?: string;
}

const FACE_DEFINITIONS = [
  { text: 'NOSE', rotation: -Math.PI / 2 },
  { text: 'TAIL', rotation: Math.PI / 2 },
  { text: 'LEFT', rotation: Math.PI },
  { text: 'RIGHT', rotation: 0 },
  { text: 'DECK', rotation: 0 },
  { text: 'BOTTOM', rotation: Math.PI },
] as const;

const makePosition = (position: [number, number, number]) =>
  new Vector3(...position).multiplyScalar(0.38);

const CORNERS = [
  [1, 1, 1],
  [1, 1, -1],
  [1, -1, 1],
  [1, -1, -1],
  [-1, 1, 1],
  [-1, 1, -1],
  [-1, -1, 1],
  [-1, -1, -1],
].map((position) => makePosition(position as [number, number, number]));

const EDGES = [
  [1, 1, 0],
  [1, 0, 1],
  [1, 0, -1],
  [1, -1, 0],
  [0, 1, 1],
  [0, 1, -1],
  [0, -1, 1],
  [0, -1, -1],
  [-1, 1, 0],
  [-1, 0, 1],
  [-1, 0, -1],
  [-1, -1, 0],
].map((position) => makePosition(position as [number, number, number]));

const EDGE_DIMENSIONS = EDGES.map(
  (edge) => edge.toArray().map((axis) => (axis === 0 ? 0.5 : 0.25)) as [number, number, number],
);

function ViewcubeHitArea({
  position,
  dimensions,
  hoverColor,
  onClick,
}: {
  position: Vector3;
  dimensions: [number, number, number];
  hoverColor: string;
  onClick: ViewcubeClick;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <mesh
      scale={1.01}
      position={position}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        setHovered(false);
      }}
      onClick={onClick}
    >
      <boxGeometry args={dimensions} />
      <meshBasicMaterial
        color={hoverColor}
        transparent
        opacity={0.6}
        visible={hovered}
        toneMapped={false}
      />
    </mesh>
  );
}

export function BoardViewcube({
  onClick,
  color = '#E8EEF5',
  hoverColor = '#22D3EE',
  textColor = '#0A1424',
  strokeColor = '#51647D',
  font = '40px Inter, Arial, sans-serif',
}: BoardViewcubeProps) {
  const { gl } = useThree();
  const [hoveredFace, setHoveredFace] = useState<number | null>(null);
  const textures = useMemo(
    () =>
      FACE_DEFINITIONS.map(({ text, rotation }) => {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext('2d');
        if (context) {
          context.fillStyle = color;
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.strokeStyle = strokeColor;
          context.lineWidth = 2;
          context.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
          context.translate(canvas.width / 2, canvas.height / 2);
          context.rotate(rotation);
          context.fillStyle = textColor;
          context.font = font;
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillText(text, 0, 0);
        }
        const texture = new CanvasTexture(canvas);
        texture.colorSpace = SRGBColorSpace;
        texture.anisotropy = gl.capabilities.getMaxAnisotropy() || 1;
        return texture;
      }),
    [color, font, gl, strokeColor, textColor],
  );

  useEffect(() => () => textures.forEach((texture) => texture.dispose()), [textures]);

  return (
    <group scale={[60, 60, 60]}>
      <mesh
        onPointerOut={(event) => {
          event.stopPropagation();
          setHoveredFace(null);
        }}
        onPointerMove={(event) => {
          event.stopPropagation();
          setHoveredFace(Math.floor((event.faceIndex ?? 0) / 2));
        }}
        onClick={onClick}
      >
        <boxGeometry />
        {textures.map((texture, index) => (
          <meshBasicMaterial
            key={FACE_DEFINITIONS[index]!.text}
            attach={`material-${index}`}
            map={texture}
            color={hoveredFace === index ? hoverColor : 'white'}
            toneMapped={false}
          />
        ))}
      </mesh>
      {EDGES.map((position, index) => (
        <ViewcubeHitArea
          key={`edge-${index}`}
          position={position}
          dimensions={EDGE_DIMENSIONS[index]!}
          hoverColor={hoverColor}
          onClick={onClick}
        />
      ))}
      {CORNERS.map((position, index) => (
        <ViewcubeHitArea
          key={`corner-${index}`}
          position={position}
          dimensions={[0.25, 0.25, 0.25]}
          hoverColor={hoverColor}
          onClick={onClick}
        />
      ))}
    </group>
  );
}
