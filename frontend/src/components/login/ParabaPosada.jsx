import { useEffect, useRef } from 'react';
import {
  BufferGeometry, CanvasTexture, CapsuleGeometry, CatmullRomCurve3, Color, CylinderGeometry, DirectionalLight,
  ExtrudeGeometry, Float32BufferAttribute, Group, HemisphereLight, IcosahedronGeometry, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, NoToneMapping, PerspectiveCamera, PlaneGeometry, Scene, Shape, SRGBColorSpace, Vector3,
  WebGLRenderer,
} from 'three';

// Paraba 3D (Three.js) de pocas caras y colores pastel, como el modelo de referencia: cuerpo de pera
// unido a la cabeza, máscara blanca en el frente con un ojo grande a cada lado, gorra azul, pico chico
// y curvo, copete, ala de paleta con tres ondas, cola en dos capas y patas grises, sobre una rama.
// Luz pareja y sin contraste fuerte. Reacciona al login:
//   reposo              nada escrito ni enfocado: parpadea; mira a los lados, se acicala el
//                       ala, la estira, se esponja, levanta una pata y da un saltito.
//   mirando-usuario     escribiendo el usuario: se inclina un poco hacia el campo.
//   mirando-contrasena  igual, un poco más abajo (el campo de la contraseña está debajo).
//   ojos-cerrados       la contraseña está a la vista: cierra los ojos y aparta la cabeza.
//   atento              campos llenos sin foco: quieta, parpadeando.
// Modelo propio armado con formas de Three.js (sin archivos). Cada parte va con un resorte hacia su
// pose (sin saltos entre estados) más un movimiento continuo: respira, se balancea y la cola sigue con
// retraso. Con prefers-reduced-motion toma la pose de cada estado sin animar.

const AZUL = '#6f8ff0';
const AZUL_OSCURO = '#5a78dc';
const AMARILLO = '#ffe46b';
const BLANCO = '#ffffff';
const OJO = '#23253b';
const GRIS = '#3f5a5c';

const ALTO_VISIBLE = 3.0; // unidades del modelo que entran a lo alto del cuadro
const GIRO_BASE = -1.0; // casi de perfil, mirando hacia el formulario (a la izquierda), como el modelo

// ---------- modelo ----------
// Caras planas con luz pareja: el aspecto de pocas caras del modelo.
const material = (color, extra = {}) => new MeshLambertMaterial({ color, flatShading: true, ...extra });

function gema(radios, color, detalle = 1) {
  const g = new IcosahedronGeometry(1, detalle);
  g.scale(...radios);
  return new Mesh(g, material(color));
}

// Lámina plana de bordes redondeados y pocas caras (ala, cola), centrada en su grosor.
function lamina(dibujar, grosor, bisel) {
  const s = new Shape();
  dibujar(s);
  const g = new ExtrudeGeometry(s, {
    depth: grosor, bevelEnabled: true, bevelThickness: bisel, bevelSize: bisel, bevelSegments: 2, curveSegments: 5,
  });
  g.translate(0, 0, -grosor / 2);
  return g;
}

// Tubo de pocas caras que sigue una curva y se afina hasta la punta (pico).
function tuboAfinado(puntos, radioBase, radioPunta, { pasos = 6, lados = 6 } = {}) {
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
      const y = Math.sin(ang) * radio * 0.85;
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
  plano.rotation.set(0.35, Math.PI / 2, 0); // pegada al costado, con las ondas atrás y abajo
  ala.add(plano);
  // Paleta grande con tres ondas redondas en el borde de atrás.
  plano.add(new Mesh(lamina((s) => {
    s.moveTo(-0.12, 0.08);
    s.bezierCurveTo(0.18, 0.2, 0.55, 0.06, 0.72, -0.26);
    s.quadraticCurveTo(0.74, -0.42, 0.6, -0.4);
    s.quadraticCurveTo(0.58, -0.56, 0.44, -0.5);
    s.quadraticCurveTo(0.38, -0.64, 0.24, -0.54);
    s.bezierCurveTo(0.06, -0.5, -0.18, -0.3, -0.12, 0.08);
  }, 0.06, 0.04), material(AZUL)));
  // Plumas largas que asoman detrás al estirar el ala.
  const primarias = [];
  for (let i = 0; i < 3; i += 1) {
    const eje = new Group();
    eje.position.set(0.36 + i * 0.12, -0.32 - i * 0.04, -0.03);
    const pluma = new Mesh(lamina((s) => {
      s.moveTo(0, -0.06);
      s.lineTo(0, 0.06);
      s.quadraticCurveTo(0.45, 0.07, 0.55, 0);
      s.quadraticCurveTo(0.45, -0.07, 0, -0.06);
    }, 0.02, 0.02), material(AZUL_OSCURO));
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

  // Cuerpo de pera de pocas caras: una esfera de triángulos estirada (ancha abajo, angosta en el
  // cuello, que sigue dentro de la cabeza). Amarillo al frente, azul atrás, cara por cara.
  const geoCuerpo = new IcosahedronGeometry(1, 2);
  const p = geoCuerpo.attributes.position;
  const unitarias = p.array.slice();
  for (let i = 0; i < p.count; i += 1) {
    const [x, y, z] = [p.getX(i), p.getY(i), p.getZ(i)];
    const radio = 0.57 - (0.17 * Math.max(0, y + 0.2)) / 1.2;
    p.setXYZ(i, x * radio, 0.95 + y * 0.64, z * radio * 1.08);
  }
  const colores = new Float32Array(p.count * 3);
  const azul = new Color(AZUL);
  const amarillo = new Color(AMARILLO);
  for (let i = 0; i < p.count; i += 3) {
    const z = (unitarias[i * 3 + 2] + unitarias[i * 3 + 5] + unitarias[i * 3 + 8]) / 3;
    const c = z > -0.15 ? amarillo : azul;
    for (let k = 0; k < 3; k += 1) colores.set([c.r, c.g, c.b], (i + k) * 3);
  }
  geoCuerpo.setAttribute('color', new Float32BufferAttribute(colores, 3));
  geoCuerpo.computeVertexNormals();
  const tronco = new Mesh(geoCuerpo, material('#ffffff', { vertexColors: true }));
  cuerpo.add(tronco);

  // Plumas sueltas que asoman al esponjarse.
  partes.plumon = [];
  for (const [x, y, z, color] of [[0.5, 0.7, 0.24, AMARILLO], [-0.5, 0.7, 0.24, AMARILLO], [0.54, 0.98, -0.12, AZUL], [-0.54, 0.98, -0.12, AZUL], [0, 0.5, 0.56, AMARILLO], [0.28, 1.2, 0.36, AMARILLO], [-0.28, 1.2, 0.36, AMARILLO]]) {
    const m = gema([0.08, 0.06, 0.05], color, 0);
    m.position.set(x, y, z);
    m.lookAt(x * 3, y, z * 3);
    const envoltura = new Group();
    envoltura.add(m);
    envoltura.scale.setScalar(0.001);
    cuerpo.add(envoltura);
    partes.plumon.push(envoltura);
  }

  const izquierda = crearAla();
  izquierda.ala.position.set(0.5, 1.08, 0.02);
  const derecha = crearAla();
  derecha.ala.position.set(-0.5, 1.08, 0.02);
  derecha.ala.scale.x = -1;
  cuerpo.add(izquierda.ala, derecha.ala);
  partes.alaIzq = izquierda;
  partes.alaDer = derecha;

  // Cola en dos capas hacia atrás y abajo: azul arriba, amarilla abajo.
  const cola = new Group();
  cola.position.set(0, 0.55, -0.42);
  const dibujoCola = (largo, ancho) => (s) => {
    s.moveTo(0, -ancho);
    s.lineTo(0, ancho);
    s.bezierCurveTo(largo * 0.55, ancho * 1.15, largo * 0.95, ancho * 0.8, largo, 0);
    s.bezierCurveTo(largo * 0.95, -ancho * 0.8, largo * 0.55, -ancho * 1.15, 0, -ancho);
  };
  const arriba = new Mesh(lamina(dibujoCola(0.95, 0.15), 0.04, 0.03), material(AZUL));
  const abajo = new Mesh(lamina(dibujoCola(0.82, 0.14), 0.04, 0.03), material(AMARILLO));
  abajo.position.y = -0.07;
  for (const m of [arriba, abajo]) {
    m.rotation.order = 'YXZ';
    m.rotation.set(-Math.PI / 2, Math.PI / 2, 0); // horizontal, hacia atrás
    cola.add(m);
  }
  cuerpo.add(cola);
  partes.cola = cola;

  // Cabeza algo cuadrada: gorra azul y máscara blanca al frente y a los costados.
  const cuello = new Group();
  cuello.position.set(0, 1.42, 0.05);
  cuello.rotation.order = 'YXZ';
  orientacion.add(cuello);
  partes.cuello = cuello;
  const cabeza = gema([0.5, 0.48, 0.5], AZUL);
  cabeza.position.set(0, 0.26, 0);
  // Más ancha que la cabeza: el blanco cubre los costados, donde van los ojos.
  const mascara = gema([0.54, 0.4, 0.44], BLANCO);
  mascara.position.set(0, 0.22, 0.1);
  cuello.add(cabeza, mascara);

  // Copete de tres plumitas atrás, arriba.
  for (const [x, giro] of [[-0.07, -0.3], [0.02, 0], [0.11, 0.3]]) {
    const pluma = new Mesh(new CapsuleGeometry(0.045, 0.12, 2, 6), material(AZUL));
    pluma.position.set(x, 0.74, -0.14);
    pluma.rotation.set(-0.55, 0, giro);
    cuello.add(pluma);
  }

  // Un ojo grande a cada lado, sobre la máscara blanca.
  partes.ojos = [];
  for (const lado of [1, -1]) {
    const ojo = new Group();
    ojo.position.set(0.5 * lado, 0.24, 0.22); // sobre la superficie de la máscara
    ojo.rotation.y = (Math.PI / 2 - 0.3) * lado;
    const disco = new Mesh(new CylinderGeometry(0.12, 0.12, 0.05, 14), material(OJO, { flatShading: false }));
    disco.rotation.x = Math.PI / 2;
    ojo.add(disco);
    cuello.add(ojo);
    partes.ojos.push({ ojo });
  }

  // Pico chico, gris oscuro y curvo, al frente de la máscara.
  const pico = new Mesh(
    tuboAfinado([[0, 0.17, 0.5], [0, 0.2, 0.6], [0, 0.12, 0.67], [0, 0.02, 0.64]], 0.1, 0.02),
    material(GRIS),
  );
  cuello.add(pico);

  // Patas grises: pierna y tres dedos adelante y uno atrás, apoyados sobre la rama.
  partes.patas = [];
  for (const x of [0.18, -0.18]) {
    const pata = new Group();
    pata.position.set(x, 0, 0.04);
    const pierna = new Mesh(new CylinderGeometry(0.055, 0.06, 0.34, 6), material(GRIS));
    pierna.position.y = 0.17;
    pata.add(pierna);
    for (const giro of [-0.45, 0, 0.45, Math.PI]) {
      const brazo = new Group();
      brazo.rotation.y = giro;
      const dedo = new Mesh(new CapsuleGeometry(0.035, 0.1, 2, 6), material(GRIS));
      dedo.rotation.x = Math.PI / 2;
      dedo.position.set(0, 0.02, 0.08);
      brazo.add(dedo);
      pata.add(brazo);
    }
    orientacion.add(pata);
    partes.patas.push(pata);
  }
  return partes;
}

function crearRama() {
  const rama = new Group();
  const madera = material('#9a6e47');
  const tronco = new Mesh(new CylinderGeometry(0.1, 0.13, 6, 7), madera);
  tronco.rotation.z = Math.PI / 2;
  tronco.position.set(2.4, -0.1, 0);
  const ramita = new Mesh(new CylinderGeometry(0.025, 0.045, 0.55, 5), madera);
  ramita.position.set(1.35, 0.12, 0.05);
  ramita.rotation.z = -0.9;
  rama.add(tronco, ramita);
  for (const [x, y, giro] of [[1.6, 0.32, 0.5], [1.44, 0.4, -0.2]]) {
    const hoja = gema([0.16, 0.045, 0.09], '#7cc25a', 0);
    hoja.position.set(x, y, 0.05);
    hoja.rotation.z = giro;
    rama.add(hoja);
  }
  return rama;
}

// Sombra suave bajo el ave, como en el modelo.
function crearSombra() {
  const lienzo = document.createElement('canvas');
  lienzo.width = 128;
  lienzo.height = 128;
  const ctx = lienzo.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(60,60,40,0.3)');
  g.addColorStop(1, 'rgba(60,60,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const sombra = new Mesh(new PlaneGeometry(1.5, 0.55), new MeshBasicMaterial({ map: new CanvasTexture(lienzo), transparent: true, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.set(-0.15, 0.015, 0);
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
  { desde: 1.4, hasta: 2.9, pose: { ojo: 1, yaw: -0.7, roll: 0.15 } },
  { desde: 2.9, hasta: 4.3, pose: { ojo: 1, yaw: 0.6, roll: -0.12 } },
  // Se acicala el ala: gira la cabeza hacia ella y se pica las plumas.
  { desde: 5.0, hasta: 8.2, pose: { ojo: 0, yaw: 1.6, pitch: 0.5, roll: -0.2, alaIzq: 0.2, inclinar: -0.04 } },
  // Estira el ala, abre las plumas y la mira.
  { desde: 8.9, hasta: 11.0, pose: { ojo: 1, alaIzq: 1, alaDer: 0.3, abanico: 1, yaw: 0.9, inclinar: -0.06, colaAlza: 0.15 } },
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
    renderer.toneMapping = NoToneMapping; // colores pastel tal cual
    caja.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    // Luz pareja, casi sin contraste, que deja ver las caras sin endurecer las sombras.
    const escena = new Scene();
    escena.add(new HemisphereLight('#ffffff', '#e8e4c6', 2.3));
    const clave = new DirectionalLight('#ffffff', 1.1);
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
      // Un poco desde arriba, como en el modelo.
      camara.position.set(0, 2.1, distancia);
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
      ave.cuello.position.y = 1.42 * ave.cuerpo.scale.y + d.cabezaY;
      ave.cuello.rotation.set(a.pitch + d.pitch, a.yaw, a.roll);
      ave.alaIzq.ala.rotation.set(-0.3 * a.alaIzq, 0, -0.16 + 1.1 * a.alaIzq);
      ave.alaDer.ala.rotation.set(-0.3 * a.alaDer, 0, -0.16 + 1.1 * a.alaDer);
      ave.alaIzq.primarias.forEach((p, i) => {
        p.scale.setScalar(Math.max(0.001, a.abanico));
        p.rotation.z = -i * 0.25 * a.abanico;
      });
      ave.alaDer.primarias.forEach((p) => p.scale.setScalar(Math.max(0.001, a.abanico * 0.4)));
      ave.cola.rotation.set(0.4 + a.colaAlza, 0, a.colaGiro + d.cola);
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
