'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { marbleParts, prepareFinishGeometry } from '@/lib/console-materials';

export type ConsoleView = 'hero' | 'front' | 'top' | 'rear' | 'inside';
type Props = { view: ConsoleView; resetKey?: number; dark?: boolean };

export default function ConsoleScene({ view, resetKey = 0, dark = false }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const controller = useRef<{ setView: (view: ConsoleView) => void } | null>(null);
  const activeView = useRef(view);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!container.current) return;
    const host = container.current;
    let disposed = false;
    let visible = true;
    let frame = 0;
    let renderer: THREE.WebGLRenderer | undefined;
    let controls: OrbitControls | undefined;
    let loadedModel: THREE.Group | undefined;
    let environment: THREE.WebGLRenderTarget | undefined;
    let room: RoomEnvironment | undefined;
    let marbleTexture: THREE.Texture | undefined;
    let resize: ResizeObserver | undefined;
    let observer: IntersectionObserver | undefined;
    const materials = new Set<THREE.Material>();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(31, 1, 0.05, 100);
    const goal = new THREE.Vector3(-5.8, 4.8, 8.2);
    let tweening = true;

    const keyboard = (event: KeyboardEvent) => {
      if (!controls || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      tweening = false;
      const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      if (event.key === 'ArrowLeft') spherical.theta -= 0.15;
      if (event.key === 'ArrowRight') spherical.theta += 0.15;
      if (event.key === 'ArrowUp') spherical.phi -= 0.12;
      if (event.key === 'ArrowDown') spherical.phi += 0.12;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.1, Math.PI / 2.02);
      camera.position.setFromSpherical(spherical).add(controls.target);
      controls.update();
    };

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = dark ? 1.4 : 1.05;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.setAttribute('aria-hidden', 'true');
      host.appendChild(renderer.domElement);

      const generator = new THREE.PMREMGenerator(renderer);
      room = new RoomEnvironment();
      environment = generator.fromScene(room, 0.04);
      scene.environment = environment.texture;
      generator.dispose();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x777069, 1.5));
      const keyLight = new THREE.DirectionalLight(0xfff6ec, 3.5);
      keyLight.position.set(-4, 7, 5);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      Object.assign(keyLight.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
      keyLight.shadow.normalBias = 0.02;
      keyLight.shadow.bias = -0.0002;
      scene.add(keyLight);
      const fill = new THREE.DirectionalLight(0xe9efff, 1.8);
      fill.position.set(5, 2, -3);
      scene.add(fill);
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: dark ? 0 : 0.14 }));
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = -0.78;
      shadow.receiveShadow = true;
      scene.add(shadow);
      materials.add(shadow.material);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.minPolarAngle = 0.1;
      controls.maxPolarAngle = Math.PI / 2.02;
      controls.rotateSpeed = 0.55;
      renderer.domElement.style.touchAction = 'pan-y';
      controls.touches.ONE = null as unknown as THREE.TOUCH;
      controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
      controls.addEventListener('start', () => { tweening = false; });

      const beige = new THREE.MeshPhysicalMaterial({ color: '#d8cbb4', roughness: 0.49, metalness: 0, clearcoat: 0.1, clearcoatRoughness: 0.6 });
      const black = new THREE.MeshPhysicalMaterial({ color: '#141416', roughness: 0.42, metalness: 0.1 });
      const marble = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.25, metalness: 0, clearcoat: 0.65, clearcoatRoughness: 0.18 });
      materials.add(beige); materials.add(black); materials.add(marble);
      marbleTexture = new THREE.TextureLoader().load('/textures/bordeaux-marble.png', texture => {
        if (disposed) { texture.dispose(); return; }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.anisotropy = Math.min(renderer!.capabilities.getMaxAnisotropy(), 8);
        marble.map = texture;
        marble.needsUpdate = true;
      }, undefined, () => { marble.color.set('#581b29'); });

      function applyView(nextView: ConsoleView, snap = false) {
        const wide = host.clientWidth < 600 ? 1.12 : 1;
        const poses: Record<ConsoleView, [number, number, number]> = {
          hero: [-5.8 * wide, 4.8 * wide, 8.2 * wide],
          front: [-1.6 * wide, 2.8 * wide, 10 * wide],
          top: [0.1, 11.3 * wide, 0.3],
          rear: [5.5 * wide, 4.6 * wide, -8 * wide],
          inside: [-4.8 * wide, 7.3 * wide, 7.4 * wide],
        };
        goal.set(...poses[nextView]).multiplyScalar(0.76);
        tweening = true;
        if (snap) camera.position.copy(goal);
        if (loadedModel) loadedModel.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          if (object.name === 'top_shell' || marbleParts.has(object.name) || /button_retainer|contact_tip|LED_spacer|controls_M2|controls_retainer/.test(object.name)) object.visible = nextView !== 'inside';
          if (object.name === 'FPGA_package_envelope') object.visible = nextView === 'inside';
        });
      }
      controller.current = { setView: v => applyView(v) };
      applyView(activeView.current, true);

      new GLTFLoader().load('/models/sgbc-revc.glb', gltf => {
        if (disposed) {
          gltf.scene.traverse(obj => { if (obj instanceof THREE.Mesh) { obj.geometry.dispose(); (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => m.dispose()); } });
          return;
        }
        loadedModel = gltf.scene;
        loadedModel.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          prepareFinishGeometry(object);
          const old = Array.isArray(object.material) ? object.material : [object.material];
          old.forEach(m => materials.add(m));
          if (object.name === 'top_shell') object.material = beige;
          else if (object.name === 'bottom_shell' || object.name.startsWith('foot_')) object.material = black;
          else if (marbleParts.has(object.name)) {
            object.material = marble;
          }
          object.castShadow = true;
          object.receiveShadow = true;
        });
        const bounds = new THREE.Box3().setFromObject(loadedModel);
        const center = bounds.getCenter(new THREE.Vector3());
        const scale = 4.85 / bounds.getSize(new THREE.Vector3()).x;
        loadedModel.scale.multiplyScalar(scale);
        loadedModel.position.sub(center.multiplyScalar(scale));
        shadow.position.y = new THREE.Box3().setFromObject(loadedModel).min.y - 0.025;
        scene.add(loadedModel);
        applyView(activeView.current, true);
        setStatus('ready');
      }, undefined, () => { if (!disposed) setStatus('error'); });

      resize = new ResizeObserver(() => {
        const width = host.clientWidth; const height = host.clientHeight;
        if (!width || !height || !renderer) return;
        camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height);
      });
      resize.observe(host);
      observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }, { rootMargin: '100px' });
      observer.observe(host);
      host.addEventListener('keydown', keyboard);
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      const animate = () => {
        if (disposed) return;
        frame = requestAnimationFrame(animate);
        if (!visible || document.hidden || !renderer || !controls) return;
        if (tweening) {
          camera.position.lerp(goal, reducedMotion.matches ? 1 : 0.065);
          if (camera.position.distanceTo(goal) < 0.005) tweening = false;
        }
        controls.update(); renderer.render(scene, camera);
      };
      animate();
    } catch { setStatus('error'); }

    return () => {
      disposed = true; controller.current = null; cancelAnimationFrame(frame);
      resize?.disconnect(); observer?.disconnect(); host.removeEventListener('keydown', keyboard);
      controls?.dispose();
      scene.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
      materials.forEach(material => material.dispose());
      marbleTexture?.dispose(); environment?.dispose(); room?.dispose();
      renderer?.dispose(); renderer?.domElement.remove();
    };
  }, [dark, retry]);

  useEffect(() => { activeView.current = view; controller.current?.setView(view); }, [view, resetKey]);

  return <div className={`console-canvas ${status === 'ready' ? 'is-ready' : ''}`} ref={container} tabIndex={0} role="group" aria-label="Interactive SGBC console: beige top, black base, Bordeaux marble buttons and trim. Drag with a mouse, use two fingers on touch, or arrow keys to rotate.">
    {status === 'loading' && <div className="model-status" role="status"><span className="model-spinner"/><span>Bringing the details into view</span></div>}
    {status === 'error' && <div className="model-status model-error"><strong>Meet SGBC.</strong><p>The 3D view couldn’t load. You can explore the console details below.</p><button onClick={() => { setStatus('loading'); setRetry(r => r + 1); }}>Try again</button></div>}
  </div>;
}
