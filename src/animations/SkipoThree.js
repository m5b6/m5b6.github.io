import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export default function SkipoThree() {
  let container = document.getElementById("skipo-3d");
  let scene = new THREE.Scene();

  let camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.z = 5;

  let renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0); // the second param is the alpha (transparency)
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);
  // add ambient lighting
  let ambientLight = new THREE.AmbientLight("rgb(255, 198, 92)", 0.3);
  scene.add(ambientLight);

  // add additional ambient light behind the model
  let ambientLightBehind = new THREE.AmbientLight("rgb(255, 198, 92)", 0.2);
  ambientLightBehind.position.set(0, 0, -10);
  scene.add(ambientLightBehind);

  // add point lighting
  let pointLight = new THREE.PointLight(0xffffff, 1);
  pointLight.position.set(5, 5, 5);
  scene.add(pointLight);

  let loader = new GLTFLoader();
  let controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false; // Disables zoom

  let material1 = new THREE.MeshStandardMaterial({
    color: 0xff0000, // Red
    roughness: 0.5,
    metalness: 0.1,
    wireframeLinejoin: "round",
  });
  let material2 = new THREE.MeshStandardMaterial({
    color: 0x00ff00, // Green
    roughness: 0.5,
    metalness: 0.1,
    wireframeLinejoin: "round",
  });
  let material3 = new THREE.MeshStandardMaterial({
    color: 0x0000ff, // Blue
    roughness: 0.5,
    metalness: 1,
    wireframeLinejoin: "round",
  });

  let materials = [material1, material2, material3];
  materials;
  loader.load("./skipo3d/skipo.gltf", function (gltf) {
    let model = gltf.scene;
    model.scale.set(17,17, 17);
    scene.add(model);

    


    window.addEventListener("resize", onWindowResize, false);
    function onWindowResize() {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }

    let rotationYLimit = Math.PI / 7;
    let rotationZLimit = Math.PI / 15; // limit to 45 degrees
    let rotationSpeedY = 0.00138;
    let rotationSpeedZ = 0.0005;
    let directionY = 1;
    let directionZ = 1;

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);

      // bounce effect when rotation limit is reached
      if (Math.abs(model.rotation.y) > rotationYLimit) {
        directionY *= -1; // reverse the direction of rotation
      }
      model.rotation.y += directionY * rotationSpeedY;

      if (Math.abs(model.rotation.z) > rotationZLimit) {
        directionZ *= -1; // reverse the direction of rotation
      }
      model.rotation.z += directionZ * rotationSpeedZ;
    }

    animate();
  });
}
