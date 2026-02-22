"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sparkles } from "@react-three/drei";
import * as THREE from "three";

interface LandingSceneProps {
  hoveredMode: "video" | "game" | null;
  mouse: React.RefObject<{ x: number; y: number }>;
}

const VIDEO_COLOR = new THREE.Color("#7c3aed");
const VIDEO_ACTIVE = new THREE.Color("#a78bfa");
const GAME_COLOR = new THREE.Color("#10b981");
const GAME_ACTIVE = new THREE.Color("#34d399");
const ACCENT_PINK = new THREE.Color("#ec4899");
const ACCENT_CYAN = new THREE.Color("#06b6d4");
const ACCENT_AMBER = new THREE.Color("#f59e0b");
const NEUTRAL_DIM = new THREE.Color("#6366f1");

function CameraRig({ mouse }: { mouse: React.RefObject<{ x: number; y: number }> }) {
  useFrame((state) => {
    const cam = state.camera;
    cam.position.x = THREE.MathUtils.lerp(cam.position.x, mouse.current.x * 0.6, 0.03);
    cam.position.y = THREE.MathUtils.lerp(cam.position.y, mouse.current.y * 0.4, 0.03);
    cam.lookAt(0, 0, 0);
  });
  return null;
}

function AnimatedShape({
  position,
  geometryType,
  geometryArgs,
  baseColor,
  activeColor,
  isActive,
  isOtherActive,
  floatSpeed = 1.5,
  floatIntensity = 2,
  rotationIntensity = 1.5,
  distort = 0.3,
  distortSpeed = 2,
  baseScale = 1,
}: {
  position: [number, number, number];
  geometryType: "icosahedron" | "torus" | "octahedron" | "dodecahedron" | "tetrahedron";
  geometryArgs: number[];
  baseColor: THREE.Color;
  activeColor: THREE.Color;
  isActive: boolean;
  isOtherActive: boolean;
  floatSpeed?: number;
  floatIntensity?: number;
  rotationIntensity?: number;
  distort?: number;
  distortSpeed?: number;
  baseScale?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const targetColor = useMemo(() => baseColor.clone(), [baseColor]);
  const targetScale = useRef(baseScale);
  const targetOpacity = useRef(0.6);

  useFrame(() => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;

    if (isActive) {
      targetColor.lerp(activeColor, 0.06);
      targetScale.current = THREE.MathUtils.lerp(targetScale.current, baseScale * 1.2, 0.04);
      targetOpacity.current = THREE.MathUtils.lerp(targetOpacity.current, 0.85, 0.05);
    } else if (isOtherActive) {
      targetColor.lerp(baseColor, 0.06);
      targetScale.current = THREE.MathUtils.lerp(targetScale.current, baseScale * 0.85, 0.04);
      targetOpacity.current = THREE.MathUtils.lerp(targetOpacity.current, 0.3, 0.05);
    } else {
      targetColor.lerp(baseColor, 0.04);
      targetScale.current = THREE.MathUtils.lerp(targetScale.current, baseScale, 0.04);
      targetOpacity.current = THREE.MathUtils.lerp(targetOpacity.current, 0.6, 0.05);
    }

    mat.color.lerp(targetColor, 0.08);
    mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity.current, 0.06);

    const s = targetScale.current;
    meshRef.current.scale.lerp(new THREE.Vector3(s, s, s), 0.06);
  });

  const geometry = useMemo(() => {
    switch (geometryType) {
      case "icosahedron": return new THREE.IcosahedronGeometry(...(geometryArgs as [number, number]));
      case "torus": return new THREE.TorusGeometry(...(geometryArgs as [number, number, number, number]));
      case "octahedron": return new THREE.OctahedronGeometry(...(geometryArgs as [number]));
      case "dodecahedron": return new THREE.DodecahedronGeometry(...(geometryArgs as [number]));
      case "tetrahedron": return new THREE.TetrahedronGeometry(...(geometryArgs as [number]));
    }
  }, [geometryType, geometryArgs]);

  return (
    <Float speed={floatSpeed} rotationIntensity={rotationIntensity} floatIntensity={floatIntensity}>
      <mesh ref={meshRef} position={position} geometry={geometry}>
        <MeshDistortMaterial
          color={baseColor}
          distort={distort}
          speed={distortSpeed}
          transparent
          opacity={0.6}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
    </Float>
  );
}

function Scene({ hoveredMode, mouse }: LandingSceneProps) {
  const videoActive = hoveredMode === "video";
  const gameActive = hoveredMode === "game";
  const otherActive = hoveredMode !== null;

  return (
    <>
      <CameraRig mouse={mouse} />
      <ambientLight intensity={0.4} />
      <pointLight position={[8, 6, 8]} intensity={0.6} color="#c084fc" />
      <pointLight position={[-8, -4, 6]} intensity={0.4} color="#34d399" />

      {/* Video zone — left side */}
      <AnimatedShape
        position={[-3.2, 0.8, -1]}
        geometryType="icosahedron"
        geometryArgs={[1.3, 1]}
        baseColor={VIDEO_COLOR}
        activeColor={VIDEO_ACTIVE}
        isActive={videoActive}
        isOtherActive={gameActive}
        floatSpeed={1.2}
        floatIntensity={2.5}
        rotationIntensity={1.8}
        distort={0.35}
        distortSpeed={2.5}
      />

      {/* Game zone — right side */}
      <AnimatedShape
        position={[3.2, -0.5, -1]}
        geometryType="torus"
        geometryArgs={[1.0, 0.38, 16, 32]}
        baseColor={GAME_COLOR}
        activeColor={GAME_ACTIVE}
        isActive={gameActive}
        isOtherActive={videoActive}
        floatSpeed={1.8}
        floatIntensity={2}
        rotationIntensity={2.2}
        distort={0.4}
        distortSpeed={3}
      />

      {/* Decorative shapes */}
      <AnimatedShape
        position={[-1.8, 2.5, -2.5]}
        geometryType="octahedron"
        geometryArgs={[0.5]}
        baseColor={ACCENT_PINK}
        activeColor={ACCENT_PINK}
        isActive={false}
        isOtherActive={otherActive}
        baseScale={0.7}
        floatSpeed={2.5}
        floatIntensity={1.5}
        distort={0.2}
        distortSpeed={4}
      />

      <AnimatedShape
        position={[2.2, 2.0, -3]}
        geometryType="dodecahedron"
        geometryArgs={[0.4]}
        baseColor={ACCENT_CYAN}
        activeColor={ACCENT_CYAN}
        isActive={false}
        isOtherActive={otherActive}
        baseScale={0.6}
        floatSpeed={2}
        floatIntensity={1.8}
        distort={0.25}
        distortSpeed={3.5}
      />

      <AnimatedShape
        position={[0, -2, -2]}
        geometryType="tetrahedron"
        geometryArgs={[0.45]}
        baseColor={ACCENT_AMBER}
        activeColor={ACCENT_AMBER}
        isActive={false}
        isOtherActive={otherActive}
        baseScale={0.55}
        floatSpeed={3}
        floatIntensity={1.2}
        distort={0.3}
        distortSpeed={2}
      />

      <AnimatedShape
        position={[-4.5, -1.8, -3.5]}
        geometryType="octahedron"
        geometryArgs={[0.3]}
        baseColor={NEUTRAL_DIM}
        activeColor={NEUTRAL_DIM}
        isActive={false}
        isOtherActive={otherActive}
        baseScale={0.45}
        floatSpeed={1.5}
        floatIntensity={2.5}
        distort={0.15}
        distortSpeed={1.5}
      />

      <AnimatedShape
        position={[4.8, 1.2, -4]}
        geometryType="tetrahedron"
        geometryArgs={[0.25]}
        baseColor={NEUTRAL_DIM}
        activeColor={NEUTRAL_DIM}
        isActive={false}
        isOtherActive={otherActive}
        baseScale={0.4}
        floatSpeed={2.2}
        floatIntensity={2}
        distort={0.2}
        distortSpeed={2.5}
      />

      {/* Ambient sparkles */}
      <Sparkles
        count={80}
        size={2.5}
        scale={[16, 12, 10]}
        speed={0.3}
        opacity={0.35}
        color="#c084fc"
      />
    </>
  );
}

export default function LandingScene({ hoveredMode, mouse }: LandingSceneProps) {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
      <Canvas
        camera={{ position: [0, 0, 7], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "default" }}
        style={{ background: "transparent" }}
      >
        <Scene hoveredMode={hoveredMode} mouse={mouse} />
      </Canvas>
    </div>
  );
}
