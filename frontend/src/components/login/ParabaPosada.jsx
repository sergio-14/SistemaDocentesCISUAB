import { useEffect, useRef } from 'react';
import {
  BufferGeometry, CanvasTexture, CapsuleGeometry, CatmullRomCurve3, Color, CylinderGeometry, DirectionalLight,
  DoubleSide, ExtrudeGeometry, Float32BufferAttribute, Group, HemisphereLight, IcosahedronGeometry, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, NoToneMapping, PerspectiveCamera, PlaneGeometry, Scene, Shape, SphereGeometry, SRGBColorSpace,
  Vector3, WebGLRenderer,
} from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Mamá paraba barba azul (la del Beni) con sus dos crías, en 3D (Three.js), de estilo tierno, con
// sombreado suave y mate, en el azul y el dorado del logo de la UAB: cabeza, espalda, alas y cola
// azules, pecho dorado, garganta azul oscuro, mancha blanca con rayitas en la cara, ojos grandes (la
// mamá con pestañas), pico negro en gancho, cola larga en punta y patas grises, en una rama con hojas.
// Las crías, una a cada lado, son más claras, cabezonas y de cola corta. Reaccionan al login:
//   reposo              nada escrito ni enfocado: parpadea; mira a los lados, se acicala el ala, la
//                       estira, se esponja, levanta una pata y da un saltito.
//   mirando-usuario     escribiendo el usuario: se inclina un poco hacia el campo.
//   mirando-contrasena  igual, un poco más abajo (el campo de la contraseña está debajo).
//   ojos-cerrados       la contraseña está a la vista: cierra los ojos y aparta la cabeza.
//   atento              campos llenos sin foco: quieta, parpadeando.
// La mamá es alta y estilizada; las crías, rechonchas. Tienen su propio ciclo (miran a los lados,
// aletean, ladean la cabeza y saltan) y una es inquieta: se aleja a saltitos por la rama y vuelve. Al
// escribir miran el campo con la mamá y, con la contraseña a la vista, también cierran los ojos.
// Modelo propio armado con formas de Three.js (sin archivos). Cada parte va con un resorte hacia su
// pose (sin saltos entre estados) más un movimiento continuo: respira, se balancea y la cola sigue con
// retraso. Con prefers-reduced-motion toma la pose de cada estado sin animar.

// Azul (#1718d0) y dorado (#c9b810) del logo de la UAB, en tres tonos de azul y un dorado algo más claro.
const AZUL = '#2f4fd8';
const AZUL_CLARO = '#7aa8f7'; // cobijas del ala: claras, para que el ala se distinga del cuerpo
const AZUL_OSCURO = '#141d8a';
const DORADO = '#f0cd36';
const DORADO_OSCURO = '#d9a91f';
const NEGRO = '#1b1b1f';
// Crías: los mismos colores, más claros.
const AZUL_CRIA = '#6f95ef';
const DORADO_CRIA = '#f8de72';
const PICO = '#26262c';
const BLANCO = '#ffffff';
const GRIS = '#4b5b5e';
const CORTEZA = '#8a5a3a';
const HOJA = '#5fb04a';

const ALTO_VISIBLE = 3.6; // unidades del modelo que entran a lo alto del cuadro (la mamá, grande)
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
  // Tapas en la base y en la punta, para que el tubo no se vea hueco desde ningún lado.
  for (const [u, anillo] of [[0, 0], [1, pasos]]) {
    const centro = curva.getPointAt(u);
    const indiceCentro = posiciones.length / 3;
    posiciones.push(centro.x, centro.y, centro.z);
    if (pintar) {
      c.set(pintar(u));
      colores.push(c.r, c.g, c.b);
    }
    for (let j = 0; j < lados; j += 1) {
      const k = anillo * (lados + 1) + j;
      indices.push(indiceCentro, k, k + 1);
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
  // Tres capas como en la paraba barba azul: plumas largas azul oscuro, azul medio y cobijas claras arriba.
  const azul = new Mesh(lamina((s) => {
    s.moveTo(-0.1, 0.06);
    s.bezierCurveTo(0.3, 0.16, 0.8, -0.1, 1.05, -0.6);
    s.bezierCurveTo(0.8, -0.5, 0.4, -0.5, 0.1, -0.42);
    s.bezierCurveTo(-0.08, -0.36, -0.16, -0.15, -0.1, 0.06);
  }, 0.03, 0.03), material(AZUL_OSCURO));
  const medio = new Mesh(lamina((s) => {
    s.moveTo(-0.11, 0.0);
    s.bezierCurveTo(0.2, 0.08, 0.5, -0.02, 0.66, -0.26);
    s.bezierCurveTo(0.5, -0.36, 0.2, -0.36, 0.0, -0.32);
    s.bezierCurveTo(-0.12, -0.24, -0.14, -0.1, -0.11, 0.0);
  }, 0.03, 0.025), material(AZUL));
  medio.position.z = 0.035;
  const claro = new Mesh(lamina((s) => {
    s.moveTo(-0.1, 0.06);
    s.bezierCurveTo(0.15, 0.13, 0.36, 0.06, 0.44, -0.1);
    s.bezierCurveTo(0.3, -0.18, 0.1, -0.2, -0.04, -0.16);
    s.bezierCurveTo(-0.13, -0.1, -0.14, 0.0, -0.1, 0.06);
  }, 0.03, 0.025), material(AZUL_CLARO));
  claro.position.z = 0.065;
  plano.add(azul, medio, claro);
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
    }, 0.02, 0.02), material(AZUL_OSCURO));
    pluma.rotation.z = -0.6;
    eje.add(pluma);
    eje.scale.setScalar(0.001);
    plano.add(eje);
    primarias.push(eje);
  }
  return { ala, primarias };
}

function crearAve({ giro = GIRO_BASE, cria = false } = {}) {
  // Mamá alta y estilizada; crías rechonchas.
  const forma = cria
    ? { radio: 0.56, alto: 0.64, centro: 0.95, cuello: 1.42, ala: 1.14 }
    : { radio: 0.47, alto: 0.8, centro: 1.08, cuello: 1.72, ala: 1.4 };
  const partes = { giro, alturaCuello: forma.cuello };
  const azulCuerpo = cria ? AZUL_CRIA : AZUL;
  const doradoCuerpo = cria ? DORADO_CRIA : DORADO;
  const base = new Group(); // ubicación y tamaño en la rama
  const inclinacion = new Group(); // gira en el plano de la pantalla, desde las patas; también salta
  const orientacion = new Group(); // gira el ave sobre su eje vertical
  orientacion.rotation.y = giro;
  base.add(inclinacion);
  inclinacion.add(orientacion);
  partes.base = base;
  partes.inclinacion = inclinacion;
  partes.orientacion = orientacion;

  const cuerpo = new Group();
  orientacion.add(cuerpo);
  partes.cuerpo = cuerpo;

  // Cuerpo de pera, liso: ancho abajo y angosto en el cuello, que sigue dentro de la cabeza.
  // Pecho y panza dorados al frente; espalda y hombros azules.
  const geoCuerpo = new IcosahedronGeometry(1, 5);
  const p = geoCuerpo.attributes.position;
  const colores = new Float32Array(p.count * 3);
  const azul = new Color(azulCuerpo);
  const dorado = new Color(doradoCuerpo);
  const doradoOscuro = new Color(cria ? DORADO : DORADO_OSCURO);
  const c = new Color();
  for (let i = 0; i < p.count; i += 1) {
    const [x, y, z] = [p.getX(i), p.getY(i), p.getZ(i)];
    const radio = forma.radio - (0.17 * Math.max(0, y + 0.2)) / 1.2;
    p.setXYZ(i, x * radio, forma.centro + y * forma.alto, z * radio * 1.08);
    const frente = Math.min(1, Math.max(0, (z - 0.12) / 0.3)) * Math.min(1, Math.max(0, (0.82 - y) / 0.2));
    c.copy(dorado).lerp(doradoOscuro, Math.max(0, -y) * 0.6);
    c.lerp(azul, 1 - frente);
    colores.set([c.r, c.g, c.b], i * 3);
  }
  geoCuerpo.setAttribute('color', new Float32BufferAttribute(colores, 3));
  const tronco = new Mesh(suavizar(geoCuerpo), material('#ffffff', { vertexColors: true }));
  cuerpo.add(tronco);

  // Plumas sueltas que asoman al esponjarse.
  partes.plumon = [];
  for (const [x, y, z] of [[0.48, 0.7, 0.24], [-0.48, 0.7, 0.24], [0.52, 0.98, -0.12], [-0.52, 0.98, -0.12], [0, 0.5, 0.56], [0.28, 1.2, 0.36], [-0.28, 1.2, 0.36]]) {
    const m = esfera([0.08, 0.055, 0.05], z > 0.3 ? doradoCuerpo : azulCuerpo, 12);
    m.position.set(x, y, z);
    m.lookAt(x * 3, y, z * 3);
    const envoltura = new Group();
    envoltura.add(m);
    envoltura.scale.setScalar(0.001);
    cuerpo.add(envoltura);
    partes.plumon.push(envoltura);
  }

  const izquierda = crearAla();
  const largoAla = cria ? 1 : 1.18; // la mamá, de alas largas
  izquierda.ala.position.set(forma.radio + 0.03, forma.ala, 0.06); // un poco despegada del cuerpo
  izquierda.ala.scale.setScalar(largoAla);
  const derecha = crearAla();
  derecha.ala.position.set(-(forma.radio + 0.03), forma.ala, 0.06);
  derecha.ala.scale.set(-largoAla, largoAla, largoAla);
  cuerpo.add(izquierda.ala, derecha.ala);
  partes.alaIzq = izquierda;
  partes.alaDer = derecha;

  // Cola larga en punta, más larga que el cuerpo: azul, más oscura hacia la punta.
  const cola = new Group();
  cola.position.set(0, 0.5, -0.4);
  const colorCola = (u) => new Color(azulCuerpo).lerp(new Color(AZUL_OSCURO), u).getStyle();
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
  if (cria) cola.scale.set(1, 0.4, 0.45); // cola corta de pichón
  else cola.scale.set(1, 1.25, 1.2); // cola larga y elegante de la mamá
  cuerpo.add(cola);
  partes.cola = cola;

  // Cabeza redonda y azul.
  const cuello = new Group();
  cuello.position.set(0, forma.cuello, 0.05);
  cuello.rotation.order = 'YXZ';
  orientacion.add(cuello);
  partes.cuello = cuello;
  const cabeza = esfera([0.5, 0.48, 0.51], azulCuerpo, 40);
  cabeza.position.set(0, 0.26, 0);
  cuello.add(cabeza);
  if (!cria) cuello.scale.setScalar(0.92); // cabeza algo más chica: silueta más fina
  if (cria) {
    cuello.scale.setScalar(1.3); // cabezón, como los pichones
    // Copete de pelusa.
    for (const [x, z, giroZ] of [[-0.06, -0.05, 0.4], [0.05, 0, -0.3], [0, -0.12, 0]]) {
      const pelusa = esfera([0.08, 0.13, 0.08], azulCuerpo, 16);
      pelusa.position.set(x, 0.74, z);
      pelusa.rotation.z = giroZ;
      cuello.add(pelusa);
    }
  }

  // Mancha blanca de la cara (como la de la paraba), apoyada en la cabeza, con el ojo encima.
  partes.ojos = [];
  const angulo = 0.85; // desde el frente hacia el costado
  for (const lado of [1, -1]) {
    const cara = new Group();
    cara.position.set(Math.sin(angulo) * 0.47 * lado, 0.24, Math.cos(angulo) * 0.47);
    cara.rotation.y = angulo * lado;
    const mancha = esfera([0.22, 0.2, 0.07], BLANCO);
    // Rayitas de plumas oscuras en la mancha blanca, como la de la paraba.
    for (let k = 0; k < 3; k += 1) {
      const raya = esfera([0.07, 0.008, 0.01], AZUL_OSCURO, 10);
      raya.position.set(-0.05 * lado, -0.09 - k * 0.035, 0.065);
      raya.rotation.z = 0.25 * lado;
      cara.add(raya);
    }
    const ojo = new Group();
    ojo.position.set(0.02 * lado, 0.03, 0.06);
    const disco = new Mesh(new CylinderGeometry(0.095, 0.095, 0.04, 28), material(NEGRO));
    disco.rotation.x = Math.PI / 2;
    const brillo = esfera([0.025, 0.025, 0.01], BLANCO, 10);
    brillo.position.set(-0.03, 0.035, 0.025);
    ojo.add(disco, brillo);
    if (!cria) {
      // Pestañas de la mamá: se cierran con el ojo.
      for (const angulo of [1.15, 1.6, 2.05]) {
        const pestana = new Mesh(new CapsuleGeometry(0.009, 0.045, 3, 6), material(NEGRO));
        pestana.position.set(Math.cos(angulo) * 0.115, Math.sin(angulo) * 0.115, 0.015);
        pestana.rotation.z = angulo - Math.PI / 2;
        ojo.add(pestana);
      }
    }
    cara.add(mancha, ojo);
    cuello.add(cara);
    partes.ojos.push({ ojo });
  }

  // Pico negro de paraba, en gancho, y la garganta azul oscuro (la "barba").
  const superior = new Mesh(
    tuboAfinado([[0, 0.28, 0.4], [0, 0.32, 0.54], [0, 0.24, 0.66], [0, 0.1, 0.68], [0, 0.01, 0.6]], 0.15, 0.02, { alto: 0.8 }),
    material(PICO, { side: DoubleSide }),
  );
  const inferior = new Mesh(
    tuboAfinado([[0, 0.12, 0.42], [0, 0.07, 0.52], [0, 0.05, 0.56]], 0.11, 0.04, { alto: 0.85 }),
    material(NEGRO, { side: DoubleSide }),
  );
  const barba = esfera([0.2, 0.12, 0.1], AZUL_OSCURO);
  barba.position.set(0, 0.02, 0.36);
  cuello.add(superior, inferior, barba);

  // Patas grises agarradas a la rama: dos dedos adelante y dos atrás, como las parabas. No giran con
  // el ave: quedan siempre sobre la rama, una al lado de la otra.
  partes.patas = [];
  for (const x of [0.15, -0.15]) {
    const pata = new Group();
    pata.position.set(x, 0.03, 0);
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
    inclinacion.add(pata);
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
  // Mientras nadie escribe (campos vacíos o ya llenos, por ejemplo autocompletados), sigue su ciclo.
  if (estado === 'reposo' || estado === 'atento') {
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

// Crías: ciclo propio, corto, desfasado entre las dos.
const CICLO_CRIA = 8;
const ACCIONES_CRIA = [
  { desde: 0.6, hasta: 1.9, pose: { yaw: -0.7, roll: 0.2 } },
  { desde: 2.2, hasta: 3.5, pose: { yaw: 0.7, roll: -0.2 } },
  { desde: 4.0, hasta: 5.0, pose: { alaIzq: 0.55, alaDer: 0.55 } },
  { desde: 5.6, hasta: 6.8, pose: { roll: 0.4, pitch: 0.15 } },
];

function poseCria(estado, t, seguimiento) {
  const pose = { ...POSE_BASE };
  if (estado.startsWith('mirando')) {
    Object.assign(pose, { inclinar: 0.08, yaw: -0.45 + (seguimiento - 0.5) * 0.3, pitch: estado.endsWith('contrasena') ? 0.3 : 0.12 });
  } else if (estado === 'ojos-cerrados') {
    Object.assign(pose, { yaw: 1.0, pitch: -0.2, ojo: 0 });
  } else {
    const c = t % CICLO_CRIA;
    for (const accion of ACCIONES_CRIA) {
      const peso = ventana(c, accion.desde, accion.hasta, 0.35);
      if (!peso) continue;
      for (const [clave, valor] of Object.entries(accion.pose)) pose[clave] += (valor - POSE_BASE[clave]) * peso;
    }
  }
  return pose;
}

function movimientoCria(estado, t) {
  const m = {
    respira: 0.03 * Math.sin((2 * Math.PI * t) / 1.6),
    balanceo: 0.04 * Math.sin((2 * Math.PI * t) / 3.1),
    cola: 0.12 * Math.sin((2 * Math.PI * t) / 1.4),
    cabezaY: 0.02 * Math.sin((2 * Math.PI * t) / 1.6 + 0.6),
    pitch: 0,
    salto: 0,
    aplastar: 0,
    ojo: 1,
    aleteo: 0,
  };
  if (estado === 'reposo' || estado === 'atento') {
    const c = t % CICLO_CRIA;
    m.aleteo = 0.35 * ventana(c, 4.0, 5.0, 0.2) * Math.sin(2 * Math.PI * 7 * t); // aletea rápido
    const u = (c - 7.1) / 0.4; // saltito
    if (u >= 0 && u <= 1) m.salto = Math.sin(Math.PI * u) * 0.35;
  }
  const p = t % 2.9; // parpadeo
  if (p < 0.16) m.ojo = 1 - Math.sin((Math.PI * p) / 0.16);
  return m;
}

// Cría inquieta: se queda, se da vuelta y se aleja a saltitos por la rama, mira alrededor, vuelve
// hacia la mamá y se queda otra vez.
const CICLO_PASEO = 14;
const LARGO_PASEO = 0.5;
function paseoInquieto(t) {
  const c = t % CICLO_PASEO;
  const brincos = (p) => Math.abs(Math.sin(Math.PI * p * 6)) * 0.1;
  if (c >= 3 && c < 5.4) {
    const p = (c - 3) / 2.4;
    return { dx: LARGO_PASEO * suave(p), girar: Math.PI, salto: brincos(p) };
  }
  if (c >= 5.4 && c < 8) return { dx: LARGO_PASEO, girar: c < 6.2 ? Math.PI : 0, salto: 0 };
  if (c >= 8 && c < 10.4) {
    const p = (c - 8) / 2.4;
    return { dx: LARGO_PASEO * (1 - suave(p)), girar: 0, salto: brincos(p) };
  }
  return { dx: 0, girar: 0, salto: 0 };
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
  if (estado === 'reposo' || estado === 'atento') {
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
    escena.add(new HemisphereLight('#ffffff', '#cbd8f3', 2.1)); // abajo celeste, como el panel
    const clave = new DirectionalLight('#fffaf2', 1.3);
    clave.position.set(-2, 5, 3);
    escena.add(clave);

    // La mamá al medio y una cría a cada lado, sobre la rama.
    const mama = crearAve();
    const crias = [
      { x: -0.6, giro: -0.6, desfase: 0, inquieta: false },
      { x: 0.64, giro: -1.15, desfase: 3.7, inquieta: true },
    ].map(({ x, giro, desfase, inquieta }) => {
      const cria = crearAve({ giro, cria: true });
      cria.base.position.set(x, -0.01, 0.05);
      cria.base.scale.setScalar(0.42);
      return { ave: cria, desfase, inquieta, x };
    });
    const mundo = new Group();
    mundo.add(mama.base, ...crias.map((c) => c.ave.base), crearRama(), crearSombra());
    escena.add(mundo);

    const camara = new PerspectiveCamera(30, 1, 0.1, 50);
    const ajustar = () => {
      const { clientWidth: w, clientHeight: h } = caja;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camara.aspect = w / h;
      const distancia = ALTO_VISIBLE / (2 * Math.tan((camara.fov * Math.PI) / 360));
      // Un poco desde arriba.
      camara.position.set(0, 2.1, distancia);
      camara.lookAt(0, 0.9, 0);
      camara.updateProjectionMatrix();
      // El ave a la derecha del centro; la rama sigue hasta el borde.
      mundo.position.x = -ALTO_VISIBLE * camara.aspect * 0.04;
    };
    ajustar();
    const observador = new ResizeObserver(ajustar);
    observador.observe(caja);

    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    // Cada ave con su pose y sus resortes.
    const animadores = [
      { ave: mama, pose: poseObjetivo, directo: movimientoDirecto, desfase: 0 },
      ...crias.map(({ ave, desfase, inquieta, x }) => ({
        ave, pose: poseCria, directo: movimientoCria, desfase, inquieta, x, dx: 0,
      })),
    ].map((animador) => ({
      ...animador,
      actual: { ...POSE_BASE },
      velocidad: Object.fromEntries(Object.keys(POSE_BASE).map((k) => [k, 0])),
    }));
    let anterior = performance.now();
    let cuadro = 0;

    const dibujar = (ahora) => {
      const dt = Math.min((ahora - anterior) / 1000, 1 / 30);
      anterior = ahora;
      const t = ahora / 1000;
      const quieto = reducido?.matches;
      const { estado: e, seguimiento: s } = entrada.current;
      for (const animador of animadores) {
        const { ave, pose, directo, desfase, actual, velocidad } = animador;
        const objetivo = pose(e, t + desfase, s);
        // La cría inquieta pasea solo mientras nadie escribe; si no, vuelve con la mamá.
        const paseo = animador.inquieta && !quieto && (e === 'reposo' || e === 'atento')
          ? paseoInquieto(t)
          : { dx: 0, girar: 0, salto: 0 };
        if (animador.inquieta) {
          objetivo.girar += paseo.girar;
          animador.dx += (paseo.dx - animador.dx) * Math.min(1, dt * 6);
          ave.base.position.x = animador.x + animador.dx;
        }
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
          ? { respira: 0, balanceo: 0, cola: 0, cabezaY: 0, pitch: 0, salto: 0, aplastar: 0, ojo: 1, aleteo: 0 }
          : directo(e, t + desfase);
        const a = actual;
        const aleteo = d.aleteo || 0;

        ave.inclinacion.rotation.z = a.inclinar + d.balanceo;
        ave.inclinacion.position.y = d.salto + paseo.salto;
        ave.orientacion.rotation.y = ave.giro + a.girar;
        const esponja = Math.max(0, a.plumon);
        ave.cuerpo.scale.set(
          1 + 0.08 * esponja + d.aplastar * 0.6,
          1 + 0.05 * esponja + d.respira - d.aplastar,
          1 + 0.08 * esponja + d.aplastar * 0.6,
        );
        ave.plumon.forEach((m) => m.scale.setScalar(Math.max(0.001, esponja)));
        ave.cuello.position.y = ave.alturaCuello * ave.cuerpo.scale.y + d.cabezaY;
        ave.cuello.rotation.set(a.pitch + d.pitch, a.yaw, a.roll);
        // Al abrir, el ala sube hacia atrás y se separa del cuerpo.
        ave.alaIzq.ala.rotation.set(0.9 * a.alaIzq, 0, -0.04 + 1.0 * a.alaIzq + aleteo);
        ave.alaDer.ala.rotation.set(0.9 * a.alaDer, 0, -0.04 + 1.0 * a.alaDer + aleteo);
        ave.alaIzq.primarias.forEach((p, i) => {
          p.scale.setScalar(Math.max(0.001, a.abanico));
          p.rotation.z = -i * 0.25 * a.abanico;
        });
        ave.alaDer.primarias.forEach((p) => p.scale.setScalar(Math.max(0.001, a.abanico * 0.4)));
        ave.cola.rotation.set(a.colaAlza, 0, a.colaGiro + d.cola);
        ave.patas[1].position.y = 0.03 + 0.2 * a.pata;
        ave.patas[1].rotation.x = -0.5 * a.pata;
        // Ojo cerrado: el disco se aplasta hasta una rayita.
        const abierto = Math.max(0, Math.min(1, a.ojo * d.ojo));
        ave.ojos.forEach(({ ojo }) => { ojo.scale.y = Math.max(0.12, abierto); });
      }
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
