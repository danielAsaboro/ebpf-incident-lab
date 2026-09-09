"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
export function NamespaceModel() {
  const mount=useRef<HTMLDivElement>(null); const [view,setView]=useState<'host'|'namespace'>('host'); const [available,setAvailable]=useState(true);
  useEffect(()=>{
    const element=mount.current;if(!element)return;
    let renderer:THREE.WebGLRenderer;
    try {renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});}catch{queueMicrotask(()=>setAvailable(false));return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));element.appendChild(renderer.domElement);
    const scene=new THREE.Scene(); const camera=new THREE.OrthographicCamera(-4,4,2.4,-2.4,.1,50);camera.position.set(view==='host'?6:0,view==='host'?4:1,8);camera.lookAt(0,0,0);
    const objects: {geometry:THREE.BufferGeometry;material:THREE.Material}[]=[];
    const frame=(w:number,h:number,d:number,color:string)=>{const box=new THREE.BoxGeometry(w,h,d);const geometry=new THREE.EdgesGeometry(box);box.dispose();const material=new THREE.LineBasicMaterial({color});const line=new THREE.LineSegments(geometry,material);objects.push({geometry,material});scene.add(line);return line;};
    frame(5.4,2.5,2.4,view==='host'?'#99beb2':'#486863');frame(2.8,1.8,1.8,view==='namespace'?'#f4ba8d':'#b29475');
    const geometry=new THREE.SphereGeometry(.24,20,16),material=new THREE.MeshBasicMaterial({color:'#f4ba8d'});objects.push({geometry,material});scene.add(new THREE.Mesh(geometry,material));
    const resize=()=>{const w=element.clientWidth;renderer.setSize(w,210);camera.left=-4;camera.right=4;camera.top=4*210/Math.max(w,1);camera.bottom=-camera.top;camera.updateProjectionMatrix();renderer.render(scene,camera);};
    const observer=new ResizeObserver(resize);observer.observe(element);resize();
    return()=>{observer.disconnect();objects.forEach(({geometry,material})=>{geometry.dispose();material.dispose();});renderer.dispose();renderer.domElement.remove();};
  },[view]);
  return <div className="namespace-model"><div ref={mount} role="img" aria-label={`Conceptual ${view} view. One process is enclosed by a namespace, itself within the host. No actual PID values are inferred.`}/>{!available&&<p>The spatial view is unavailable. The host and namespace are two identity views of one process.</p>}<div className="figure-records" role="group" aria-label="Identity viewpoint"><button onClick={()=>setView('host')} aria-pressed={view==='host'}>Host view</button><button onClick={()=>setView('namespace')} aria-pressed={view==='namespace'}>Namespace view</button></div><p className="figure-footnote">The point is the same process in both views. Frames express scope, not physical space. Only received evidence can supply PID values.</p></div>;
}
