import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface CameraControl3DProps {
  value: { azimuth: number; elevation: number; distance: number };
  onChange: (value: { azimuth: number; elevation: number; distance: number }) => void;
  imageUrl: string | null;
}

const AZIMUTH_STEPS = [0, 45, 90, 135, 180, 225, 270, 315];
const ELEVATION_STEPS = [-30, 0, 30, 60];
const DISTANCE_STEPS = [0.6, 1.0, 1.4];

const AZIMUTH_NAMES: Record<number, string> = {
  0: 'front view', 45: 'front-right quarter view', 90: 'right side view',
  135: 'back-right quarter view', 180: 'back view', 225: 'back-left quarter view',
  270: 'left side view', 315: 'front-left quarter view'
};
const ELEVATION_NAMES: Record<string, string> = { '-30': 'low-angle shot', '0': 'eye-level shot', '30': 'elevated shot', '60': 'high-angle shot' };
const DISTANCE_NAMES: Record<string, string> = { '0.6': 'close-up', '1': 'medium shot', '1.4': 'wide shot' };

function snapToNearest(value: number, steps: number[]) {
  return steps.reduce((prev, curr) => Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev);
}

export const CameraControl3D: React.FC<CameraControl3DProps> = ({ value, onChange, imageUrl }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const planeMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const targetPlaneRef = useRef<THREE.Mesh | null>(null);
  const cameraGroupRef = useRef<THREE.Group | null>(null);
  const azimuthHandleRef = useRef<THREE.Mesh | null>(null);
  const elevationHandleRef = useRef<THREE.Mesh | null>(null);
  const distanceHandleRef = useRef<THREE.Mesh | null>(null);
  const distanceLineRef = useRef<THREE.Line | null>(null);
  const promptOverlayRef = useRef<HTMLDivElement>(null);
  const latestValueRef = useRef(value);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
    camera.position.set(4.5, 3, 4.5);
    camera.lookAt(0, 0.75, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    // Grid
    scene.add(new THREE.GridHelper(8, 16, 0x333333, 0x222222));

    const CENTER = new THREE.Vector3(0, 0.75, 0);
    const BASE_DISTANCE = 1.6;
    const AZIMUTH_RADIUS = 2.4;
    const ELEVATION_RADIUS = 1.8;

    // Placeholder texture
    const createPlaceholderTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#ffcc99';
      ctx.beginPath();
      ctx.arc(128, 128, 80, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(100, 110, 10, 0, Math.PI * 2);
      ctx.arc(156, 110, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(128, 130, 35, 0.2, Math.PI - 0.2);
      ctx.stroke();
      return new THREE.CanvasTexture(canvas);
    };

    const planeMaterial = new THREE.MeshBasicMaterial({ map: createPlaceholderTexture(), side: THREE.DoubleSide });
    planeMaterialRef.current = planeMaterial;
    const targetPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), planeMaterial);
    targetPlane.position.copy(CENTER);
    scene.add(targetPlane);
    targetPlaneRef.current = targetPlane;

    // Camera model
    const cameraGroup = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6699cc, metalness: 0.5, roughness: 0.3 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.38), bodyMat);
    cameraGroup.add(body);
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.11, 0.18, 16),
      new THREE.MeshStandardMaterial({ color: 0x6699cc, metalness: 0.5, roughness: 0.3 })
    );
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 0.26;
    cameraGroup.add(lens);
    scene.add(cameraGroup);
    cameraGroupRef.current = cameraGroup;

    // Azimuth ring
    const azimuthRing = new THREE.Mesh(
      new THREE.TorusGeometry(AZIMUTH_RADIUS, 0.04, 16, 64),
      new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 0.3 })
    );
    azimuthRing.rotation.x = Math.PI / 2;
    azimuthRing.position.y = 0.05;
    scene.add(azimuthRing);

    const azimuthHandle = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 0.5 })
    );
    azimuthHandle.userData.type = 'azimuth';
    scene.add(azimuthHandle);
    azimuthHandleRef.current = azimuthHandle;

    // Elevation arc
    const arcPoints = [];
    for (let i = 0; i <= 32; i++) {
      const angle = THREE.MathUtils.degToRad(-30 + (90 * i / 32));
      arcPoints.push(new THREE.Vector3(-0.8, ELEVATION_RADIUS * Math.sin(angle) + CENTER.y, ELEVATION_RADIUS * Math.cos(angle)));
    }
    const arcCurve = new THREE.CatmullRomCurve3(arcPoints);
    const elevationArc = new THREE.Mesh(
      new THREE.TubeGeometry(arcCurve, 32, 0.04, 8, false),
      new THREE.MeshStandardMaterial({ color: 0xff69b4, emissive: 0xff69b4, emissiveIntensity: 0.3 })
    );
    scene.add(elevationArc);

    const elevationHandle = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xff69b4, emissive: 0xff69b4, emissiveIntensity: 0.5 })
    );
    elevationHandle.userData.type = 'elevation';
    scene.add(elevationHandle);
    elevationHandleRef.current = elevationHandle;

    // Distance line & handle
    const distanceLineGeo = new THREE.BufferGeometry();
    const distanceLine = new THREE.Line(distanceLineGeo, new THREE.LineBasicMaterial({ color: 0xffa500 }));
    scene.add(distanceLine);
    distanceLineRef.current = distanceLine;

    const distanceHandle = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xffa500, emissive: 0xffa500, emissiveIntensity: 0.5 })
    );
    distanceHandle.userData.type = 'distance';
    scene.add(distanceHandle);
    distanceHandleRef.current = distanceHandle;

    // Interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isDragging = false;
    let dragTarget: THREE.Object3D | null = null;
    let dragStartMouse = new THREE.Vector2();
    let dragStartDistance = 1.0;
    const intersection = new THREE.Vector3();

    const updatePositions = (az: number, el: number, dist: number) => {
      const distance = BASE_DISTANCE * dist;
      const azRad = THREE.MathUtils.degToRad(az);
      const elRad = THREE.MathUtils.degToRad(el);

      const camX = distance * Math.sin(azRad) * Math.cos(elRad);
      const camY = distance * Math.sin(elRad) + CENTER.y;
      const camZ = distance * Math.cos(azRad) * Math.cos(elRad);

      if (cameraGroup) {
        cameraGroup.position.set(camX, camY, camZ);
        cameraGroup.lookAt(CENTER);
      }

      if (azimuthHandle) {
        azimuthHandle.position.set(AZIMUTH_RADIUS * Math.sin(azRad), 0.05, AZIMUTH_RADIUS * Math.cos(azRad));
      }
      
      if (elevationHandle) {
        elevationHandle.position.set(-0.8, ELEVATION_RADIUS * Math.sin(elRad) + CENTER.y, ELEVATION_RADIUS * Math.cos(elRad));
      }

      const orangeDist = distance - 0.5;
      if (distanceHandle) {
        distanceHandle.position.set(
          orangeDist * Math.sin(azRad) * Math.cos(elRad),
          orangeDist * Math.sin(elRad) + CENTER.y,
          orangeDist * Math.cos(azRad) * Math.cos(elRad)
        );
      }
      
      if (distanceLineGeo) {
        distanceLineGeo.setFromPoints([cameraGroup.position.clone(), CENTER.clone()]);
      }

      // Update prompt preview
      const azSnap = snapToNearest(az, AZIMUTH_STEPS);
      const elSnap = snapToNearest(el, ELEVATION_STEPS);
      const distSnap = snapToNearest(dist, DISTANCE_STEPS);
      const distKey = distSnap === 1 ? '1.0' : distSnap.toFixed(1);
      setPrompt(`<sks> ${AZIMUTH_NAMES[azSnap]} ${ELEVATION_NAMES[String(elSnap)]} ${DISTANCE_NAMES[distKey]}`);
    };

    const handleMouseDown = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects([azimuthHandle, elevationHandle, distanceHandle]);

      if (intersects.length > 0) {
        isDragging = true;
        dragTarget = intersects[0].object;
        (dragTarget as any).material.emissiveIntensity = 1.0;
        dragTarget.scale.setScalar(1.3);
        dragStartMouse.copy(mouse);
        // Use a ref or a way to get the latest value without closure issues
        dragStartDistance = latestValueRef.current.distance;
        renderer.domElement.style.cursor = 'grabbing';
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDragging && dragTarget) {
        raycaster.setFromCamera(mouse, camera);

        if (dragTarget.userData.type === 'azimuth') {
          const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.05);
          if (raycaster.ray.intersectPlane(plane, intersection)) {
            let az = THREE.MathUtils.radToDeg(Math.atan2(intersection.x, intersection.z));
            if (az < 0) az += 360;
            onChange({ ...latestValueRef.current, azimuth: az });
          }
        } else if (dragTarget.userData.type === 'elevation') {
          const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -0.8);
          if (raycaster.ray.intersectPlane(plane, intersection)) {
            const relY = intersection.y - CENTER.y;
            const relZ = intersection.z;
            let el = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(Math.atan2(relY, relZ)), -30, 60);
            onChange({ ...latestValueRef.current, elevation: el });
          }
        } else if (dragTarget.userData.type === 'distance') {
          const deltaY = mouse.y - dragStartMouse.y;
          let dist = THREE.MathUtils.clamp(dragStartDistance - deltaY * 1.5, 0.6, 1.4);
          onChange({ ...latestValueRef.current, distance: dist });
        }
      } else {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects([azimuthHandle, elevationHandle, distanceHandle]);
        [azimuthHandle, elevationHandle, distanceHandle].forEach(h => {
          (h.material as any).emissiveIntensity = 0.5;
          h.scale.setScalar(1);
        });
        if (intersects.length > 0) {
          (intersects[0].object as any).material.emissiveIntensity = 0.8;
          intersects[0].object.scale.setScalar(1.1);
          renderer.domElement.style.cursor = 'grab';
        } else {
          renderer.domElement.style.cursor = 'default';
        }
      }
    };

    const handleMouseUp = () => {
      if (dragTarget) {
        (dragTarget as any).material.emissiveIntensity = 0.5;
        dragTarget.scale.setScalar(1);
        
        // Snap
        const targetAz = snapToNearest(latestValueRef.current.azimuth, AZIMUTH_STEPS);
        const targetEl = snapToNearest(latestValueRef.current.elevation, ELEVATION_STEPS);
        const targetDist = snapToNearest(latestValueRef.current.distance, DISTANCE_STEPS);
        
        onChange({ azimuth: targetAz, elevation: targetEl, distance: targetDist });
      }
      isDragging = false;
      dragTarget = null;
      renderer.domElement.style.cursor = 'default';
    };

    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Initial position
    updatePositions(value.azimuth, value.elevation, value.distance);

    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      renderer.dispose();
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Sync Three.js with React state
  useEffect(() => {
    const distance = 1.6 * value.distance;
    const azRad = THREE.MathUtils.degToRad(value.azimuth);
    const elRad = THREE.MathUtils.degToRad(value.elevation);
    const CENTER = new THREE.Vector3(0, 0.75, 0);

    if (cameraGroupRef.current) {
      const camX = distance * Math.sin(azRad) * Math.cos(elRad);
      const camY = distance * Math.sin(elRad) + CENTER.y;
      const camZ = distance * Math.cos(azRad) * Math.cos(elRad);
      cameraGroupRef.current.position.set(camX, camY, camZ);
      cameraGroupRef.current.lookAt(CENTER);
    }

    if (azimuthHandleRef.current) {
      azimuthHandleRef.current.position.set(2.4 * Math.sin(azRad), 0.05, 2.4 * Math.cos(azRad));
    }

    if (elevationHandleRef.current) {
      elevationHandleRef.current.position.set(-0.8, 1.8 * Math.sin(elRad) + CENTER.y, 1.8 * Math.cos(elRad));
    }

    if (distanceHandleRef.current) {
      const orangeDist = distance - 0.5;
      distanceHandleRef.current.position.set(
        orangeDist * Math.sin(azRad) * Math.cos(elRad),
        orangeDist * Math.sin(elRad) + CENTER.y,
        orangeDist * Math.cos(azRad) * Math.cos(elRad)
      );
    }

    if (distanceLineRef.current && cameraGroupRef.current) {
      distanceLineRef.current.geometry.setFromPoints([cameraGroupRef.current.position.clone(), CENTER.clone()]);
    }

    const azSnap = snapToNearest(value.azimuth, AZIMUTH_STEPS);
    const elSnap = snapToNearest(value.elevation, ELEVATION_STEPS);
    const distSnap = snapToNearest(value.distance, DISTANCE_STEPS);
    const distKey = distSnap === 1 ? '1.0' : distSnap.toFixed(1);
    setPrompt(`<sks> ${AZIMUTH_NAMES[azSnap]} ${ELEVATION_NAMES[String(elSnap)]} ${DISTANCE_NAMES[distKey]}`);

  }, [value]);

  // Update texture when imageUrl changes
  useEffect(() => {
    if (!planeMaterialRef.current || !sceneRef.current || !targetPlaneRef.current) return;

    const CENTER = new THREE.Vector3(0, 0.75, 0);

    if (!imageUrl) {
      // Reset to placeholder logic here if needed, but for now just keep current or clear
      return;
    }

    const loader = new THREE.TextureLoader();
    loader.load(imageUrl, (texture) => {
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      planeMaterialRef.current!.map = texture;
      planeMaterialRef.current!.needsUpdate = true;

      const img = texture.image;
      if (img && img.width && img.height) {
        const aspect = img.width / img.height;
        const maxSize = 1.5;
        let planeWidth, planeHeight;
        if (aspect > 1) {
          planeWidth = maxSize;
          planeHeight = maxSize / aspect;
        } else {
          planeHeight = maxSize;
          planeWidth = maxSize * aspect;
        }
        sceneRef.current!.remove(targetPlaneRef.current!);
        const newPlane = new THREE.Mesh(
          new THREE.PlaneGeometry(planeWidth, planeHeight),
          planeMaterialRef.current!
        );
        newPlane.position.copy(CENTER);
        sceneRef.current!.add(newPlane);
        targetPlaneRef.current = newPlane;
      }
    });
  }, [imageUrl]);

  return (
    <div className="relative w-full h-[450px] bg-[#1a1a1a] rounded-xl overflow-hidden border border-white/10" ref={containerRef}>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-2 rounded-lg font-mono text-xs text-[#00ff88] whitespace-nowrap z-10 border border-[#00ff88]/20">
        {prompt}
      </div>
    </div>
  );
};
