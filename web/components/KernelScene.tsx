"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { addLabGeometry } from "./lab-geometry";
import { labDetails } from "@/lib/lab-details";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export type MachineLayer = "process" | "kernel" | "transport";
export type SceneView = "isometric" | "section";
type Props = {
  labId?: string;
  layer: MachineLayer;
  separation: number;
  view: SceneView;
  zoom: number;
  reset: number;
  observations: number;
  onSelect: (layer: MachineLayer) => void;
};

/** A conceptual model of event collection, never a simulation of measured traffic. */
export function KernelScene(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const update = useRef<((next: Props) => void) | null>(null);
  const latest = useRef(props);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => { latest.current = props; update.current?.(props); }, [props]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" }); }
    catch { queueMicrotask(() => setUnavailable(true)); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0xe9e9e2, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-6, 6, 6, -6, .1, 100);
    camera.position.set(9, 7, 10);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, .25, 0);
    controls.enableDamping = false;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.minPolarAngle = .25;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.update();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x7c8075, 3));
    const key = new THREE.DirectionalLight(0xffffff, 4);
    key.position.set(-5, 10, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
    key.shadow.normalBias = .03;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xc5d4dc, 2);
    fill.position.set(4, 3, -6); scene.add(fill);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: .13 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -2.05; ground.receiveShadow = true; scene.add(ground);
    const model = new THREE.Group(); scene.add(model);
    const groups: Record<MachineLayer, THREE.Group> = { process: new THREE.Group(), kernel: new THREE.Group(), transport: new THREE.Group() };
    const picks: THREE.Object3D[] = [];
    const highlights: Record<MachineLayer, THREE.MeshStandardMaterial> = {
      process: new THREE.MeshStandardMaterial({ color: 0xbec3b9, roughness: .55, metalness: .25 }),
      kernel: new THREE.MeshStandardMaterial({ color: 0xe65031, roughness: .5, metalness: .15 }),
      transport: new THREE.MeshStandardMaterial({ color: 0xadb7b0, roughness: .6, metalness: .2 }),
    };
    const dark = new THREE.MeshStandardMaterial({ color: 0x272e2c, roughness: .65, metalness: .35 });
    const darker = new THREE.MeshStandardMaterial({ color: 0x161d1c, roughness: .7, metalness: .25 });
    const pale = new THREE.MeshStandardMaterial({ color: 0xd4d6cd, roughness: .5, metalness: .35 });
    function box(group: THREE.Group, width: number, height: number, depth: number, x: number, y: number, z: number, material: THREE.Material) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
      mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
    }
    function line(group: THREE.Group, points: number[][], color = 0x77857a, opacity = .65) {
      const geometry = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p as [number, number, number])));
      group.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity })));
    }
    Object.entries(groups).forEach(([id, group]) => {
      model.add(group);
      const plate = box(group, 5.6, .16, 3.8, 0, 0, 0, dark);
      plate.userData.layer = id; picks.push(plate);
      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(plate.geometry), new THREE.LineBasicMaterial({ color: 0x79847e }));
      outline.position.copy(plate.position); group.add(outline);
      for (const x of [-2.5, 2.5]) for (const z of [-1.6, 1.6]) {
        const screw = new THREE.Mesh(new THREE.CylinderGeometry(.065, .065, .03, 12), pale);
        screw.position.set(x, .1, z); group.add(screw);
      }
      const strip = box(group, 5.3, .025, .028, 0, .095, 1.72, highlights[id as MachineLayer]);
      strip.userData.layer = id;
      for (let i = 0; i < 32; i++) box(group, .022, .035, .1, -2.45 + i * .158, .08, -1.86, pale);
    });
    if (!latest.current.labId || latest.current.labId === "01") {
    // Upper board: deliberately abstract process blocks and their lineage paths.
    for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) {
      const x = -2 + col; const z = -.95 + row * .94;
      const height = .16 + ((row * 7 + col * 3) % 5) * .105;
      const mesh = box(groups.process, .67, height, .56, x, .12 + height / 2, z, row === 1 && col === 2 ? highlights.process : darker);
      mesh.userData.layer = "process"; picks.push(mesh);
      box(groups.process, .46, .01, .018, x, .13 + height, z - .12, pale);
      for (let p = 0; p < 4; p++) box(groups.process, .012, .015, .06, x - .22 + p * .145, .12, z + .33, pale);
      if (col < 4) line(groups.process, [[x + .35, .1, z], [x + .5, .1, z], [x + .5, .1, 0], [x + 1, .1, 0]]);
    }
    // Kernel boundary: a probe package and circuit-like event paths.
    const chip = box(groups.kernel, 1.6, .3, 1.55, .15, .25, 0, darker);
    chip.userData.layer = "kernel"; picks.push(chip);
    box(groups.kernel, 1.37, .03, 1.3, .15, .42, 0, highlights.kernel);
    for (let i = 0; i < 11; i++) {
      const offset = -.55 + i * .13;
      box(groups.kernel, .025, .05, .23, .15 + offset, .16, -.89, pale);
      box(groups.kernel, .025, .05, .23, .15 + offset, .16, .89, pale);
      const dest = -2.3 + i * .45;
      line(groups.kernel, [[.15 + offset, .095, 1.02], [.15 + offset, .095, 1.2 + (i % 3) * .1], [dest, .095, 1.2 + (i % 3) * .1], [dest, .095, 1.65]], i === 5 ? 0xff6542 : 0x839181);
      line(groups.kernel, [[.15 + offset, .095, -1.02], [.15 + offset, .095, -1.16], [dest, .095, -1.5]]);
    }
    for (let i = 0; i < 3; i++) {
      box(groups.kernel, .55, .16, .5, -2, .17, -.9 + i * .85, dark);
      box(groups.kernel, .4, .12, .55, 2.12, .16, -.8 + i * .8, pale);
    }
    // Event transport: bounded ring-buffer model, not a physical kernel layout.
    const ringGeometry = new THREE.TorusGeometry(.92, .115, 12, 64);
    const ring = new THREE.Mesh(ringGeometry, highlights.transport); ring.rotation.x = Math.PI / 2; ring.position.set(-.65, .25, 0); groups.transport.add(ring);
    ring.userData.layer = "transport"; picks.push(ring);
    for (let i = 0; i < 4; i++) {
      box(groups.transport, 1.14, .14, .32, 1.6, .17, -.95 + i * .6, darker);
      line(groups.transport, [[.3, .1, 0], [.7, .1, 0], [.7, .1, -.95 + i * .6], [1.1, .1, -.95 + i * .6]]);
    }
    } else {
      addLabGeometry(latest.current.labId, groups, highlights);
      (Object.keys(groups) as MachineLayer[]).forEach(layer => groups[layer].traverse(object => { if (object instanceof THREE.Mesh) { object.userData.layer = layer; picks.push(object); } }));
    }
    const receipts = new THREE.Group(); groups.transport.add(receipts);
    for (let i = 0; i < 12; i++) {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(.11, 10, 10), new THREE.MeshStandardMaterial({ color: 0xef5637, roughness: .5 }));
      bead.position.set(-2.3 + i * .42, .24, 1.48); bead.visible = false; receipts.add(bead);
    }
    const probe = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 4.4, 8), new THREE.MeshStandardMaterial({ color: 0xf25736 }));
    probe.position.set(.15, .35, 0); model.add(probe);
    const render = () => renderer.render(scene, camera);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let disposed = false;
    let previousReset = -1;
    let previousView = "";
    function resize() {
      const width = element!.clientWidth; const height = element!.clientHeight;
      if (!width || !height) return;
      const aspect = width / height;
      const span = aspect < 1 ? 4.8 / aspect : 5.2;
      camera.left = -span * aspect; camera.right = span * aspect; camera.top = span; camera.bottom = -span;
      camera.updateProjectionMatrix(); renderer.setSize(width, height); render();
    }
    function apply(next: Props) {
      cancelAnimationFrame(frame);
      const gap = .4 + next.separation * .018;
      const destinations = { process: gap, kernel: 0, transport: -gap };
      (Object.keys(groups) as MachineLayer[]).forEach(id => {
        highlights[id].color.set(id === next.layer ? 0xee5836 : 0x9da99d);
      });
      receipts.children.forEach((receipt, index) => { receipt.visible = index < Math.min(next.observations, 12); });
      probe.visible = next.layer === "kernel";
      if (next.reset !== previousReset || next.view !== previousView) {
        camera.position.set(...(next.view === "section" ? [0, 3, 13] : [9, 7, 10]) as [number, number, number]);
        controls.target.set(0, .25, 0); controls.update();
        previousReset = next.reset; previousView = next.view;
      }
      camera.zoom = next.zoom; camera.updateProjectionMatrix();
      const animate = () => {
        if (disposed) return;
        let moving = false;
        (Object.keys(groups) as MachineLayer[]).forEach(id => {
          const distance = destinations[id] - groups[id].position.y;
          groups[id].position.y += reduced.matches ? distance : distance * .14;
          if (Math.abs(distance) > .003) moving = true;
        });
        render(); if (moving) frame = requestAnimationFrame(animate);
      };
      animate();
    }
    update.current = apply;
    const observer = new ResizeObserver(resize); observer.observe(element);
    controls.addEventListener("change", render);
    const raycaster = new THREE.Raycaster();
    let down = { x: 0, y: 0 };
    function pointerDown(event: PointerEvent) { down = { x: event.clientX, y: event.clientY }; }
    function pointerUp(event: PointerEvent) {
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
      const hit = raycaster.intersectObjects(picks)[0];
      if (hit?.object.userData.layer) latest.current.onSelect(hit.object.userData.layer);
    }
    function contextLost(event: Event) { event.preventDefault(); setUnavailable(true); }
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    resize(); apply(latest.current);
    return () => {
      disposed = true; update.current = null; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>();
      scene.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          geometries.add(object.geometry);
          (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
        }
      });
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
      renderer.dispose(); renderer.domElement.remove();
    };
  }, []);

  return <div className="kernel-render" ref={host} role="img" aria-label={`Interactive conceptual model: ${labDetails[props.labId ?? "01"].figure}. Use the layer and view buttons to inspect it.`}>
    {unavailable && <div className="scene-fallback"><span>SCHEMATIC VIEW</span><strong>{labDetails[props.labId ?? "01"].layers.process.name}</strong><b>↓</b><strong>{labDetails[props.labId ?? "01"].layers.kernel.name}</strong><b>↓</b><strong>{labDetails[props.labId ?? "01"].layers.transport.name}</strong><p>3D is unavailable on this device. Layer controls and the investigation remain usable.</p></div>}
  </div>;
}
