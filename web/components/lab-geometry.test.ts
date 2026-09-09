import * as THREE from "three";
import { expect, it } from "vitest";
import { addLabGeometry } from "./lab-geometry";
it.each(["02", "03", "04", "05", "06", "07"])("lab %s builds finite, selectable geometry in every layer", id => {
  const groups = { process: new THREE.Group(), kernel: new THREE.Group(), transport: new THREE.Group() };
  const materials = { process: new THREE.MeshStandardMaterial(), kernel: new THREE.MeshStandardMaterial(), transport: new THREE.MeshStandardMaterial() };
  addLabGeometry(id, groups, materials);
  Object.entries(groups).forEach(([layer, group]) => {
    expect(group.children.length).toBeGreaterThan(0);
    group.traverse(object => { if (object instanceof THREE.Mesh) { expect(object.userData.layer).toBe(layer); expect(Array.from(object.geometry.attributes.position.array).every(Number.isFinite)).toBe(true); object.geometry.dispose(); } });
  });
});
