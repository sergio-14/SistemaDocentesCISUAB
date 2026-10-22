import { useEffect, useRef } from 'react';
import {
  ACESFilmicToneMapping, BufferGeometry, CanvasTexture, CapsuleGeometry, CatmullRomCurve3, Color, CylinderGeometry,
  DirectionalLight, DoubleSide, ExtrudeGeometry, Float32BufferAttribute, Group, HemisphereLight, LatheGeometry, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene, Shape, SphereGeometry,
  SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Paraba 3D (Three.js) de estilo tierno y suave: cabeza y cuerpo en una sola silueta redondeada,
// disco blanco con un ojo grande a cada lado, pico chico y curvo, ala plana con el borde en ondas,
// cola larga, copete y patas finas, posada en una rama. Azul y amarillo del logo de la UAB,
// aclarados. Reacciona al login:
//   reposo              nada escrito ni enfocado: ojos entrecerrados; mira a los lados, se acicala el
//                       ala, la estira, se esponja, levanta una pata y da un saltito.
//   mirando-usuario     escribiendo el usuario: se inclina un poco hacia el campo y lo sigue con la mirada.
//   mirando-contrasena  igual, un poco más abajo (el campo de la contraseña está debajo).
//   ojos-cerrados       la contraseña está a la vista: cierra los ojos y aparta la cabeza.
//   atento              campos llenos sin foco: quieta, parpadeando.
// Modelo propio armado con formas de Three.js (sin archivos). Cada parte va con un resorte hacia su
// pose (sin saltos entre estados) más un movimiento continuo: respira, se balancea y la cola sigue con
// retraso. Con prefers-reduced-motion toma la pose de cada estado sin animar.

// Azul y dorado del logo de la UAB (#1718d0 y #c9b810), aclarados para el tono suave del modelo.
const AZUL = '#4a6ee6';
const AZUL_OSCURO = '#3553c4';
const AMARILLO = '#f6dc56';
const BLANCO = '#ffffff';
const OJO = '#1d1f2e';
const PICO = '#3e5458';

const ALTO_VISIBLE = 3.1; // unidades del modelo que entran a lo alto del cuadro
const GIRO_BASE = -1.0; // de tres cuartos, mirando hacia el formulario (a la izquierda)

// ---------- modelo ----------
const material = (color, extra = {}) => new MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });

function suavizar(geometria) {
  geometria.deleteAttribute('normal');
  geometria.deleteAttribute('uv');
  const unida = mergeVertices(geometria, 1e-4);
  unida.computeVertexNormals();
  return unida;
}

// Lámina plana con bordes redondeados (ala, cola), centrada en su grosor.
function lamina(dibujar, grosor, bisel) {
  const s = new Shape();
  dibujar(s);
  const g = new ExtrudeGeometry(s, {
    depth: grosor, bevelEnabled: true, bevelThickness: bisel, bevelSize: bisel, bevelSegments: 5, curveSegments: 20,
  });
  g.translate(0, 0, -grosor / 2);
  return suavizar(g);
}

// Tubo que sigue una curva y se afina hasta la punta (pico).
function tuboAfinado(puntos, radioBase, radioPunta, { alto = 1, pasos = 24, lados = 12 } = {}) {
  const curva = new CatmullRomCurve3(puntos.map((p) => new Vector3(...p)));
  const marcos = curva.computeFrenetFrames(pasos, false);
  const posiciones = [];
  const indices = [];
  for (let i = 0; i <= pasos; i += 1) {
    const u = i / pasos;
    const centro = curva.getPointAt(u);
    const radio = radioBase + (radioPunta - radioBase) * u;
    const n = marcos.normals[i];
    const b = marcos.binormals[i];
    for (let j = 0; j <= lados; j += 1) {
      const ang = (j / lados) * Math.PI * 2;
      const x = Math.cos(ang) * radio;
      const y = Math.sin(ang) * radio * alto;
      posiciones.push(centro.x + n.x * x + b.x * y, centro.y + n.y * x + b.y * y, centro.z + n.z * x + b.z * y);
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
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function crearAla() {
  const ala = new Group();
  const plano = new Group();
  plano.rotation.set(0.25, Math.PI / 2, 0); // pegada al costado, con la punta hacia atrás y abajo
  ala.add(plano);
  // Paleta con el borde de atrás en tres ondas, como plumas redondas.
  const forma = lamina((s) => {
    s.moveTo(-0.08, 0.04);
    s.bezierCurveTo(0.15, 0.13, 0.46, 0.02, 0.64, -0.28);
    s.quadraticCurveTo(0.63, -0.42, 0.51, -0.38);
    s.quadraticCurveTo(0.48, -0.52, 0.36, -0.45);
    s.quadraticCurveTo(0.3, -0.57, 0.18, -0.47);
    s.bezierCurveTo(0.04, -0.43, -0.13, -0.26, -0.08, 0.04);
  }, 0.04, 0.035);
  plano.add(new Mesh(forma, material(AZUL)));
  // Plumas largas que aparecen detrás al estirar el ala.
  const primarias = [];
  for (let i = 0; i < 3; i += 1) {
    const eje = new Group();
    eje.position.set(0.3 + i * 0.1, -0.3 - i * 0.03, -0.02);
    const pluma = lamina((s) => {
      s.moveTo(0, -0.05);
      s.lineTo(0, 0.05);
      s.quadraticCurveTo(0.42, 0.06, 0.5, 0);
      s.quadraticCurveTo(0.42, -0.06, 0, -0.05);
    }, 0.02, 0.02);
    const m = new Mesh(pluma, material(AZUL_OSCURO));
    m.rotation.z = -0.6;
    eje.add(m);
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

  // Cuerpo de revolución (de la base hasta dentro de la cabeza, para que no se vea la unión):
  // amarillo al frente, azul en la espalda.
  const perfil = [[0, 0.32], [0.2, 0.34], [0.38, 0.44], [0.49, 0.62], [0.52, 0.85], [0.5, 1.08], [0.46, 1.3], [0.44, 1.5], [0.4, 1.62], [0.28, 1.74]]
    .map(([r, y]) => new Vector2(r, y));
  const geoCuerpo = new LatheGeometry(perfil, 40);
  geoCuerpo.computeVertexNormals();
  const n = geoCuerpo.attributes.normal;
  const p = geoCuerpo.attributes.position;
  const colores = new Float32Array(p.count * 3);
  const azul = new Color(AZUL);
  const amarillo = new Color(AMARILLO);
  const c = new Color();
  for (let i = 0; i < p.count; i += 1) {
    // Frente amarillo con un borde suave; más arriba del pecho, azul.
    const frente = Math.min(1, Math.max(0, (n.getZ(i) + 0.05) / 0.35));
    const altura = Math.min(1, Math.max(0, (1.56 - p.getY(i)) / 0.12));
    c.copy(azul).lerp(amarillo, frente * altura);
    colores.set([c.r, c.g, c.b], i * 3);
  }
  geoCuerpo.setAttribute('color', new Float32BufferAttribute(colores, 3));
  const tronco = new Mesh(geoCuerpo, material('#ffffff', { vertexColors: true }));
  cuerpo.add(tronco);

  // Plumas sueltas que asoman al esponjarse.
  partes.plumon = [];
  for (const [x, y, z, color] of [[0.44, 0.7, 0.24, AMARILLO], [-0.44, 0.7, 0.24, AMARILLO], [0.5, 1.0, -0.1, AZUL], [-0.5, 1.0, -0.1, AZUL], [0, 0.5, 0.48, AMARILLO], [0.25, 1.2, 0.38, AMARILLO], [-0.25, 1.2, 0.38, AMARILLO]]) {
    const m = new Mesh(new SphereGeometry(0.07, 10, 8), material(color));
    m.scale.set(1, 0.7, 0.6);
    m.position.set(x, y, z);
    m.lookAt(x * 3, y, z * 3);
    const envoltura = new Group();
    envoltura.add(m);
    envoltura.scale.setScalar(0.001);
    cuerpo.add(envoltura);
    partes.plumon.push(envoltura);
  }

  const izquierda = crearAla();
  izquierda.ala.position.set(0.47, 1.12, 0.06);
  const derecha = crearAla();
  derecha.ala.position.set(-0.47, 1.12, 0.06);
  derecha.ala.scale.x = -1;
  cuerpo.add(izquierda.ala, derecha.ala);
  partes.alaIzq = izquierda;
  partes.alaDer = derecha;

  // Cola larga y plana: azul arriba y amarilla abajo.
  const cola = new Group();
  cola.position.set(0, 0.55, -0.38);
  const dibujoCola = (largo, ancho) => (s) => {
    s.moveTo(0, -ancho);
    s.lineTo(0, ancho);
    s.bezierCurveTo(largo * 0.6, ancho * 1.1, largo * 0.95, ancho * 0.7, largo, 0);
    s.bezierCurveTo(largo * 0.95, -ancho * 0.7, largo * 0.6, -ancho * 1.1, 0, -ancho);
  };
  const arriba = new Mesh(lamina(dibujoCola(1.0, 0.13), 0.03, 0.025), material(AZUL));
  const abajo = new Mesh(lamina(dibujoCola(0.85, 0.11), 0.03, 0.025), material(AMARILLO));
  abajo.position.y = -0.06;
  for (const m of [arriba, abajo]) {
    m.rotation.order = 'YXZ';
    m.rotation.set(-Math.PI / 2, Math.PI / 2, 0); // horizontal, hacia atrás
    cola.add(m);
  }
  cuerpo.add(cola);
  partes.cola = cola;

  // Cabeza: esfera del mismo ancho que el cuello, así la silueta sigue de una pieza.
  const cuello = new Group();
  cuello.position.set(0, 1.45, 0.05);
  cuello.rotation.order = 'YXZ';
  orientacion.add(cuello);
  partes.cuello = cuello;
  const cabeza = new Mesh(new SphereGeometry(0.46, 40, 28), material(AZUL));
  cabeza.scale.set(1, 0.95, 1.02);
  cabeza.position.set(0, 0.2, 0);
  cuello.add(cabeza);

  // Copete de tres plumitas.
  for (const [x, giro] of [[-0.05, -0.25], [0.03, 0], [0.1, 0.25]]) {
    const pluma = new Mesh(new CapsuleGeometry(0.035, 0.12, 4, 10), material(AZUL));
    pluma.position.set(x, 0.66, -0.12);
    pluma.rotation.set(-0.5, 0, giro);
    cuello.add(pluma);
  }

  // Disco blanco con un ojo grande a cada lado.
  partes.ojos = [];
  const blanco = material(BLANCO, { roughness: 0.6 });
  const negro = material(OJO, { roughness: 0.3 });
  for (const lado of [1, -1]) {
    const cara = new Group();
    // Apoyado sobre la superficie de la cabeza, mirando hacia afuera y adelante.
    cara.position.set(Math.sin(0.75) * 0.43 * lado, 0.24, Math.cos(0.75) * 0.43);
    cara.rotation.y = 0.75 * lado;
    const disco = new Mesh(new SphereGeometry(0.27, 32, 20), blanco);
    disco.scale.set(1, 1.05, 0.32);
    const ojo = new Group();
    ojo.position.z = 0.07;
    const iris = new Mesh(new SphereGeometry(0.115, 24, 16), negro);
    iris.scale.set(1, 1, 0.4);
    const brillo = new Mesh(new SphereGeometry(0.025, 10, 8), blanco);
    brillo.position.set(-0.04, 0.045, 0.045);
    ojo.add(iris, brillo);
    cara.add(disco, ojo);
    cuello.add(cara);
    partes.ojos.push({ ojo, brillo });
  }

  // Pico chico, oscuro y curvo.
  const pico = new Mesh(
    tuboAfinado([[0, 0.24, 0.36], [0, 0.27, 0.5], [0, 0.18, 0.6], [0, 0.06, 0.58]], 0.11, 0.015, { alto: 0.85 }),
    material(PICO, { roughness: 0.5, side: DoubleSide }),
  );
  cuello.add(pico);

  // Patas finas agarradas a la rama: pierna y tres dedos (dos adelante y uno atrás).
  partes.patas = [];
  const gris = material(PICO, { roughness: 0.6 });
  for (const x of [0.17, -0.17]) {
    const pata = new Group();
    pata.position.set(x, 0, 0.04);
    const pierna = new Mesh(new CylinderGeometry(0.04, 0.045, 0.36, 10), gris);
    pierna.position.y = 0.18;
    pata.add(pierna);
    for (const [dx, giro] of [[-0.04, 0.35], [0.04, 0.35], [0, Math.PI - 0.35]]) {
      const dedo = new Mesh(new CapsuleGeometry(0.03, 0.1, 4, 8), gris);
      dedo.position.set(dx, 0.01, Math.cos(giro) * 0.07);
      dedo.rotation.x = Math.PI / 2 - giro;
      pata.add(dedo);
    }
    orientacion.add(pata);
    partes.patas.push(pata);
  }
  return partes;
}

function crearRama() {
  const rama = new Group();
  const madera = material('#7a5638', { roughness: 0.95 });
  const tronco = new Mesh(new CylinderGeometry(0.09, 0.12, 6, 14), madera);
  tronco.rotation.z = Math.PI / 2;
  tronco.position.set(2.4, -0.09, 0);
  const ramita = new Mesh(new CylinderGeometry(0.022, 0.04, 0.55, 8), madera);
  ramita.position.set(1.35, 0.12, 0.05);
  ramita.rotation.z = -0.9;
  rama.add(tronco, ramita);
  for (const [x, y, giro] of [[1.6, 0.32, 0.5], [1.44, 0.4, -0.2]]) {
    const hoja = new Mesh(new SphereGeometry(1, 16, 10), material('#6aa84f', { roughness: 0.7 }));
    hoja.scale.set(0.16, 0.045, 0.09);
    hoja.position.set(x, y, 0.05);
    hoja.rotation.z = giro;
    rama.add(hoja);
  }
  return rama;
}

// Sombra suave sobre la rama, como en el modelo.
function crearSombra() {
  const lienzo = document.createElement('canvas');
  lienzo.width = 128;
  lienzo.height = 128;
  const ctx = lienzo.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(30,41,59,0.35)');
  g.addColorStop(1, 'rgba(30,41,59,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const sombra = new Mesh(new PlaneGeometry(1.4, 0.5), new MeshBasicMaterial({ map: new CanvasTexture(lienzo), transparent: true, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.set(-0.1, 0.012, 0);
  return sombra;
}

// ---------- animación ----------
const POSE_BASE = {
  inclinar: 0, girar: 0, yaw: 0, pitch: 0, roll: 0, alaIzq: 0, alaDer: 0, abanico: 0,
  colaGiro: 0, colaAlza: 0, plumon: 0, pata: 0, ojo: 1, mirada: 0,
};
const POSES = {
  atento: {},
  'mirando-usuario': { inclinar: 0.1, yaw: -0.5, pitch: 0.1, mirada: -0.6 },
  'mirando-contrasena': { inclinar: 0.13, yaw: -0.45, pitch: 0.3, roll: 0.08, mirada: -0.6 },
  'ojos-cerrados': { inclinar: -0.05, yaw: 1.3, pitch: -0.22, roll: -0.1, ojo: 0 },
  reposo: { ojo: 0.45 },
};

const CICLO = 20;
const ACCIONES = [
  // Mira a un lado y al otro.
  { desde: 1.4, hasta: 2.9, pose: { ojo: 1, yaw: -0.7, roll: 0.15, mirada: -0.8 } },
  { desde: 2.9, hasta: 4.3, pose: { ojo: 1, yaw: 0.6, roll: -0.12, mirada: 0.8 } },
  // Se acicala el ala: gira la cabeza hacia ella y se pica las plumas.
  { desde: 5.0, hasta: 8.2, pose: { ojo: 0, yaw: 1.6, pitch: 0.5, roll: -0.2, alaIzq: 0.2, inclinar: -0.04 } },
  // Estira el ala, abre las plumas y la mira.
  { desde: 8.9, hasta: 11.0, pose: { ojo: 1, alaIzq: 1, alaDer: 0.3, abanico: 1, yaw: 0.9, mirada: 0.7, inclinar: -0.06, colaAlza: 0.15 } },
  // Se esponja.
  { desde: 11.7, hasta: 13.3, pose: { ojo: 0, plumon: 1, pitch: -0.1 } },
  // Levanta una pata y se acomoda en la rama.
  { desde: 14.0, hasta: 14.8, pose: { ojo: 1, pata: 1, inclinar: -0.06 } },
  { desde: 14.8, hasta: 15.7, pose: { ojo: 1, inclinar: 0.05 } },
  // Mira al frente justo antes del saltito.
  { desde: 16.3, hasta: 17.8, pose: { ojo: 1 } },
];
const SALTO = { desde: 16.8, dura: 0.55 };

const suave = (x) => x * x * (3 - 2 * x);
function ventana(t, desde, hasta, rampa = 0.5) {
  if (t <= desde || t >= hasta) return 0;
  return suave(Math.min(1, (t - desde) / rampa, (hasta - t) / rampa));
}

function poseObjetivo(estado, t, seguimiento) {
  const pose = { ...POSE_BASE, ...(POSES[estado] || {}) };
  if (estado.startsWith('mirando')) {
    // La cabeza y la mirada siguen el texto: al alargarse, el cursor se acerca al ave.
    pose.yaw += (seguimiento - 0.5) * 0.3;
    pose.mirada += seguimiento * 1.0;
  }
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
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    caja.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    const escena = new Scene();
    escena.add(new HemisphereLight('#ffffff', '#d7dcc0', 1.9));
    const clave = new DirectionalLight('#fffaf0', 1.8);
    clave.position.set(-2, 5, 4);
    const relleno = new DirectionalLight('#e8efff', 0.6);
    relleno.position.set(3, 2, 3);
    escena.add(clave, relleno);

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
      camara.position.set(0, 1.25, distancia);
      camara.lookAt(0, 0.85, 0);
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
      ave.cuello.position.y = 1.45 * ave.cuerpo.scale.y + d.cabezaY;
      ave.cuello.rotation.set(a.pitch + d.pitch, a.yaw, a.roll);
      ave.alaIzq.ala.rotation.set(-0.3 * a.alaIzq, 0, -0.08 + 1.05 * a.alaIzq);
      ave.alaDer.ala.rotation.set(-0.3 * a.alaDer, 0, -0.08 + 1.05 * a.alaDer);
      ave.alaIzq.primarias.forEach((p, i) => {
        p.scale.setScalar(Math.max(0.001, a.abanico));
        p.rotation.z = -i * 0.25 * a.abanico;
      });
      ave.alaDer.primarias.forEach((p) => p.scale.setScalar(Math.max(0.001, a.abanico * 0.4)));
      ave.cola.rotation.set(0.3 + a.colaAlza, 0, a.colaGiro + d.cola);
      ave.patas[1].position.y = 0.2 * a.pata;
      ave.patas[1].rotation.x = -0.5 * a.pata;
      // Ojo cerrado: el disco negro se aplasta hasta una rayita.
      const abierto = Math.max(0, Math.min(1, a.ojo * d.ojo));
      ave.ojos.forEach(({ ojo, brillo }) => {
        ojo.scale.y = Math.max(0.1, abierto);
        brillo.visible = abierto > 0.5;
        ojo.position.x = 0.05 * Math.max(-1, Math.min(1, a.mirada));
      });
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
