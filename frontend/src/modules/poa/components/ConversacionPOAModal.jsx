import { useState, useEffect, useRef } from 'react';
import {
	getComentariosPOA,
	crearComentarioPOA,
	enviarMensajePOA,
} from '../../../apis/poa.api';
import toast from 'react-hot-toast';

/**
 * Panel de conversación entre el elaborador y la entidad revisora para un DocumentoPOA.
 * Se abre como panel lateral deslizante desde el lado derecho.
 *
 * Props:
 *  - documentoId    {number}  ID del DocumentoPOA
 *  - estadoDoc      {string}  Estado actual del documento ('revision', 'observado', etc.)
 *  - tituloDoc      {string}  Título/programa del documento (para el encabezado)
 *  - open           {boolean} Controla si el panel está visible
 *  - onClose        {fn}      Callback para cerrar el panel
 *  - usuarioActual  {object}  Objeto con al menos { id, username, is_superuser, roles }
 */
export default function ConversacionPOAModal({
	documentoId,
	estadoDoc,
	tituloDoc = 'Documento POA',
	open,
	onClose,
	usuarioActual,
}) {
	const [comentarios, setComentarios] = useState([]);
	const [loading, setLoading] = useState(false);
	const [texto, setTexto] = useState('');
	const [enviando, setEnviando] = useState(false);
	const [animando, setAnimando] = useState(false);
	const scrollRef = useRef(null);

	// Roles revisores para determinar qué lado del chat corresponde al usuario
	const ROLES_REVISOR = ['revisor_1', 'revisor_2', 'revisor_3', 'revisor_4', 'director_carrera'];
	const esRevisor =
		Array.isArray(usuarioActual?.roles) && usuarioActual.roles.some((r) => ROLES_REVISOR.includes(r));

	// ─── animación entrada / salida ───────────────────────────────────────────
	useEffect(() => {
		if (open) {
			setTimeout(() => setAnimando(true), 10);
			if (documentoId) cargarComentarios();
		} else {
			setAnimando(false);
		}
	}, [open, documentoId]);

	// scroll automático al fondo
	useEffect(() => {
		if (animando && scrollRef.current) {
			setTimeout(() => {
				scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
			}, 80);
		}
	}, [animando, comentarios]);

	const cargarComentarios = async () => {
		setLoading(true);
		try {
			const res = await getComentariosPOA(documentoId);
			setComentarios(res.data?.results ?? res.data ?? []);
		} catch {
			// silenciar; no queremos bloquear la UI por un error de carga
		} finally {
			setLoading(false);
		}
	};

	// Hilo activo: el primero con abierto=true
	const hiloActivo = comentarios.find((c) => c.abierto) ?? null;

	// Puede escribir si: hay hilo activo, O el doc está en revisión/observado y es revisor
	const puedeEscribir =
		!!hiloActivo ||
		(esRevisor && ['revision', 'observado'].includes(estadoDoc));

	const handleIniciarConversacion = async () => {
		try {
			await crearComentarioPOA(documentoId);
			await cargarComentarios();
			toast.success('Conversación iniciada');
		} catch (err) {
			toast.error(err?.response?.data?.detail || 'No se pudo iniciar la conversación');
		}
	};

	const handleEnviar = async () => {
		if (!texto.trim()) return;
		if (texto.trim().length < 5) {
			toast.error('El mensaje debe tener al menos 5 caracteres');
			return;
		}
		if (!hiloActivo) {
			toast.error('No hay conversación activa');
			return;
		}
		setEnviando(true);
		try {
			await enviarMensajePOA(hiloActivo.id, texto.trim());
			setTexto('');
			await cargarComentarios();
		} catch (err) {
			toast.error(err?.response?.data?.detail || 'Error al enviar el mensaje');
		} finally {
			setEnviando(false);
		}
	};

	const handleKeyDown = (e) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleEnviar();
		}
	};

	const formatFecha = (fecha) => {
		const d = new Date(fecha);
		const ahora = new Date();
		const diffDias = Math.floor((ahora - d) / 86400000);
		if (diffDias === 0) return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
		if (diffDias === 1) return 'Ayer';
		if (diffDias < 7) return `Hace ${diffDias} días`;
		return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
	};

	// Todos los mensajes de todos los hilos, en orden cronológico
	const todosMensajes = comentarios
		.flatMap((c) => (c.mensajes ?? []).map((m) => ({ ...m, hiloId: c.id, hiloAbierto: c.abierto })))
		.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

	const esMiMensaje = (msg) => (esRevisor ? msg.es_revisor : !msg.es_revisor);

	if (!open) return null;

	return (
		<div className="poa-conversation-modal fixed inset-0 z-[70]">
			{/* Overlay */}
			<div
				className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-400 ${
					animando ? 'opacity-100' : 'opacity-0'
				}`}
				onClick={onClose}
			/>

			{/* Panel */}
			<div
				className={`poa-conversation-panel absolute right-4 top-4 bottom-4 w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-400 ease-out ${
					animando ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
				}`}
			>
				{/* ── Header ── */}
				<div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-4 flex items-center gap-3 flex-shrink-0">
					<div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center">
						<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
								d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
						</svg>
					</div>
					<div className="flex-1 min-w-0">
						<h2 className="text-base font-bold text-white leading-tight">Conversaciones</h2>
						<p className="text-violet-200 text-xs truncate">{tituloDoc}</p>
					</div>
					<button
						onClick={onClose}
						className="w-9 h-9 rounded-xl hover:bg-white/20 flex items-center justify-center text-white transition-all hover:rotate-90 duration-300"
					>
						<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				{/* ── Cuerpo scroll ── */}
				<div
					ref={scrollRef}
					className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50 dark:bg-slate-900"
				>
					{loading ? (
						<div className="flex justify-center py-10">
							<div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
						</div>
					) : todosMensajes.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-14 text-center">
							<div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-3">
								<svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
										d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
								</svg>
							</div>
							<p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Sin conversaciones</p>
							<p className="text-xs text-slate-400 mt-1">
								{['revision', 'observado'].includes(estadoDoc)
									? 'Inicia una conversación para comunicar observaciones'
									: 'Las conversaciones están disponibles durante la revisión'}
							</p>
						</div>
					) : (
						todosMensajes.map((msg) => (
							<div
								key={msg.id}
								className={`flex ${esMiMensaje(msg) ? 'justify-end' : 'justify-start'}`}
							>
								<div
									className={`max-w-[78%] rounded-2xl px-4 py-2.5 shadow-sm ${
										esMiMensaje(msg)
											? 'bg-violet-600 text-white rounded-br-sm'
											: 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-sm border border-slate-200 dark:border-slate-600'
									}`}
								>
									{/* Autor + rol */}
									<p className={`text-[10px] font-semibold mb-1 ${esMiMensaje(msg) ? 'text-violet-200' : 'text-slate-400 dark:text-slate-400'}`}>
										{msg.autor_nombre}
										{msg.es_revisor && (
											<span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] ${esMiMensaje(msg) ? 'bg-violet-500' : 'bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-300'}`}>
												Revisor
											</span>
										)}
									</p>
									<p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.texto}</p>
									<p className={`text-[10px] mt-1 text-right ${esMiMensaje(msg) ? 'text-violet-300' : 'text-slate-400'}`}>
										{formatFecha(msg.fecha)}
									</p>
								</div>
							</div>
						))
					)}
				</div>

				{/* ── Footer: input ── */}
				<div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
					{/* Botón "Iniciar conversación" si no hay hilo activo y se puede */}
					{!hiloActivo && ['revision', 'observado'].includes(estadoDoc) && (
						<button
							onClick={handleIniciarConversacion}
							className="w-full mb-2 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors"
						>
							+ Iniciar conversación
						</button>
					)}

					{hiloActivo ? (
						<div className="flex gap-2 items-end">
							<textarea
								rows={2}
								value={texto}
								onChange={(e) => setTexto(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="Escribe una observación o corrección… (Enter para enviar)"
								className="flex-1 resize-none rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-slate-400"
							/>
							<button
								onClick={handleEnviar}
								disabled={enviando || !texto.trim()}
								className="w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors flex-shrink-0"
							>
								{enviando ? (
									<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
								) : (
									<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
									</svg>
								)}
							</button>
						</div>
					) : (
						!['revision', 'observado'].includes(estadoDoc) && (
							<p className="text-xs text-center text-slate-400 py-1">
								Las conversaciones están disponibles cuando el documento está en revisión u observado.
							</p>
						)
					)}

					{hiloActivo && (
						<p className="text-[10px] text-slate-400 mt-1 text-center">
							Los mensajes se conservan durante la gestión {hiloActivo.gestion}
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
