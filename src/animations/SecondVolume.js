import * as THREE from 'three';
import {FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import {TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';

  
export default async function SecondVolume(){

  const scene = new THREE.Scene();
  scene.background = null;


  const renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;

  const container = document.querySelector(".second-volume");  
  const height = container.clientHeight;
  const width = container.clientWidth;
  const aspectRatio = width / height;
  renderer.setSize(width, height);
  
  const camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);

  container.appendChild(renderer.domElement);


  const fontLoader = new FontLoader();

  const font = await fontLoader.loadAsync('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/fonts/helvetiker_regular.typeface.json');
  const textGeometry = new TextGeometry('riolab', {
    font: font,
    size: 1.5,
    height: 0.5,
    curveSegments: 100,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelOffset: 0,
    bevelSegments: 5
  });

  textGeometry.computeBoundingBox();
  textGeometry.translate(
    -0.5 * (textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x),
    -0.5 * (textGeometry.boundingBox.max.y - textGeometry.boundingBox.min.y),
    -0.5 * (textGeometry.boundingBox.max.z - textGeometry.boundingBox.min.z)
  );

  const textMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const textMesh = new THREE.Mesh(textGeometry, textMaterial);
  textMesh.castShadow = true;
  scene.add(textMesh);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(1, 1, 1);
  light.castShadow = true;
  scene.add(light);

  const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 1);
  scene.add(hemisphereLight);

  const pointLight = new THREE.PointLight(0xffffff, 0.8, 18);
  pointLight.position.set(-3, 6, -3);
  pointLight.castShadow = true;
  scene.add(pointLight);

  camera.position.z = 5;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false;

  function animate() {
    requestAnimationFrame(animate);

    controls.update();

    renderer.render(scene, camera);
  }

  animate();
}

