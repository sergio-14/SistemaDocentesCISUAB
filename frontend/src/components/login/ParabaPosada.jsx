import { useEffect, useRef } from 'react';
import {
  BufferGeometry, CanvasTexture, CapsuleGeometry, CatmullRomCurve3, Color, CylinderGeometry, DirectionalLight,
  ExtrudeGeometry, Float32BufferAttribute, Group, HemisphereLight, IcosahedronGeometry, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, NoToneMapping, PerspectiveCamera, PlaneGeometry, Scene, Shape, SphereGeometry, SRGBColorSpace,
  Vector3, WebGLRenderer,
} from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Paraba 3D (Three.js) de estilo tierno, con sombreado suave y mate, en los colores del logo de la
// UAB: cuerpo y cabeza rojos, mancha blanca en la cara con un ojo grande a cada lado, pico grande en
// gancho (dorado arriba, negro abajo), alas con franja dorada y plumas largas azules, cola larga en
// punta y patas grises agarradas a una rama natural con hojas. Reacciona al login:
//   reposo              nada escrito ni enfocado: parpadea; mira a los lados, se acicala el ala, la
//                       estira, se esponja, levanta una pata y da un saltito.
//   mirando-usuario     escribiendo el usuario: se inclina un poco hacia el campo.
//   mirando-contrasena  igual, un poco más abajo (el campo de la contraseña está debajo).
//   ojos-cerrados       la contraseña está a la vista: cierra los ojos y aparta la cabeza.
//   atento              campos llenos sin foco: quieta, parpadeando.
// Modelo propio armado con formas de Three.js (sin archivos). Cada parte va con un resorte hacia su
// pose (sin saltos entre estados) más un movimiento continuo: respira, se balancea y la cola sigue con
// retraso. Con prefers-reduced-motion toma la pose de cada estado sin animar.

// Colores del logo de la UAB (rojo #f20b0d, azul #1718d0, dorado #c9b810), apenas suavizados.
const ROJO = '#e8262b';
const ROJO_CLARO = '#ff5a4f';
const AZUL = '#2a3fd6';
const DORADO = '#e2c62c';
const NEGRO = '#1b1b1f';
const BLANCO = '#ffffff';
const GRIS = '#4b5b5e';
const CORTEZA = '#8a5a3a';
const HOJA = '#5fb04a';

const ALTO_VISIBLE = 3.4; // unidades del modelo que entran a lo alto del cuadro
const GIRO_BASE = -1.0; // casi de perfil, mirando hacia el formulario (a la izquierda)

// ---------- modelo ----------
// Sombreado suave y mate, con luz pareja: redondeado, sin caras marcadas.
const material = (color, extra = {}) => new MeshLambertMaterial({ color, ...extra });

function suavizar(geometria) {
  geometria.deleteAttribute('normal');
  geometria.deleteAttribute('uv');
  const unida = mergeVertices(geometria, 1e-4);
  unida.computeVertexNormals();
  return unida;
}

function esfera(radios, color, segmentos = 32) {
  const g = new SphereGeometry(1, segmentos, Math.round(segmentos * 0.7));
  g.scale(...radios);
  return new Mesh(g, material(color));
}

// Lámina de bordes redondeados (alas, hojas), centrada en su grosor.
function lamina(dibujar, grosor, bisel) {
  const s = new Shape();
  dibujar(s);
  const g = new ExtrudeGeometry(s, {
    depth: grosor, bevelEnabled: true, bevelThickness: bisel, bevelSize: bisel, bevelSegments: 4, curveSegments: 18,
  });
  g.translate(0, 0, -grosor / 2);
  return suavizar(g);
}

// Tubo que sigue una curva y se afina (pico, cola, rama). `ancho`/`alto` aplanan la sección y
// `pintar(u)` da el color a lo largo (0 base, 1 punta).
function tuboAfinado(puntos, radioBase, radioPunta, { ancho = 1, alto = 1, pintar = null, pasos = 32, lados = 16 } = {}) {
  const curva = new CatmullRomCurve3(puntos.map((p) => new Vector3(...p)));
  const marcos = curva.computeFrenetFrames(pasos, false);
  const posiciones = [];
  const colores = [];
  const indices = [];
  const c = new Color();
  for (let i = 0; i <= pasos; i += 1) {
    const u = i / pasos;
    const centro = curva.getPointAt(u);
    const radio = radioBase + (radioPunta - radioBase) * u;
    const n = marcos.normals[i];
    const b = marcos.binormals[i];
    if (pintar) c.set(pintar(u));
    for (let j = 0; j <= lados; j += 1) {
      const ang = (j / lados) * Math.PI * 2;
      const x = Math.cos(ang) * radio * ancho;
      const y = Math.sin(ang) * radio * alto;
      posiciones.push(centro.x + n.x * x + b.x * y, centro.y + n.y * x + b.y * y, centro.z + n.z * x + b.z * y);
      if (pintar) colores.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < pasos; i += 1) {
    for (let j = 0; j < lados; j += 1) {
      const k = i * (lados + 1) + j;
      indices.push(k, k + lados + 1, k + 1, k + lados + 1, k + lados + 2, k + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(posiciones, 3));
  if (pintar) g.setAttribute('color', new Float32BufferAttribute(colores, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function crearAla() {
  const ala = new Group();
  const plano = new Group();
  plano.rotation.set(-0.75, Math.PI / 2, 0); // pegada al costado, con la punta hacia atrás y abajo
  ala.add(plano);
  // Tres capas como en la paraba: plumas largas azules, franja dorada y cobijas rojas arriba.
  const azul = new Mesh(lamina((s) => {
    s.moveTo(-0.1, 0.06);
    s.bezierCurveTo(0.3, 0.16, 0.8, -0.1, 1.05, -0.6);
    s.bezierCurveTo(0.8, -0.5, 0.4, -0.5, 0.1, -0.42);
    s.bezierCurveTo(-0.08, -0.36, -0.16, -0.15, -0.1, 0.06);
  }, 0.03, 0.03), material(AZUL));
  const dorado = new Mesh(lamina((s) => {
    s.moveTo(-0.11, 0.0);
    s.bezierCurveTo(0.2, 0.08, 0.5, -0.02, 0.66, -0.26);
    s.bezierCurveTo(0.5, -0.36, 0.2, -0.36, 0.0, -0.32);
    s.bezierCurveTo(-0.12, -0.24, -0.14, -0.1, -0.11, 0.0);
  }, 0.03, 0.025), material(DORADO));
  dorado.position.z = 0.035;
  const rojo = new Mesh(lamina((s) => {
    s.moveTo(-0.1, 0.06);
    s.bezierCurveTo(0.15, 0.13, 0.36, 0.06, 0.44, -0.1);
    s.bezierCurveTo(0.3, -0.18, 0.1, -0.2, -0.04, -0.16);
    s.bezierCurveTo(-0.13, -0.1, -0.14, 0.0, -0.1, 0.06);
  }, 0.03, 0.025), material(ROJO));
  rojo.position.z = 0.065;
  plano.add(azul, dorado, rojo);
  // Plumas largas que asoman detrás al estirar el ala.
  const primarias = [];
  for (let i = 0; i < 3; i += 1) {
    const eje = new Group();
    eje.position.set(0.55 + i * 0.12, -0.42 - i * 0.04, -0.03);
    const pluma = new Mesh(lamina((s) => {
      s.moveTo(0, -0.06);
      s.lineTo(0, 0.06);
      s.quadraticCurveTo(0.5, 0.07, 0.6, 0);
      s.quadraticCurveTo(0.5, -0.07, 0, -0.06);
    }, 0.02, 0.02), material(AZUL));
    pluma.rotation.z = -0.6;
    eje.add(pluma);
    eje.scale.setScalar(0.001);
    plano.add(eje);
    primarias.push(eje);
  }
  return { ala, primarias };
}

function crearAve() {
  const partes = {};
  const inclinacion = new Group(); // gira en el plano de la pantalla, desde las patas; también salta
  const orientacion = new Group(); // gira el ave sobre su eje vertical
  orientacion.rotation.y = GIRO_BASE;
  inclinacion.add(orientacion);
  partes.inclinacion = inclinacion;
  partes.orientacion = orientacion;

  const cuerpo = new Group();
  orientacion.add(cuerpo);
  partes.cuerpo = cuerpo;

  // Cuerpo de pera, liso: ancho abajo y angosto en el cuello, que sigue dentro de la cabeza.
  // Rojo, con la panza un poco más clara.
  const geoCuerpo = new IcosahedronGeometry(1, 5);
  const p = geoCuerpo.attributes.position;
  const colores = new Float32Array(p.count * 3);
  const rojo = new Color(ROJO);
  const claro = new Color(ROJO_CLARO);
  const c = new Color();
  for (let i = 0; i < p.count; i += 1) {
    const [x, y, z] = [p.getX(i), p.getY(i), p.getZ(i)];
    const radio = 0.56 - (0.17 * Math.max(0, y + 0.2)) / 1.2;
    p.setXYZ(i, x * radio, 0.95 + y * 0.64, z * radio * 1.08);
    const panza = Math.min(1, Math.max(0, (z - 0.2) / 0.6)) * Math.min(1, Math.max(0, (0.4 - y) / 0.6));
    c.copy(rojo).lerp(claro, panza * 0.55);
    colores.set([c.r, c.g, c.b], i * 3);
  }
  geoCuerpo.setAttribute('color', new Float32BufferAttribute(colores, 3));
  const tronco = new Mesh(suavizar(geoCuerpo), material('#ffffff', { vertexColors: true }));
  cuerpo.add(tronco);

  // Plumas sueltas que asoman al esponjarse.
  partes.plumon = [];
  for (const [x, y, z] of [[0.48, 0.7, 0.24], [-0.48, 0.7, 0.24], [0.52, 0.98, -0.12], [-0.52, 0.98, -0.12], [0, 0.5, 0.56], [0.28, 1.2, 0.36], [-0.28, 1.2, 0.36]]) {
    const m = esfera([0.08, 0.055, 0.05], ROJO, 12);
    m.position.set(x, y, z);
    m.lookAt(x * 3, y, z * 3);
    const envoltura = new Group();
    envoltura.add(m);
    envoltura.scale.setScalar(0.001);
    cuerpo.add(envoltura);
    partes.plumon.push(envoltura);
  }

  const izquierda = crearAla();
  izquierda.ala.position.set(0.5, 1.14, 0.06);
  const derecha = crearAla();
  derecha.ala.position.set(-0.5, 1.14, 0.06);
  derecha.ala.scale.x = -1;
  cuerpo.add(izquierda.ala, derecha.ala);
  partes.alaIzq = izquierda;
  partes.alaDer = derecha;

  // Cola larga en punta, más larga que el cuerpo: roja con la punta azul.
  const cola = new Group();
  cola.position.set(0, 0.5, -0.4);
  const colorCola = (u) => (u < 0.62 ? ROJO : AZUL);
  for (const [x, giro, largo] of [[-0.07, -0.14, 0.88], [0, 0, 1], [0.07, 0.14, 0.88]]) {
    const geo = tuboAfinado(
      [[0, 0, 0], [0, -0.38 * largo, -0.32], [0, -0.88 * largo, -0.56], [0, -1.4 * largo, -0.7]],
      0.13, 0.02, { ancho: 0.32, pintar: colorCola },
    );
    const m = new Mesh(geo, material('#ffffff', { vertexColors: true }));
    m.position.x = x;
    m.rotation.z = giro;
    cola.add(m);
  }
  cuerpo.add(cola);
  partes.cola = cola;

  // Cabeza redonda y roja.
  const cuello = new Group();
  cuello.position.set(0, 1.42, 0.05);
  cuello.rotation.order = 'YXZ';
  orientacion.add(cuello);
  partes.cuello = cuello;
  const cabeza = esfera([0.5, 0.48, 0.51], ROJO, 40);
  cabeza.position.set(0, 0.26, 0);
  cuello.add(cabeza);

  // Mancha blanca de la cara (como la de la paraba), apoyada en la cabeza, con el ojo encima.
  partes.ojos = [];
  const angulo = 0.85; // desde el frente hacia el costado
  for (const lado of [1, -1]) {
    const cara = new Group();
    cara.position.set(Math.sin(angulo) * 0.47 * lado, 0.24, Math.cos(angulo) * 0.47);
    cara.rotation.y = angulo * lado;
    const mancha = esfera([0.22, 0.2, 0.07], BLANCO);
    const ojo = new Group();
    ojo.position.set(0.02 * lado, 0.03, 0.06);
    const disco = new Mesh(new CylinderGeometry(0.095, 0.095, 0.04, 28), material(NEGRO));
    disco.rotation.x = Math.PI / 2;
    const brillo = esfera([0.025, 0.025, 0.01], BLANCO, 10);
    brillo.position.set(-0.03, 0.035, 0.025);
    ojo.add(disco, brillo);
    cara.add(mancha, ojo);
    cuello.add(cara);
    partes.ojos.push({ ojo });
  }

  // Pico grande de paraba: superior dorado en gancho y mandíbula negra.
  const superior = new Mesh(
    tuboAfinado([[0, 0.3, 0.38], [0, 0.36, 0.56], [0, 0.26, 0.72], [0, 0.08, 0.74], [0, -0.04, 0.64]], 0.2, 0.02, { alto: 0.85 }),
    material(DORADO),
  );
  const inferior = new Mesh(
    tuboAfinado([[0, 0.1, 0.4], [0, 0.03, 0.55], [0, 0, 0.6]], 0.15, 0.05, { alto: 0.9 }),
    material(NEGRO),
  );
  cuello.add(superior, inferior);

  // Patas grises agarradas a la rama: dos dedos adelante y dos atrás, como las parabas.
  partes.patas = [];
  for (const x of [0.17, -0.17]) {
    const pata = new Group();
    pata.position.set(x, 0, 0.04);
    const pierna = new Mesh(new CylinderGeometry(0.05, 0.06, 0.3, 12), material(GRIS));
    pierna.position.y = 0.17;
    pata.add(pierna);
    for (const giro of [-0.3, 0.3, Math.PI - 0.3, Math.PI + 0.3]) {
      const brazo = new Group();
      brazo.rotation.y = giro;
      const dedo = new Mesh(new CapsuleGeometry(0.035, 0.1, 4, 10), material(GRIS));
      dedo.rotation.x = Math.PI / 2 + 0.5;
      dedo.position.set(0, 0.0, 0.08);
      brazo.add(dedo);
      pata.add(brazo);
    }
    orientacion.add(pata);
    partes.patas.push(pata);
  }
  return partes;
}

// Rama natural: curva, se afina hacia la punta, con nudos, una ramita y hojas.
function crearRama() {
  const rama = new Group();
  const corteza = material(CORTEZA);
  const tronco = new Mesh(
    tuboAfinado([[-0.9, -0.15, 0.05], [0.2, -0.1, 0], [1.2, -0.17, -0.05], [2.3, -0.07, 0], [3.6, -0.13, 0.05]], 0.15, 0.1, { pasos: 60, lados: 18 }),
    corteza,
  );
  const tapa = esfera([0.15, 0.15, 0.15], CORTEZA, 20);
  tapa.position.set(-0.9, -0.15, 0.05);
  rama.add(tronco, tapa);
  for (const [x, y, z, r] of [[0.65, -0.12, 0.11, 0.06], [1.75, -0.1, -0.1, 0.05]]) {
    const nudo = esfera([r, r * 0.8, r], '#6e4529', 14);
    nudo.position.set(x, y, z);
    rama.add(nudo);
  }
  const ramita = new Mesh(tuboAfinado([[1.3, -0.1, 0], [1.6, 0.22, 0.05], [1.95, 0.42, 0]], 0.05, 0.015, { pasos: 20, lados: 10 }), corteza);
  rama.add(ramita);
  const forma = (s) => {
    s.moveTo(0, 0);
    s.quadraticCurveTo(0.12, 0.1, 0.32, 0);
    s.quadraticCurveTo(0.12, -0.1, 0, 0);
  };
  for (const [x, y, z, giroZ, giroY] of [[1.95, 0.42, 0, 0.4, 0.2], [1.75, 0.33, 0.04, 1.4, -0.4], [1.55, 0.18, -0.02, -0.5, 0.6]]) {
    const hoja = new Mesh(lamina(forma, 0.01, 0.01), material(HOJA));
    hoja.position.set(x, y, z);
    hoja.rotation.set(1.2, giroY, giroZ);
    rama.add(hoja);
  }
  return rama;
}

// Sombra suave del ave sobre la rama.
function crearSombra() {
  const lienzo = document.createElement('canvas');
  lienzo.width = 128;
  lienzo.height = 128;
  const ctx = lienzo.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(40,30,20,0.3)');
  g.addColorStop(1, 'rgba(40,30,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const sombra = new Mesh(new PlaneGeometry(1.2, 0.36), new MeshBasicMaterial({ map: new CanvasTexture(lienzo), transparent: true, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.set(-0.05, 0.02, 0);
  return sombra;
}

// ---------- animación ----------
const POSE_BASE = {
  inclinar: 0, girar: 0, yaw: 0, pitch: 0, roll: 0, alaIzq: 0, alaDer: 0, abanico: 0,
  colaGiro: 0, colaAlza: 0, plumon: 0, pata: 0, ojo: 1,
};
const POSES = {
  atento: {},
  'mirando-usuario': { inclinar: 0.1, yaw: -0.5, pitch: 0.1 },
  'mirando-contrasena': { inclinar: 0.13, yaw: -0.45, pitch: 0.3, roll: 0.08 },
  'ojos-cerrados': { inclinar: -0.05, yaw: 1.3, pitch: -0.22, roll: -0.1, ojo: 0 },
  reposo: {},
};

const CICLO = 20;
const ACCIONES = [
  // Mira a un lado y al otro.
  { desde: 1.4, hasta: 2.9, pose: { yaw: -0.7, roll: 0.15 } },
  { desde: 2.9, hasta: 4.3, pose: { yaw: 0.6, roll: -0.12 } },
  // Se acicala el ala: gira la cabeza hacia ella, cierra los ojos y se pica las plumas.
  { desde: 5.0, hasta: 8.2, pose: { ojo: 0, yaw: 1.6, pitch: 0.5, roll: -0.2, alaIzq: 0.2, inclinar: -0.04 } },
  // Estira el ala, abre las plumas y la mira.
  { desde: 8.9, hasta: 11.0, pose: { alaIzq: 1, alaDer: 0.3, abanico: 1, yaw: 0.9, inclinar: -0.06, colaAlza: 0.15 } },
  // Se esponja con los ojos cerrados.
  { desde: 11.7, hasta: 13.3, pose: { ojo: 0, plumon: 1, pitch: -0.1 } },
  // Levanta una pata y se acomoda en la rama.
  { desde: 14.0, hasta: 14.8, pose: { pata: 1, inclinar: -0.06 } },
  { desde: 14.8, hasta: 15.7, pose: { inclinar: 0.05 } },
];
const SALTO = { desde: 16.8, dura: 0.55 };

const suave = (x) => x * x * (3 - 2 * x);
function ventana(t, desde, hasta, rampa = 0.5) {
  if (t <= desde || t >= hasta) return 0;
  return suave(Math.min(1, (t - desde) / rampa, (hasta - t) / rampa));
}

function poseObjetivo(estado, t, seguimiento) {
  const pose = { ...POSE_BASE, ...(POSES[estado] || {}) };
  // La cabeza sigue el texto: al alargarse, el cursor se acerca al ave.
  if (estado.startsWith('mirando')) pose.yaw += (seguimiento - 0.5) * 0.3;
  if (estado === 'reposo') {
    const c = t % CICLO;
    for (const accion of ACCIONES) {
      const peso = ventana(c, accion.desde, accion.hasta);
      if (!peso) continue;
      for (const [clave, valor] of Object.entries(accion.pose)) {
        const base = POSES.reposo[clave] ?? POSE_BASE[clave];
        pose[clave] += (valor - base) * peso;
      }
    }
  }
  return pose;
}

// Movimiento que no pasa por el resorte: respiración, balanceo, picoteo, saltito y parpadeo.
function movimientoDirecto(estado, t) {
  const m = {
    respira: 0.018 * Math.sin((2 * Math.PI * t) / 3.4),
    balanceo: 0.025 * Math.sin((2 * Math.PI * t) / 5.6),
    cola: 0.07 * Math.sin((2 * Math.PI * t) / 5.6 - 0.9),
    cabezaY: 0.012 * Math.sin((2 * Math.PI * t) / 3.4 + 0.6),
    pitch: 0,
    salto: 0,
    aplastar: 0,
    ojo: 1,
  };
  if (estado === 'reposo') {
    const c = t % CICLO;
    m.pitch = 0.13 * ventana(c, 5.7, 7.8, 0.3) * Math.sin(2 * Math.PI * 3 * t);
    // Saltito: se agacha, sube y cae aplastándose un poco.
    const u = (c - SALTO.desde) / SALTO.dura;
    if (u > -0.3 && u < 0) m.aplastar = Math.sin((Math.PI * (u + 0.3)) / 0.3) * 0.08;
    if (u >= 0 && u <= 1) m.salto = Math.sin(Math.PI * u) * 0.3;
    if (u > 1 && u < 1.35) m.aplastar = Math.sin((Math.PI * (u - 1)) / 0.35) * 0.1;
  }
  const p = t % 3.8; // parpadeo cada 3,8 s, de 180 ms
  if (p < 0.18) m.ojo = 1 - Math.sin((Math.PI * p) / 0.18);
  return m;
}

function ParabaPosada({ estado = 'reposo', seguimiento = 0, className = '' }) {
  const contenedor = useRef(null);
  const entrada = useRef({ estado, seguimiento });
  entrada.current = { estado, seguimiento: Math.min(Math.max(seguimiento, 0), 1) };

  useEffect(() => {
    const caja = contenedor.current;
    let renderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return undefined; // sin WebGL el panel queda solo con su fondo
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = NoToneMapping; // colores tal cual
    caja.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    // Luz pareja y suave: volumen sin sombras duras.
    const escena = new Scene();
    escena.add(new HemisphereLight('#ffffff', '#e6e1cf', 2.1));
    const clave = new DirectionalLight('#fffaf2', 1.3);
    clave.position.set(-2, 5, 3);
    escena.add(clave);

    const ave = crearAve();
    const mundo = new Group();
    mundo.add(ave.inclinacion, crearRama(), crearSombra());
    escena.add(mundo);

    const camara = new PerspectiveCamera(30, 1, 0.1, 50);
    const ajustar = () => {
      const { clientWidth: w, clientHeight: h } = caja;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camara.aspect = w / h;
      const distancia = ALTO_VISIBLE / (2 * Math.tan((camara.fov * Math.PI) / 360));
      // Un poco desde arriba.
      camara.position.set(0, 1.9, distancia);
      camara.lookAt(0, 0.75, 0);
      camara.updateProjectionMatrix();
      // El ave a la derecha del centro; la rama sigue hasta el borde.
      mundo.position.x = ALTO_VISIBLE * camara.aspect * 0.1;
    };
    ajustar();
    const observador = new ResizeObserver(ajustar);
    observador.observe(caja);

    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const actual = { ...POSE_BASE };
    const velocidad = Object.fromEntries(Object.keys(POSE_BASE).map((k) => [k, 0]));
    let anterior = performance.now();
    let cuadro = 0;

    const dibujar = (ahora) => {
      const dt = Math.min((ahora - anterior) / 1000, 1 / 30);
      anterior = ahora;
      const t = ahora / 1000;
      const quieto = reducido?.matches;
      const { estado: e, seguimiento: s } = entrada.current;
      const objetivo = poseObjetivo(e, t, s);
      for (const k of Object.keys(actual)) {
        if (quieto) {
          actual[k] = objetivo[k];
          velocidad[k] = 0;
        } else {
          // Resorte: rígido 60, amortiguado 12 (llega suave y con un leve rebote).
          velocidad[k] += ((objetivo[k] - actual[k]) * 60 - velocidad[k] * 12) * dt;
          actual[k] += velocidad[k] * dt;
        }
      }
      const d = quieto
        ? { respira: 0, balanceo: 0, cola: 0, cabezaY: 0, pitch: 0, salto: 0, aplastar: 0, ojo: 1 }
        : movimientoDirecto(e, t);
      const a = actual;

      ave.inclinacion.rotation.z = a.inclinar + d.balanceo;
      ave.inclinacion.position.y = d.salto;
      ave.orientacion.rotation.y = GIRO_BASE + a.girar;
      const esponja = Math.max(0, a.plumon);
      ave.cuerpo.scale.set(
        1 + 0.08 * esponja + d.aplastar * 0.6,
        1 + 0.05 * esponja + d.respira - d.aplastar,
        1 + 0.08 * esponja + d.aplastar * 0.6,
      );
      ave.plumon.forEach((m) => m.scale.setScalar(Math.max(0.001, esponja)));
      ave.cuello.position.y = 1.42 * ave.cuerpo.scale.y + d.cabezaY;
      ave.cuello.rotation.set(a.pitch + d.pitch, a.yaw, a.roll);
      // Al abrir, el ala sube hacia atrás y se separa del cuerpo.
      ave.alaIzq.ala.rotation.set(0.9 * a.alaIzq, 0, -0.16 + 1.0 * a.alaIzq);
      ave.alaDer.ala.rotation.set(0.9 * a.alaDer, 0, -0.16 + 1.0 * a.alaDer);
      ave.alaIzq.primarias.forEach((p, i) => {
        p.scale.setScalar(Math.max(0.001, a.abanico));
        p.rotation.z = -i * 0.25 * a.abanico;
      });
      ave.alaDer.primarias.forEach((p) => p.scale.setScalar(Math.max(0.001, a.abanico * 0.4)));
      ave.cola.rotation.set(a.colaAlza, 0, a.colaGiro + d.cola);
      ave.patas[1].position.y = 0.2 * a.pata;
      ave.patas[1].rotation.x = -0.5 * a.pata;
      // Ojo cerrado: el disco se aplasta hasta una rayita.
      const abierto = Math.max(0, Math.min(1, a.ojo * d.ojo));
      ave.ojos.forEach(({ ojo }) => { ojo.scale.y = Math.max(0.12, abierto); });
      renderer.render(escena, camara);
      cuadro = requestAnimationFrame(dibujar);
    };
    cuadro = requestAnimationFrame(dibujar);

    return () => {
      cancelAnimationFrame(cuadro);
      observador.disconnect();
      escena.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (o.material.map) o.material.map.dispose();
          o.material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={contenedor} className={className} aria-hidden="true" />;
}

export default ParabaPosada;
