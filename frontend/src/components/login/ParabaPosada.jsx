import { useEffect, useRef } from 'react';
import {
  ACESFilmicToneMapping, BufferGeometry, CatmullRomCurve3, Color, CylinderGeometry, DirectionalLight, DoubleSide,
  Float32BufferAttribute, Group, HemisphereLight, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, PerspectiveCamera,
  Scene, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector3, WebGLRenderer,
} from 'three';

// Guacamayo en 3D (Three.js) posado en una rama, con los colores del logo de la UAB, que reacciona
// al formulario del login (como los avatares que miran el campo):
//   reposo              nada escrito ni enfocado: ojos cerrados; mira a los lados, se acicala el ala,
//                       la estira abriendo las plumas, se esponja y se acomoda en la rama, en un ciclo.
//   mirando-usuario     escribiendo el usuario: se inclina un poco hacia el campo y la cabeza sigue el texto.
//   mirando-contrasena  igual, un poco más abajo (el campo de la contraseña está debajo).
//   ojos-cerrados       la contraseña está a la vista: cierra los ojos y aparta la cabeza.
//   atento              campos llenos sin foco: quieto, parpadeando.
// El modelo se arma con formas de Three.js (sin archivos). Cada parte va con un resorte hacia su pose
// (sin saltos entre estados) más un movimiento continuo: respira, se balancea y la cola sigue con
// retraso. Con prefers-reduced-motion toma la pose de cada estado sin animar.

// Colores del logo de la UAB: rojo, azul, dorado del engranaje, violeta de los rayos, negro y blanco.
const ROJO = '#f20b0d';
const AZUL = '#1718d0';
const VIOLETA = '#2c0dd0';
const DORADO = '#c9b810';
const NEGRO = '#151515';
const BLANCO = '#f7f5ee';

const ALTO_VISIBLE = 3.9; // unidades del modelo que entran a lo alto del cuadro
const GIRO_BASE = -0.85; // de tres cuartos, mirando hacia el formulario (a la izquierda)

// ---------- modelo ----------
const plumaje = (color, extra = {}) => new MeshPhysicalMaterial({
  color, roughness: 0.6, metalness: 0, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new Color('#ffffff'), ...extra,
});

function elipsoide(radios, color, material = null) {
  const g = new SphereGeometry(1, 48, 32);
  g.scale(...radios);
  return new Mesh(g, material || plumaje(color));
}

// Tubo que sigue una curva y se afina hasta la punta (pico y plumas de la cola y del ala).
// `ancho` y `alto` aplanan la sección; `pintar(u)` da el color a lo largo (0 base, 1 punta).
function tuboAfinado(puntos, radioBase, radioPunta, { ancho = 1, alto = 1, pintar = null, pasos = 48, lados = 18 } = {}) {
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
  // Ala plegada: tres volúmenes apoyados en el costado (rojo arriba, banda dorada, azul abajo).
  const azul = elipsoide([0.11, 0.72, 0.27], AZUL);
  azul.position.set(0, -0.56, -0.13);
  azul.rotation.x = 0.28;
  const dorado = elipsoide([0.12, 0.3, 0.27], DORADO);
  dorado.position.set(0.015, -0.32, -0.05);
  dorado.rotation.x = 0.18;
  const rojo = elipsoide([0.13, 0.3, 0.28], ROJO);
  rojo.position.set(0.03, -0.1, 0);
  rojo.rotation.x = 0.1;
  ala.add(azul, dorado, rojo);
  // Plumas largas de la punta, que se abren en abanico al estirar el ala.
  const primarias = [];
  for (let i = 0; i < 5; i += 1) {
    const eje = new Group();
    eje.position.set(0, -0.62 - i * 0.03, -0.12 - i * 0.03);
    const geo = tuboAfinado([[0, 0, 0], [0, -0.3, -0.12], [0, -0.62, -0.3]], 0.07, 0.012, { alto: 0.25 });
    eje.add(new Mesh(geo, plumaje(i % 2 ? VIOLETA : AZUL, { side: DoubleSide })));
    ala.add(eje);
    primarias.push(eje);
  }
  return { ala, primarias };
}

function crearAve() {
  const partes = {};
  const inclinacion = new Group(); // gira en el plano de la pantalla, desde las patas
  const orientacion = new Group(); // gira el ave sobre su eje vertical
  orientacion.rotation.y = GIRO_BASE;
  inclinacion.add(orientacion);
  partes.inclinacion = inclinacion;
  partes.orientacion = orientacion;

  const cuerpo = new Group();
  orientacion.add(cuerpo);
  partes.cuerpo = cuerpo;

  const tronco = elipsoide([0.44, 0.86, 0.5], ROJO);
  tronco.position.set(0, 1.12, 0);
  tronco.rotation.x = 0.22;
  const pecho = elipsoide([0.4, 0.5, 0.42], ROJO);
  pecho.position.set(0, 1.45, 0.12);
  cuerpo.add(tronco, pecho);

  // Plumas sueltas que asoman al esponjarse.
  partes.plumon = [];
  for (const [x, y, z] of [[0.28, 0.85, 0.38], [-0.28, 0.85, 0.38], [0.38, 1.2, 0.22], [-0.38, 1.2, 0.22], [0, 0.68, 0.45], [0.18, 1.5, 0.45], [-0.18, 1.5, 0.45], [0, 0.42, 0.34]]) {
    const m = elipsoide([0.1, 0.07, 0.06], ROJO);
    m.position.set(x, y, z);
    m.lookAt(x * 3, y, z * 3);
    m.scale.setScalar(0.001);
    cuerpo.add(m);
    partes.plumon.push(m);
  }

  const izquierda = crearAla();
  izquierda.ala.position.set(0.36, 1.62, -0.02);
  const derecha = crearAla();
  derecha.ala.position.set(-0.36, 1.62, -0.02);
  derecha.ala.scale.x = -1;
  cuerpo.add(izquierda.ala, derecha.ala);
  partes.alaIzq = izquierda;
  partes.alaDer = derecha;

  // Cola: tres plumas largas, rojas con una franja dorada y la punta azul.
  const cola = new Group();
  cola.position.set(0, 0.55, -0.3);
  const colorCola = (u) => {
    if (u < 0.62) return ROJO;
    return u < 0.72 ? DORADO : AZUL;
  };
  for (const [x, giro, largo] of [[-0.08, -0.12, 0.9], [0, 0, 1], [0.08, 0.12, 0.9]]) {
    const geo = tuboAfinado(
      [[0, 0, 0], [0, -0.45 * largo, -0.25], [0, -0.95 * largo, -0.42], [0, -1.35 * largo, -0.52]],
      0.11, 0.015, { ancho: 0.3, pintar: colorCola },
    );
    const m = new Mesh(geo, plumaje('#ffffff', { vertexColors: true, side: DoubleSide }));
    m.position.x = x;
    m.rotation.z = giro;
    cola.add(m);
  }
  cuerpo.add(cola);
  partes.cola = cola;

  // Cabeza, con el giro en el cuello.
  const cuello = new Group();
  cuello.position.set(0, 1.85, 0.08);
  cuello.rotation.order = 'YXZ';
  orientacion.add(cuello);
  partes.cuello = cuello;

  const cabeza = elipsoide([0.36, 0.38, 0.4], ROJO);
  cabeza.position.set(0, 0.28, 0.08);
  const nuca = elipsoide([0.32, 0.3, 0.32], ROJO);
  nuca.position.set(0, 0.02, 0.02);
  cuello.add(cabeza, nuca);

  partes.ojos = [];
  const piel = new MeshStandardMaterial({ color: BLANCO, roughness: 0.75 });
  for (const lado of [1, -1]) {
    const cara = elipsoide([0.07, 0.2, 0.24], null, piel);
    cara.position.set(0.3 * lado, 0.27, 0.24);
    cara.rotation.y = 0.45 * lado;
    cuello.add(cara);

    const ojo = new Group();
    ojo.position.set(0.345 * lado, 0.34, 0.24);
    ojo.rotation.y = (Math.PI / 2 - 0.45) * lado;
    const iris = new Mesh(new SphereGeometry(0.05, 24, 16), new MeshStandardMaterial({ color: '#f4e7a0', roughness: 0.3 }));
    const pupila = new Mesh(new SphereGeometry(0.032, 20, 14), new MeshStandardMaterial({ color: '#0a0a0a', roughness: 0.15 }));
    pupila.position.z = 0.028;
    ojo.add(iris, pupila);
    // Ojo cerrado: un arco como el del modelo.
    const parpado = new Mesh(new TorusGeometry(0.052, 0.011, 8, 24, Math.PI), new MeshStandardMaterial({ color: NEGRO }));
    parpado.position.copy(ojo.position);
    parpado.rotation.set(0, ojo.rotation.y, Math.PI);
    cuello.add(ojo, parpado);
    partes.ojos.push({ ojo, parpado, lado });
  }

  // Pico: superior dorado en gancho y mandíbula negra.
  const superior = new Mesh(
    tuboAfinado([[0, 0.3, 0.27], [0, 0.36, 0.44], [0, 0.27, 0.57], [0, 0.11, 0.59], [0, 0.0, 0.51]], 0.18, 0.02, { alto: 0.82 }),
    plumaje(DORADO, { roughness: 0.32, sheen: 0, side: DoubleSide }),
  );
  const inferior = new Mesh(
    tuboAfinado([[0, 0.15, 0.3], [0, 0.08, 0.43], [0, 0.03, 0.48]], 0.13, 0.05, { alto: 0.85 }),
    plumaje(NEGRO, { roughness: 0.4, sheen: 0, side: DoubleSide }),
  );
  cuello.add(superior, inferior);

  // Patas doradas agarradas a la rama (dedos en arco alrededor de ella).
  const geoDedo = new TorusGeometry(0.13, 0.038, 12, 20, 1.5);
  const matPata = plumaje(DORADO, { sheen: 0, roughness: 0.5 });
  partes.patas = [];
  for (const x of [0.15, -0.15]) {
    const pata = new Group();
    pata.position.set(x, -0.09, 0.02);
    for (const [inicio, dx] of [[0.2, -0.03], [Math.PI - 0.2 - 1.5, 0.03]]) {
      const dedo = new Mesh(geoDedo, matPata);
      dedo.rotation.set(0, Math.PI / 2, inicio);
      dedo.position.x = dx;
      pata.add(dedo);
    }
    orientacion.add(pata);
    partes.patas.push(pata);
  }
  return partes;
}

function crearRama() {
  const rama = new Group();
  const madera = new MeshStandardMaterial({ color: '#5a3d28', roughness: 0.9 });
  const tronco = new Mesh(new CylinderGeometry(0.1, 0.12, 6, 24), madera);
  tronco.rotation.z = Math.PI / 2;
  tronco.position.set(2.4, -0.09, 0);
  const ramita = new Mesh(new CylinderGeometry(0.025, 0.04, 0.6, 12), madera);
  ramita.position.set(1.55, 0.13, 0.05);
  ramita.rotation.z = -0.9;
  const hoja = elipsoide([0.17, 0.055, 0.1], null, new MeshStandardMaterial({ color: '#4f7a3a', roughness: 0.7 }));
  hoja.position.set(1.83, 0.33, 0.05);
  hoja.rotation.z = 0.5;
  rama.add(tronco, ramita, hoja);
  return rama;
}

// ---------- animación ----------
const POSE_BASE = {
  inclinar: 0, girar: 0, yaw: 0, pitch: 0, roll: 0, alaIzq: 0, alaDer: 0, abanico: 0,
  colaGiro: 0, colaAlza: 0, plumon: 0, pata: 0, ojo: 1, mirada: 0,
};
const POSES = {
  atento: {},
  'mirando-usuario': { inclinar: 0.1, yaw: -0.55, pitch: 0.1 },
  'mirando-contrasena': { inclinar: 0.13, yaw: -0.5, pitch: 0.3, roll: 0.08 },
  'ojos-cerrados': { inclinar: -0.05, yaw: 1.65, pitch: -0.22, roll: -0.1, ojo: 0 },
  reposo: { ojo: 0 },
};

const CICLO = 18;
const ACCIONES = [
  // Mira a un lado y al otro.
  { desde: 1.4, hasta: 2.9, pose: { ojo: 1, yaw: -0.75, roll: 0.15 } },
  { desde: 2.9, hasta: 4.3, pose: { ojo: 1, yaw: 0.6, roll: -0.12 } },
  // Se acicala el ala: gira la cabeza hacia ella y se pica las plumas.
  { desde: 5.0, hasta: 8.2, pose: { yaw: 1.9, pitch: 0.55, roll: -0.2, alaIzq: 0.18, inclinar: -0.04 } },
  // Estira el ala, abre las plumas y la mira.
  { desde: 8.9, hasta: 11.0, pose: { ojo: 1, alaIzq: 1, alaDer: 0.3, abanico: 1, yaw: 0.9, inclinar: -0.06, colaAlza: 0.12 } },
  // Se esponja.
  { desde: 11.7, hasta: 13.3, pose: { plumon: 1, pitch: -0.1 } },
  // Levanta una pata y se acomoda en la rama.
  { desde: 14.0, hasta: 14.8, pose: { ojo: 1, pata: 1, inclinar: -0.06 } },
  { desde: 14.8, hasta: 15.7, pose: { ojo: 1, inclinar: 0.05 } },
];

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
    pose.mirada = (seguimiento - 0.5) * 0.6;
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

// Movimiento que no pasa por el resorte: respiración, balanceo, picoteo y parpadeo.
function movimientoDirecto(estado, t) {
  const m = {
    respira: 0.015 * Math.sin((2 * Math.PI * t) / 3.4),
    balanceo: 0.025 * Math.sin((2 * Math.PI * t) / 5.6),
    cola: 0.06 * Math.sin((2 * Math.PI * t) / 5.6 - 0.9),
    cabezaY: 0.012 * Math.sin((2 * Math.PI * t) / 3.4 + 0.6),
    pitch: 0,
    ojo: 1,
  };
  if (estado === 'reposo') m.pitch = 0.13 * ventana(t % CICLO, 5.7, 7.8, 0.3) * Math.sin(2 * Math.PI * 3 * t);
  const p = t % 3.8; // parpadeo cada 3,8 s, de 160 ms
  if (p < 0.16) m.ojo = 1 - Math.sin((Math.PI * p) / 0.16);
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
    renderer.toneMappingExposure = 1.05;
    caja.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    const escena = new Scene();
    escena.add(new HemisphereLight('#ffffff', '#b9c6dc', 1.3));
    const clave = new DirectionalLight('#ffffff', 2.4);
    clave.position.set(-3, 5, 5);
    const contraluz = new DirectionalLight('#cfe0ff', 1.4);
    contraluz.position.set(3, 3, -4);
    escena.add(clave, contraluz);

    const ave = crearAve();
    const mundo = new Group();
    mundo.add(ave.inclinacion, crearRama());
    escena.add(mundo);

    const camara = new PerspectiveCamera(30, 1, 0.1, 50);
    const ajustar = () => {
      const { clientWidth: w, clientHeight: h } = caja;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camara.aspect = w / h;
      const distancia = ALTO_VISIBLE / (2 * Math.tan((camara.fov * Math.PI) / 360));
      camara.position.set(0, 1.05, distancia);
      camara.lookAt(0, 1.05, 0);
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
      const d = quieto ? { respira: 0, balanceo: 0, cola: 0, cabezaY: 0, pitch: 0, ojo: 1 } : movimientoDirecto(e, t);
      const a = actual;

      ave.inclinacion.rotation.z = a.inclinar + d.balanceo;
      ave.orientacion.rotation.y = GIRO_BASE + a.girar;
      const esponja = Math.max(0, a.plumon);
      ave.cuerpo.scale.set(1 + 0.07 * esponja, 1 + 0.04 * esponja + d.respira, 1 + 0.07 * esponja);
      ave.plumon.forEach((m) => m.scale.setScalar(Math.max(0.001, esponja)));
      ave.cuello.position.y = 1.85 * ave.cuerpo.scale.y + d.cabezaY;
      ave.cuello.rotation.set(a.pitch + d.pitch, a.yaw, a.roll);
      ave.alaIzq.ala.rotation.set(-0.3 * a.alaIzq, 0, -0.12 + 1.0 * a.alaIzq);
      ave.alaDer.ala.rotation.set(-0.3 * a.alaDer, 0, -0.12 + 1.0 * a.alaDer);
      ave.alaIzq.primarias.forEach((p, i) => { p.rotation.x = -i * 0.22 * a.abanico; });
      ave.alaDer.primarias.forEach((p, i) => { p.rotation.x = -i * 0.22 * a.abanico * 0.4; });
      ave.cola.rotation.set(a.colaAlza, 0, a.colaGiro + d.cola);
      ave.patas[1].position.y = -0.09 + 0.22 * a.pata;
      ave.patas[1].rotation.x = -0.5 * a.pata;
      const abierto = Math.max(0, Math.min(1, a.ojo * d.ojo));
      ave.ojos.forEach(({ ojo, parpado, lado }) => {
        ojo.scale.y = Math.max(abierto, 0.08);
        ojo.visible = abierto > 0.06;
        ojo.rotation.y = (Math.PI / 2 - 0.45) * lado + a.mirada * lado;
        parpado.scale.setScalar(Math.max(0.001, 1 - abierto));
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
        if (o.material) o.material.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={contenedor} className={className} aria-hidden="true" />;
}

export default ParabaPosada;
