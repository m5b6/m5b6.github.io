import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export default async function SetContentHeader() {
  const scene = new THREE.Scene();
  scene.background = null;

  const renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;

  const container = document.querySelector(".section-header");
  const height = container.clientHeight;
  const width = container.clientWidth;
  const aspectRatio = width / height;
  console.log(height, width);
  renderer.setSize(width, height);

  const camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);

  container.appendChild(renderer.domElement);

  const fontLoader = new FontLoader();

  const font = await fontLoader.loadAsync(
    "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/fonts/helvetiker_bold.typeface.json"
  );
  const textGeometry = new TextGeometry("experiencia", {
    font: font,
    size: 1,
    height: 0.5,
    curveSegments: 6,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelOffset: 0,
    bevelSegments: 5,
  });

  textGeometry.computeBoundingBox();
  textGeometry.translate(
    -0.5 * (textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x),
    -0.5 * (textGeometry.boundingBox.max.y - textGeometry.boundingBox.min.y),
    -0.5 * (textGeometry.boundingBox.max.z - textGeometry.boundingBox.min.z)
  );

  const textMaterial = new THREE.MeshStandardMaterial({
    color: "#fff",
    roughness: 1,
  });
  var roughnessMap = new THREE.TextureLoader().load("roughnessMap.png");
  roughnessMap.magFilter = THREE.NearestFilter;
  textMaterial.roughnessMap = roughnessMap;

  const textMesh = new THREE.Mesh(textGeometry, textMaterial);
  textMesh.castShadow = true;
  scene.add(textMesh);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(1, 1, 1);
  light.castShadow = false;
  scene.add(light);

  camera.position.z = 5;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false;

  let rotationDirection = { x: 1, y: 1, z: 1 };

  function animate() {
    requestAnimationFrame(animate);

    // Adjust rotation direction if limit is reached
    if (
      textMesh.rotation.y >= Math.PI / 6 ||
      textMesh.rotation.y <= -Math.PI / 6
    )
      rotationDirection.y *= -1;
    if (
      textMesh.rotation.x >= Math.PI / 6 ||
      textMesh.rotation.x <= -Math.PI / 6
    )
      rotationDirection.x *= -1;
    if (
      textMesh.rotation.z >= Math.PI / 6 ||
      textMesh.rotation.z <= -Math.PI / 6
    )
      rotationDirection.z *= -1;

    // Rotate the textMesh
    textMesh.rotation.y += 0.0004 * rotationDirection.y;
    textMesh.rotation.x += 0.0001 * rotationDirection.x;
    textMesh.rotation.z += 0.00005 * rotationDirection.z;

    controls.update();

    renderer.render(scene, camera);
  }

  animate();
}
