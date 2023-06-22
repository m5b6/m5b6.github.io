import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export default function ContactThree(social) {
  let container = document.getElementById(`${social}-3d`);
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
  renderer.domElement.classList.add("option-icon");
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

  loader.load(`./${social}3d/${social}.gltf`, function (gltf) {
    let model = gltf.scene;
    if (social === "mail") {
      model.scale.set(55, 55, 55);
    } else if (social === "linkedin") {
      model.scale.set(4, 4, 4);
    
    } else {
      model.scale.set(5, 5, 5);
    }
    scene.add(model);

    let material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
      metalness: 0.1,
      wireframeLinejoin: "round",
    });

    model.traverse(function (child) {
      if (child.isMesh) {
        child.material = material;
      }
    });

    window.addEventListener("resize", onWindowResize, false);
    function onWindowResize() {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }

    let rotationYLimit = Math.PI / 7;
    let rotationZLimit = Math.PI / 15; // limit to 45 degrees
    let rotationSpeedY = (Math.random() * (0.0007 - 0.0001) + 0.0001).toFixed(
      5
    ); // Random speed between 0.0001 and 0.002
    let rotationSpeedZ = (Math.random() * (0.0007 - 0.0001) + 0.0001).toFixed(
      5
    ); // Random speed between 0.0001 and 0.002
    let directionY = Math.random() > 0.5 ? 1 : -1; // Random direction either 1 or -1
    let directionZ = Math.random() > 0.5 ? 1 : -1; // Random direction either 1 or -1

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
