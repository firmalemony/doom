console.log('DEBUG: main.js loaded');
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

function updateKills() {
  document.getElementById('kills').textContent = `Zabito: ${killCount}`;
}

function updateTopScores() {
  let scores = JSON.parse(localStorage.getItem('doomTopScores') || '[]');
  scores = scores.slice(0, 3);
  for (let i = 0; i < 3; i++) {
    const el = document.getElementById('score'+(i+1));
    if (scores[i]) {
      el.textContent = `${scores[i].name}: ${scores[i].score}`;
    } else {
      el.textContent = '---';
    }
  }
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
let killCount = 0;
let obstacleBlocks = [];

function isPositionFree(x, z) {
  // Kontrola vzdálenosti od hráče
  if (camera && camera.position) {
    const dx = x - camera.position.x;
    const dz = z - camera.position.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist < 4) return false;
  }
  // Kontrola kolize s překážkovými bloky
  for (const block of obstacleBlocks) {
    if (!block) continue;
    const dx = Math.abs(x - block.position.x);
    const dz = Math.abs(z - block.position.z);
    if (dx < 1.2 && dz < 1.2) return false;
  }
  // Kontrola kolize se stěnami
  for (const wall of walls) {
    if (!wall) continue;
    const dx = Math.abs(x - wall.position.x);
    const dz = Math.abs(z - wall.position.z);
    if (dx < 1.2 && dz < 1.2) return false;
  }
  return true;
}

function createZombie(x, z) {
  // Pokud je pozice obsazena, hledej novou
  let attempts = 0;
  while (!isPositionFree(x, z) && attempts < 50) {
    x = (Math.random() * 18 - 9).toFixed(1);
    z = (Math.random() * 18 - 9).toFixed(1);
    attempts++;
  }
  if (!isPositionFree(x, z)) return null; // Pokud se nenajde volné místo, nespawnuj
  let headTexture;
  try {
    headTexture = new THREE.TextureLoader().load('head.png');
  } catch (e) {
    headTexture = new THREE.TextureLoader().load('head');
  }
  // --- HLAVA ---
  const headGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
  const headMat = new THREE.MeshPhongMaterial({map: headTexture});
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0, 1.6, 0);

  // --- TĚLO ---
  const bodyGeo = new THREE.BoxGeometry(0.8, 1.2, 0.4);
  const bodyMat = new THREE.MeshPhongMaterial({color: 0x918A2E});
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.set(0, 0.8, 0);

  // --- LEVÁ RUKA ---
  const lArmGeo = new THREE.BoxGeometry(0.4, 1.2, 0.4);
  const lArmMat = new THREE.MeshPhongMaterial({color: 0x918A2E});
  const lArm = new THREE.Mesh(lArmGeo, lArmMat);
  lArm.position.set(-0.6, 0.8, 0);

  // --- PRAVÁ RUKA ---
  const rArmGeo = new THREE.BoxGeometry(0.4, 1.2, 0.4);
  const rArmMat = new THREE.MeshPhongMaterial({color: 0x918A2E});
  const rArm = new THREE.Mesh(rArmGeo, rArmMat);
  rArm.position.set(0.6, 0.8, 0);

  // --- LEVÁ NOHA ---
  const lLegGeo = new THREE.BoxGeometry(0.4, 1.2, 0.4);
  const lLegMat = new THREE.MeshPhongMaterial({color: 0x918A2E});
  const lLeg = new THREE.Mesh(lLegGeo, lLegMat);
  lLeg.position.set(-0.2, 0.2, 0);

  // --- PRAVÁ NOHA ---
  const rLegGeo = new THREE.BoxGeometry(0.4, 1.2, 0.4);
  const rLegMat = new THREE.MeshPhongMaterial({color: 0x918A2E});
  const rLeg = new THREE.Mesh(rLegGeo, rLegMat);
  rLeg.position.set(0.2, 0.2, 0);

  // --- SKLÁDÁNÍ ---
  const group = new THREE.Group();
  group.add(head);
  group.add(body);
  group.add(lArm);
  group.add(rArm);
  group.add(lLeg);
  group.add(rLeg);
  group.position.set(Number(x), 0, Number(z));

  // Každý zombie má svůj offset a timer
  const offset = new THREE.Vector3((Math.random()-0.5)*2, 0, (Math.random()-0.5)*2);
  const offsetTimer = {t: Math.random()*2+1};
  enemies.push({mesh: group, alive: true, offset, offsetTimer});
  scene.add(group);
  return group;
}

function isMobile() {
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
}

let mobileMove = {up: false, down: false, left: false, right: false};
let mobileShoot = false;
let mobileShootPrev = false;
let mobileTurn = {left: false, right: false};

function setupMobileControls() {
  const controls = document.getElementById('mobile-controls');
  if (!controls) return;
  controls.style.display = 'block';
  // Pohyb
  document.getElementById('btn-up').ontouchstart = e => { e.stopPropagation(); mobileMove.up = true; };
  document.getElementById('btn-up').ontouchend = e => { e.stopPropagation(); mobileMove.up = false; };
  document.getElementById('btn-down').ontouchstart = e => { e.stopPropagation(); mobileMove.down = true; };
  document.getElementById('btn-down').ontouchend = e => { e.stopPropagation(); mobileMove.down = false; };
  document.getElementById('btn-left').ontouchstart = e => { e.stopPropagation(); mobileMove.left = true; };
  document.getElementById('btn-left').ontouchend = e => { e.stopPropagation(); mobileMove.left = false; };
  document.getElementById('btn-right').ontouchstart = e => { e.stopPropagation(); mobileMove.right = true; };
  document.getElementById('btn-right').ontouchend = e => { e.stopPropagation(); mobileMove.right = false; };
  // Skok
  document.getElementById('btn-jump').ontouchstart = e => { e.stopPropagation(); if (!isJumping) { yVelocity = jumpStrength; isJumping = true; } };
  // Střelba
  document.getElementById('btn-shoot').ontouchstart = e => { e.stopPropagation(); mobileShoot = true; };
  // Otáčení
  document.getElementById('btn-turn-left').ontouchstart = e => { e.stopPropagation(); mobileTurn.left = true; };
  document.getElementById('btn-turn-left').ontouchend = e => { e.stopPropagation(); mobileTurn.left = false; };
  document.getElementById('btn-turn-right').ontouchstart = e => { e.stopPropagation(); mobileTurn.right = true; };
  document.getElementById('btn-turn-right').ontouchend = e => { e.stopPropagation(); mobileTurn.right = false; };
  // Ovládání kamery tažením prstu
  let lastTouchX = null;
  controls.ontouchstart = e => {
    if (e.touches.length === 1) lastTouchX = e.touches[0].clientX;
  };
  controls.ontouchmove = e => {
    if (e.touches.length === 1 && lastTouchX !== null) {
      const dx = e.touches[0].clientX - lastTouchX;
      yaw -= dx * 0.008;
      lastTouchX = e.touches[0].clientX;
    }
  };
  controls.ontouchend = e => { lastTouchX = null; };
}

function init() {
  scene = new THREE.Scene();
  scene.background = null;

  camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0, 1.6, 5);

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Obloha (skybox jako koule)
  const skyTexture = new THREE.TextureLoader().load('sky.png');
  const skyGeo = new THREE.SphereGeometry(100, 32, 32);
  const skyMat = new THREE.MeshBasicMaterial({map: skyTexture, side: THREE.BackSide});
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // Podlaha s texturou
  const floorTexture = new THREE.TextureLoader().load('floor.png');
  floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(10, 10);
  const floorGeometry = new THREE.PlaneGeometry(50, 50, 10, 10);
  const floorMaterial = new THREE.MeshPhongMaterial({map: floorTexture});
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI/2;
  scene.add(floor);

  // Vnější stěny s texturou
  walls = [];
  const wallTexture = new THREE.TextureLoader().load('wall.png');
  wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
  wallTexture.repeat.set(1, 1);
  const wallMaterial = new THREE.MeshPhongMaterial({map: wallTexture});
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

  // Ammo boxy s texturou
  ammoBoxes = [];
  const ammoTexture = new THREE.TextureLoader().load('ammo.png');
  for (let i = 0; i < 8; i++) {
    const boxGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const boxMat = new THREE.MeshPhongMaterial({map: ammoTexture});
    const box = new THREE.Mesh(boxGeo, boxMat);
    let x = (Math.random() * 18 - 9).toFixed(1);
    let z = (Math.random() * 18 - 9).toFixed(1);
    box.position.set(x, 0.25, z);
    scene.add(box);
    ammoBoxes.push(box);
  }

  // Překážky (náhodné bloky)
  obstacleBlocks = [];
  const blockTexture = new THREE.TextureLoader().load('box.png');
  for (let i = 0; i < 8; i++) {
    const blockGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    const blockMat = new THREE.MeshPhongMaterial({map: blockTexture});
    const block = new THREE.Mesh(blockGeo, blockMat);
    let x = (Math.random() * 18 - 9).toFixed(1);
    let z = (Math.random() * 18 - 9).toFixed(1);
    block.position.set(x, 0.6, z);
    scene.add(block);
    obstacleBlocks.push(block);
  }

  // Vytvoř 3 zombie panáčky na různých pozicích, ne u hráče
  enemies = [];
  for (let i = 0; i < 3; i++) {
    let x, z;
    let attempts = 0;
    do {
      x = (Math.random() * 18 - 9).toFixed(1);
      z = (Math.random() * 18 - 9).toFixed(1);
      attempts++;
    } while ((!isPositionFree(x, z) || Math.sqrt((x-camera.position.x)**2 + (z-camera.position.z)**2) < 4) && attempts < 50);
    if (isPositionFree(x, z) && Math.sqrt((x-camera.position.x)**2 + (z-camera.position.z)**2) >= 4) {
      createZombie(x, z);
    }
  }

  window.addEventListener('resize', onWindowResize, false);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  document.addEventListener('mousedown', onMouseDown);

  updateHUD();
  updateKills();
  updateTopScores();
  initPointerLock();
  if (isMobile()) setupMobileControls();
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
    case 'MetaLeft':
    case 'MetaRight':
    case 'ControlLeft':
    case 'ControlRight':
      if (canShoot && ammo > 0) {
        ammo--;
        updateHUD();
        canShoot = false;
        setTimeout(() => { canShoot = true; }, 300);
        shoot();
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
  const raycaster = new THREE.Raycaster();
  const dir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
  raycaster.set(camera.position, dir);
  let hit = false, hitPoint = null, hitEnemy = null;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    let meshes = [];
    enemy.mesh.traverse(obj => { if (obj.isMesh) meshes.push(obj); });
    const intersects = raycaster.intersectObjects(meshes, true);
    if (intersects.length > 0 && intersects[0].distance < 10) {
      hit = true;
      hitPoint = intersects[0].point;
      hitEnemy = enemy;
      break;
    }
  }
  // Vykresli střelu (žlutý válec)
  const maxLen = 10;
  const start = camera.position.clone();
  const end = hit && hitPoint ? hitPoint : camera.position.clone().add(dir.clone().multiplyScalar(maxLen));
  const length = start.distanceTo(end);
  const geometry = new THREE.CylinderGeometry(0.05, 0.05, length, 8);
  const material = new THREE.MeshBasicMaterial({color: 0xffff00});
  const bullet = new THREE.Mesh(geometry, material);
  // Umístění a orientace válce
  bullet.position.copy(start).add(end).multiplyScalar(0.5);
  bullet.lookAt(end);
  bullet.rotateX(Math.PI/2);
  scene.add(bullet);
  setTimeout(() => scene.remove(bullet), 120);

  if (hit && hitEnemy) {
    console.log('Zombie zasáhnut na', hitPoint);
    hitEnemy.alive = false;
    scene.remove(hitEnemy.mesh);
    // Odstraň zombie z pole enemies
    const idx = enemies.indexOf(hitEnemy);
    if (idx !== -1) enemies.splice(idx, 1);
    killCount++;
    updateKills();
    // Rozprsknutí na kousky
    for (let i = 0; i < 16; i++) {
      const fragGeo = new THREE.SphereGeometry(0.12, 4, 4);
      const fragMat = new THREE.MeshBasicMaterial({color: 0xff0000});
      const frag = new THREE.Mesh(fragGeo, fragMat);
      frag.position.copy(hitPoint);
      scene.add(frag);
      const v = new THREE.Vector3(
        (Math.random()-0.5)*2,
        Math.random()*2,
        (Math.random()-0.5)*2
      );
      (function(frag, v, t=0) {
        function animateFrag() {
          t += 0.04;
          frag.position.add(v.clone().multiplyScalar(0.08));
          v.y -= 0.08;
          if (t < 0.7) requestAnimationFrame(animateFrag);
          else scene.remove(frag);
        }
        animateFrag();
      })(frag, v);
    }
    // Vytvoř nový zombie na náhodné pozici
    let x = (Math.random() * 18 - 9).toFixed(1);
    let z = (Math.random() * 18 - 9).toFixed(1);
    createZombie(x, z);
  }
}

let gameOver = false;
function animate() {
  if (gameOver) return;
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

  // Sbírání nábojů (pouze v XZ rovině)
  for (let i = 0; i < ammoBoxes.length; i++) {
    if (!ammoBoxes[i]) continue;
    const dx = camera.position.x - ammoBoxes[i].position.x;
    const dz = camera.position.z - ammoBoxes[i].position.z;
    const distXZ = Math.sqrt(dx*dx + dz*dz);
    if (distXZ < 1.2 && ammo < maxAmmo) {
      ammo = Math.min(maxAmmo, ammo + 5);
      updateHUD();
      scene.remove(ammoBoxes[i]);
      ammoBoxes[i] = null;
      console.log('Naboj sebran!');
    }
  }

  // Pohyb nepřátel (AI s offsetem a obcházením bloků)
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    // Offset timer
    enemy.offsetTimer.t -= 0.016;
    if (enemy.offsetTimer.t <= 0) {
      enemy.offset.set((Math.random()-0.5)*2, 0, (Math.random()-0.5)*2);
      enemy.offsetTimer.t = Math.random()*2+1;
    }
    // Směr k hráči + offset
    const toPlayer = camera.position.clone().sub(enemy.mesh.position);
    toPlayer.y = 0;
    toPlayer.normalize();
    let moveVec = toPlayer.clone().add(enemy.offset.clone().multiplyScalar(0.3)).normalize().multiplyScalar(0.02);
    // Pokud by narazil do bloku, zkus jiný směr (náhodný offset)
    if (zombieBlocked(enemy.mesh.position, moveVec)) {
      enemy.offset.set((Math.random()-0.5)*2, 0, (Math.random()-0.5)*2);
      moveVec = enemy.offset.clone().normalize().multiplyScalar(0.02);
      if (zombieBlocked(enemy.mesh.position, moveVec)) moveVec.set(0,0,0); // zůstane stát
    }
    enemy.mesh.position.add(moveVec);
    // Udržuj zombie na zemi
    enemy.mesh.position.y = 0;
  }

  // Detekce kolize hráče se zombie (pouze v XZ rovině)
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const dx = camera.position.x - enemy.mesh.position.x;
    const dz = camera.position.z - enemy.mesh.position.z;
    const distXZ = Math.sqrt(dx*dx + dz*dz);
    if (distXZ < 1.1) {
      gameOver = true;
      showGameOver();
      break;
    }
  }

  // Mobilní pohyb
  if (isMobile()) {
    moveForward = mobileMove.up;
    moveBackward = mobileMove.down;
    moveLeft = mobileMove.left;
    moveRight = mobileMove.right;
    // Střelba pouze při touchstart na btn-shoot
    if (mobileShoot && canShoot && ammo > 0) {
      ammo--;
      updateHUD();
      canShoot = false;
      setTimeout(() => { canShoot = true; }, 300);
      shoot();
      mobileShoot = false; // ihned po vystřelení nastav zpět na false
    }
    // Otáčení kamerou tlačítky
    if (mobileTurn.left) yaw += 0.06;
    if (mobileTurn.right) yaw -= 0.06;
  }

  renderer.render(scene, camera);
}

function showGameOver() {
  console.log('GAME OVER!');
  // Vytvoř menu GAME OVER
  const div = document.createElement('div');
  div.className = 'gameover-modal';
  div.innerHTML = `GAME OVER<br>Zabití nepřátelé: ${killCount}<br><br>`;
  // Input pro jméno
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Tvé jméno';
  input.value = 'Hráč';
  input.style.fontSize = '32px';
  input.style.padding = '8px 16px';
  input.style.margin = '12px 0';
  input.style.borderRadius = '8px';
  input.style.border = '1px solid #fff';
  div.appendChild(input);
  div.appendChild(document.createElement('br'));
  // Tlačítko pro uložení skóre a restart
  const btn = document.createElement('button');
  btn.textContent = 'Uložit skóre a restartovat';
  btn.style.display = 'block';
  btn.style.margin = '24px auto 0 auto';
  btn.style.fontSize = '32px';
  btn.style.padding = '12px 32px';
  btn.style.background = '#222';
  btn.style.color = '#fff';
  btn.style.border = '2px solid #fff';
  btn.style.borderRadius = '12px';
  btn.style.cursor = 'pointer';
  btn.onclick = () => {
    let name = input.value.trim() || 'Hráč';
    let scores = JSON.parse(localStorage.getItem('doomTopScores') || '[]');
    scores.push({name, score: killCount});
    scores.sort((a,b) => b.score - a.score);
    localStorage.setItem('doomTopScores', JSON.stringify(scores.slice(0,10)));
    updateTopScores();
    location.reload();
  };
  div.appendChild(btn);
  document.body.appendChild(div);
}

function zombieBlocked(pos, moveVec) {
  // Vrací true, pokud by zombie narazil do překážky nebo stěny
  for (const block of obstacleBlocks) {
    const dx = pos.x + moveVec.x - block.position.x;
    const dz = pos.z + moveVec.z - block.position.z;
    if (Math.abs(dx) < 0.9 && Math.abs(dz) < 0.9) {
      return true;
    }
  }
  for (const wall of walls) {
    const dx = pos.x + moveVec.x - wall.position.x;
    const dz = pos.z + moveVec.z - wall.position.z;
    if (Math.abs(dx) < 1.1 && Math.abs(dz) < 1.1) {
      return true;
    }
  }
  return false;
}

init(); 