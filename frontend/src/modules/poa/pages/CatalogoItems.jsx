import React, { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FaTrash, FaEdit, FaFileUpload } from 'react-icons/fa';
import { getItemsCatalogo, deleteCatalogoItem, importarCatalogoItemsExcel, descargarCatalogoItemsExcel } from '../../../apis/poa.api';
import NuevoCatalogoItemModal from '../components/NuevoCatalogoItemModal';
import IconButton from '../components/IconButton';
import toast from 'react-hot-toast';
import { Modal } from '../components/base';
import Dialog from '../components/base/Dialog';

const CatalogoItems = () => {
	const outletContext = useOutletContext() || {};
	const poaPermissions = outletContext.poaPermissions || {};
	const canEdit = !!poaPermissions.canEdit;

	const [items, setItems] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [selectedItem, setSelectedItem] = useState(null);
	const [page, setPage] = useState(1);
	const [totalCount, setTotalCount] = useState(0);
	const [hasNextPage, setHasNextPage] = useState(false);
	const [hasPrevPage, setHasPrevPage] = useState(false);

	// modal para crear/editar items
	const [showItemModal, setShowItemModal] = useState(false);
	const [modalItem, setModalItem] = useState(null);
	const [importing, setImporting] = useState(false);
	const [downloading, setDownloading] = useState(false);
	const [downloadProgress, setDownloadProgress] = useState(0);
	const [downloadIndeterminate, setDownloadIndeterminate] = useState(false);
	const [importResumen, setImportResumen] = useState(null);
	const [importOmitidos, setImportOmitidos] = useState([]);
	const [importArchivoNombre, setImportArchivoNombre] = useState('');
	const [showImportResultModal, setShowImportResultModal] = useState(false);
	const [importConflict, setImportConflict] = useState(null);
	const [pendingImportFile, setPendingImportFile] = useState(null);
	const [deleteDialogItem, setDeleteDialogItem] = useState(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [appliedSearch, setAppliedSearch] = useState('');
	const [stickyTop, setStickyTop] = useState(72);
	const [controlsHeight, setControlsHeight] = useState(0);
	const fileInputRef = useRef(null);
	const stickyControlsRef = useRef(null);

	useEffect(() => {
		const detectHeaderOffset = () => {
			const candidates = document.querySelectorAll('header, .app-header, .main-header, .navbar, [data-app-header]');
			let offset = 0;
			candidates.forEach((el) => {
				const style = window.getComputedStyle(el);
				if (style.position !== 'fixed' && style.position !== 'sticky') return;
				const rect = el.getBoundingClientRect();
				if (rect.bottom > 0 && rect.top <= 2) {
					offset = Math.max(offset, Math.ceil(rect.height));
				}
			});
			setStickyTop(offset || 72);
		};

		detectHeaderOffset();
		window.addEventListener('resize', detectHeaderOffset);
		return () => window.removeEventListener('resize', detectHeaderOffset);
	}, []);

	useEffect(() => {
		const el = stickyControlsRef.current;
		if (!el) return;
		const measure = () => setControlsHeight(Math.ceil(el.getBoundingClientRect().height));
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		window.addEventListener('resize', measure);
		return () => {
			observer.disconnect();
			window.removeEventListener('resize', measure);
		};
	}, [importing, selectedItem]);

	const cargarItems = async ({ targetPage = page, search = appliedSearch } = {}) => {
		setLoading(true);
		setError(null);
		try {
			const params = { page: targetPage };
			if (String(search || '').trim().length >= 2) {
				params.q = String(search).trim();
			}
			const res = await getItemsCatalogo(params);
			const d = res?.data;
			let list = [];
			let count = 0;
			let hasNext = false;
			let hasPrev = false;

			if (Array.isArray(d)) {
				list = d;
				count = d.length;
			} else if (d && Array.isArray(d.results)) {
				list = d.results;
				count = Number(d.count || d.results.length || 0);
				hasNext = Boolean(d.next);
				hasPrev = Boolean(d.previous);
			} else if (d && Array.isArray(d.data)) {
				list = d.data;
				count = d.data.length;
			}

			setItems(list);
			setTotalCount(count);
			setHasNextPage(hasNext);
			setHasPrevPage(hasPrev);
			if (selectedItem && !list.some(it => String(it.id) === String(selectedItem.id))) {
				setSelectedItem(null);
			}
		} catch (err) {
			setError(err?.response?.data?.detail || err?.message || 'Error cargando items.');
			setItems([]);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		cargarItems({ targetPage: page, search: appliedSearch });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [page, appliedSearch]);

	const handleBuscarItems = () => {
		const q = String(searchQuery || '').trim();
		setPage(1);
		setAppliedSearch(q);
	};

	const handleLimpiarBusqueda = () => {
		setSearchQuery('');
		setAppliedSearch('');
		setPage(1);
	};

	const handleSelectItem = (item) => {
		setSelectedItem((prev) => {
			if (prev && String(prev.id) === String(item.id)) return null;
			return item;
		});
	};

	const openEditarItem = (it) => {
		if (!canEdit) {
			toast.error('Solo el elaborador puede editar items.');
			return;
		}
		setModalItem(it);
		setShowItemModal(true);
	};

	const openNuevoItem = () => {
		if (!canEdit) {
			toast.error('Solo el elaborador puede crear items.');
			return;
		}
		setModalItem(null);
		setShowItemModal(true);
	};

	const handleItemCreated = async () => {
		await cargarItems({ targetPage: page, search: appliedSearch });
		setShowItemModal(false);
	};

	const handleItemUpdated = (updated) => {
		setItems(prev => prev.map(it => (String(it.id) === String(updated.id) ? updated : it)));
		setSelectedItem(updated);
		setShowItemModal(false);
	};

	const handleEditarSeleccionado = () => {
		if (!selectedItem) {
			toast.error('Selecciona un item para editar.');
			return;
		}
		openEditarItem(selectedItem);
	};

	const handleEliminarSeleccionado = async () => {
		if (!canEdit) {
			toast.error('Solo el elaborador puede eliminar items.');
			return;
		}
		if (!selectedItem) {
			toast.error('Selecciona un item para eliminar.');
			return;
		}
		setDeleteDialogItem(selectedItem);
	};

	const confirmarEliminarItem = async () => {
		const item = deleteDialogItem;
		if (!item) return;
		try {
			await deleteCatalogoItem(item.id);
			setItems(prev => prev.filter(x => String(x.id) !== String(item.id)));
			setSelectedItem(null);
			toast.success('Item eliminado');
		} catch (err) {
			console.error('Error eliminando item', err);
			toast.error('No se pudo eliminar el item');
		} finally {
			setDeleteDialogItem(null);
		}
	};

	const handleOpenImportPicker = () => {
		if (!canEdit) {
			toast.error('Solo el elaborador puede importar items.');
			return;
		}
		if (importing) return;
		fileInputRef.current?.click();
	};

	const handleDescargarCatalogoExcel = async () => {
		setDownloading(true);
		setDownloadProgress(0);
		setDownloadIndeterminate(false);
		try {
			const res = await descargarCatalogoItemsExcel({
				onDownloadProgress: (progressEvent) => {
					const total = Number(progressEvent?.total || 0);
					const loaded = Number(progressEvent?.loaded || 0);
					if (!total || total <= 0) {
						setDownloadIndeterminate(true);
						return;
					}
					setDownloadIndeterminate(false);
					const percent = Math.min(100, Math.max(0, Math.round((loaded * 100) / total)));
					setDownloadProgress(percent);
				},
			});
			const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'catalogo_items.xlsx';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			setDownloadProgress(100);
			toast.success('Descarga completada.');
		} catch (err) {
			toast.error(err?.response?.data?.detail || 'No se pudo descargar el catálogo.');
		} finally {
			setTimeout(() => {
				setDownloading(false);
				setDownloadProgress(0);
				setDownloadIndeterminate(false);
			}, 250);
		}
	};

	const descargarOmitidosCSV = () => {
		if (!Array.isArray(importOmitidos) || importOmitidos.length === 0) return;
		const headers = ['fila', 'detalle', 'partida', 'motivo'];
		const lines = [headers.join(',')];
		for (const row of importOmitidos) {
			const fila = String(row?.fila ?? '').replace(/"/g, '""');
			const detalle = String(row?.detalle ?? '').replace(/"/g, '""');
			const partida = String(row?.partida ?? '').replace(/"/g, '""');
			const motivo = String(row?.motivo ?? '').replace(/"/g, '""');
			lines.push(`"${fila}","${detalle}","${partida}","${motivo}"`);
		}
		const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'omitidos_importacion_items.csv';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const descargarPlantillaExcel = () => {
		const headers = ['DETALLE', 'partida', 'UNIDAD_MEDIDA'];
		const ejemplo1 = ['MOTOR TRIFASICO ROTOR BOBINADO 15.000 W', '43200', 'UNIDAD'];
		const ejemplo2 = ['MOTOR TRIFASICO ROTOR BOBINADO 22.000 W', '43200', 'UNIDAD'];
		const rows = [headers, ejemplo1, ejemplo2];
		const csv = rows
			.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
			.join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'plantilla_items_poa.csv';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const ejecutarImportacionExcel = async ({ file, replaceDuplicates = false }) => {
		const formData = new FormData();
		formData.append('archivo', file);
		formData.append('dry_run', 'false');
		if (replaceDuplicates) {
			formData.append('replace_duplicates', 'true');
		}

		const res = await importarCatalogoItemsExcel(formData);
		const resumen = res?.data?.resumen || null;
		const omitidos = Array.isArray(res?.data?.omitidos) ? res.data.omitidos : [];
		setImportResumen(resumen);
		setImportOmitidos(omitidos);
		setShowImportResultModal(true);

		toast.success(
			replaceDuplicates
				? `Importación completada con reemplazo. Creados: ${resumen?.items_creados || 0}, Actualizados: ${resumen?.items_actualizados || 0}, Duplicados: ${resumen?.duplicados_detectados || 0}`
				: `Importación completada. Creados: ${resumen?.items_creados || 0}, Actualizados: ${resumen?.items_actualizados || 0}, Duplicados: ${resumen?.duplicados_detectados || 0}`
		);
		setSelectedItem(null);
		await cargarItems({ targetPage: 1, search: appliedSearch });
		setPage(1);
	};

	const handleImportExcel = async (event) => {
		if (!canEdit) {
			event.target.value = '';
			toast.error('Solo el elaborador puede importar items.');
			return;
		}
		const file = event.target.files?.[0];
		if (!file) return;

		setImportResumen(null);
		setImportOmitidos([]);
		setShowImportResultModal(false);
		setImportConflict(null);
		setPendingImportFile(file);

		setImporting(true);
		setImportArchivoNombre(file.name || '');
		try {
			await ejecutarImportacionExcel({ file, replaceDuplicates: false });
		} catch (err) {
			if (err?.response?.status === 409 && err?.response?.data?.requires_confirmation) {
				setImportConflict({
					message: err?.response?.data?.detail || 'Se detectaron duplicados en el catálogo existente.',
					duplicateCount: Array.isArray(err?.response?.data?.duplicados) ? err.response.data.duplicados.length : 0,
					file,
				});
				return;
			}
			const detail = err?.response?.data?.detail || err?.message || 'No se pudo importar el archivo.';
			toast.error(String(detail));
		} finally {
			setImporting(false);
			event.target.value = '';
			if (!importConflict) {
				setPendingImportFile(null);
			}
		}
	};

	const confirmReplaceDuplicates = async () => {
		if (!importConflict?.file) return;
		setImportConflict(null);
		setImporting(true);
		try {
			await ejecutarImportacionExcel({ file: importConflict.file, replaceDuplicates: true });
			setPendingImportFile(null);
		} catch (err) {
			const detail = err?.response?.data?.detail || err?.message || 'No se pudo importar el archivo.';
			toast.error(String(detail));
		} finally {
			setImporting(false);
		}
	};

	const closeImportResultModal = () => {
		setShowImportResultModal(false);
		setImportResumen(null);
		setImportOmitidos([]);
		setImportArchivoNombre('');
	};

	return (
		<div className="relative w-full max-w-6xl mx-auto">
			<Dialog
				open={Boolean(importConflict)}
				type="warning"
				title="Duplicados detectados en la importación"
				message={importConflict ? `${importConflict.message}${importConflict.duplicateCount ? ` (${importConflict.duplicateCount} registros)` : ''}. ¿Deseas reemplazar los registros existentes?` : ''}
				confirmText="Reemplazar"
				cancelText="Cancelar"
				onConfirm={confirmReplaceDuplicates}
				onCancel={() => {
					setImportConflict(null);
					setPendingImportFile(null);
				}}
			/>
			<Dialog
				open={Boolean(deleteDialogItem)}
				type="danger"
				title="Eliminar item"
				message={deleteDialogItem ? `Eliminar item ${deleteDialogItem.id || deleteDialogItem.detalle || ''}?` : ''}
				confirmText="Eliminar"
				cancelText="Cancelar"
				onConfirm={confirmarEliminarItem}
				onCancel={() => setDeleteDialogItem(null)}
			/>
			<div className="poa-mobile-page-card catalogo-card w-full p-6 rounded shadow border border-slate-200 bg-white/90 text-slate-900 dark:border-slate-700 dark:bg-slate-900/55 dark:text-slate-100">
			{!canEdit && (
				<div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
					Modo solo lectura: puedes ver y descargar el catálogo. Solo el encargado de elavorar el POA puede crear o modificar items.
				</div>
			)}
			<div
				ref={stickyControlsRef}
				className="sticky z-30 mb-4 rounded-lg p-3 shadow-sm border border-sky-200 bg-sky-50/95 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/55"
				style={{ top: `${stickyTop}px` }}
			>
					<div className="mb-3 rounded-lg p-3 border border-sky-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/55">
					<div className="text-sm font-semibold text-slate-700 mb-2 dark:text-slate-200">Ingresa un término de búsqueda: (DETALLE, PARTIDA)</div>
					<div className="flex flex-wrap items-center gap-2">
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							onKeyDown={(e) => { if (e.key === 'Enter') handleBuscarItems(); }}
							placeholder="Ejemplo: AZULEJO / 43200 / UNIDAD"
							className="px-3 py-2 rounded w-full md:w-[420px] border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
						/>
						<button
							type="button"
							onClick={handleBuscarItems}
							className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 dark:bg-slate-700 dark:text-sky-100 dark:hover:bg-slate-600 dark:border dark:border-sky-500/40"
						>
							Buscar
						</button>
						<button type="button" onClick={handleLimpiarBusqueda} className="px-3 py-2 rounded bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600">
							Limpiar
						</button>
					</div>
				</div>

				<div className="flex justify-end gap-3">
					{canEdit && (
						<>
							<IconButton
								showIcon
								icon={<FaFileUpload />}
								onClick={openNuevoItem}
								className="btn-futuristic font-bold py-2 px-4 rounded"
								title="Crear nuevo item"
							>
								Nuevo item
							</IconButton>
							{selectedItem && (
								<>
									<IconButton
										showIcon
										icon={<FaEdit />}
										onClick={handleEditarSeleccionado}
										className="btn-futuristic font-bold py-2 px-4 rounded"
										title="Editar item seleccionado"
									>
										Editar seleccionado
									</IconButton>
									<IconButton
										showIcon
										icon={<FaTrash />}
										onClick={handleEliminarSeleccionado}
										className="btn-futuristic font-bold py-2 px-4 rounded"
										title="Eliminar item seleccionado"
									>
										Eliminar seleccionado
									</IconButton>
								</>
							)}
						</>
					)}
					<button
						type="button"
						onClick={handleDescargarCatalogoExcel}
						disabled={downloading}
						className="px-4 py-2 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-700 dark:bg-slate-700 dark:text-emerald-200 dark:hover:bg-slate-600 dark:border dark:border-emerald-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
					>
						{downloading ? 'Descargando...' : 'Descargar catálogo'}
					</button>
					<input
						type="file"
						ref={fileInputRef}
						onChange={handleImportExcel}
						accept=".xlsx,.xls"
						className="hidden"
					/>
					{canEdit && (
						<IconButton
							showIcon
							icon={<FaFileUpload />}
							onClick={handleOpenImportPicker}
							className="btn-futuristic font-bold py-2 px-4 rounded"
							title="Importar items desde Excel"
						>
							{importing ? 'Importando...' : 'Importar Excel'}
						</IconButton>
					)}
				</div>
			</div>

			{importing && (
				<div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
					<div className="flex items-center gap-3 mb-2">
						<div className="text-sm font-semibold text-blue-900">
							Importando items...
						</div>
					</div>
					<div className="w-full h-2 bg-blue-200 rounded-full overflow-hidden">
						<div
							className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
							style={{
								animation: 'progress-bar 1.5s ease-in-out infinite',
								width: '30%',
							}}
						/>
					</div>
					<div className="text-xs text-blue-700 mt-2">Por favor espera, esto puede tomar algunos minutos...</div>
					<style>{`
						@keyframes progress-bar {
							0% { transform: translateX(-100%); }
							100% { transform: translateX(1000%); }
						}
					`}</style>
				</div>
			)}

			{downloading && (
				<div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg dark:bg-emerald-900/30 dark:border-emerald-700">
					<div className="text-sm font-semibold text-emerald-900 dark:text-emerald-200 mb-2">
						Descargando catálogo... {downloadIndeterminate ? '' : `${downloadProgress}%`}
					</div>
					<div className="w-full h-2 bg-emerald-200 rounded-full overflow-hidden dark:bg-emerald-800/60">
						{downloadIndeterminate ? (
							<div
								className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full"
								style={{
									animation: 'download-progress-indeterminate 1.4s ease-in-out infinite',
									width: '30%',
								}}
							/>
						) : (
							<div
								className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-200"
								style={{ width: `${downloadProgress}%` }}
							/>
						)}
					</div>
					<div className="text-xs text-emerald-800 dark:text-emerald-300 mt-2">Generando archivo Excel, por favor espera...</div>
					<style>{`
						@keyframes download-progress-indeterminate {
							0% { transform: translateX(-100%); }
							100% { transform: translateX(400%); }
						}
					`}</style>
				</div>
			)}

			{showImportResultModal && importResumen && (
				<Modal onClose={closeImportResultModal}>
					<div className="modal-panel w-full max-w-5xl rounded-xl">
						<div className="modal-header flex items-start justify-between gap-3 px-5 py-4">
							<div>
								<div className="text-lg font-semibold">Resultado de importación</div>
								<div className="text-sm opacity-90">
									{importArchivoNombre ? `Archivo: ${importArchivoNombre}` : 'Archivo procesado'}
								</div>
							</div>
							<button
								type="button"
								onClick={closeImportResultModal}
								className="rounded bg-slate-900/25 px-3 py-1 text-sm text-white hover:bg-slate-900/35"
							>
								Cerrar
							</button>
						</div>

						<div className="modal-body p-5">
							<div className="poa-mobile-kpi-card mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
								<div className="text-sm font-medium">Cargados en base de datos</div>
								<div className="text-2xl font-extrabold leading-tight">{importResumen.items_creados || 0}</div>
								<div className="text-xs opacity-80">Registros nuevos insertados correctamente.</div>
							</div>

							<div className="poa-mobile-kpi-strip poa-mobile-kpi-strip-3 grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-blue-900">
								<div>Procesadas: <b>{importResumen.filas_procesadas || 0}</b></div>
								<div>Filas vacías: <b>{importResumen.filas_vacias || 0}</b></div>
								<div>Errores: <b>{importResumen.errores || 0}</b></div>
								<div>Actualizados: <b>{importResumen.items_actualizados || 0}</b></div>
								<div>Items creados: <b>{importResumen.items_creados || 0}</b></div>
								<div>Partidas únicas: <b>{importResumen.partidas_unicas_detectadas || 0}</b></div>
								<div>Duplicados detectados: <b>{importResumen.duplicados_detectados || 0}</b></div>
							</div>

							{importOmitidos.length > 0 && (
								<div className="mt-4">
									<div className="mb-2 flex items-center justify-between gap-2">
										<div className="text-sm font-medium text-amber-700">
											Registros omitidos: {importOmitidos.length}
										</div>
										<button
											type="button"
											onClick={descargarOmitidosCSV}
											className="text-xs px-3 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200"
										>
											Descargar CSV de omitidos
										</button>
									</div>
									<div className="mb-2 text-xs text-amber-800">
										Estos registros no se cargaron automáticamente. Si son necesarios, ingrésalos manualmente.
									</div>
									<div className="max-h-64 overflow-auto border border-amber-200 rounded bg-white text-xs">
										<table className="min-w-full">
											<thead className="bg-amber-50">
												<tr>
													<th className="text-left px-2 py-1">Fila</th>
													<th className="text-left px-2 py-1">Detalle</th>
													<th className="text-left px-2 py-1">Partida</th>
													<th className="text-left px-2 py-1">Motivo</th>
												</tr>
											</thead>
											<tbody>
												{importOmitidos.slice(0, 100).map((row, i) => (
													<tr key={`imp-skip-${i}`} className="border-t">
														<td className="px-2 py-1">{row?.fila ?? '-'}</td>
														<td className="px-2 py-1">{row?.detalle || '-'}</td>
														<td className="px-2 py-1">{row?.partida || '-'}</td>
														<td className="px-2 py-1">{row?.motivo || 'Sin detalle'}</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</div>
							)}

							<div className="mt-4 flex justify-end">
								<button
									type="button"
									onClick={closeImportResultModal}
									className="btn-success rounded px-4 py-2 text-sm"
								>
									Aceptar
								</button>
							</div>
						</div>
					</div>
				</Modal>
			)}

			{loading && <div className="text-blue-600 dark:text-blue-400">Cargando items...</div>}
			{error && <div className="text-red-600 dark:text-red-400">Error al cargar items: {typeof error === 'string' ? error : JSON.stringify(error)}</div>}

			{!loading && !error && (
				<div>
					<div className="text-sm text-slate-500 dark:text-slate-400 mb-2">Total de registros: {totalCount}</div>
					<div className="poa-table-wrapper overflow-auto max-h-[68vh] border rounded border-sky-200 bg-white/75 dark:border-slate-700 dark:bg-transparent">
						<table className="poa-mobile-card-table min-w-full table-auto border-collapse font-sans text-sm leading-snug text-blue-900 dark:text-white">
							<thead>
								<tr className="text-left">
									<th className="sticky top-0 z-20 px-3 py-2 border border-blue-300 dark:border-gray-600 font-medium bg-blue-100 text-blue-900 dark:bg-slate-900 dark:text-slate-100 shadow-sm">Partida</th>
									<th className="sticky top-0 z-20 px-3 py-2 border border-blue-300 dark:border-gray-600 font-medium bg-blue-100 text-blue-900 dark:bg-slate-900 dark:text-slate-100 shadow-sm">DETALLE</th>
									<th className="sticky top-0 z-20 px-3 py-2 border border-blue-300 dark:border-gray-600 font-medium bg-blue-100 text-blue-900 dark:bg-slate-900 dark:text-slate-100 shadow-sm">UNIDAD_MEDIDA</th>
								</tr>
							</thead>
							<tbody>
								{items.length === 0 && (
									<tr>
										<td className="px-3 py-3 text-slate-500 dark:text-slate-400" colSpan={3}>No hay registros para mostrar.</td>
									</tr>
								)}
								{items.map((it, idx) => {
									const isSelected = selectedItem && String(selectedItem.id) === String(it.id);
									const rowBase = 'px-3 py-2 border border-blue-300 dark:border-gray-600 align-top';
									const cellStateClass = isSelected
										? 'bg-amber-300 text-slate-950 font-semibold dark:bg-cyan-700 dark:text-white'
										: 'odd:bg-white even:bg-blue-50 dark:odd:bg-slate-900 dark:even:bg-slate-800 dark:text-slate-100';
									return (
										<tr
											key={`item-${it?.id ?? idx}`}
											onClick={() => handleSelectItem(it)}
											className={`cursor-pointer border-t transition-colors ${isSelected ? 'ring-1 ring-inset ring-amber-500 dark:ring-cyan-400' : ''}`}
										>
											<td data-label="Partida" className={`${rowBase} ${cellStateClass}`}>{it?.partida || '-'}</td>
											<td data-label="Detalle" className={`${rowBase} ${cellStateClass}`}><div className="table-cell-clamp">{it?.detalle || '-'}</div></td>
											<td data-label="Unidad" className={`${rowBase} ${cellStateClass}`}>{it?.unidad_medida || '-'}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
					<div className="mt-3 flex items-center justify-between">
						<div className="text-sm text-slate-600">Página: {page}</div>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => setPage((p) => Math.max(1, p - 1))}
								disabled={!hasPrevPage}
								className="px-3 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
							>
								Anterior
							</button>
							<button
								type="button"
								onClick={() => setPage((p) => p + 1)}
								disabled={!hasNextPage}
								className="px-3 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
							>
								Siguiente
							</button>
						</div>
					</div>
				</div>
			)}

			{showItemModal && (
				<NuevoCatalogoItemModal
					partida={modalItem ? { codigo: modalItem.partida } : null}
					item={modalItem}
					onClose={() => setShowItemModal(false)}
					onCreated={handleItemCreated}
					onUpdated={handleItemUpdated}
				/>
			)}
			</div>
		</div>
	);
};

export default CatalogoItems;
