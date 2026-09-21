import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, SendHorizontal, X, ChevronDown, Search, Trash2, Ban, MoreVertical, Check, CheckCheck } from 'lucide-react';
import Dialog from './base/Dialog';
import {
  getChatContactosPOA,
  buscarUsuariosChatPOA,
  getMensajesChatPOA,
  enviarMensajeChatPOA,
  vaciarChatPOA,
  getEstadoBloqueoChatPOA,
  bloquearUsuarioChatPOA,
  desbloquearUsuarioChatPOA,
  getCurrentUserPOA,
} from '../../../apis/poa.api';

const toNumericId = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const resolveUserId = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'string') return toNumericId(value);
  const candidates = [value?.id, value?.user_id, value?.pk, value?.user?.id, value?.user?.pk, value?.user_detalle?.id];
  for (const candidate of candidates) {
    const resolved = toNumericId(candidate);
    if (resolved) return resolved;
  }
  return null;
};

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const formatNombre = (contacto) => contacto?.nombre_completo || contacto?.nombre || contacto?.username || 'Usuario';

const resolveCount = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const getUnreadFromContact = (contacto) => resolveCount(
  contacto?.no_leidos ?? contacto?.mensajes_no_leidos ?? contacto?.unread_count,
);

const resolveUnreadTotal = (data) => {
  const direct = resolveCount(data?.no_leidos_total ?? data?.mensajes_no_leidos_total ?? data?.unread_count);
  if (direct) return direct;

  const contactos = Array.isArray(data?.contactos) ? data.contactos : [];
  const recientes = Array.isArray(data?.contactos_recientes) ? data.contactos_recientes : [];
  const merged = [...contactos, ...recientes];
  const seen = new Set();
  return merged.reduce((total, contacto) => {
    const id = resolveUserId(contacto);
    if (!id || seen.has(id)) return total;
    seen.add(id);
    return total + getUnreadFromContact(contacto);
  }, 0);
};

const formatBadgeCount = (count) => (count > 99 ? '99+' : String(count));

const isConnectionRefused = (err) => {
  const code = err?.code || err?.cause?.code;
  const message = String(err?.message || '').toLowerCase();
  return code === 'ERR_NETWORK' || message.includes('connection refused') || !err?.response;
};

const isAuthExpired = (err) => {
  const status = err?.response?.status;
  return status === 401 || status === 403;
};

function ChatFlotantePOA({ currentUser }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState(null);
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const [loadingContactos, setLoadingContactos] = useState(false);
  const [contactosSugeridos, setContactosSugeridos] = useState([]);
  const [contactosRecientes, setContactosRecientes] = useState([]);
  const [contactoDefault, setContactoDefault] = useState(null);
  const [selectedPeer, setSelectedPeer] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0);
  const [loadingMensajes, setLoadingMensajes] = useState(false);
  const [texto, setTexto] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showChatList, setShowChatList] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showVaciarDialog, setShowVaciarDialog] = useState(false);
  const [bloqueoEstado, setBloqueoEstado] = useState({ bloqueado_por_mi: false, bloqueado_por_peer: false });
  const [alertaAsignacion, setAlertaAsignacion] = useState(null);
  const [pollingPaused, setPollingPaused] = useState(false);
  const searchContainerRef = useRef(null);
  const chatListRef = useRef(null);
  const actionsMenuRef = useRef(null);
  const searchInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const panelRef = useRef(null);
  const dragStateRef = useRef(null);
  const notifiedConnectionRef = useRef(false);
  const unreadRequestRef = useRef(null);
  const searchTimerRef = useRef(null);
  const searchSeqRef = useRef(0);
  const bloqueoPeerFetchedRef = useRef(null);

  const currentUserSnapshot = useMemo(() => currentUser || getStoredUser(), [currentUser]);
  const [localCurrentUser, setLocalCurrentUser] = useState(currentUserSnapshot);
  const currentUserId = useMemo(() => resolveUserId(localCurrentUser), [localCurrentUser]);
  const currentUsername = useMemo(() => String(localCurrentUser?.username || '').toLowerCase(), [localCurrentUser]);
  const peerActual = selectedPeer || contactoDefault || null;
  const peerActualId = resolveUserId(peerActual);
  const chatsConConversacion = useMemo(() => {
    const pool = contactosRecientes;
    const seen = new Set();
    const unique = [];
    for (const contacto of pool) {
      const id = resolveUserId(contacto);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      unique.push(contacto);
    }
    return unique;
  }, [contactosRecientes]);

  const formatHora = useCallback((fecha) => {
    if (!fecha) return '';
    const parsed = new Date(fecha);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
  }, []);

  const focusMessageInput = useCallback((delay = 0) => {
    const focus = () => {
      const input = messageInputRef.current;
      if (!input || input.disabled) return;
      input.focus({ preventScroll: true });
    };
    window.requestAnimationFrame(focus);
    if (delay > 0) window.setTimeout(focus, delay);
  }, []);

  const focusSearchInput = useCallback(() => {
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    });
  }, []);

  const cargarNoLeidos = useCallback(async () => {
    if (unreadRequestRef.current) return unreadRequestRef.current;

    unreadRequestRef.current = getChatContactosPOA()
      .then((res) => {
        setMensajesNoLeidos(resolveUnreadTotal(res?.data || {}));
      })
      .catch((err) => {
        if (isAuthExpired(err)) setPollingPaused(true);
      })
      .finally(() => {
        unreadRequestRef.current = null;
      });

    return unreadRequestRef.current;
  }, []);

  useEffect(() => {
    if (currentUserId) return undefined;

    let active = true;
    const fetchCurrentUser = async () => {
      try {
        const res = await getCurrentUserPOA();
        if (active) setLocalCurrentUser(res.data || null);
      } catch {
        // El chat seguira funcionando cuando exista sesion valida.
      }
    };

    fetchCurrentUser();
    return () => {
      active = false;
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return undefined;

    cargarNoLeidos();
    const intervalId = window.setInterval(cargarNoLeidos, open ? 6000 : 10000);
    return () => window.clearInterval(intervalId);
  }, [cargarNoLeidos, currentUserId, open]);

  const closeChat = useCallback(() => {
    setOpen(false);
    setPanelPosition(null);
    setIsDraggingPanel(false);
    dragStateRef.current = null;
  }, []);

  const fetchEstadoBloqueo = useCallback(async (peerId) => {
    if (!peerId) {
      setBloqueoEstado({ bloqueado_por_mi: false, bloqueado_por_peer: false });
      return;
    }
    try {
      const res = await getEstadoBloqueoChatPOA(peerId);
      const data = res?.data || {};
      setBloqueoEstado({
        bloqueado_por_mi: Boolean(data.bloqueado_por_mi),
        bloqueado_por_peer: Boolean(data.bloqueado_por_peer),
      });
    } catch {
      setBloqueoEstado({ bloqueado_por_mi: false, bloqueado_por_peer: false });
    }
  }, []);

  const fetchMensajes = useCallback(async (peerId, options = {}) => {
    const { silent = false } = options;
    if (!peerId) return;
    if (!silent) setLoadingMensajes(true);
    try {
      const res = await getMensajesChatPOA(peerId);
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      const listFiltered = list.filter((msg) => {
        const emisorId = resolveUserId(msg?.emisor || msg?.autor);
        const receptorId = resolveUserId(msg?.receptor || msg?.destinatario);
        if (!currentUserId) return true;
        return (
          (emisorId === currentUserId && receptorId === peerId) ||
          (emisorId === peerId && receptorId === currentUserId)
        );
      });
      setMensajes(listFiltered);
      if (!silent) cargarNoLeidos();
      setPollingPaused(false);
      notifiedConnectionRef.current = false;
    } catch (err) {
      if (isAuthExpired(err)) {
        setPollingPaused(true);
        if (!notifiedConnectionRef.current) {
          toast.error('Tu sesión expiró. Vuelve a iniciar sesión.');
          notifiedConnectionRef.current = true;
        }
        return;
      }
      if (!silent) setMensajes([]);
      const refused = isConnectionRefused(err);
      if (refused) {
        setPollingPaused(true);
        if (!notifiedConnectionRef.current) {
          toast.error('No hay conexión con el servidor de chat.');
          notifiedConnectionRef.current = true;
        }
      } else if (!silent) {
        toast.error('No se pudo cargar el chat.');
      }
    } finally {
      if (!silent) setLoadingMensajes(false);
    }
  }, [cargarNoLeidos, currentUserId]);

  const cargarContactos = async () => {
    setLoadingContactos(true);
    try {
      const res = await getChatContactosPOA();
      const data = res.data || {};
      const list = Array.isArray(data.contactos) ? data.contactos : [];
      const recientes = Array.isArray(data.contactos_recientes) ? data.contactos_recientes : [];
      const alerta = data.alerta_asignacion || null;
      const mantieneChatDirectorElaborador = ['director', 'elaborador'].includes(data.rol_contactos);
      const defaultContact = alerta
        ? null
        : (mantieneChatDirectorElaborador ? data.contacto_default : recientes[0]) || null;
      setMensajesNoLeidos(resolveUnreadTotal(data));
      setContactosSugeridos(list);
      setContactosRecientes(recientes);
      setContactoDefault(defaultContact);
      setAlertaAsignacion(alerta);

      const autoSelected = alerta
        ? null
        : (defaultContact && resolveUserId(defaultContact)
          ? defaultContact
          : (recientes.length === 1 ? recientes[0] : null));

      if (autoSelected && !alerta) {
        const autoSelectedId = resolveUserId(autoSelected);
        setSelectedPeer(autoSelected);
        bloqueoPeerFetchedRef.current = autoSelectedId;
        await fetchEstadoBloqueo(autoSelectedId);
        await fetchMensajes(autoSelectedId, { silent: false });
      } else {
        setSelectedPeer(null);
        setMensajes([]);
        setBloqueoEstado({ bloqueado_por_mi: false, bloqueado_por_peer: false });
      }
    } catch (err) {
      if (isAuthExpired(err)) {
        setPollingPaused(true);
        if (!notifiedConnectionRef.current) {
          toast.error('Tu sesión expiró. Vuelve a iniciar sesión.');
          notifiedConnectionRef.current = true;
        }
        return;
      }
      setContactosSugeridos([]);
      setContactosRecientes([]);
      setContactoDefault(null);
      setAlertaAsignacion(null);
      setSelectedPeer(null);
      setMensajes([]);
      if (isConnectionRefused(err)) {
        setPollingPaused(true);
        if (!notifiedConnectionRef.current) {
          toast.error('Servidor desconectado. Verifica que Django esté ejecutándose y que la URL del backend sea correcta.');
          notifiedConnectionRef.current = true;
        }
      } else {
        toast.error(err?.response?.data?.detail || 'No se pudieron cargar los contactos.');
      }
    } finally {
      setLoadingContactos(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const init = async () => {
      // si no hay usuario resuelto, pedir al backend
      if (!currentUserSnapshot || !resolveUserId(currentUserSnapshot)) {
        try {
          const res = await getCurrentUserPOA();
          setLocalCurrentUser(res.data || null);
        } catch (e) {
          // ignore, seguir con lo que haya
        }
      }
      await cargarContactos();
    };
    init();
  }, [open]);

  useEffect(() => {
    if (!open || !peerActualId || pollingPaused) return undefined;
    const intervalId = window.setInterval(() => {
      fetchMensajes(peerActualId, { silent: true });
    }, 1800);
    return () => window.clearInterval(intervalId);
  }, [open, peerActualId, fetchMensajes, pollingPaused]);

  useEffect(() => {
    if (!isDraggingPanel) return undefined;

    const handlePointerMove = (event) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      const dx = event.clientX - dragState.startX;
      const dy = event.clientY - dragState.startY;

      const panel = panelRef.current;
      const panelWidth = panel?.offsetWidth || 390;
      const panelHeight = panel?.offsetHeight || 640;

      const minLeft = 8;
      const minTop = 8;
      const maxLeft = Math.max(minLeft, window.innerWidth - 80);
      const maxTop = Math.max(minTop, window.innerHeight - 80);

      const unclampedLeft = dragState.startLeft + dx;
      const unclampedTop = dragState.startTop + dy;

      const left = Math.min(Math.max(unclampedLeft, minLeft - panelWidth + 80), maxLeft);
      const top = Math.min(Math.max(unclampedTop, minTop), Math.max(minTop, maxTop - panelHeight + 80));

      setPanelPosition({ left, top });
    };

    const handlePointerUp = () => {
      setIsDraggingPanel(false);
      dragStateRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDraggingPanel]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSearch(false);
      }
      if (chatListRef.current && !chatListRef.current.contains(event.target)) {
        setShowChatList(false);
      }
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target)) {
        setShowActionsMenu(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => () => {
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
  }, []);

  const handleBuscar = (value) => {
    setSearch(value);
    const q = String(value || '').trim();
    searchSeqRef.current += 1;
    const requestSeq = searchSeqRef.current;

    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);

    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimerRef.current = window.setTimeout(async () => {
      try {
        const res = await buscarUsuariosChatPOA(q);
        if (requestSeq !== searchSeqRef.current) return;
        const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        const filtered = list.filter((u) => resolveUserId(u) !== currentUserId);
        setSearchResults(filtered.slice(0, 10));
      } catch {
        if (requestSeq === searchSeqRef.current) setSearchResults([]);
      } finally {
        if (requestSeq === searchSeqRef.current) setSearching(false);
      }
    }, 280);
  };

  const seleccionarContacto = async (contacto) => {
    const peerId = resolveUserId(contacto);
    if (!peerId) return;
    setSelectedPeer(contacto);
    setBloqueoEstado({ bloqueado_por_mi: false, bloqueado_por_peer: false });
    setShowSearch(false);
    setShowChatList(false);
    setShowActionsMenu(false);
    setSearch('');
    setSearchResults([]);
    bloqueoPeerFetchedRef.current = peerId;
    await fetchEstadoBloqueo(peerId);
    await fetchMensajes(peerId, { silent: false });
    focusMessageInput(80);
  };

  const registrarChatReciente = (contacto, ultimoMensaje) => {
    const peerId = resolveUserId(contacto);
    if (!peerId) return;

    setContactosRecientes((prev) => {
      const actualizado = {
        ...contacto,
        id: peerId,
        ultimo_mensaje: ultimoMensaje,
        fecha_ultimo_mensaje: new Date().toISOString(),
        no_leidos: 0,
      };

      return [
        actualizado,
        ...prev.filter((item) => resolveUserId(item) !== peerId),
      ];
    });
  };

  useEffect(() => {
    if (!open) return;
    if (!peerActualId) {
      bloqueoPeerFetchedRef.current = null;
      fetchEstadoBloqueo(null);
      return;
    }
    if (bloqueoPeerFetchedRef.current === peerActualId) return;
    bloqueoPeerFetchedRef.current = peerActualId;
    fetchEstadoBloqueo(peerActualId);
  }, [open, peerActualId, fetchEstadoBloqueo]);

  const handleToggleBloqueo = async () => {
    const peerId = resolveUserId(peerActual);
    if (!peerId) {
      toast.error('Selecciona un contacto.');
      focusMessageInput(40);
      return;
    }
    try {
      if (bloqueoEstado.bloqueado_por_mi) {
        await desbloquearUsuarioChatPOA(peerId);
        toast.success('Usuario desbloqueado.');
      } else {
        await bloquearUsuarioChatPOA(peerId);
        toast.success('Usuario bloqueado.');
      }
      bloqueoPeerFetchedRef.current = peerId;
      await fetchEstadoBloqueo(peerId);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo actualizar el bloqueo.');
    } finally {
      setShowActionsMenu(false);
      focusMessageInput(80);
    }
  };

  const handleEnviar = async () => {
    const textoLimpio = String(texto || '').trim();
    const peerId = resolveUserId(selectedPeer || contactoDefault);

    if (!peerId) {
      toast.error('No hay un contacto disponible para chat.');
      focusMessageInput(40);
      return;
    }
    if (bloqueoEstado.bloqueado_por_mi) {
      toast.error('Desbloquea al usuario para enviar mensajes.');
      focusMessageInput(40);
      return;
    }
    if (bloqueoEstado.bloqueado_por_peer) {
      toast.error('Este usuario te bloqueó y no puede recibir mensajes.');
      focusMessageInput(40);
      return;
    }
    if (textoLimpio.length < 2) {
      toast.error('Escribe un mensaje valido.');
      focusMessageInput(40);
      return;
    }

    setSending(true);
    try {
      await enviarMensajeChatPOA(peerId, textoLimpio);
      setTexto('');
      const peer = selectedPeer || contactoDefault || null;
      if (!selectedPeer) {
        if (peer) setSelectedPeer(peer);
      }
      registrarChatReciente(peer, textoLimpio);
      await fetchMensajes(peerId, { silent: true });
    } catch (err) {
      if (isConnectionRefused(err)) {
        setPollingPaused(true);
        if (!notifiedConnectionRef.current) {
          toast.error('No hay conexión con el servidor de chat.');
          notifiedConnectionRef.current = true;
        }
        return;
      }
      toast.error(err?.response?.data?.detail || 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
      focusMessageInput(120);
    }
  };

  const handleVaciarChat = async () => {
    const peerId = resolveUserId(selectedPeer || contactoDefault);
    if (!peerId) {
      toast.error('Selecciona un contacto para vaciar el chat.');
      focusMessageInput(40);
      return;
    }
    setShowVaciarDialog(true);
  };

  const confirmarVaciarChat = async () => {
    const peerId = resolveUserId(selectedPeer || contactoDefault);
    if (!peerId) return;
    try {
      await vaciarChatPOA(peerId);
      setMensajes([]);
      await cargarContactos();
      toast.success('Chat vaciado correctamente.');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo vaciar el chat.');
    } finally {
      setShowChatList(false);
      setShowActionsMenu(false);
      setShowVaciarDialog(false);
      focusMessageInput(100);
    }
  };

  const listaVisible = search.trim().length >= 2 ? searchResults : null;
  const totalNoLeidos = resolveCount(mensajesNoLeidos);
  const badgeNoLeidos = formatBadgeCount(totalNoLeidos);

  const renderContacto = (contacto, extraClass = '') => {
    const id = resolveUserId(contacto);
    const activo = id && id === peerActualId;
    const inicial = formatNombre(contacto).trim().charAt(0).toUpperCase() || '?';
    return (
      <button
        key={id || String(contacto?.username || Math.random())}
        onClick={() => seleccionarContacto(contacto)}
        className={`poa-chat-contact ${activo ? 'is-active' : ''} ${extraClass}`}
      >
        <span className="poa-chat-contact-avatar">{inicial}</span>
        <div className="poa-chat-contact-body">
          <p className="text-sm font-semibold truncate">{formatNombre(contacto)}</p>
          <p className="poa-chat-contact-meta">@{contacto?.username || 'sin-usuario'}</p>
          {contacto?.ultimo_mensaje && (
            <p className="poa-chat-contact-meta mt-1">{contacto.ultimo_mensaje}</p>
          )}
        </div>
        <ChevronDown size={14} className={`poa-chat-contact-chevron ${activo ? 'rotate-180' : ''}`} />
      </button>
    );
  };

  useEffect(() => {
    if (!open) return;
    if (showVaciarDialog) return;
    if (showSearch) {
      focusSearchInput();
      return;
    }
    focusMessageInput(120);
  }, [open, peerActualId, loadingContactos, showSearch, showChatList, showActionsMenu, showVaciarDialog, focusMessageInput, focusSearchInput]);

  const handlePanelClick = useCallback((event) => {
    if (!open || showVaciarDialog) return;
    const interactive = event.target.closest('button,input,textarea,select,a,[data-no-refocus="true"]');
    if (interactive) return;
    setShowChatList(false);
    setShowActionsMenu(false);
    if (!showSearch) focusMessageInput(20);
  }, [focusMessageInput, open, showSearch, showVaciarDialog]);

  const handlePanelPointerDown = (event) => {
    if (event.button !== 0) return;

    const clickedNoDrag = event.target.closest('[data-no-drag="true"]');
    const clickedDragHandle = event.target.closest('[data-drag-handle="true"]');
    if (clickedNoDrag || !clickedDragHandle) return;

    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    const startLeft = panelPosition?.left ?? rect.left;
    const startTop = panelPosition?.top ?? rect.top;

    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startLeft,
      startTop,
    };

    setPanelPosition({ left: startLeft, top: startTop });
    setIsDraggingPanel(true);
  };

  return (
    <>
      <button
        onClick={() => {
          const shouldFocus = !open;
          setOpen((prev) => {
            const next = !prev;
            if (!next) {
              setPanelPosition(null);
              setIsDraggingPanel(false);
              dragStateRef.current = null;
            }
            return next;
          });
          if (shouldFocus) focusMessageInput(120);
        }}
        className="poa-chat-button fixed bottom-6 right-6 w-14 h-14 rounded-full transition-all duration-300 hover:scale-110 flex items-center justify-center text-white z-[121]"
        title="Mensajes"
        aria-label={totalNoLeidos > 0 ? `Mensajes, ${badgeNoLeidos} sin leer` : 'Mensajes'}
      >
        <MessageCircle size={22} />
        {totalNoLeidos > 0 && (
          <span className="poa-chat-unread-badge">
            {badgeNoLeidos}
          </span>
        )}
      </button>

      {open && (
        <div className="poa-chat-layer fixed inset-0 z-[122] pointer-events-none">
          <div
            ref={panelRef}
            onClick={handlePanelClick}
            onPointerDown={handlePanelPointerDown}
            style={panelPosition ? { left: panelPosition.left, top: panelPosition.top } : undefined}
            className={`poa-chat-panel absolute w-[390px] max-w-[calc(100vw-1.5rem)] h-[640px] max-h-[calc(100vh-8rem)] rounded-3xl overflow-hidden flex flex-col pointer-events-auto ${panelPosition ? '' : 'right-6 bottom-24'}`}
          >
            <div data-drag-handle="true" className={`poa-chat-header relative z-20 ${isDraggingPanel ? 'cursor-grabbing' : 'cursor-grab'}`}>
              <div data-drag-handle="true" className="px-4 py-3 flex items-center gap-2 select-none">
                <MessageCircle size={16} className="text-white" />
                <div className="text-white font-bold text-sm truncate">
                  {peerActual ? ` ${formatNombre(peerActual)}` : 'Chat'}
                </div>
                <div data-no-drag="true" className="ml-auto flex items-center gap-1">
                  <button
                    onClick={() => {
                      setShowSearch((prev) => {
                        const next = !prev;
                        window.setTimeout(() => {
                          if (next) focusSearchInput();
                          else focusMessageInput(40);
                        }, 0);
                        return next;
                      });
                      setShowChatList(false);
                    }}
                    className="poa-chat-header-action"
                    title="Buscar usuario"
                  >
                    <Search size={15} />
                  </button>
                  <div className="relative" ref={chatListRef}>
                    <button
                      onClick={() => {
                        setShowChatList((prev) => !prev);
                        setShowSearch(false);
                        focusMessageInput(40);
                      }}
                      className="poa-chat-header-action"
                      title="Historial de chats"
                    >
                      <ChevronDown size={15} className={showChatList ? 'rotate-180 transition-transform' : 'transition-transform'} />
                    </button>
                    {showChatList && (
                      <div className="poa-chat-popover absolute right-0 top-10 w-72 max-h-64 overflow-y-auto rounded-xl p-2 space-y-2 z-[140]">
                        {loadingContactos && <p className="poa-chat-popover-empty">Cargando chats...</p>}
                        {!loadingContactos && chatsConConversacion.length === 0 && (
                          <p className="poa-chat-popover-empty">No hay chats pendientes.</p>
                        )}
                        {!loadingContactos && chatsConConversacion.map((contacto) => renderContacto(contacto))}
                      </div>
                    )}
                  </div>
                  <div className="relative" ref={actionsMenuRef}>
                    <button
                      onClick={() => {
                        setShowActionsMenu((prev) => !prev);
                        setShowChatList(false);
                        setShowSearch(false);
                        focusMessageInput(40);
                      }}
                      className="poa-chat-header-action"
                      title="Opciones"
                    >
                      <MoreVertical size={15} />
                    </button>
                    {showActionsMenu && (
                      <div className="poa-chat-popover absolute right-0 top-10 w-52 rounded-xl overflow-hidden z-[140]">
                        <button
                          onClick={handleVaciarChat}
                          className="poa-chat-menu-item"
                        >
                          <Trash2 size={14} /> Vaciar chat
                        </button>
                        <button
                          onClick={handleToggleBloqueo}
                          className="poa-chat-menu-item is-warning"
                        >
                          <Ban size={14} /> {bloqueoEstado.bloqueado_por_mi ? 'Desbloquear usuario' : 'Bloquear usuario'}
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={closeChat}
                    className="poa-chat-header-action"
                    title="Cerrar"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {alertaAsignacion && (
                <div className="px-3 pb-3">
                  <div className="poa-chat-alert rounded-2xl px-3 py-3">
                    <p className="text-sm font-bold">{alertaAsignacion.titulo}</p>
                    <p className="poa-chat-alert-text mt-1">{alertaAsignacion.mensaje}</p>
                    <button
                      type="button"
                      onClick={() => navigate(alertaAsignacion.link || '/poa/accesos')}
                      className="poa-chat-alert-action"
                    >
                      {alertaAsignacion.texto_link || 'Asignar'}
                    </button>
                  </div>
                </div>
              )}

              {showSearch && (
                <div className="px-3 pb-3" ref={searchContainerRef}>
                  <div className="relative">
                    <Search size={14} className="poa-chat-search-icon absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      ref={searchInputRef}
                      value={search}
                      onChange={(e) => handleBuscar(e.target.value)}
                      placeholder="Buscar usuario por nombre o usuario"
                      className="poa-chat-search-input"
                    />
                  </div>
                  {searching && <p className="poa-chat-search-status mt-2">Buscando...</p>}
                  {search.trim().length >= 2 && (
                    <div className="mt-2 max-h-44 overflow-y-auto pr-1 space-y-2">
                      {listaVisible.length > 0 ? (
                        listaVisible.map((contacto) => renderContacto(contacto))
                      ) : (
                        <p className="poa-chat-search-status">Sin resultados.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>

            <div className="poa-chat-body relative flex-1 overflow-y-auto p-3">
              {!peerActual && !loadingContactos && (
                <p className="poa-chat-empty">Selecciona un contacto para ver el chat.</p>
              )}
              {peerActual && loadingMensajes && <p className="poa-chat-empty">Cargando mensajes...</p>}
              {peerActual && !loadingMensajes && mensajes.length === 0 && (
                <p className="poa-chat-empty">No hay mensajes todavía.</p>
              )}
              {mensajes.map((msg) => {
                const autorId = resolveUserId(msg?.emisor || msg?.autor);
                const autorUsername = String(msg?.emisor_username || msg?.autor_username || '').toLowerCase();
                const esMio = (currentUserId && autorId === currentUserId) || (!!currentUsername && autorUsername === currentUsername);
                const mensajeLeido = Boolean(msg?.leido || msg?.leido_en);
                const mensajeEntregado = msg?.entregado !== false;
                return (
                  <div key={msg.id} className={`mb-2 flex ${esMio ? 'justify-end' : 'justify-start'}`}>
                    <div className={`poa-chat-bubble ${esMio ? 'is-mine' : 'is-peer'}`}>
                      <p className="text-sm break-words">{msg?.texto}</p>
                      <p className="poa-chat-time">
                        {formatHora(msg?.fecha)}
                        {esMio && (
                          <span
                            className={`poa-chat-status ${mensajeLeido ? 'is-read' : ''}`}
                            title={mensajeLeido ? 'Leido' : 'Entregado'}
                          >
                            {mensajeLeido ? <CheckCheck size={13} /> : (mensajeEntregado ? <Check size={13} /> : null)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}

              {peerActual && (bloqueoEstado.bloqueado_por_mi || bloqueoEstado.bloqueado_por_peer) && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-6">
                  <div className="poa-chat-blocked">
                    {bloqueoEstado.bloqueado_por_peer
                      ? `${formatNombre(peerActual)} te bloqueo.`
                      : 'Bloqueado.'}
                  </div>
                </div>
              )}
            </div>

            <div className="poa-chat-composer p-3">
              <div className="flex items-center gap-2">
                <input
                  ref={messageInputRef}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleEnviar();
                    }
                  }}
                  placeholder={
                    bloqueoEstado.bloqueado_por_peer
                      ? 'No puedes enviar mensajes a este usuario'
                      : bloqueoEstado.bloqueado_por_mi
                        ? 'Usuario bloqueado por ti'
                        : (peerActual ? 'Escribe un mensaje...' : 'Selecciona un contacto primero')
                  }
                  disabled={
                    sending ||
                    bloqueoEstado.bloqueado_por_mi ||
                    bloqueoEstado.bloqueado_por_peer ||
                    !peerActual
                  }
                  className="poa-chat-input"
                />
                <button
                  onClick={handleEnviar}
                  disabled={
                    sending ||
                    bloqueoEstado.bloqueado_por_mi ||
                    bloqueoEstado.bloqueado_por_peer ||
                    !peerActual
                  }
                  className="poa-chat-send"
                >
                  <SendHorizontal size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={showVaciarDialog}
        type="warning"
        title="Vaciar chat"
        message="¿Seguro que deseas vaciar este chat? Esta acción eliminará los mensajes de ambos lados."
        confirmText="Aceptar"
        cancelText="Cancelar"
        onConfirm={confirmarVaciarChat}
        onCancel={() => {
          setShowVaciarDialog(false);
          focusMessageInput(100);
        }}
        onClose={() => {
          setShowVaciarDialog(false);
          focusMessageInput(100);
        }}
      />
    </>
  );
}

export default ChatFlotantePOA;
