'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { bordeauxParts, prepareFinishGeometry } from '@/lib/console-materials';
import { setCutawayVisibility } from '@/lib/console-assembly';
import consoleMetadata from '@/public/models/rear-port-fit.json';
import pcbMetadata from '@/public/models/pcb-revision.json';
import { siteCopy, type Locale } from '@/lib/site-copy';

const modelRevision = consoleMetadata.model_sha256;
const pcbRevision = pcbMetadata.sha256;

export type ConsoleView = 'hero' | 'front' | 'top' | 'rear' | 'inside' | 'bottom';
type Props = { view: ConsoleView; resetKey?: number; dark?: boolean; model?: 'console' | 'pcb'; interaction?: 'orbit' | 'cursor'; locale?: Locale };

export default function ConsoleScene({ view, resetKey = 0, dark = false, model = 'console', interaction = 'orbit', locale = 'en' }: Props) {
  const copy = siteCopy[locale].viewer;
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
    let needsRender = true;
    let renderer: THREE.WebGLRenderer | undefined;
    let controls: OrbitControls | undefined;
    let loadedModel: THREE.Group | undefined;
    let framingBounds: THREE.Box3 | undefined;
    let environment: THREE.WebGLRenderTarget | undefined;
    let room: RoomEnvironment | undefined;
    let resize: ResizeObserver | undefined;
    let observer: IntersectionObserver | undefined;
    const materials = new Set<THREE.Material>();
    const scene = new THREE.Scene();
    const modelPivot = new THREE.Group();
    scene.add(modelPivot);
    const camera = new THREE.PerspectiveCamera(31, 1, 0.05, 100);
    const goal = new THREE.Vector3(-5.8, 4.8, 8.2);
    let tweening = true;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const desktopPointer = window.matchMedia('(min-width: 761px) and (hover: hover) and (pointer: fine)');
    const pointerSurface = host.closest<HTMLElement>('[data-console-tilt]') ?? host;
    const tiltTarget = new THREE.Vector2();
    const dragTarget = new THREE.Vector2();
    const dragStart = new THREE.Vector2();
    const dragOrigin = new THREE.Vector2();
    const heldKeys = new Set<string>();
    let dragPointer: number | null = null;
    let touchDrag = false;
    let touchDirection: 'pending' | 'rotate' | 'scroll' = 'pending';
    let scrollDirty = true;
    let scrollProgress = 0;
    let lastFrameTime = performance.now();
    const markScrollDirty = () => { scrollDirty = true; };
    const resetTilt = () => { tiltTarget.set(0, 0); };
    const moveTilt = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || reducedMotion.matches || !desktopPointer.matches) return;
      const bounds = pointerSurface.getBoundingClientRect();
      // Captured drag events can arrive after the cursor has left the hero.
      if (!bounds.width || !bounds.height || event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
        resetTilt();
        return;
      }
      tiltTarget.set(
        (event.clientX - bounds.left) / bounds.width * 2 - 1,
        (event.clientY - bounds.top) / bounds.height * 2 - 1,
      );
    };
    const resetDrag = () => {
      const pointer = dragPointer;
      dragPointer = null; heldKeys.clear(); dragTarget.set(0, 0);
      host.classList.remove('is-dragging');
      if (pointer !== null && renderer?.domElement.hasPointerCapture(pointer)) renderer.domElement.releasePointerCapture(pointer);
    };
    const resetMotion = () => { resetDrag(); resetTilt(); markScrollDirty(); };
    const beginDrag = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0 || dragPointer !== null || !loadedModel || !renderer) return;
      dragPointer = event.pointerId;
      touchDrag = event.pointerType === 'touch';
      touchDirection = 'pending'; heldKeys.clear();
      dragStart.set(event.clientX, event.clientY);
      const progress = reducedMotion.matches ? 0 : scrollProgress;
      // Pick up the visible pose if the previous release is still settling.
      dragOrigin.set(modelPivot.rotation.x - progress * 0.08, modelPivot.rotation.y - progress * 1.2);
      dragTarget.copy(dragOrigin);
      renderer.domElement.setPointerCapture(event.pointerId);
      host.classList.add('is-dragging');
    };
    const moveDrag = (event: PointerEvent) => {
      if (event.pointerId !== dragPointer || !renderer) return;
      const dx = event.clientX - dragStart.x, dy = event.clientY - dragStart.y;
      if (touchDrag && touchDirection === 'pending') {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
        touchDirection = Math.abs(dx) > Math.abs(dy) ? 'rotate' : 'scroll';
      }
      if (touchDrag && touchDirection === 'scroll') return;
      const bounds = renderer.domElement.getBoundingClientRect();
      dragTarget.set(
        THREE.MathUtils.clamp(dragOrigin.x + dy / Math.max(bounds.height, 1) * 1.8, -0.65, 0.65),
        THREE.MathUtils.clamp(dragOrigin.y + dx / Math.max(bounds.width, 1) * Math.PI * 2, -Math.PI * 2, Math.PI * 2),
      );
    };
    const endDrag = (event: PointerEvent) => { if (event.pointerId === dragPointer) resetDrag(); };
    const heroKeyDown = (event: KeyboardEvent) => {
      if (event.target !== host || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Escape') { resetDrag(); return; }
      heldKeys.add(event.key);
      if (event.key === 'ArrowLeft') dragTarget.y -= 0.22;
      if (event.key === 'ArrowRight') dragTarget.y += 0.22;
      if (event.key === 'ArrowUp') dragTarget.x = Math.max(-0.65, dragTarget.x - 0.12);
      if (event.key === 'ArrowDown') dragTarget.x = Math.min(0.65, dragTarget.x + 0.12);
      dragTarget.y = THREE.MathUtils.clamp(dragTarget.y, -Math.PI * 2, Math.PI * 2);
    };
    const heroKeyUp = (event: KeyboardEvent) => { if (heldKeys.delete(event.key) && heldKeys.size === 0) resetDrag(); };
    const visibilityChange = () => { if (document.hidden) resetMotion(); };

    const keyboard = (event: KeyboardEvent) => {
      if (!controls || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      tweening = false;
      const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      if (event.key === 'ArrowLeft') spherical.theta -= 0.15;
      if (event.key === 'ArrowRight') spherical.theta += 0.15;
      if (event.key === 'ArrowUp') spherical.phi -= 0.12;
      if (event.key === 'ArrowDown') spherical.phi += 0.12;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.1, model === 'pcb' ? Math.PI - 0.1 : Math.PI / 2.02);
      camera.position.setFromSpherical(spherical).add(controls.target);
      controls.update();
    };

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = dark ? 0.8 : 1.05;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.shadowMap.autoUpdate = false;
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

      if (interaction === 'orbit') {
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.07;
        controls.enableZoom = false;
        controls.enablePan = false;
        controls.minPolarAngle = 0.1;
        controls.maxPolarAngle = model === 'pcb' ? Math.PI - 0.1 : Math.PI / 2.02;
        controls.rotateSpeed = 0.55;
        renderer.domElement.style.touchAction = 'none';
        controls.touches.ONE = THREE.TOUCH.ROTATE;
        controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
        controls.addEventListener('start', () => { tweening = false; });
        controls.addEventListener('change', () => { needsRender = true; });
      } else {
        pointerSurface.addEventListener('pointermove', moveTilt, { passive: true });
        pointerSurface.addEventListener('pointerleave', resetTilt);
        renderer.domElement.addEventListener('pointerdown', beginDrag);
        renderer.domElement.addEventListener('pointermove', moveDrag, { passive: true });
        renderer.domElement.addEventListener('pointerup', endDrag);
        renderer.domElement.addEventListener('pointercancel', endDrag);
        renderer.domElement.addEventListener('lostpointercapture', endDrag);
        host.addEventListener('keydown', heroKeyDown);
        host.addEventListener('keyup', heroKeyUp);
        host.addEventListener('blur', resetDrag);
        window.addEventListener('blur', resetMotion);
        document.addEventListener('visibilitychange', visibilityChange);
        window.addEventListener('scroll', markScrollDirty, { passive: true });
        window.addEventListener('resize', markScrollDirty, { passive: true });
        reducedMotion.addEventListener('change', resetMotion);
        desktopPointer.addEventListener('change', resetMotion);
      }

      const shell = new THREE.MeshPhysicalMaterial({ color: '#98988f', roughness: 0.49, metalness: 0, clearcoat: 0.1, clearcoatRoughness: 0.6 });
      const black = new THREE.MeshPhysicalMaterial({ color: '#141416', roughness: 0.42, metalness: 0.1 });
      const bordeaux = new THREE.MeshPhysicalMaterial({ color: '#592330', roughness: 0.38, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.35 });
      materials.add(shell); materials.add(black); materials.add(bordeaux);

      function applyView(nextView: ConsoleView, snap = false) {
        needsRender = true;
        if (renderer) renderer.shadowMap.needsUpdate = true;
        const wide = host.clientWidth < 600 ? 1.12 : 1;
        const poses: Record<ConsoleView, [number, number, number]> = {
          hero: [-5.8 * wide, 4.8 * wide, 8.2 * wide],
          front: [-1.6 * wide, 2.8 * wide, 10 * wide],
          top: [0.1, 11.3 * wide, 0.3],
          rear: [5.5 * wide, 4.6 * wide, -8 * wide],
          inside: [-4.8 * wide, 7.3 * wide, 7.4 * wide],
          bottom: [0.1, -11.3 * wide, 0.3],
        };
        goal.set(...poses[nextView]).multiplyScalar(0.76);
        // Fit the actual model, including narrow phone viewports.
        if (framingBounds && host.clientHeight && host.clientWidth) {
          const box = framingBounds;
          const direction = goal.clone().normalize();
          const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
          const up = new THREE.Vector3().crossVectors(direction, right);
          const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
          const tanH = tanV * host.clientWidth / host.clientHeight;
          let distance = 0;
          for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
            const corner = new THREE.Vector3(x, y, z);
            distance = Math.max(distance, Math.abs(corner.dot(right)) / tanH + corner.dot(direction), Math.abs(corner.dot(up)) / tanV + corner.dot(direction));
          }
          goal.copy(direction.multiplyScalar(distance * 1.18));
        }
        const constrained = new THREE.Spherical().setFromVector3(goal);
        constrained.phi = THREE.MathUtils.clamp(constrained.phi, 0.1, model === 'pcb' ? Math.PI - 0.1 : Math.PI / 2.02);
        goal.setFromSpherical(constrained);
        tweening = true;
        if (snap) camera.position.copy(goal);
        if (loadedModel) loadedModel.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          if (model === 'console') setCutawayVisibility(object, nextView === 'inside');
        });
      }
      controller.current = { setView: v => applyView(v) };
      applyView(activeView.current, true);

      const modelUrl = model === 'pcb' ? `/models/sgbc-revc-it6263.glb?v=${pcbRevision}` : `/models/sgbc-revc.glb?v=${modelRevision}`;
      new GLTFLoader().load(modelUrl, gltf => {
        if (disposed) {
          gltf.scene.traverse(obj => { if (obj instanceof THREE.Mesh) { obj.geometry.dispose(); (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => m.dispose()); } });
          return;
        }
        loadedModel = gltf.scene;
        loadedModel.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          if (model === 'console') prepareFinishGeometry(object);
          const old = Array.isArray(object.material) ? object.material : [object.material];
          old.forEach(m => materials.add(m));
          if (model === 'console' && (object.name === 'top_shell' || object.name === 'controls_lid_supports_cutaway' || object.name === 'cartridge_cradle_cutaway' || object.name === 'cartridge_socket_retainer')) object.material = shell;
          else if (model === 'console' && (object.name === 'bottom_shell' || object.name.startsWith('foot_'))) object.material = black;
          else if (model === 'console' && bordeauxParts.has(object.name)) {
            object.material = bordeaux;
          }
          object.castShadow = true;
          object.receiveShadow = true;
        });
        const bounds = new THREE.Box3().setFromObject(loadedModel);
        const center = bounds.getCenter(new THREE.Vector3());
        const scale = 4.85 / bounds.getSize(new THREE.Vector3()).x;
        loadedModel.scale.multiplyScalar(scale);
        loadedModel.position.sub(center.multiplyScalar(scale));
        // Fit the original pose before adding the model to the rotating pivot.
        // Hover, scroll and drag must not change the camera's fitting distance.
        framingBounds = new THREE.Box3().setFromObject(loadedModel);
        shadow.position.y = framingBounds.min.y - 0.025;
        modelPivot.add(loadedModel);
        applyView(activeView.current, true);
        setStatus('ready');
      }, undefined, () => { if (!disposed) setStatus('error'); });

      resize = new ResizeObserver(() => {
        resetMotion();
        const width = host.clientWidth; const height = host.clientHeight;
        if (!width || !height || !renderer) return;
        camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height);
        applyView(activeView.current, true);
      });
      resize.observe(host);
      observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; needsRender = true; }, { rootMargin: '100px' });
      observer.observe(host);
      if (interaction === 'orbit') host.addEventListener('keydown', keyboard);
      const animate = () => {
        if (disposed) return;
        frame = requestAnimationFrame(animate);
        const now = performance.now();
        const delta = Math.min((now - lastFrameTime) / 1000, 0.05);
        lastFrameTime = now;
        if (!visible || document.hidden || !renderer) return;
        if (interaction === 'cursor') {
          const scrollEnabled = !reducedMotion.matches;
          if (scrollEnabled && scrollDirty) {
            // Follow the hero through the viewport without intercepting touch scrolling.
            const bounds = pointerSurface.getBoundingClientRect();
            scrollProgress = THREE.MathUtils.clamp(-bounds.top / Math.max(bounds.height, 1), 0, 1);
            scrollDirty = false;
          }
          const active = dragPointer !== null || heldKeys.size > 0;
          // Keep tracking the cursor, but let manual rotation take over until release.
          const tiltEnabled = !active && !reducedMotion.matches && desktopPointer.matches;
          const targetX = (scrollEnabled ? scrollProgress * 0.08 : 0) + dragTarget.x + (tiltEnabled ? tiltTarget.y * 0.10 : 0);
          const targetY = (scrollEnabled ? scrollProgress * 1.2 : 0) + dragTarget.y + (tiltEnabled ? tiltTarget.x * 0.17 : 0);
          const amount = reducedMotion.matches ? 1 : 1 - Math.exp(-(active ? 18 : 7) * delta);
          if (Math.abs(modelPivot.rotation.x - targetX) + Math.abs(modelPivot.rotation.y - targetY) > 0.00001) {
            modelPivot.rotation.x = THREE.MathUtils.lerp(modelPivot.rotation.x, targetX, amount);
            modelPivot.rotation.y = THREE.MathUtils.lerp(modelPivot.rotation.y, targetY, amount);
            renderer.shadowMap.needsUpdate = true;
            needsRender = true;
          }
        }
        if (tweening) {
          needsRender = true;
          const amount = reducedMotion.matches ? 1 : 0.09;
          const current = new THREE.Spherical().setFromVector3(camera.position);
          const target = new THREE.Spherical().setFromVector3(goal);
          const angle = Math.atan2(Math.sin(target.theta - current.theta), Math.cos(target.theta - current.theta));
          current.theta += angle * amount;
          current.phi = THREE.MathUtils.lerp(current.phi, target.phi, amount);
          current.radius = THREE.MathUtils.lerp(current.radius, target.radius, amount);
          camera.position.setFromSpherical(current);
          if (camera.position.distanceTo(goal) < 0.005) tweening = false;
        }
        const changed = controls?.update() ?? false;
        if (!controls) camera.lookAt(0, 0, 0);
        if (needsRender || changed) {
          renderer.render(scene, camera);
          needsRender = false;
        }
      };
      animate();
    } catch { queueMicrotask(() => { if (!disposed) setStatus('error'); }); }

    return () => {
      disposed = true; controller.current = null; cancelAnimationFrame(frame);
      resize?.disconnect(); observer?.disconnect(); host.removeEventListener('keydown', keyboard);
      resetDrag();
      pointerSurface.removeEventListener('pointermove', moveTilt);
      pointerSurface.removeEventListener('pointerleave', resetTilt);
      renderer?.domElement.removeEventListener('pointerdown', beginDrag);
      renderer?.domElement.removeEventListener('pointermove', moveDrag);
      renderer?.domElement.removeEventListener('pointerup', endDrag);
      renderer?.domElement.removeEventListener('pointercancel', endDrag);
      renderer?.domElement.removeEventListener('lostpointercapture', endDrag);
      host.removeEventListener('keydown', heroKeyDown);
      host.removeEventListener('keyup', heroKeyUp);
      host.removeEventListener('blur', resetDrag);
      window.removeEventListener('blur', resetMotion);
      document.removeEventListener('visibilitychange', visibilityChange);
      window.removeEventListener('scroll', markScrollDirty);
      window.removeEventListener('resize', markScrollDirty);
      reducedMotion.removeEventListener('change', resetMotion);
      desktopPointer.removeEventListener('change', resetMotion);
      controls?.dispose();
      scene.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
      materials.forEach(material => material.dispose());
      environment?.dispose(); room?.dispose();
      renderer?.dispose(); renderer?.domElement.remove();
    };
  }, [dark, retry, model, interaction]);

  useEffect(() => { activeView.current = view; controller.current?.setView(view); }, [view, resetKey]);

  // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- This custom 3D widget handles arrow keys and needs keyboard focus.
  return <div className={`console-canvas ${interaction === 'cursor' ? 'console-canvas--cursor' : ''} ${status === 'ready' ? 'is-ready' : ''}`} ref={container} tabIndex={0} role="application" aria-label={interaction === 'orbit' ? copy[model] : copy.hero}>
    {status === 'loading' && <output className="model-status"><span className="model-spinner"/><span>{copy.loading}</span></output>}
    {status === 'error' && <div className="model-status model-error"><strong>{copy.errorTitle}</strong><p>{copy.error}</p><button onClick={() => { setStatus('loading'); setRetry(r => r + 1); }}>{copy.retry}</button></div>}
  </div>;
}
