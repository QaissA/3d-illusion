import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const aspect = () => innerWidth / innerHeight;

// After the user lets go, ease the camera back to the one viewpoint where the illusion works.
function homing(camera, controls, home, target) {
  let held = false, releasedAt = -Infinity;
  controls.addEventListener('start', () => (held = true));
  controls.addEventListener('end', () => { held = false; releasedAt = performance.now(); });
  return dt => {
    if (held || performance.now() - releasedAt < 1200) return;
    const k = 1 - Math.exp(-dt * 2);
    camera.position.lerp(home, k);
    controls.target.lerp(target, k);
    if (camera.isOrthographicCamera) { camera.zoom += (1 - camera.zoom) * k; camera.updateProjectionMatrix(); }
    controls.update();
  };
}

/* 01 — Penrose triangle: three ordinary beams that only close up from one exact direction. */
function penrose() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xefe7d6);
  const L = 4, w = 1;
  // flat Escher-style shading: one tone per face orientation
  const mat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec3 vN; void main(){ vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'varying vec3 vN; void main(){ vec3 n = abs(vN); gl_FragColor = vec4(n.x*vec3(.86,.36,.27) + n.y*vec3(.98,.82,.52) + n.z*vec3(.22,.25,.42), 1.); }',
  });
  const beam = (sx, sy, sz, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(x, y, z);
    scene.add(m);
  };
  // path goes +x, +y, +z: the end (L,L,L) sits exactly in front of the start when viewed along (1,1,1)
  beam(L + w, w, w, L / 2, 0, 0);
  beam(w, L, w, L, L / 2 + w / 2, 0);
  beam(w, w, L, L, L, L / 2 + w / 2);

  const h = 5.5;
  const camera = new THREE.OrthographicCamera(-h * aspect(), h * aspect(), h, -h, 0.1, 200);
  const target = new THREE.Vector3(2 * L / 3, L / 3, 0); // centroid of the projected triangle
  const homeDir = new THREE.Vector3(1, 1, 1).normalize();
  const home = target.clone().addScaledVector(homeDir, 40);
  camera.position.copy(home);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(target);
  controls.update();

  const truth = new THREE.PerspectiveCamera(40, 1.4, 0.1, 200);
  const goHome = homing(camera, controls, home, target);
  return {
    title: 'Impossible Triangle', light: true, scene, camera, controls, truth, homeDir,
    desc: 'Three perfectly ordinary beams. From exactly one direction they form a shape that cannot exist. Drag to break it — let go and it heals.',
    update(t, dt) {
      goHome(dt);
      truth.position.set(target.x + Math.cos(t * 0.4) * 16, 7, target.z + Math.sin(t * 0.4) * 16);
      truth.lookAt(target);
    },
  };
}

/* 02 — Anamorphic word: cubes scattered along rays from a single eye point. */
function anamorph() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07070c);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x222244, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(3, 5, 8);
  scene.add(sun);

  const eye = new THREE.Vector3(0, 0, 22);
  const W = 640, H = 140, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.font = '900 110px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('ILLUSION', W / 2, H / 2 + 6);
  const px = g.getImageData(0, 0, W, H).data;

  const unit = 16 / W, step = 4, cell = unit * step, rays = [];
  for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
    if (px[(y * W + x) * 4 + 3] < 128) continue;
    const p = new THREE.Vector3((x - W / 2) * unit, (H / 2 - y) * unit, 0);
    const d0 = eye.distanceTo(p);
    rays.push({
      dir: p.sub(eye).normalize(), d0, u: x / W,
      base: d0 * (0.35 + Math.random() * 1.4),
      phase: Math.random() * Math.PI * 2,
      axis: new THREE.Vector3().randomDirection(),
      speed: 0.3 + Math.random(),
    });
  }

  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), rays.length);
  const col = new THREE.Color();
  rays.forEach((r, i) => mesh.setColorAt(i, col.setHSL(0.52 + r.u * 0.45, 0.85, 0.6)));
  scene.add(mesh);
  // a marker for the only place in space where the word is readable
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
  marker.position.copy(eye);
  scene.add(marker);

  const camera = new THREE.PerspectiveCamera(45, aspect(), 0.1, 300);
  const target = new THREE.Vector3();
  camera.position.copy(eye);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.update();
  const goHome = homing(camera, controls, eye, target);
  const truth = new THREE.PerspectiveCamera(45, 1.4, 0.1, 300);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3();

  return {
    title: 'One True Eye', scene, camera, controls, truth, homeDir: eye.clone().normalize(),
    desc: `${rays.length} cubes drifting through space, none of them touching. There is only one point in the universe from which they spell something.`,
    update(t, dt) {
      goHome(dt);
      // cubes slide along their rays and grow with distance, so from the eye nothing moves
      rays.forEach((r, i) => {
        const d = r.base * (1 + 0.2 * Math.sin(t * 0.7 + r.phase));
        pos.copy(eye).addScaledVector(r.dir, d);
        s.setScalar(cell * 1.15 * d / r.d0);
        q.setFromAxisAngle(r.axis, t * r.speed + r.phase);
        mesh.setMatrixAt(i, m.compose(pos, q, s));
      });
      mesh.instanceMatrix.needsUpdate = true;
      truth.position.set(Math.sin(t * 0.3) * 30, 9, 10 + Math.cos(t * 0.3) * 30);
      truth.lookAt(0, 0, 10);
    },
  };
}

/* 03 — A box whose six faces are windows into six different worlds (stencil buffer). */
function box() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0d12);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x333355, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(4, 6, 5);
  scene.add(sun);

  const S = 4, cube = new THREE.Group();
  scene.add(cube);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xdedede, metalness: 0.8, roughness: 0.25 });
  for (let a = 0; a < 3; a++) for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
    const size = [0.12, 0.12, 0.12], p = [0, 0, 0];
    size[a] = S + 0.12;
    p[(a + 1) % 3] = s1 * S / 2;
    p[(a + 2) % 3] = s2 * S / 2;
    const edge = new THREE.Mesh(new THREE.BoxGeometry(...size), frameMat);
    edge.position.set(...p);
    cube.add(edge);
  }

  const std = color => new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.2 });
  const worlds = [
    [0x0b1d51, () => new THREE.Mesh(new THREE.TorusKnotGeometry(0.8, 0.27, 180, 24), std(0xff7a3d))],
    [0x0f4c4c, () => {
      const g = new THREE.Group();
      for (let i = 0; i < 40; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.08 + Math.random() * 0.18, 20, 12), std(new THREE.Color().setHSL(0.9 + Math.random() * 0.15, 0.8, 0.65)));
        b.position.randomDirection().multiplyScalar(0.3 + Math.random() * 1.2);
        g.add(b);
      }
      return g;
    }],
    [0x000000, () => {
      const g = new THREE.Group();
      [1.5, 1.0, 0.55].forEach((r, i) => {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, i), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true }));
        m.userData.tick = (t) => m.rotation.set(t * (i + 1) * 0.3, t * 0.2 * (i % 2 ? -1 : 1), 0);
        g.add(m);
      });
      return g;
    }],
    [0xf2c94c, () => {
      const g = new THREE.Group();
      for (let i = 0; i < 14; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.14, 1.3), std(i % 2 ? 0x1b1b1b : 0xfafafa));
        b.position.y = -1.3 + i * 0.2;
        b.userData.tick = (t) => (b.rotation.y = Math.sin(t + i * 0.35) * 1.2);
        g.add(b);
      }
      return g;
    }],
    [0x3a1d5c, () => {
      const g = new THREE.Group();
      [1.4, 1.1, 0.8].forEach((r, i) => {
        const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 16, 100), std([0x7cf5ff, 0xff5fa2, 0xfff275][i]));
        m.userData.tick = (t) => (m.rotation[['x', 'y', 'z'][i]] = t * (1 + i * 0.5));
        g.add(m);
      });
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 16), std(0xffffff)));
      return g;
    }],
    [0x02020a, () => {
      const n = 4000, pos = new Float32Array(n * 3), cols = new Float32Array(n * 3), c = new THREE.Color();
      for (let i = 0; i < n; i++) {
        const r = Math.sqrt(Math.random()) * 1.7, a = r * 3 + (i % 3) * Math.PI * 2 / 3 + (Math.random() - 0.5) * 0.6;
        pos.set([Math.cos(a) * r, (Math.random() - 0.5) * 0.15 * (1.8 - r), Math.sin(a) * r], i * 3);
        c.setHSL(0.6 - r * 0.25, 0.9, 0.55 + (1.7 - r) * 0.2).toArray(cols, i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      const p = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.035, vertexColors: true }));
      p.rotation.x = 0.5;
      return p;
    }],
  ];
  const normals = [[0, 0, 1], [1, 0, 0], [0, 0, -1], [-1, 0, 0], [0, 1, 0], [0, -1, 0]].map(n => new THREE.Vector3(...n));

  const contents = [];
  worlds.forEach(([bg, make], i) => {
    const ref = i + 1, n = normals[i];
    // invisible window: marks its pixels in the stencil buffer with this world's id
    const win = new THREE.Mesh(new THREE.PlaneGeometry(S, S), new THREE.MeshBasicMaterial({
      colorWrite: false, depthWrite: false, stencilWrite: true, stencilRef: ref,
      stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
    }));
    win.position.copy(n).multiplyScalar(S / 2);
    win.lookAt(n.clone().multiplyScalar(S));
    cube.add(win);

    const world = new THREE.Group();
    world.add(new THREE.Mesh(new THREE.BoxGeometry(S * 0.99, S * 0.99, S * 0.99), new THREE.MeshBasicMaterial({ color: bg, side: THREE.BackSide })));
    const obj = make();
    world.add(obj);
    // everything inside only draws where its own window was drawn
    world.traverse(o => {
      if (!o.material) return;
      Object.assign(o.material, { stencilWrite: true, stencilRef: ref, stencilFunc: THREE.EqualStencilFunc });
      o.renderOrder = 1;
    });
    cube.add(world);
    contents.push(obj);
  });

  const camera = new THREE.PerspectiveCamera(45, aspect(), 0.1, 100);
  camera.position.set(6.5, 4, 8);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  return {
    title: 'Six Worlds', scene, camera, controls,
    desc: 'One small box, six faces, six worlds. Every window opens onto a different inside. Orbit around it.',
    update(t, dt) {
      controls.update();
      cube.rotation.y += dt * 0.2;
      cube.rotation.x = Math.sin(t * 0.25) * 0.35;
      contents.forEach((o, i) => {
        o.rotation.y += dt * (0.3 + i * 0.05);
        o.traverse(c => c.userData.tick?.(t));
      });
    },
  };
}

const scenes = [penrose(), anamorph(), box()];
const nav = document.querySelector('nav'), desc = document.getElementById('desc');
const meter = document.getElementById('meter'), inset = document.getElementById('inset');
let cur = 0;

const buttons = scenes.map((s, i) => {
  const b = document.createElement('button');
  b.innerHTML = `<b>0${i + 1}</b> ${s.title}`;
  b.onclick = () => show(i);
  nav.append(b);
  return b;
});

function show(i) {
  cur = i;
  const s = scenes[i];
  scenes.forEach((o, j) => (o.controls.enabled = j === i));
  buttons.forEach((b, j) => b.classList.toggle('on', j === i));
  desc.textContent = s.desc;
  inset.hidden = !s.truth;
  meter.hidden = !s.homeDir;
  document.body.dataset.theme = s.light ? 'light' : 'dark';
}
show(0);
addEventListener('keydown', e => scenes[e.key - 1] && show(e.key - 1));

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  for (const { camera } of scenes) {
    if (camera.isOrthographicCamera) { camera.left = -camera.top * aspect(); camera.right = camera.top * aspect(); }
    else camera.aspect = aspect();
    camera.updateProjectionMatrix();
  }
});

const clock = new THREE.Clock(), dir = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime, s = scenes[cur];
  s.update(t, dt);

  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, innerWidth, innerHeight);
  renderer.render(s.scene, s.camera);

  if (s.homeDir) {
    const a = Math.max(0, 1 - dir.subVectors(s.camera.position, s.controls.target).normalize().angleTo(s.homeDir) / 0.35);
    meter.innerHTML = `${a > 0.98 ? 'ILLUSION LOCKED' : 'ALIGNMENT'} ${Math.round(a * 100)}%<i style="width:${a * 100}%"></i>`;
  }

  if (s.truth) {
    const r = inset.getBoundingClientRect(), y = innerHeight - r.bottom;
    renderer.setScissorTest(true);
    renderer.setScissor(r.left, y, r.width, r.height);
    renderer.setViewport(r.left, y, r.width, r.height);
    s.truth.aspect = r.width / r.height;
    s.truth.updateProjectionMatrix();
    renderer.render(s.scene, s.truth);
  }
});
