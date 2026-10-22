import { useEffect, useRef } from 'react';
import {
  ACESFilmicToneMapping, BufferGeometry, CatmullRomCurve3, CylinderGeometry, DirectionalLight, DoubleSide,
  Float32BufferAttribute, Group, HemisphereLight, IcosahedronGeometry, Mesh, MeshStandardMaterial, PerspectiveCamera,
  Scene, SphereGeometry, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three';

// Guacamayo 3D (Three.js) de estilo tierno y facetado (low-poly, colores planos, cabeza grande y ojos
// grandes con párpados), con los colores del logo de la UAB, posado en una rama. Reacciona al login:
//   reposo              nada escrito ni enfocado: ojos entrecerrados; mira a los lados, se acicala el
//                       ala, la estira abriendo las plumas, se esponja, levanta una pata y da un saltito.
//   mirando-usuario     escribiendo el usuario: se inclina un poco hacia el campo y lo sigue con la mirada.
//   mirando-contrasena  igual, un poco más abajo (el campo de la contraseña está debajo).
//   ojos-cerrados       la contraseña está a la vista: cierra los párpados y aparta la cabeza.
//   atento              campos llenos sin foco: quieto, parpadeando.
// Modelo propio armado con formas de Three.js (sin archivos). Cada parte va con un resorte hacia su
// pose (sin saltos entre estados) más un movimiento continuo: respira, se balancea y la cola sigue con
// retraso. Con prefers-reduced-motion toma la pose de cada estado sin animar.

// Colores del logo de la UAB: rojo, azul, dorado del engranaje, violeta de los rayos, negro y blanco.
const ROJO = '#f20b0d';
const AZUL = '#1718d0';
const VIOLETA = '#2c0dd0';
const DORADO = '#c9b810';
const NEGRO = '#151515';
const BLANCO = '#f7f5ee';

const ALTO_VISIBLE = 3.5; // unidades del modelo que entran a lo alto del cuadro
const GIRO_BASE = -0.6; // de tres cuartos, mirando hacia el formulario (a la izquierda)

// ---------- modelo ----------
const plano = (color, extra = {}) => new MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, flatShading: true, ...extra });

// Volumen facetado: icosaedro (2 subdivisiones) estirado a los radios dados.
function gema(radios, color, material = null, detalle = 2) {
  const g = new IcosahedronGeometry(1, detalle);
  g.scale(...radios);
  return new Mesh(g, material || plano(color));
}

// Tubo facetado que sigue una curva y se afina (pico y plumas). `ancho`/`alto` aplanan la sección.
function tuboAfinado(puntos, radioBase, radioPunta, { ancho = 1, alto = 1, pasos = 10, lados = 6 } = {}) {
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
      const x = Math.cos(ang) * radio * ancho;
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
  // Ala plegada en tres capas: roja arriba, banda dorada y azul en la punta.
  const azul = gema([0.09, 0.42, 0.2], AZUL);
  azul.position.set(0, -0.36, -0.1);
  azul.rotation.x = 0.35;
  const dorado = gema([0.1, 0.2, 0.2], DORADO);
  dorado.position.set(0.015, -0.2, -0.03);
  dorado.rotation.x = 0.2;
  const rojo = gema([0.11, 0.2, 0.21], ROJO);
  rojo.position.set(0.03, -0.05, 0.01);
  ala.add(azul, dorado, rojo);
  // Plumas de la punta, que se abren en abanico al estirar el ala.
  const primarias = [];
  for (let i = 0; i < 4; i += 1) {
    const eje = new Group();
    eje.position.set(0, -0.48 - i * 0.02, -0.14 - i * 0.03);
    const geo = tuboAfinado([[0, 0, 0], [0, -0.18, -0.08], [0, -0.38, -0.2]], 0.06, 0.012, { alto: 0.3, lados: 4 });
    eje.add(new Mesh(geo, plano(i % 2 ? VIOLETA : AZUL, { side: DoubleSide })));
    ala.add(eje);
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

  const tronco = gema([0.5, 0.62, 0.48], ROJO);
  tronco.position.set(0, 0.72, 0);
  tronco.rotation.x = 0.12;
  const panza = gema([0.38, 0.42, 0.2], '#ff3a2e');
  panza.position.set(0, 0.62, 0.33);
  cuerpo.add(tronco, panza);

  // Plumas sueltas que asoman al esponjarse.
  partes.plumon = [];
  for (const [x, y, z] of [[0.36, 0.5, 0.3], [-0.36, 0.5, 0.3], [0.48, 0.85, 0.1], [-0.48, 0.85, 0.1], [0, 0.32, 0.4], [0.2, 1.05, 0.38], [-0.2, 1.05, 0.38]]) {
    const m = gema([0.08, 0.06, 0.05], ROJO, null, 0);
    m.position.set(x, y, z);
    m.lookAt(x * 3, y, z * 3);
    m.scale.setScalar(0.001);
    cuerpo.add(m);
    partes.plumon.push(m);
  }

  const izquierda = crearAla();
  izquierda.ala.position.set(0.44, 0.98, -0.04);
  const derecha = crearAla();
  derecha.ala.position.set(-0.44, 0.98, -0.04);
  derecha.ala.scale.x = -1;
  cuerpo.add(izquierda.ala, derecha.ala);
  partes.alaIzq = izquierda;
  partes.alaDer = derecha;

  // Cola: tres plumas planas, rojas con la punta azul.
  const cola = new Group();
  cola.position.set(0, 0.3, -0.36);
  for (const [x, giro, largo, color] of [[-0.07, -0.18, 0.85, AZUL], [0, 0, 1, ROJO], [0.07, 0.18, 0.85, AZUL]]) {
    const geo = tuboAfinado([[0, 0, 0], [0, -0.3 * largo, -0.2], [0, -0.66 * largo, -0.34], [0, -0.95 * largo, -0.4]], 0.1, 0.02, { ancho: 0.32, lados: 5 });
    const m = new Mesh(geo, plano(color, { side: DoubleSide }));
    m.position.x = x;
    m.rotation.z = giro;
    cola.add(m);
  }
  const puntaCola = new Mesh(
    tuboAfinado([[0, -0.66, -0.34], [0, -0.95, -0.4]], 0.07, 0.02, { ancho: 0.34, lados: 5 }),
    plano(AZUL, { side: DoubleSide }),
  );
  cola.add(puntaCola);
  cuerpo.add(cola);
  partes.cola = cola;

  // Cabeza grande, con el giro en el cuello.
  const cuello = new Group();
  cuello.position.set(0, 1.32, 0.05);
  cuello.rotation.order = 'YXZ';
  orientacion.add(cuello);
  partes.cuello = cuello;

  const cabeza = gema([0.6, 0.56, 0.56], ROJO);
  cabeza.position.set(0, 0.4, 0.04);
  const mascara = gema([0.42, 0.3, 0.2], BLANCO);
  mascara.position.set(0, 0.42, 0.44);
  cuello.add(cabeza, mascara);

  // Ojos grandes: esclerótica blanca, pupila negra con brillo y párpado rojo que baja.
  partes.ojos = [];
  const blanco = plano('#ffffff', { roughness: 0.4, flatShading: false });
  const negro = plano('#0b0b0b', { roughness: 0.2, flatShading: false });
  for (const lado of [1, -1]) {
    const ojo = new Group();
    ojo.position.set(0.22 * lado, 0.5, 0.52);
    ojo.rotation.y = 0.42 * lado;
    const esclerotica = new Mesh(new SphereGeometry(0.15, 20, 14), blanco);
    const pupila = new Group();
    pupila.position.z = 0.075; // la pupila no debe asomar por el párpado cerrado
    const negra = new Mesh(new SphereGeometry(0.075, 16, 12), negro);
    const brillo = new Mesh(new SphereGeometry(0.025, 8, 6), blanco);
    brillo.position.set(-0.025, 0.03, 0.06);
    pupila.add(negra, brillo);
    const parpado = new Mesh(new SphereGeometry(0.17, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), plano(ROJO, { side: DoubleSide }));
    ojo.add(esclerotica, pupila, parpado);
    cuello.add(ojo);
    partes.ojos.push({ pupila, parpado });
  }

  // Pico corto y curvo: superior dorado en gancho y mandíbula negra.
  const superior = new Mesh(
    tuboAfinado([[0, 0.36, 0.5], [0, 0.4, 0.68], [0, 0.3, 0.8], [0, 0.14, 0.8], [0, 0.06, 0.72]], 0.15, 0.025, { alto: 0.85, lados: 7 }),
    plano(DORADO, { side: DoubleSide }),
  );
  const inferior = new Mesh(
    tuboAfinado([[0, 0.2, 0.52], [0, 0.13, 0.64], [0, 0.1, 0.68]], 0.11, 0.05, { alto: 0.9, lados: 6 }),
    plano(NEGRO, { side: DoubleSide }),
  );
  cuello.add(superior, inferior);

  // Patas doradas sobre la rama.
  partes.patas = [];
  for (const x of [0.17, -0.17]) {
    const pata = new Group();
    pata.position.set(x, 0.02, 0.06);
    for (const dz of [0.1, -0.06]) {
      const dedo = gema([0.05, 0.045, 0.1], DORADO, null, 1);
      dedo.position.set(0, 0, dz);
      pata.add(dedo);
    }
    orientacion.add(pata);
    partes.patas.push(pata);
  }
  return partes;
}

function crearRama() {
  const rama = new Group();
  const madera = plano('#6b4a31', { roughness: 0.95 });
  const tronco = new Mesh(new CylinderGeometry(0.1, 0.13, 6, 7), madera);
  tronco.rotation.z = Math.PI / 2;
  tronco.position.set(2.4, -0.1, 0);
  const ramita = new Mesh(new CylinderGeometry(0.025, 0.045, 0.6, 5), madera);
  ramita.position.set(1.4, 0.12, 0.05);
  ramita.rotation.z = -0.9;
  rama.add(tronco, ramita);
  for (const [x, y, giro] of [[1.68, 0.33, 0.5], [1.5, 0.42, -0.2]]) {
    const hoja = gema([0.17, 0.05, 0.1], '#4f8a3a', null, 0);
    hoja.position.set(x, y, 0.05);
    hoja.rotation.z = giro;
    rama.add(hoja);
  }
  return rama;
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
  reposo: { ojo: 0.35 },
};

const CICLO = 20;
const ACCIONES = [
  // Mira a un lado y al otro.
  { desde: 1.4, hasta: 2.9, pose: { ojo: 1, yaw: -0.7, roll: 0.15, mirada: -0.8 } },
  { desde: 2.9, hasta: 4.3, pose: { ojo: 1, yaw: 0.6, roll: -0.12, mirada: 0.8 } },
  // Se acicala el ala: gira la cabeza hacia ella y se pica las plumas.
  { desde: 5.0, hasta: 8.2, pose: { ojo: 0, yaw: 1.7, pitch: 0.5, roll: -0.2, alaIzq: 0.2, inclinar: -0.04 } },
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
    if (u > -0.3 && u < 0) m.aplastar = Math.sin(Math.PI * (u + 0.3) / 0.3) * 0.08;
    if (u >= 0 && u <= 1) m.salto = Math.sin(Math.PI * u) * 0.3;
    if (u > 1 && u < 1.35) m.aplastar = Math.sin(Math.PI * (u - 1) / 0.35) * 0.1;
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
    renderer.toneMappingExposure = 1.1;
    caja.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    const escena = new Scene();
    escena.add(new HemisphereLight('#ffffff', '#c9d4e8', 1.6));
    const clave = new DirectionalLight('#ffffff', 2.2);
    clave.position.set(-3, 5, 5);
    const contraluz = new DirectionalLight('#dbe7ff', 1.0);
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
      camara.position.set(0, 0.85, distancia);
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
      ave.cuello.position.y = 1.32 * ave.cuerpo.scale.y + d.cabezaY;
      ave.cuello.rotation.set(a.pitch + d.pitch, a.yaw, a.roll);
      ave.alaIzq.ala.rotation.set(-0.3 * a.alaIzq, 0, -0.1 + 1.05 * a.alaIzq);
      ave.alaDer.ala.rotation.set(-0.3 * a.alaDer, 0, -0.1 + 1.05 * a.alaDer);
      ave.alaIzq.primarias.forEach((p, i) => { p.rotation.x = -i * 0.25 * a.abanico; });
      ave.alaDer.primarias.forEach((p, i) => { p.rotation.x = -i * 0.25 * a.abanico * 0.4; });
      ave.cola.rotation.set(a.colaAlza, 0, a.colaGiro + d.cola);
      ave.patas[1].position.y = 0.02 + 0.2 * a.pata;
      ave.patas[1].rotation.x = -0.5 * a.pata;
      // Párpado: arriba (-0,65 rad) con el ojo abierto; tapa el frente (π/2) con el ojo cerrado.
      const abierto = Math.max(0, Math.min(1, a.ojo * d.ojo));
      ave.ojos.forEach(({ pupila, parpado }) => {
        parpado.rotation.x = -0.65 + (Math.PI / 2 + 0.65) * (1 - abierto);
        pupila.position.x = 0.05 * Math.max(-1, Math.min(1, a.mirada));
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
