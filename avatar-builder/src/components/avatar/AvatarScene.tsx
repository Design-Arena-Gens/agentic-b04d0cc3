"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Float,
  Html,
  OrbitControls,
} from "@react-three/drei";
import { Color, Group, MeshPhysicalMaterial, PlaneGeometry, Vector3 } from "three";
import { AvatarParameters, useAvatarStore } from "@/state/avatarStore";

type AvatarSceneProps = {
  avatarGroupRef: React.MutableRefObject<Group | null>;
};

type AvatarModelProps = {
  parameters: AvatarParameters;
  avatarGroupRef: React.MutableRefObject<Group | null>;
};

const lerp = (value: number, min: number, max: number) =>
  min + (max - min) * value;

const useClothGeometry = () => {
  const [clothGeometry] = useState(() => new PlaneGeometry(1.8, 2.2, 18, 24));
  const [basePositions] = useState(
    () =>
      Float32Array.from(
        clothGeometry.attributes.position.array as ArrayLike<number>,
      ),
  );

  useEffect(() => {
    return () => {
      clothGeometry.dispose();
    };
  }, [clothGeometry]);

  return { clothGeometry, basePositions };
};

const AvatarModel = ({ parameters, avatarGroupRef }: AvatarModelProps) => {
  const rootRef = useRef<Group>(null);
  const hairGroupRef = useRef<Group>(null);
  const { clothGeometry, basePositions } = useClothGeometry();

  useEffect(() => {
    avatarGroupRef.current = rootRef.current;
  }, [avatarGroupRef]);

  const skinMaterial = useMemo(() => {
    const mat = new MeshPhysicalMaterial({
      color: new Color(parameters.skin.tone),
      roughness: parameters.skin.roughness,
      metalness: 0.02,
      reflectivity: 0.45,
      clearcoat: parameters.skin.sheen * 0.6,
      clearcoatRoughness: 0.3,
    });
    mat.sheen = parameters.skin.sheen;
    mat.sheenColor = new Color(parameters.skin.tone).offsetHSL(0, -0.05, 0.1);
    mat.transmission = parameters.skin.subsurface * 0.15;
    return mat;
  }, [parameters.skin]);

  useEffect(() => {
    return () => {
      skinMaterial.dispose();
    };
  }, [skinMaterial]);

  const headScale = useMemo<[number, number, number]>(
    () => [
      lerp(parameters.head.headWidth, 0.9, 1.2),
      lerp(parameters.head.headHeight, 0.9, 1.3),
      lerp(parameters.head.chinDefinition, 0.9, 1.1),
    ],
    [
      parameters.head.chinDefinition,
      parameters.head.headHeight,
      parameters.head.headWidth,
    ],
  );

  const hairHue = useMemo(() => new Color(parameters.hair.color), [parameters]);
  const secondaryHairColor = useMemo(
    () => new Color(parameters.hair.secondaryColor),
    [parameters.hair.secondaryColor],
  );

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();

    const windAmplitude = 0.15 + parameters.clothing.layering * 0.2;
    const hairFlex = 0.08 + parameters.hair.length * 0.18;
    const curliness = 0.4 + parameters.hair.curl * 0.9;

    if (hairGroupRef.current) {
      hairGroupRef.current.rotation.z =
        Math.sin(elapsed * (1.4 + curliness)) * hairFlex;
      hairGroupRef.current.rotation.x =
        Math.cos(elapsed * 1.2) * (hairFlex * 0.5);
    }

    if (basePositions.length) {
      const attr = clothGeometry.attributes.position;
      const array = attr.array as Float32Array;

      for (let i = 0; i < array.length; i += 3) {
        const baseX = basePositions[i];
        const baseY = basePositions[i + 1];
        const wave =
          Math.sin(baseY * 4 + elapsed * 2.1) * 0.02 +
          Math.cos(baseX * 4 + elapsed * 1.6) * 0.02;
        const dynamicOffset =
          Math.sin(elapsed * 3 + baseX * 2.3) *
          windAmplitude *
          (0.3 + parameters.clothing.fabricSheen);

        // eslint-disable-next-line react-hooks/immutability
        array[i + 2] = basePositions[i + 2] + wave + dynamicOffset;
      }

      attr.needsUpdate = true;
      clothGeometry.computeVertexNormals();
    }
  });

  const hairLayers = useMemo(() => {
    const layers = 6;
    return Array.from({ length: layers }).map((_, index) => {
      const t = index / layers;
      const radius = lerp(parameters.hair.volume, 0.4, 0.85) * (1 - t * 0.15);
      const height =
        lerp(parameters.hair.length, 0.4, 1.4) *
        (parameters.hair.style === "buzz" ? 0.3 : 1 - t * 0.1);
      return { radius, height, offset: t };
    });
  }, [parameters.hair]);

  return (
    <group
      ref={rootRef}
      position={[0, -0.6 + parameters.body.posture * 0.1, 0]}
      dispose={null}
    >
      <group position={[0, lerp(parameters.body.height, 1.4, 1.9), 0]}>
        <mesh castShadow position={[0, 0.35, 0]} scale={[1, 1.4, 0.8]}>
          <capsuleGeometry args={[0.38, lerp(parameters.body.height, 1.1, 1.6)]} />
          <meshPhysicalMaterial
            color={parameters.clothing.primaryColor}
            roughness={lerp(parameters.clothing.fabricSheen, 0.5, 0.9)}
            metalness={0.05}
            clearcoat={parameters.clothing.fabricSheen * 0.6}
            sheen={parameters.clothing.fabricSheen * 0.8}
            sheenColor={new Color(parameters.clothing.secondaryColor)}
          />
        </mesh>
      </group>

      <mesh
        castShadow
        position={[0, lerp(parameters.body.height, 1.5, 1.9), 0]}
        scale={headScale}
      >
        <sphereGeometry args={[0.4, 64, 64]} />
        <primitive object={skinMaterial} attach="material" />
      </mesh>

      <group position={[0, lerp(parameters.body.height, 1.65, 2.0), 0]}>
        <mesh position={[-lerp(parameters.facial.eyeSpacing, 0.16, 0.24), 0.03, 0.36]}>
          <sphereGeometry args={[lerp(parameters.facial.eyeSize, 0.06, 0.09), 32, 32]} />
          <meshPhysicalMaterial
            color="#1c1f25"
            reflectivity={0.95}
            roughness={0.18}
            clearcoat={0.9}
            transmission={0.12}
          />
        </mesh>
        <mesh position={[lerp(parameters.facial.eyeSpacing, 0.16, 0.24), 0.03, 0.36]}>
          <sphereGeometry args={[lerp(parameters.facial.eyeSize, 0.06, 0.09), 32, 32]} />
          <meshPhysicalMaterial
            color="#1c1f25"
            reflectivity={0.95}
            roughness={0.18}
            clearcoat={0.9}
            transmission={0.12}
          />
        </mesh>

        <mesh position={[0, -0.02, 0.42]} rotation={[Math.PI * 0.5, 0, 0]}>
          <cylinderGeometry
            args={[
              lerp(parameters.facial.noseWidth, 0.05, 0.12),
              lerp(parameters.facial.noseWidth, 0.03, 0.08),
              lerp(parameters.facial.noseLength, 0.28, 0.42),
              32,
            ]}
          />
          <primitive object={skinMaterial} attach="material" />
        </mesh>

        <mesh position={[0, -0.18, 0.33]} rotation={[0, 0, 0]}>
          <capsuleGeometry
            args={[
              lerp(parameters.facial.lipFullness, 0.04, 0.09),
              lerp(parameters.facial.lipFullness, 0.12, 0.25),
            ]}
          />
          <meshPhysicalMaterial
            color={new Color(parameters.skin.tone).offsetHSL(0.03, 0.12, 0.05)}
            roughness={0.3}
            clearcoat={0.4}
            sheen={0.4}
          />
        </mesh>

        <mesh position={[-0.4, 0.05, 0]} rotation={[0, Math.PI * 0.6, 0]}>
          <sphereGeometry
            args={[
              lerp(parameters.facial.earSize, 0.1, 0.16),
              32,
              32,
              0,
              Math.PI,
            ]}
          />
          <primitive object={skinMaterial} attach="material" />
        </mesh>
        <mesh position={[0.4, 0.05, 0]} rotation={[0, -Math.PI * 0.6, 0]}>
          <sphereGeometry
            args={[
              lerp(parameters.facial.earSize, 0.1, 0.16),
              32,
              32,
              0,
              Math.PI,
            ]}
          />
          <primitive object={skinMaterial} attach="material" />
        </mesh>
      </group>

      <group ref={hairGroupRef} position={[0, lerp(parameters.body.height, 1.74, 2.08), 0]}>
        {parameters.hair.style !== "buzz" ? (
          hairLayers.map((layer, index) => (
            <mesh
              key={`hair-${index}`}
              position={[0, (layer.offset - 0.5) * parameters.hair.length, 0]}
              scale={[layer.radius, layer.height, layer.radius]}
            >
              <sphereGeometry args={[0.4, 48, 48]} />
              <meshPhysicalMaterial
                color={hairHue.clone().lerp(secondaryHairColor, layer.offset * 0.6)}
                roughness={lerp(parameters.hair.curl, 0.2, 0.45)}
                metalness={0.05}
                clearcoat={0.7}
                clearcoatRoughness={0.25}
              />
            </mesh>
          ))
        ) : (
          <mesh scale={[0.95, 0.85, 0.95]}>
            <sphereGeometry args={[0.42, 48, 48]} />
            <meshPhysicalMaterial
              color={hairHue}
              roughness={0.35}
              metalness={0.02}
              clearcoat={0.5}
            />
          </mesh>
        )}
      </group>

      <Float
        floatingRange={[0.02, 0.06]}
        rotationIntensity={0.2}
        speed={1.2 + parameters.hair.volume * 0.5}
      >
        <mesh
          position={[0, lerp(parameters.body.height, 1.1, 1.35), 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          geometry={clothGeometry}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial
            color={parameters.clothing.secondaryColor}
            transparent
            opacity={0.95}
            roughness={lerp(parameters.clothing.fabricSheen, 0.25, 0.7)}
            metalness={0.1}
            clearcoat={0.6}
            sheen={0.6}
            sheenColor={new Color(parameters.clothing.primaryColor)}
          />
        </mesh>
      </Float>
    </group>
  );
};

export const AvatarScene = ({ avatarGroupRef }: AvatarSceneProps) => {
  const parameters = useAvatarStore((state) => state.parameters);

  return (
    <Canvas
      shadows
      camera={{ position: [0, 1.8, 4.1], fov: 32 }}
      dpr={[1, 2]}
      className="rounded-3xl bg-[#05060c]"
    >
      <color attach="background" args={["#05060c"]} />
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[4, 6, 3]}
        intensity={1.7}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-4, 3, -4]} intensity={0.35} />
      <Suspense
        fallback={
          <Html center>
            <div className="rounded-full border border-slate-700/50 bg-slate-900/60 px-4 py-2 text-sm text-slate-300">
              Loading renderer…
            </div>
          </Html>
        }
      >
        <AvatarModel parameters={parameters} avatarGroupRef={avatarGroupRef} />
        <Environment preset="warehouse" />
      </Suspense>
      <ContactShadows
        position={[0, -0.9, 0]}
        opacity={0.35}
        scale={10}
        blur={3.2}
        far={2}
      />
      <OrbitControls
        enablePan={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={(Math.PI / 2) * 1.15}
        minDistance={2.6}
        maxDistance={4.6}
        target={new Vector3(0, 1.4, 0)}
      />
    </Canvas>
  );
};
