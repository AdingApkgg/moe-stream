"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useUIStore } from "@/stores/app";

interface ParticleConfig {
  type: "sakura" | "firefly" | "snow" | "stars" | "none";
  density: number;
  speed: number;
  opacity: number;
  color: string;
}

const PRESETS: Record<string, { colors: number[]; size: [number, number] }> = {
  sakura: {
    colors: [0xffb7c5, 0xff69b4, 0xffc0cb, 0xffa0b4, 0xffe4e9],
    size: [0.08, 0.15],
  },
  firefly: {
    colors: [0xffee58, 0xfff176, 0xfdd835, 0xffeb3b, 0xffc107],
    size: [0.03, 0.06],
  },
  snow: {
    colors: [0xffffff, 0xe3f2fd, 0xbbdefb, 0xf5f5f5, 0xe0e0e0],
    size: [0.04, 0.1],
  },
  stars: {
    colors: [0xffffff, 0xfff9c4, 0xbbdefb, 0xf3e5f5, 0xffe0b2],
    size: [0.02, 0.05],
  },
};

function mapDensity(density: number, isMobile: boolean): number {
  const base = 30 + (density / 100) * 270;
  return Math.floor(isMobile ? base * 0.5 : base);
}

function SakuraParticles({ config, count }: { config: ParticleConfig; count: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    const arr = [];
    const preset = PRESETS[config.type] || PRESETS.sakura;
    for (let i = 0; i < count; i++) {
      arr.push({
        x: (Math.random() - 0.5) * 20,
        y: Math.random() * 12 - 2,
        z: (Math.random() - 0.5) * 6,
        rotX: Math.random() * Math.PI * 2,
        rotY: Math.random() * Math.PI * 2,
        rotZ: Math.random() * Math.PI * 2,
        speedY: 0.3 + Math.random() * 0.5,
        speedRotX: (Math.random() - 0.5) * 2,
        speedRotZ: (Math.random() - 0.5) * 1.5,
        swayPhase: Math.random() * Math.PI * 2,
        swayAmp: 0.3 + Math.random() * 0.7,
        scale: preset.size[0] + Math.random() * (preset.size[1] - preset.size[0]),
        color: config.color
          ? new THREE.Color(config.color)
          : new THREE.Color(preset.colors[i % preset.colors.length]),
      });
    }
    return arr;
  }, [count, config.type, config.color]);

  useEffect(() => {
    if (!meshRef.current) return;
    particles.forEach((p, i) => {
      meshRef.current.setColorAt(i, p.color);
    });
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [particles]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const speed = config.speed;
    const dt = Math.min(delta, 0.05);
    particles.forEach((p, i) => {
      p.y -= p.speedY * speed * dt;
      p.rotX += p.speedRotX * speed * dt;
      p.rotZ += p.speedRotZ * speed * dt;
      p.swayPhase += speed * dt;
      const swayX = Math.sin(p.swayPhase) * p.swayAmp * dt;
      p.x += swayX;

      if (p.y < -8) {
        p.y = 8 + Math.random() * 2;
        p.x = (Math.random() - 0.5) * 20;
      }
      if (p.x > 12) p.x = -12;
      if (p.x < -12) p.x = 12;

      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rotX, p.rotY, p.rotZ);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1);
    return geo;
  }, []);

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, count]}>
      <meshBasicMaterial
        transparent
        opacity={config.opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

function FireflyParticles({ config, count }: { config: ParticleConfig; count: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    const arr = [];
    const preset = PRESETS.firefly;
    for (let i = 0; i < count; i++) {
      arr.push({
        x: (Math.random() - 0.5) * 20,
        y: (Math.random() - 0.5) * 12,
        z: (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.2,
        phase: Math.random() * Math.PI * 2,
        pulseSpeed: 1 + Math.random() * 2,
        scale: preset.size[0] + Math.random() * (preset.size[1] - preset.size[0]),
        baseColor: config.color
          ? new THREE.Color(config.color)
          : new THREE.Color(preset.colors[i % preset.colors.length]),
      });
    }
    return arr;
  }, [count, config.color]);

  useEffect(() => {
    if (!meshRef.current) return;
    particles.forEach((p, i) => {
      meshRef.current.setColorAt(i, p.baseColor);
    });
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [particles]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const speed = config.speed;
    const dt = Math.min(delta, 0.05);
    const time = state.clock.elapsedTime;

    particles.forEach((p, i) => {
      p.x += p.vx * speed * dt;
      p.y += p.vy * speed * dt;
      p.phase += p.pulseSpeed * speed * dt;

      if (p.x > 12) p.vx = -Math.abs(p.vx);
      if (p.x < -12) p.vx = Math.abs(p.vx);
      if (p.y > 7) p.vy = -Math.abs(p.vy);
      if (p.y < -7) p.vy = Math.abs(p.vy);

      p.vx += (Math.random() - 0.5) * 0.01;
      p.vy += (Math.random() - 0.5) * 0.01;

      const pulse = (Math.sin(p.phase) * 0.5 + 0.5);
      const flickerScale = p.scale * (0.5 + pulse * 0.8);

      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(flickerScale);
      dummy.rotation.set(0, 0, time * 0.1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial
        transparent
        opacity={config.opacity}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

function SnowParticles({ config, count }: { config: ParticleConfig; count: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    const arr = [];
    const preset = PRESETS.snow;
    for (let i = 0; i < count; i++) {
      arr.push({
        x: (Math.random() - 0.5) * 20,
        y: Math.random() * 12 - 2,
        z: (Math.random() - 0.5) * 6,
        speedY: 0.2 + Math.random() * 0.4,
        swayPhase: Math.random() * Math.PI * 2,
        swayAmp: 0.2 + Math.random() * 0.4,
        rotZ: Math.random() * Math.PI * 2,
        rotSpeedZ: (Math.random() - 0.5) * 0.5,
        scale: preset.size[0] + Math.random() * (preset.size[1] - preset.size[0]),
        color: config.color
          ? new THREE.Color(config.color)
          : new THREE.Color(preset.colors[i % preset.colors.length]),
      });
    }
    return arr;
  }, [count, config.color]);

  useEffect(() => {
    if (!meshRef.current) return;
    particles.forEach((p, i) => {
      meshRef.current.setColorAt(i, p.color);
    });
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [particles]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const speed = config.speed;
    const dt = Math.min(delta, 0.05);
    particles.forEach((p, i) => {
      p.y -= p.speedY * speed * dt;
      p.swayPhase += speed * dt * 0.5;
      p.rotZ += p.rotSpeedZ * speed * dt;
      p.x += Math.sin(p.swayPhase) * p.swayAmp * dt;

      if (p.y < -8) {
        p.y = 8 + Math.random() * 2;
        p.x = (Math.random() - 0.5) * 20;
      }

      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, 0, p.rotZ);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <circleGeometry args={[1, 6]} />
      <meshBasicMaterial
        transparent
        opacity={config.opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

function StarsParticles({ config, count }: { config: ParticleConfig; count: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    const arr = [];
    const preset = PRESETS.stars;
    for (let i = 0; i < count; i++) {
      arr.push({
        x: (Math.random() - 0.5) * 24,
        y: (Math.random() - 0.5) * 14,
        z: -2 - Math.random() * 4,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.5 + Math.random() * 2,
        scale: preset.size[0] + Math.random() * (preset.size[1] - preset.size[0]),
        color: config.color
          ? new THREE.Color(config.color)
          : new THREE.Color(preset.colors[i % preset.colors.length]),
      });
    }
    return arr;
  }, [count, config.color]);

  useEffect(() => {
    if (!meshRef.current) return;
    particles.forEach((p, i) => {
      meshRef.current.setColorAt(i, p.color);
    });
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [particles]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const speed = config.speed;
    const dt = Math.min(delta, 0.05);

    particles.forEach((p, i) => {
      p.phase += p.twinkleSpeed * speed * dt;
      const twinkle = Math.sin(p.phase) * 0.5 + 0.5;
      const s = p.scale * (0.3 + twinkle * 0.7);

      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <circleGeometry args={[1, 4]} />
      <meshBasicMaterial
        transparent
        opacity={config.opacity}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

function ParticleScene({ config, count }: { config: ParticleConfig; count: number }) {
  switch (config.type) {
    case "sakura":
      return <SakuraParticles config={config} count={count} />;
    case "firefly":
      return <FireflyParticles config={config} count={count} />;
    case "snow":
      return <SnowParticles config={config} count={count} />;
    case "stars":
      return <StarsParticles config={config} count={count} />;
    default:
      return null;
  }
}

export default function ParticleBackground({ config }: { config: ParticleConfig }) {
  const reducedMotion = useUIStore((s) => s.reducedMotion);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  if (reducedMotion || config.type === "none") return null;

  const count = mapDensity(config.density, isMobile);

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden
    >
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
        style={{ background: "transparent" }}
      >
        <ParticleScene config={config} count={count} />
      </Canvas>
    </div>
  );
}
