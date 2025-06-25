// Základní nastavení Three.js
let scene, camera, renderer, controls;
let ammo = 10;
const maxAmmo = 20;

// Pohyb hráče
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let canShoot = true;
let isJumping = false;
let yVelocity = 0;
const gravity = -0.015;
const jumpStrength = 0.32;
const groundY = 1.6;

// Pointer lock pro myš
function initPointerLock() {
  const havePointerLock = 'pointerLockElement' in document;
  if (havePointerLock) {
    document.body.addEventListener('click', () => {
      document.body.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === document.body) {
        document.addEventListener('mousemove', onMouseMove, false);
      } else {
        document.removeEventListener('mousemove', onMouseMove, false);
      }
    }, false);
  }
}

let pitch = 0, yaw = 0;
function onMouseMove(event) {
  yaw -= event.movementX * 0.002;
  // pitch -= event.movementY * 0.002; // ZAKÁZÁNO naklánění nahoru/dolů
  // pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
}

function updateCameraRotation() {
  // camera.rotation.x = pitch; // ZAKÁZÁNO naklánění nahoru/dolů
  camera.rotation.y = yaw;
}

function updateHUD() {
  document.getElementById('ammo').textContent = `Náboje: ${ammo}`;
}

// Kolize se stěnami
function checkCollision(newPos) {
  const playerRadius = 0.3;
  for (const wall of walls) {
    const dx = Math.abs(newPos.x - wall.position.x);
    const dz = Math.abs(newPos.z - wall.position.z);
    if (dx < 1 + playerRadius && dz < 1 + playerRadius && Math.abs(newPos.y - wall.position.y) < 1.5) {
      console.log('KOLIZE!', newPos.x, newPos.z, 'vs wall', wall.position.x, wall.position.z);
      return true;
    }
  }
  return false;
}

let walls = [];
let ammoBoxes = [];
let enemies = [];

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0, 2, 5);

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Podlaha
  const floorGeometry = new THREE.PlaneGeometry(50, 50, 10, 10);
  const floorMaterial = new THREE.MeshPhongMaterial({color: 0x444444});
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI/2;
  scene.add(floor);

  // Pouze vnější stěny
  walls = [];
  const wallMaterial = new THREE.MeshPhongMaterial({color: 0x888888});
  for (let i = -5; i <= 5; i++) {
    for (let j = -5; j <= 5; j++) {
      if (i === -5 || i === 5 || j === -5 || j === 5) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), wallMaterial);
        wall.position.set(i * 2, 1, j * 2);
        scene.add(wall);
        walls.push(wall);
      }
    }
  }

  // Ambientní světlo
  scene.add(new THREE.AmbientLight(0xffffff, 1));

  // Jeden červený nepřítel uprostřed mapy
  enemies = [];
  const enemyGeo = new THREE.SphereGeometry(0.6, 16, 16);
  const enemyMat = new THREE.MeshPhongMaterial({color: 0xff0000, flatShading: true});
  const enemy = new THREE.Mesh(enemyGeo, enemyMat);
  enemy.position.set(0, 1, 0);
  scene.add(enemy);
  enemies.push({mesh: enemy, alive: true});
  console.log('Nepřítel pozice:', enemy.position.x, enemy.position.y, enemy.position.z);

  window.addEventListener('resize', onWindowResize, false);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  document.addEventListener('mousedown', onMouseDown);

  updateHUD();
  initPointerLock();
  animate();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
  console.log('keydown', event.code);
  switch(event.code) {
    case 'KeyW':
    case 'ArrowUp':
      moveForward = true; break;
    case 'KeyS':
    case 'ArrowDown':
      moveBackward = true; break;
    case 'KeyA':
    case 'ArrowLeft':
      moveLeft = true; break;
    case 'KeyD':
    case 'ArrowRight':
      moveRight = true; break;
    case 'Space':
      if (!isJumping) {
        yVelocity = jumpStrength;
        isJumping = true;
      }
      break;
  }
}
function onKeyUp(event) {
  console.log('keyup', event.code);
  switch(event.code) {
    case 'KeyW':
    case 'ArrowUp':
      moveForward = false; break;
    case 'KeyS':
    case 'ArrowDown':
      moveBackward = false; break;
    case 'KeyA':
    case 'ArrowLeft':
      moveLeft = false; break;
    case 'KeyD':
    case 'ArrowRight':
      moveRight = false; break;
  }
}

function onMouseDown(event) {
  if (event.button === 0 && canShoot && ammo > 0) {
    ammo--;
    updateHUD();
    canShoot = false;
    setTimeout(() => { canShoot = true; }, 300); // rychlost střelby
    shoot();
  }
}

function shoot() {
  // Raycast dopředu
  const raycaster = new THREE.Raycaster();
  const dir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
  raycaster.set(camera.position, dir);
  let hit = false;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const intersects = raycaster.intersectObject(enemy.mesh);
    if (intersects.length > 0 && intersects[0].distance < 10) {
      enemy.alive = false;
      scene.remove(enemy.mesh);
      hit = true;
      break;
    }
  }
  // Efekt výstřelu (krátký blesk)
  if (!hit) {
    const flashGeo = new THREE.SphereGeometry(0.1, 6, 6);
    const flashMat = new THREE.MeshBasicMaterial({color: 0xffff00});
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.copy(camera.position).add(dir.clone().multiplyScalar(1));
    scene.add(flash);
    setTimeout(() => scene.remove(flash), 80);
  }
}

function animate() {
  requestAnimationFrame(animate);
  // Debug výpis pozice kamery
  console.log('Kamera:', camera.position.x, camera.position.y, camera.position.z);
  // Pohyb hráče
  direction.set(0, 0, 0);
  if (moveForward) direction.z += 1;
  if (moveBackward) direction.z -= 1;
  if (moveLeft) direction.x -= 1;
  if (moveRight) direction.x += 1;
  direction.normalize();
  // Opravený převod směru podle rotace kamery (yaw) - pohyb relativní ke směru pohledu
  const speed = 0.08;
  let move = new THREE.Vector3();
  // Vytvořím vektor pohybu ve směru pohledu (dopředu/dozadu) a v ose kolmé (doleva/doprava)
  // Dopředu/dozadu
  let forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  // Doleva/doprava
  let right = new THREE.Vector3(-forward.z, 0, forward.x);
  move.copy(forward).multiplyScalar(direction.z).add(right.multiplyScalar(direction.x));
  if (move.length() > 0) move.normalize();
  move.multiplyScalar(speed);
  let newPos = camera.position.clone();
  newPos.x += move.x;
  newPos.z += move.z;

  // Skákání a gravitace
  if (isJumping) {
    yVelocity += gravity;
    newPos.y += yVelocity;
    if (newPos.y <= groundY) {
      newPos.y = groundY;
      isJumping = false;
      yVelocity = 0;
    }
  }

  if (!checkCollision(newPos)) {
    camera.position.copy(newPos);
  } else {
    // Pokud narazíš do stěny, zastav pohyb v XZ, ale umožni pád/skok
    let onlyY = camera.position.clone();
    onlyY.y = newPos.y;
    camera.position.copy(onlyY);
  }
  updateCameraRotation();

  // Sbírání nábojů
  for (let i = 0; i < ammoBoxes.length; i++) {
    if (!ammoBoxes[i]) continue;
    const dist = camera.position.distanceTo(ammoBoxes[i].position);
    if (dist < 1.2 && ammo < maxAmmo) {
      ammo = Math.min(maxAmmo, ammo + 5);
      updateHUD();
      scene.remove(ammoBoxes[i]);
      ammoBoxes[i] = null;
    }
  }

  // Pohyb nepřátel (jednoduchý AI)
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const toPlayer = camera.position.clone().sub(enemy.mesh.position);
    if (toPlayer.length() < 12) {
      toPlayer.y = 0;
      toPlayer.normalize();
      enemy.mesh.position.add(toPlayer.multiplyScalar(0.02));
    }
  }

  renderer.render(scene, camera);
}

init(); 