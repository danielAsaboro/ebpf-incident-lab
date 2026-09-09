import * as THREE from "three";
import type { MachineLayer } from "./KernelScene";

/** Subject-specific teaching geometry. No generated traffic or inferred measurements. */
export function addLabGeometry(id: string, groups: Record<MachineLayer, THREE.Group>, highlights: Record<MachineLayer, THREE.MeshStandardMaterial>) {
  const dark = new THREE.MeshStandardMaterial({ color: 0x172421, metalness: .3, roughness: .55 });
  const pale = new THREE.MeshStandardMaterial({ color: 0xc2cbbb, metalness: .3, roughness: .6 });
  function box(layer: MachineLayer, x: number, z: number, w: number, h: number, d: number, material: THREE.Material = dark, y = .12) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y + h / 2, z); mesh.castShadow = mesh.receiveShadow = true; mesh.userData.layer = layer; groups[layer].add(mesh); return mesh;
  }
  function path(layer: MachineLayer, points: number[][], material: THREE.Material = highlights[layer], radius = .035) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p as [number, number, number])), false, "catmullrom", .05);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, radius, 7, false), material); mesh.userData.layer = layer; mesh.castShadow = true; groups[layer].add(mesh);
  }
  function ring(layer: MachineLayer, x: number, z: number, radius: number, upright = false) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, .09, 10, 48), highlights[layer]); mesh.position.set(x, upright ? radius + .15 : .22, z); if (!upright) mesh.rotation.x = Math.PI / 2; mesh.userData.layer = layer; mesh.castShadow = true; groups[layer].add(mesh);
  }
  function record(layer: MachineLayer, x: number, z: number, w = .75) { box(layer, x, z, w, .18, .48, pale); for (let i = 0; i < 3; i++) box(layer, x, z - .13 + i * .12, w * .7, .012, .02, dark, .31); }
  if (id === "02") {
    for (let i = 0; i < 3; i++) { box("process", -1.6 + i * 1.6, 0, 1.05, .13, 1.45, pale); box("process", -1.6 + i * 1.6, -.65, .42, .15, .22, highlights.process); }
    for (const x of [-1.4, 1.4]) { box("kernel", x, -.55, .14, .85, .15, pale); box("kernel", x, .55, .14, .85, .15, pale); box("kernel", x, 0, .14, .14, 1.25, highlights.kernel, .9); }
    path("kernel", [[-2.2,.35,0],[-1.4,.35,0],[0,.7,.3],[1.4,.35,0],[2.2,.35,0]]);
    for (let i = 0; i < 3; i++) record("transport", -1.6 + i * 1.6, 0, 1.1);
  } else if (id === "03") {
    for (const x of [-1.8, 1.8]) { box("process", x, 0, 1.1, .55, 1.4); ring("process", x, .73, .33, true); }
    path("process", [[-1.25,.45,0],[-.7,.45,0],[-.4,.45,0]], pale);
    path("process", [[.4,.45,0],[.7,.45,0],[1.25,.45,0]], pale);
    box("kernel", 0, 0, .13, .95, 2.2, highlights.kernel); path("kernel", [[-2,.3,-.6],[-.5,.3,-.6],[-.3,.6,-.6]], pale); path("kernel", [[-2,.3,.6],[-.5,.3,.6],[-.5,.3,1.2],[-2,.3,1.2]]);
    record("transport", -1.3, 0, 1.5); record("transport", 1.3, 0, 1.5);
  } else if (id === "04") {
    ring("process", -1.65, 0, .58); ring("process", 1.65, 0, .58); path("process", [[-1,.3,0],[0,.3,0],[1,.3,0]], pale);
    for (let i = 0; i < 3; i++) { const length = .8 + i * 1.3; box("kernel", -2 + length/2, -.9 + i * .9, length, .14, .26, highlights.kernel); box("kernel", -2.2, -.9 + i*.9, .03, .55, .5, pale); box("kernel", 2.2, -.9 + i*.9, .03, .55, .5, pale); }
    for (let i = 0; i < 7; i++) box("transport", -2 + i * .65, 0, .35, .18 + i * .06, 1.2, i === 6 ? highlights.transport : pale);
  } else if (id === "05") {
    box("process", -2, 0, .65, .65, 1.5); box("process", 2, 0, .65, .65, 1.5);
    for (let i = 0; i < 3; i++) path("process", [[-1.7,.4,-.6+i*.6],[-.3,.4,-.6+i*.6],[.3,.4,-.6+i*.6],[1.7,.4,-.6+i*.6]], i===1 ? highlights.process : pale);
    for (let i = 0; i < 3; i++) path("kernel", [[-2,.2,-.8+i*.8],[-1,.2,-.8+i*.8],[0,.7,-.8+i*.8],[1,.2,-.8+i*.8],[2,.2,-.8+i*.8]], highlights.kernel, .055);
    for (let i = 0; i < 4; i++) { box("transport", -1.8+i*1.2, 0, .75, .15+i*.16, 1, pale); }
  } else if (id === "06") {
    for (let i = 0; i < 3; i++) { const w=4.3-i*1.25; const d=2.8-i*.7; const y=.25+i*.15; path("process", [[-w/2,y,-d/2],[w/2,y,-d/2],[w/2,y,d/2],[-w/2,y,d/2],[-w/2,y,-d/2]], i===2 ? highlights.process : pale, .055); }
    box("process", 0, 0, .6, .65, .6, highlights.process);
    for (const x of [-1.6,0,1.6]) { ring("kernel", x, 0, .45, true); }
    path("kernel", [[-2.2,.55,0],[-1,.55,0],[1,.55,0],[2.2,.55,0]], pale);
    record("transport", -1.1, 0, 1.4); record("transport", 1.1, 0, 1.4);
  } else {
    const nodes = [[-2,0],[-.8,-.9],[-.8,.9],[.7,-.9],[.7,.9],[2,0]];
    nodes.forEach(([x,z],i)=>box("process",x,z,.6,.25,.5,i===4? highlights.process:pale));
    for (const [a,b] of [[0,1],[0,2],[1,3],[2,4],[3,5],[4,5]]) path("process", [[nodes[a][0],.23,nodes[a][1]],[nodes[b][0],.23,nodes[b][1]]], pale, .025);
    for (const x of [-1.6,0,1.6]) { box("kernel",x,-.75,.2,1,.2,pale); box("kernel",x,.75,.2,1,.2,pale); box("kernel",x,0,.2,.18,1.7,highlights.kernel,1.1); }
    for(let r=0;r<2;r++) for(let c=0;c<4;c++) box("transport",-1.7+c*1.15,-.55+r*1.1,.72,.15,.7,(r+c)%3===0?highlights.transport:pale);
  }
}
