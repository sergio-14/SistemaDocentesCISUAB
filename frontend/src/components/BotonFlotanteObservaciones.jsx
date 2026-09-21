import { useCallback, useEffect, forwardRef, useImperativeHandle, useMemo, useRef, useState, useLayoutEffect } from 'react';
import {
  AlertTriangle,
  CheckCheck,
  ChevronDown,
  ChevronsDown,
  Copy,
  EyeOff,
  MessageCircle,
  Pin,
  Reply,
  SendHorizontal,
  X
} from 'lucide-react';
import {
  getObservacionesPorFondo,
  agregarMensajeObservacion,
  getTypingObservacionFondo,
  setTypingObservacionFondo,
  marcarObservacionResuelta
} from '../apis/api';
import api from '../apis/api';
import toast from 'react-hot-toast';

const formatBadgeCount = (count) => (count > 99 ? '99+' : String(count));
const quoteAccentColors = ['#00e5ff', '#ff3df2', '#a3ff12', '#ffb000', '#7c4dff', '#00ffa3'];

const BotonFlotanteObservaciones = forwardRef(({ fondoId, estadoFondo, onObservacionCambiada }, ref) => {
  const [observaciones, setObservaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [isClosingChat, setIsClosingChat] = useState(false);
  const [texto, setTexto] = useState('');
  const [esInterno, setEsInterno] = useState(false);
  const [sending, setSending] = useState(false);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [alguienEscribiendo, setAlguienEscribiendo] = useState(false);
  const [typingIndicadorVisible, setTypingIndicadorVisible] = useState(false);
  const [panelBox, setPanelBox] = useState(null);
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const [isResizingPanel, setIsResizingPanel] = useState(false);
  const [menuMensajeId, setMenuMensajeId] = useState(null);
  const [menuPlacement, setMenuPlacement] = useState('below');
  const [respondiendoA, setRespondiendoA] = useState(null);
  const [observacionPorResolver, setObservacionPorResolver] = useState(null);
  const [observacionPendienteVisible, setObservacionPendienteVisible] = useState(true);
  const [cerrandoConfirmacionResolver, setCerrandoConfirmacionResolver] = useState(false);
  const [mensajeFijado, setMensajeFijado] = useState(null);
  const [mensajeParaFijar, setMensajeParaFijar] = useState(null);
  const [duracionFijado, setDuracionFijado] = useState('7d');
  const [mensajeResaltadoId, setMensajeResaltadoId] = useState(null);
  const [mensajesNuevosIds, setMensajesNuevosIds] = useState([]);
  const [mostrarBajarChat, setMostrarBajarChat] = useState(false);
  const [swipeMensaje, setSwipeMensaje] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const typingHideTimerRef = useRef(null);
  const panelRef = useRef(null);
  const dragStateRef = useRef(null);
  const resizeStateRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const swipeStateRef = useRef(null);
  const messageRefs = useRef(new Map());
  const knownMessageIdsRef = useRef(new Set());
  const initializedMessagesRef = useRef(false);
  const previousMessageRectsRef = useRef(new Map());
  const typingVisibleRef = useRef(false);
  const localTypingRef = useRef(false);
  const newMessageTimerRef = useRef(null);
  const closeChatTimerRef = useRef(null);
  const justOpenedChatRef = useRef(false);

  const capturarPosicionesMensajes = useCallback(() => {
    const rects = new Map();
    messageRefs.current.forEach((node, id) => {
      if (node) rects.set(id, node.getBoundingClientRect());
    });
    previousMessageRectsRef.current = rects;
  }, []);

  const extraerIdsMensajes = (observacionesData) => {
    return new Set(
      (observacionesData || []).flatMap((obs) =>
        (obs.mensajes || []).map((mensaje) => mensaje.id)
      )
    );
  };

  const cargarUsuario = useCallback(async () => {
    try {
      const response = await api.get('/usuario/');
      setUsuarioActual(response.data);
    } catch (err) {
      console.error('Error al cargar usuario:', err);
    }
  }, []);

  const cargarObservaciones = useCallback(async ({ silent = false, marcarLeido = false } = {}) => {
    if (!fondoId) return;

    try {
      capturarPosicionesMensajes();
      if (!silent) setLoading(true);
      const response = await getObservacionesPorFondo(fondoId, { marcarLeido });
      const observacionesData = response.data.results || response.data || [];
      const idsActuales = extraerIdsMensajes(observacionesData);

      if (!initializedMessagesRef.current) {
        knownMessageIdsRef.current = idsActuales;
        initializedMessagesRef.current = true;
      } else {
        const nuevos = [...idsActuales].filter((id) => !knownMessageIdsRef.current.has(id));
        knownMessageIdsRef.current = idsActuales;

        if (nuevos.length > 0) {
          if (newMessageTimerRef.current) window.clearTimeout(newMessageTimerRef.current);
          setMensajesNuevosIds(nuevos);
          newMessageTimerRef.current = window.setTimeout(() => {
            setMensajesNuevosIds((actuales) => actuales.filter((id) => !nuevos.includes(id)));
          }, 760);
        }
      }

      setObservaciones(observacionesData);
    } catch (err) {
      console.error('Error al cargar observaciones:', err);
      if (!silent) toast.error('No se pudo cargar el chat.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [fondoId, capturarPosicionesMensajes]);

  useEffect(() => {
    if (!fondoId) return;
    cargarObservaciones({ marcarLeido: false });
    cargarUsuario();
  }, [fondoId, cargarObservaciones, cargarUsuario]);

  useEffect(() => {
    if (!open || !fondoId) return undefined;
    cargarObservaciones({ silent: true, marcarLeido: true });
    const intervalId = window.setInterval(() => {
      cargarObservaciones({ silent: true, marcarLeido: true });
    }, 1800);
    return () => window.clearInterval(intervalId);
  }, [open, fondoId, cargarObservaciones]);

  useEffect(() => {
    if (open || !fondoId) return undefined;
    const intervalId = window.setInterval(() => {
      cargarObservaciones({ silent: true, marcarLeido: false });
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [open, fondoId, cargarObservaciones]);

  const cargarTyping = useCallback(async () => {
    if (!fondoId) return;
    try {
      const response = await getTypingObservacionFondo(fondoId);
      const siguienteEstado = Boolean(response.data?.alguien_escribiendo);
      typingVisibleRef.current = siguienteEstado;
      setAlguienEscribiendo(siguienteEstado);
      if (siguienteEstado) {
        if (typingHideTimerRef.current) window.clearTimeout(typingHideTimerRef.current);
        setTypingIndicadorVisible(true);
      } else {
        if (typingHideTimerRef.current) window.clearTimeout(typingHideTimerRef.current);
        typingHideTimerRef.current = window.setTimeout(() => {
          setTypingIndicadorVisible(false);
        }, 180);
      }
    } catch {
      typingVisibleRef.current = false;
      setAlguienEscribiendo(false);
      if (typingHideTimerRef.current) window.clearTimeout(typingHideTimerRef.current);
      typingHideTimerRef.current = window.setTimeout(() => {
        setTypingIndicadorVisible(false);
      }, 180);
    }
  }, [fondoId]);

  useEffect(() => {
    if (!open || !fondoId) return undefined;
    cargarTyping();
    const intervalId = window.setInterval(cargarTyping, 300);
    return () => window.clearInterval(intervalId);
  }, [open, fondoId, cargarTyping]);

  useEffect(() => () => {
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    if (typingHideTimerRef.current) window.clearTimeout(typingHideTimerRef.current);
    if (newMessageTimerRef.current) window.clearTimeout(newMessageTimerRef.current);
    if (closeChatTimerRef.current) window.clearTimeout(closeChatTimerRef.current);
    if (fondoId) setTypingObservacionFondo(fondoId, false).catch(() => {});
  }, [fondoId]);

  useEffect(() => {
    if (!open || !scrollRef.current) return;
    if (justOpenedChatRef.current) return;
    if (mensajesNuevosIds.length > 0) return;
    const debeBajar = shouldAutoScrollRef.current;
    const timeoutId = window.setTimeout(() => {
      if (!scrollRef.current || !debeBajar) return;
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 80);
    return () => window.clearTimeout(timeoutId);
  }, [open, observaciones, mensajesNuevosIds]);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 100);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setMenuMensajeId(null);
      setRespondiendoA(null);
      setMensajeFijado(null);
      setSwipeMensaje(null);
      setAlguienEscribiendo(false);
      setTypingIndicadorVisible(false);
    }
  }, [open]);

  useEffect(() => {
    if (!menuMensajeId) return undefined;

    const handleOutsidePointer = (event) => {
      const target = event.target;
      if (
        target.closest?.('.ft-chat-message-menu') ||
        target.closest?.('.ft-chat-message-menu-trigger')
      ) {
        return;
      }
      setMenuMensajeId(null);
    };

    window.addEventListener('pointerdown', handleOutsidePointer);
    return () => window.removeEventListener('pointerdown', handleOutsidePointer);
  }, [menuMensajeId]);

  useEffect(() => {
    if (!mensajeFijado?.fijadoHasta) return undefined;

    const validarVigencia = () => {
      if (Date.now() >= mensajeFijado.fijadoHasta) {
        setMensajeFijado(null);
      }
    };

    validarVigencia();
    const intervalId = window.setInterval(validarVigencia, 60000);
    return () => window.clearInterval(intervalId);
  }, [mensajeFijado]);

  useEffect(() => {
    if (!isDraggingPanel && !isResizingPanel) return undefined;

    const minWidth = 360;
    const minHeight = 430;
    const margin = 8;

    const clampBox = (box) => {
      const maxWidth = Math.max(minWidth, window.innerWidth - margin * 2);
      const maxHeight = Math.max(minHeight, window.innerHeight - margin * 2);
      const width = Math.min(Math.max(box.width, minWidth), maxWidth);
      const height = Math.min(Math.max(box.height, minHeight), maxHeight);
      const left = Math.min(Math.max(box.left, margin), window.innerWidth - width - margin);
      const top = Math.min(Math.max(box.top, margin), window.innerHeight - height - margin);
      return { left, top, width, height };
    };

    const handlePointerMove = (event) => {
      const dragState = dragStateRef.current;
      const resizeState = resizeStateRef.current;

      if (dragState) {
        const dx = event.clientX - dragState.startX;
        const dy = event.clientY - dragState.startY;
        setPanelBox(clampBox({
          ...dragState.startBox,
          left: dragState.startBox.left + dx,
          top: dragState.startBox.top + dy,
        }));
        return;
      }

      if (resizeState) {
        const dx = event.clientX - resizeState.startX;
        const dy = event.clientY - resizeState.startY;
        const edges = resizeState.edges;
        const next = { ...resizeState.startBox };

        if (edges.includes('right')) next.width = resizeState.startBox.width + dx;
        if (edges.includes('bottom')) next.height = resizeState.startBox.height + dy;
        if (edges.includes('left')) {
          next.left = resizeState.startBox.left + dx;
          next.width = resizeState.startBox.width - dx;
        }
        if (edges.includes('top')) {
          next.top = resizeState.startBox.top + dy;
          next.height = resizeState.startBox.height - dy;
        }

        setPanelBox(clampBox(next));
      }
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
      resizeStateRef.current = null;
      setIsDraggingPanel(false);
      setIsResizingPanel(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDraggingPanel, isResizingPanel]);

  useImperativeHandle(ref, () => ({
    abrirPanel: () => {
      shouldAutoScrollRef.current = true;
      justOpenedChatRef.current = true;
      setOpen(true);
      if (onObservacionCambiada) onObservacionCambiada();
    },
    obtenerPendientes: () => {
      return observaciones.filter((obs) => !obs.resuelta).length;
    },
    actualizarObservaciones: async () => {
      await cargarObservaciones({ silent: true, marcarLeido: open });
    }
  }));

  const esAutoridad = usuarioActual?.perfil?.rol === 'director' ||
    usuarioActual?.perfil?.rol === 'jefe_estudios';
  const rolActivo = localStorage.getItem('active_role') || usuarioActual?.perfil?.rol;
  const puedeMarcarObservacionResuelta = usuarioActual?.is_superuser || rolActivo === 'jefe_estudios';

  const observacionesOrdenadas = useMemo(() => {
    return [...observaciones].sort(
      (a, b) => new Date(a.fecha_creacion) - new Date(b.fecha_creacion)
    );
  }, [observaciones]);

  const mensajes = useMemo(() => {
    return observacionesOrdenadas
      .flatMap((obs, obsIndex) => (obs.mensajes || []).map((mensaje, index) => ({
        ...mensaje,
        observacionId: obs.id,
        observacionNumero: obsIndex + 1,
        observacionResuelta: obs.resuelta,
        esInicial: index === 0,
      })))
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  }, [observacionesOrdenadas]);

  useLayoutEffect(() => {
    if (!open || !scrollRef.current || !justOpenedChatRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    setMostrarBajarChat(false);
    previousMessageRectsRef.current = new Map();
    justOpenedChatRef.current = false;
  }, [open, mensajes.length, loading]);

  const observacionPendientePrincipal = useMemo(() => {
    const pendientes = mensajes.filter((mensaje) => mensaje.esInicial && !mensaje.observacionResuelta);
    return pendientes[pendientes.length - 1] || null;
  }, [mensajes]);

  useLayoutEffect(() => {
    if (justOpenedChatRef.current) return;
    const nuevos = mensajesNuevosIds;
    const previousRects = previousMessageRectsRef.current;
    const tieneMovimientoPendiente = previousRects && previousRects.size > 0;
    const debeAnclarAbajo = open && shouldAutoScrollRef.current && (nuevos.length > 0 || tieneMovimientoPendiente) && scrollRef.current;

    if (debeAnclarAbajo) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }

    if (previousRects && previousRects.size > 0) {
      messageRefs.current.forEach((node, id) => {
        const previous = previousRects.get(id);
        if (!node || !previous || nuevos.includes(id)) return;

        const current = node.getBoundingClientRect();
        const deltaY = previous.top - current.top;
        if (Math.abs(deltaY) < 1) return;

        node.animate(
          [
            { transform: `translateY(${deltaY}px)` },
            { transform: 'translateY(0)' },
          ],
          {
            duration: 460,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          }
        );
      });
    }

    previousMessageRectsRef.current = new Map();
  }, [mensajes, mensajesNuevosIds, open]);

  const hayConversacionActiva = observaciones.length > 0;
  const puedeResponder = esAutoridad || estadoFondo === 'observado' || hayConversacionActiva;

  const esMiMensaje = (mensaje) => {
    const usuarioActualId = Number(usuarioActual?.id);
    const autorId = Number(mensaje?.autor);
    const usuarioActualUsername = String(usuarioActual?.username || '').toLowerCase();
    const autorUsername = String(mensaje?.autor_username || '').toLowerCase();

    if (Number.isFinite(usuarioActualId) && Number.isFinite(autorId)) {
      return usuarioActualId === autorId;
    }

    return Boolean(usuarioActualUsername && autorUsername && usuarioActualUsername === autorUsername);
  };

  const esMensajeDeOtroUsuario = (mensaje) => !esMiMensaje(mensaje);

  const badgeCount = observaciones
    .filter((obs) => !obs.resuelta)
    .reduce((count, obs) => {
      const mensajesOtro = (obs.mensajes || []).filter((msg) =>
        esMensajeDeOtroUsuario(msg) && !msg.leido
      );
      return count + mensajesOtro.length;
    }, 0);

  const conversacionActiva = observacionesOrdenadas[observacionesOrdenadas.length - 1] || null;
  const formatHora = (fecha) => {
    if (!fecha) return '';
    const parsed = new Date(fecha);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
  };

  const fechaKey = (fecha) => {
    if (!fecha) return '';
    const parsed = new Date(fecha);
    if (Number.isNaN(parsed.getTime())) return '';
    return [
      parsed.getFullYear(),
      String(parsed.getMonth() + 1).padStart(2, '0'),
      String(parsed.getDate()).padStart(2, '0'),
    ].join('-');
  };

  const formatFechaSeparador = (fecha) => {
    if (!fecha) return '';
    const parsed = new Date(fecha);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString('es-BO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const resumenMensaje = (mensaje) => {
    const contenido = String(mensaje?.texto || '').replace(/\s+/g, ' ').trim();
    if (!contenido) return 'Mensaje';
    return contenido.length > 86 ? `${contenido.slice(0, 86)}...` : contenido;
  };

  const nombreCita = (mensaje) => {
    if (!mensaje) return 'Mensaje';
    if (esMiMensaje(mensaje)) return 'Tú';
    return mensaje.autor_nombre || mensaje.autor_username || 'Mensaje';
  };

  const colorCita = (mensaje) => {
    const seed = Number(mensaje?.id || mensaje?.autor || 0);
    return quoteAccentColors[Math.abs(seed) % quoteAccentColors.length];
  };

  const elegirRespuesta = (mensaje) => {
    setRespondiendoA(mensaje);
    setMenuMensajeId(null);
    window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60);
  };

  const copiarMensaje = async (mensaje) => {
    try {
      await navigator.clipboard.writeText(mensaje.texto || '');
      toast.success('Mensaje copiado');
    } catch {
      toast.error('No se pudo copiar el mensaje');
    } finally {
      setMenuMensajeId(null);
    }
  };

  const fijarMensaje = (mensaje) => {
    setMensajeParaFijar(mensaje);
    setDuracionFijado('7d');
    setMenuMensajeId(null);
  };

  const confirmarFijarMensaje = () => {
    if (!mensajeParaFijar) return;
    const ahora = Date.now();
    const duraciones = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    setMensajeFijado({
      ...mensajeParaFijar,
      fijadoHasta: ahora + duraciones[duracionFijado],
      duracionFijado,
    });
    setMensajeParaFijar(null);
    toast.success('Fijaste un mensaje.');
  };

  const irAMensaje = (mensajeId) => {
    if (!mensajeId) return;
    const target = messageRefs.current.get(mensajeId);
    const container = scrollRef.current;
    if (!target || !container) return;

    const offset = target.offsetTop - 72;
    container.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
    setMensajeResaltadoId(mensajeId);
    window.setTimeout(() => setMensajeResaltadoId(null), 1800);
  };

  const irAMensajeFijado = () => {
    irAMensaje(mensajeFijado?.id);
  };

  const toggleMenuMensaje = (event, mensajeId) => {
    event.stopPropagation();

    if (menuMensajeId === mensajeId) {
      setMenuMensajeId(null);
      return;
    }

    const triggerRect = event.currentTarget.getBoundingClientRect();
    const bodyRect = scrollRef.current?.getBoundingClientRect();
    const limiteInferior = bodyRect?.bottom || window.innerHeight;
    const limiteSuperior = bodyRect?.top || 0;
    const espacioAbajo = limiteInferior - triggerRect.bottom;
    const espacioArriba = triggerRect.top - limiteSuperior;

    setMenuPlacement(espacioAbajo >= 150 || espacioAbajo >= espacioArriba ? 'below' : 'above');
    setMenuMensajeId(mensajeId);
  };

  const handleEnviar = async () => {
    const textoLimpio = String(texto || '').trim();

    if (!conversacionActiva) {
      toast.error('No hay una observacion activa.');
      inputRef.current?.focus({ preventScroll: true });
      return;
    }

    if (!puedeResponder) {
      toast.error('No puedes responder en este estado.');
      inputRef.current?.focus({ preventScroll: true });
      return;
    }

    if (!textoLimpio) {
      inputRef.current?.focus({ preventScroll: true });
      return;
    }

    setSending(true);
    shouldAutoScrollRef.current = true;
    try {
      await agregarMensajeObservacion(conversacionActiva.id, textoLimpio, respondiendoA?.id || null, esInterno);
      localTypingRef.current = false;
      window.setTimeout(() => {
        setTypingObservacionFondo(fondoId, false).catch(() => {});
      }, 650);
      setTexto('');
      setEsInterno(false);
      setRespondiendoA(null);
      await cargarObservaciones({ silent: true, marcarLeido: true });
    } catch (err) {
      console.error('Error al enviar mensaje:', err);
      toast.error(err.response?.data?.error || 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
      window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 80);
    }
  };

  const marcarComoResuelta = async (observacionId) => {
    if (!observacionId) return;
    try {
      await marcarObservacionResuelta(observacionId);
      setObservaciones((actuales) =>
        actuales.map((obs) =>
          obs.id === observacionId
            ? { ...obs, resuelta: true, fecha_resolucion: new Date().toISOString() }
            : obs
        )
      );
      cerrarConfirmacionResolver();
      toast.success('Observacion marcada como resuelta.');
    } catch (err) {
      console.error('Error al marcar observacion como resuelta:', err);
      toast.error('No se pudo marcar como resuelta.');
    }
  };

  const cerrarConfirmacionResolver = () => {
    if (!observacionPorResolver) return;
    setCerrandoConfirmacionResolver(true);
    window.setTimeout(() => {
      setObservacionPorResolver(null);
      setCerrandoConfirmacionResolver(false);
    }, 220);
  };

  const actualizarVisibilidadObservacionPendiente = useCallback(() => {
    if (!observacionPendientePrincipal?.id || !scrollRef.current) {
      setObservacionPendienteVisible(true);
      return;
    }

    const target = messageRefs.current.get(observacionPendientePrincipal.id);
    if (!target) {
      setObservacionPendienteVisible(false);
      return;
    }

    const containerRect = scrollRef.current.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    setObservacionPendienteVisible(
      targetRect.bottom > containerRect.top + 12 &&
      targetRect.top < containerRect.bottom - 12
    );
  }, [observacionPendientePrincipal]);

  const handleTextoChange = (value) => {
    setTexto(value);
    if (!open || !fondoId || !hayConversacionActiva || !puedeResponder) return;

    const escribiendo = String(value || '').trim().length > 0;

    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);

    if (escribiendo) {
      localTypingRef.current = true;
      setTypingObservacionFondo(fondoId, true).catch(() => {});
      typingTimerRef.current = window.setTimeout(() => {
        localTypingRef.current = false;
        setTypingObservacionFondo(fondoId, false).catch(() => {});
      }, 1800);
      return;
    }

    if (localTypingRef.current) {
      localTypingRef.current = false;
      setTypingObservacionFondo(fondoId, false).catch(() => {});
    }
  };

  const cerrarChat = () => {
    if (isClosingChat) return;
    setIsClosingChat(true);
    setAlguienEscribiendo(false);
    setTypingIndicadorVisible(false);
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    if (typingHideTimerRef.current) window.clearTimeout(typingHideTimerRef.current);
    localTypingRef.current = false;
    if (fondoId) setTypingObservacionFondo(fondoId, false).catch(() => {});
    if (closeChatTimerRef.current) window.clearTimeout(closeChatTimerRef.current);
    closeChatTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      setIsClosingChat(false);
      setPanelBox(null);
      setMenuMensajeId(null);
      setRespondiendoA(null);
      setObservacionPorResolver(null);
      setCerrandoConfirmacionResolver(false);
      setMensajeParaFijar(null);
    }, 320);
  };

  const handleChatScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanciaAlFinal = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldAutoScrollRef.current = distanciaAlFinal < 80;
    setMostrarBajarChat(distanciaAlFinal > 180);
    actualizarVisibilidadObservacionPendiente();
  };

  const bajarAlFinalChat = () => {
    const el = scrollRef.current;
    if (!el) return;
    shouldAutoScrollRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setMostrarBajarChat(false);
  };

  useEffect(() => {
    if (!open || !observacionPendientePrincipal) return undefined;
    const timeoutId = window.setTimeout(actualizarVisibilidadObservacionPendiente, 40);
    return () => window.clearTimeout(timeoutId);
  }, [open, observacionPendientePrincipal, mensajes, actualizarVisibilidadObservacionPendiente]);

  const iniciarSwipeMensaje = (event, mensaje, esMio) => {
    if (event.pointerType === 'mouse') return;
    swipeStateRef.current = {
      id: mensaje.id,
      mensaje,
      esMio,
      startX: event.clientX,
      startY: event.clientY,
    };
  };

  const moverSwipeMensaje = (event) => {
    const state = swipeStateRef.current;
    if (!state) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (Math.abs(dy) > 26) return;

    const direccionCorrecta = state.esMio ? dx < 0 : dx > 0;
    if (!direccionCorrecta) {
      setSwipeMensaje(null);
      return;
    }

    setSwipeMensaje({
      id: state.id,
      offset: Math.max(-58, Math.min(58, dx)),
    });
  };

  const finalizarSwipeMensaje = () => {
    const state = swipeStateRef.current;
    const current = swipeMensaje;
    swipeStateRef.current = null;
    setSwipeMensaje(null);

    if (!state || !current || Math.abs(current.offset) < 42) return;
    elegirRespuesta(state.mensaje);
  };

  const getCurrentPanelBox = () => {
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) {
      return panelBox || {
        left: Math.max(8, window.innerWidth - 430 - 24),
        top: Math.max(8, window.innerHeight - 690 - 96),
        width: 430,
        height: 690,
      };
    }
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const iniciarArrastre = (event) => {
    if (event.button !== 0) return;
    if (event.target.closest('[data-no-drag="true"]')) return;
    const startBox = getCurrentPanelBox();
    setPanelBox(startBox);
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startBox,
    };
    setIsDraggingPanel(true);
  };

  const iniciarResize = (event, edges) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const startBox = getCurrentPanelBox();
    setPanelBox(startBox);
    resizeStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startBox,
      edges,
    };
    setIsResizingPanel(true);
  };

  return (
    <>
      <button
        onClick={() => {
          if (open) cerrarChat();
          else {
            if (closeChatTimerRef.current) window.clearTimeout(closeChatTimerRef.current);
            setIsClosingChat(false);
            shouldAutoScrollRef.current = true;
            justOpenedChatRef.current = true;
            setOpen(true);
          }
        }}
        className={`ft-chat-button fixed bottom-6 right-6 w-14 h-14 rounded-full transition-all duration-300 hover:scale-110 flex items-center justify-center text-white z-[121] ${isClosingChat ? 'is-absorbing' : ''}`}
        title="Mensajes"
        aria-label={badgeCount > 0 ? `Mensajes, ${formatBadgeCount(badgeCount)} pendientes` : 'Mensajes'}
      >
        <MessageCircle size={22} />
        {badgeCount > 0 && (
          <span className="ft-chat-unread-badge">
            {formatBadgeCount(badgeCount)}
          </span>
        )}
      </button>

      {open && (
        <div className="ft-chat-layer fixed inset-0 z-[122] pointer-events-none">
          <div
            ref={panelRef}
            style={panelBox ? {
              left: panelBox.left,
              top: panelBox.top,
              width: panelBox.width,
              height: panelBox.height,
            } : undefined}
            className={`ft-chat-panel absolute w-[430px] max-w-[calc(100vw-1.5rem)] h-[690px] max-h-[calc(100vh-8rem)] rounded-3xl overflow-hidden flex flex-col pointer-events-auto ${panelBox ? '' : 'right-6 bottom-24'} ${isClosingChat ? 'is-closing' : ''}`}
          >
            <div
              onPointerDown={iniciarArrastre}
              className={`ft-chat-header relative z-20 ${isDraggingPanel ? 'cursor-grabbing' : 'cursor-grab'}`}
            >
              <div className="px-4 py-3 flex items-center gap-2 select-none">
                <MessageCircle size={16} className="ft-chat-header-icon" />
                <div className="ft-chat-header-title text-sm truncate">
                  Mensajes del Fondo
                </div>
                <button
                  data-no-drag="true"
                  onClick={cerrarChat}
                  className="ft-chat-header-action ml-auto"
                  title="Cerrar"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <span className="ft-chat-resize-handle ft-chat-resize-top" onPointerDown={(e) => iniciarResize(e, 'top')} />
            <span className="ft-chat-resize-handle ft-chat-resize-right" onPointerDown={(e) => iniciarResize(e, 'right')} />
            <span className="ft-chat-resize-handle ft-chat-resize-bottom" onPointerDown={(e) => iniciarResize(e, 'bottom')} />
            <span className="ft-chat-resize-handle ft-chat-resize-left" onPointerDown={(e) => iniciarResize(e, 'left')} />
            <span className="ft-chat-resize-handle ft-chat-resize-top-left" onPointerDown={(e) => iniciarResize(e, 'top left')} />
            <span className="ft-chat-resize-handle ft-chat-resize-top-right" onPointerDown={(e) => iniciarResize(e, 'top right')} />
            <span className="ft-chat-resize-handle ft-chat-resize-bottom-left" onPointerDown={(e) => iniciarResize(e, 'bottom left')} />
            <span className="ft-chat-resize-handle ft-chat-resize-bottom-right" onPointerDown={(e) => iniciarResize(e, 'bottom right')} />

            {mensajeFijado && (
              <div
                role="button"
                tabIndex={0}
                className="ft-chat-pinned-bar"
                onClick={irAMensajeFijado}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    irAMensajeFijado();
                  }
                }}
                title="Ir al mensaje fijado"
              >
                <Pin size={15} />
                <span>{resumenMensaje(mensajeFijado)}</span>
                <button
                  type="button"
                  className="ft-chat-pinned-clear"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMensajeFijado(null);
                  }}
                  title="Desfijar"
                >
                  <X size={13} />
                </button>
              </div>
            )}
            {!observacionPorResolver && observacionPendientePrincipal && !observacionPendienteVisible && (
              <div
                role="button"
                tabIndex={0}
                className="ft-chat-resolve-sticky ft-chat-pending-sticky"
                onClick={() => irAMensaje(observacionPendientePrincipal.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    irAMensaje(observacionPendientePrincipal.id);
                  }
                }}
                title="Ir a la observacion pendiente"
              >
                <AlertTriangle size={14} />
                <div>
                  <span>Observacion #{observacionPendientePrincipal.observacionNumero}</span>
                  <p>Pendiente de resolver</p>
                </div>
              </div>
            )}

            <div
              ref={scrollRef}
              onScroll={handleChatScroll}
              className="ft-chat-body relative flex-1 overflow-y-auto p-3"
            >
              {loading && <p className="ft-chat-empty">Cargando mensajes...</p>}
              {!loading && mensajes.length === 0 && (
                <p className="ft-chat-empty">No hay mensajes todavia.</p>
              )}

              {mensajes.map((mensaje, index) => {
                const esMio = esMiMensaje(mensaje);
                const swipeOffset = swipeMensaje?.id === mensaje.id ? swipeMensaje.offset : 0;
                const esNuevo = mensajesNuevosIds.includes(mensaje.id);
                const mostrarSeparadorFecha =
                  index === 0 || fechaKey(mensaje.fecha) !== fechaKey(mensajes[index - 1]?.fecha);
                return (
                  <div key={mensaje.id}>
                    {mostrarSeparadorFecha && (
                      <div className="ft-chat-date-separator">
                        <span>{formatFechaSeparador(mensaje.fecha)}</span>
                      </div>
                    )}
                    <div
                      ref={(node) => {
                        if (node) messageRefs.current.set(mensaje.id, node);
                        else messageRefs.current.delete(mensaje.id);
                      }}
                      style={{ '--ft-chat-accent': colorCita(mensaje) }}
                      className={`ft-chat-message-row mb-2 flex ${esMio ? 'justify-end' : 'justify-start'} ${menuMensajeId === mensaje.id ? 'has-open-menu' : ''} ${esNuevo ? 'is-new' : ''} ${mensajeResaltadoId === mensaje.id ? 'is-highlighted' : ''}`}
                    >
                    <div
                      className={`ft-chat-message-wrap ${esMio ? 'is-mine' : 'is-peer'} ${swipeMensaje?.id === mensaje.id ? 'is-swiping' : ''}`}
                      style={swipeOffset ? { transform: `translateX(${swipeOffset}px)` } : undefined}
                      onPointerDown={(e) => iniciarSwipeMensaje(e, mensaje, esMio)}
                      onPointerMove={moverSwipeMensaje}
                      onPointerUp={finalizarSwipeMensaje}
                      onPointerCancel={finalizarSwipeMensaje}
                    >
                      {menuMensajeId === mensaje.id && (
                        <div className={`ft-chat-message-menu ${esMio ? 'is-mine' : 'is-peer'} is-${menuPlacement}`}>
                          <button type="button" onClick={() => elegirRespuesta(mensaje)}>
                            <Reply size={14} />
                            <span>Responder</span>
                          </button>
                          <button type="button" onClick={() => copiarMensaje(mensaje)}>
                            <Copy size={14} />
                            <span>Copiar</span>
                          </button>
                          <button type="button" onClick={() => fijarMensaje(mensaje)}>
                            <Pin size={14} />
                            <span>Fijar</span>
                          </button>
                        </div>
                      )}
                      <div className={`ft-chat-bubble ${esMio ? 'is-mine' : 'is-peer'} ${mensaje.esInicial ? 'has-initial-label' : ''}`}>
                      <button
                        type="button"
                        className="ft-chat-message-menu-trigger"
                        onClick={(e) => toggleMenuMensaje(e, mensaje.id)}
                        title="Opciones"
                        aria-label="Opciones del mensaje"
                      >
                        <ChevronDown size={20} />
                      </button>
                      {mensaje.responde_a_detalle && (
                        <div
                          className="ft-chat-reply-quote"
                          style={{ '--ft-chat-accent': colorCita(mensaje.responde_a_detalle) }}
                        >
                          <span>{nombreCita(mensaje.responde_a_detalle)}</span>
                          <p>{resumenMensaje(mensaje.responde_a_detalle)}</p>
                        </div>
                      )}
                      {mensaje.es_interno && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 mb-1 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          <EyeOff size={10} /> Interno
                        </span>
                      )}
                      <p className="ft-chat-text text-sm break-words whitespace-pre-wrap">{mensaje.texto}</p>
                      {mensaje.esInicial && (
                        <p className={`ft-chat-initial-label ${mensaje.observacionResuelta ? 'is-resolved' : ''}`}>
                          <AlertTriangle size={11} />
                          <span>Observacion #{mensaje.observacionNumero || 1}</span>
                          <span className="ft-chat-observation-state">
                            ({mensaje.observacionResuelta ? 'Resuelta' : 'Pendiente'})
                          </span>
                          {!mensaje.observacionResuelta && puedeMarcarObservacionResuelta && (
                            <button
                              type="button"
                              className="ft-chat-resolve-link"
                              onClick={() => {
                                setCerrandoConfirmacionResolver(false);
                                setObservacionPorResolver({
                                  id: mensaje.observacionId,
                                  numero: mensaje.observacionNumero || 1,
                                  mensajeId: mensaje.id
                                });
                              }}
                            >
                              Marcar como resuelta
                            </button>
                          )}
                        </p>
                      )}
                      <p className="ft-chat-time">
                        <span>{formatHora(mensaje.fecha)}</span>
                        {esMio && (
                          <span
                            className={`ft-chat-status ${mensaje.leido ? 'is-read' : ''}`}
                            title={mensaje.leido ? 'Leido' : 'Entregado'}
                          >
                            <CheckCheck size={17} />
                          </span>
                        )}
                      </p>
                      </div>
                    </div>
                  </div>
                  </div>
                );
              })}

              <div className={`ft-chat-typing-row ${typingIndicadorVisible && mensajesNuevosIds.length === 0 ? 'is-visible' : ''}`}>
                <div className="flex justify-start">
                  <div className="ft-chat-typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            </div>
            {mostrarBajarChat && (
              <button
                type="button"
                className="ft-chat-scroll-bottom"
                onClick={bajarAlFinalChat}
                title="Bajar al final"
                aria-label="Bajar al final del chat"
              >
                <ChevronsDown size={20} />
              </button>
            )}

            <div className="ft-chat-composer p-3">
              {respondiendoA && (
                <div
                  className="ft-chat-reply-preview"
                  style={{ '--ft-chat-accent': colorCita(respondiendoA) }}
                >
                  <div>
                    <span>{nombreCita(respondiendoA)}</span>
                    <p>{resumenMensaje(respondiendoA)}</p>
                  </div>
                  <button type="button" onClick={() => setRespondiendoA(null)} title="Cancelar respuesta">
                    <X size={14} />
                  </button>
                </div>
              )}
              {observacionPorResolver && (
                <div className={`ft-chat-resolve-confirm ${cerrandoConfirmacionResolver ? 'is-closing' : ''}`}>
                  <AlertTriangle size={14} />
                  <div>
                    <span>Observacion #{observacionPorResolver.numero}</span>
                    <p>Observacion resuelta?</p>
                  </div>
                  <button
                    type="button"
                    className="ft-chat-resolve-confirm-cancel"
                    onClick={cerrarConfirmacionResolver}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="ft-chat-resolve-confirm-action"
                    onClick={() => marcarComoResuelta(observacionPorResolver.id)}
                  >
                    Confirmar
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={texto}
                  onChange={(e) => handleTextoChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleEnviar();
                    }
                  }}
                  placeholder={
                    !hayConversacionActiva
                      ? 'No hay observaciones activas'
                      : !puedeResponder
                        ? 'No puedes responder en este estado'
                        : 'Escribe un mensaje...'
                  }
                  disabled={sending || !hayConversacionActiva || !puedeResponder}
                  className="ft-chat-input"
                />
                <button
                  onClick={handleEnviar}
                  disabled={sending || !hayConversacionActiva || !puedeResponder || !texto.trim()}
                  className="ft-chat-send"
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <SendHorizontal size={16} />
                  )}
                </button>
              </div>
            </div>

            {mensajeParaFijar && (
              <div className="ft-chat-pin-modal-layer">
                <div className="ft-chat-pin-modal">
                  <h3>Selecciona por cuanto tiempo quieres fijar el mensaje</h3>
                  <p>Puedes desfijarlo en cualquier momento.</p>

                  <div className="ft-chat-pin-options">
                    {[
                      { value: '24h', label: '24 horas' },
                      { value: '7d', label: '7 dias' },
                      { value: '30d', label: '30 dias' },
                    ].map((option) => (
                      <label key={option.value} className="ft-chat-pin-option">
                        <input
                          type="radio"
                          name="ft-chat-pin-duration"
                          value={option.value}
                          checked={duracionFijado === option.value}
                          onChange={() => setDuracionFijado(option.value)}
                        />
                        <span />
                        <strong>{option.label}</strong>
                      </label>
                    ))}
                  </div>

                  <div className="ft-chat-pin-actions">
                    <button type="button" onClick={() => setMensajeParaFijar(null)}>
                      Cancelar
                    </button>
                    <button type="button" onClick={confirmarFijarMensaje}>
                      Fijar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
});

BotonFlotanteObservaciones.displayName = 'BotonFlotanteObservaciones';

export default BotonFlotanteObservaciones;
