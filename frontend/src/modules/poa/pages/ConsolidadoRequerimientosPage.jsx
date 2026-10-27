import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { FaBoxOpen, FaChevronDown, FaChevronUp, FaFileExcel, FaFilePdf, FaPlus, FaSearch, FaTruck, FaUndo } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { API_BASE, anularMovimientoMaterialPOA, descargarInformeMaterialesExcelPOA, getConsolidadoRequerimientosPOA, getOrdenesCompraPOA, getProgramasPOA } from '../../../apis/poa.api';
import FullscreenPDFViewer from '../../../components/FullscreenPDFViewer';
import Dialog from '../components/base/Dialog';
import NuevaOrdenCompraModal from '../components/NuevaOrdenCompraModal';
import RegistrarRecepcionModal from '../components/RegistrarRecepcionModal';
import RegistrarEntregaModal from '../components/RegistrarEntregaModal';

const STATUS = { emitida: 'Emitida', recibiendo: 'Recepción parcial', recibida: 'Recibida', cancelada: 'Anulada' };
const archivoUrl = (url) => !url ? '' : (String(url).startsWith('http') ? url : `${API_BASE}${url}`);
const cantidad = (value) => Number(value || 0).toLocaleString('es-BO', { maximumFractionDigits: 2 });
const dinero = (value) => Number(value || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ConsolidadoRequerimientosPage() {
  const { poaPermissions = {} } = useOutletContext() || {};
  const location = useLocation();
  const canEdit = !!poaPermissions.canEdit;
  const [filtros, setFiltros] = useState({ gestion: new Date().getFullYear(), programa: '', partida: '', item: '', mes_requerimiento: '' });
  const [programas, setProgramas] = useState([]);
  const [datos, setDatos] = useState({ items: [] });
  const [ordenes, setOrdenes] = useState([]);
  const [seccion, setSeccion] = useState(() => location.state?.materialTab === 'entregas' ? 'entregas' : 'recepcion');
  const [abierto, setAbierto] = useState(null);
  const [orden, setOrden] = useState(null);
  const [recepcion, setRecepcion] = useState(null);
  const [entrega, setEntrega] = useState(null);
  const [anular, setAnular] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [pdfAbierto, setPdfAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [consolidado, compras] = await Promise.all([
        getConsolidadoRequerimientosPOA(filtros),
        getOrdenesCompraPOA({ gestion: filtros.gestion }),
      ]);
      setDatos(consolidado.data);
      setOrdenes(Array.isArray(compras.data) ? compras.data : compras.data?.results || []);
    } catch {
      toast.error('No se pudieron cargar los materiales y sus saldos.');
    } finally {
      setCargando(false);
    }
  }, [filtros]);

  useEffect(() => {
    getProgramasPOA({ activo: true }).then((response) => setProgramas(Array.isArray(response.data) ? response.data : response.data?.results || [])).catch(() => {});
  }, []);
  useEffect(() => {
    const temporizador = setTimeout(cargar, 250);
    return () => clearTimeout(temporizador);
  }, [cargar]);
  useEffect(() => {
    if (location.state?.materialTab) setSeccion(location.state.materialTab === 'entregas' ? 'entregas' : 'recepcion');
  }, [location.state?.materialTab]);

  const movimientosStock = useMemo(() => ordenes.flatMap((compra) => (compra.recepciones || []).flatMap((acta) =>
    (acta.detalles || []).map((detalle) => ({
      compra,
      acta,
      detalle,
      linea: compra.detalles.find((item) => Number(item.id) === Number(detalle.detalle_orden)),
    })))), [ordenes]);
  const stockResumen = useMemo(() => {
    const agrupado = new Map();
    movimientosStock.forEach(({ compra, acta, detalle, linea }) => {
      if (acta.anulada || compra.estado === 'cancelada') return;
      const llave = `${linea?.partida || ''}|${linea?.item || ''}|${linea?.unidad_medida || ''}`;
      const fila = agrupado.get(llave) || {
        partida: linea?.partida || '', item: linea?.item || 'Material', unidad: linea?.unidad_medida || '',
        recibido: 0, disponible: 0, valor: 0,
      };
      fila.recibido += Number(detalle.cantidad_recibida || 0);
      fila.disponible += Number(detalle.saldo_entrega || 0);
      fila.valor += Number(detalle.saldo_entrega || 0) * Number(detalle.costo_unitario_real || 0);
      agrupado.set(llave, fila);
    });
    return [...agrupado.values()].sort((a, b) => a.item.localeCompare(b.item, 'es'));
  }, [movimientosStock]);

  const descargarExcel = async () => {
    try {
      const response = await descargarInformeMaterialesExcelPOA({ gestion: filtros.gestion });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `seguimiento_materiales_poa_${filtros.gestion}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('No se pudo generar el informe de abastecimiento.');
    }
  };

  const informePdfUrl = `${API_BASE}/api/poa/reportes/materiales/?${new URLSearchParams({ gestion: filtros.gestion, formato: 'pdf' }).toString()}`;
  const consolidadoPdfUrl = `${API_BASE}/api/poa/consolidado-requerimientos/?${new URLSearchParams({ ...filtros, formato: 'pdf' }).toString()}`;
  const confirmarAnulacion = async () => {
    if (!motivo.trim()) return toast.error('Indique el motivo de la anulación.');
    try {
      await anularMovimientoMaterialPOA(anular.tipo, anular.id, motivo);
      toast.success('Movimiento anulado. El historial se conserva.');
      setAnular(null);
      setMotivo('');
      cargar();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'No se pudo anular el movimiento.');
    }
  };
  const cambiarFiltro = (key, value) => setFiltros((actual) => ({ ...actual, [key]: value }));
  const botonAnular = (tipo, id, etiqueta) => canEdit && <button className="text-xs font-bold text-red-700 hover:underline" onClick={() => setAnular({ tipo, id, etiqueta })}><FaUndo className="mr-1 inline" />Anular</button>;

  return <section className="mx-auto w-full max-w-[1500px] space-y-4">
    <header className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-2xl font-extrabold text-blue-900">Abastecimiento de materiales POA</h2><p className="mt-1 text-sm text-slate-600">Compras parciales por proveedor, recepción física, stock y entrega a las actividades planificadas. Los informes cubren toda la gestión seleccionada.</p></div>
        <div className="flex flex-wrap gap-2"><button className="btn-success rounded px-3 py-2" onClick={descargarExcel}><FaFileExcel className="mr-1 inline" />Informe Excel</button><button className="btn-secondary rounded px-3 py-2" onClick={() => setPdfAbierto(true)}><FaFilePdf className="mr-1 inline" />Informe PDF</button></div>
      </div>
      <nav className="mt-4 flex gap-5 border-b" aria-label="Gestión de materiales">
        <button onClick={() => setSeccion('recepcion')} className={`border-b-2 px-2 py-2 text-sm font-bold ${seccion === 'recepcion' ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-600'}`}>1. Compras y recepción</button>
        <button onClick={() => setSeccion('entregas')} className={`border-b-2 px-2 py-2 text-sm font-bold ${seccion === 'entregas' ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-600'}`}>2. Stock y entregas</button>
      </nav>
    </header>

    <div className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
      <label>Gestión<input className="poa-input mt-1 w-full" type="number" value={filtros.gestion} onChange={(event) => cambiarFiltro('gestion', event.target.value)} /></label>
      <label>Programa<select className="poa-input mt-1 w-full" value={filtros.programa} onChange={(event) => cambiarFiltro('programa', event.target.value)}><option value="">Todos</option>{programas.map((programa) => <option key={programa.id} value={programa.nombre}>{programa.nombre}</option>)}</select></label>
      {seccion === 'recepcion' && <>
        <label>Partida<input className="poa-input mt-1 w-full" value={filtros.partida} onChange={(event) => cambiarFiltro('partida', event.target.value)} /></label>
        <label>Material<input className="poa-input mt-1 w-full" value={filtros.item} onChange={(event) => cambiarFiltro('item', event.target.value)} /></label>
        <label>Mes requerido<input className="poa-input mt-1 w-full" value={filtros.mes_requerimiento} onChange={(event) => cambiarFiltro('mes_requerimiento', event.target.value)} /></label>
      </>}
    </div>

    {seccion === 'recepcion' && <>
      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4">
          <div><h3 className="font-bold text-slate-900">Requerimientos planificados y pendientes de compra</h3><p className="text-xs text-slate-600">La cantidad disponible disminuye al registrar compras; el stock aumenta al recepcionar.</p></div>
          <div className="flex gap-2"><button className="btn-secondary rounded px-3 py-2" onClick={() => setPdfAbierto('consolidado')}><FaFilePdf className="mr-1 inline" />Consolidado PDF</button>{canEdit && <button disabled={!datos.items?.some((item) => Number(item.cantidad_pendiente_compra) > 0)} className="btn-primary rounded px-3 py-2" onClick={() => setOrden(true)}><FaPlus className="mr-1 inline" />Registrar compra</button>}<button className="btn-secondary rounded px-3 py-2" onClick={cargar} disabled={cargando}><FaSearch className="mr-1 inline" />{cargando ? 'Actualizando…' : 'Actualizar'}</button></div>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-blue-50 text-left"><tr><th className="p-3">Partida / material</th><th>Unidad</th><th>Planificado</th><th>Comprado</th><th>Pendiente</th><th>Costo planificado restante</th><th /></tr></thead>
          <tbody>{(datos.items || []).map((item, index) => <React.Fragment key={`${item.partida}-${item.item}-${index}`}>
            <tr className="border-t"><td className="p-3"><b>{item.item}</b><small className="block text-slate-500">Partida {item.partida}{item.caracteristicas ? ` · ${item.caracteristicas}` : ''}</small></td><td>{item.unidad_medida}</td><td>{cantidad(item.cantidad_total)}</td><td>{cantidad(item.cantidad_comprada)}</td><td className="font-bold">{cantidad(item.cantidad_pendiente_compra)}</td><td className="poa-currency-cell text-right tabular-nums">Bs. {dinero(item.monto_estimado_pendiente)}</td><td><button aria-label="Ver actividades solicitantes" onClick={() => setAbierto(abierto === index ? null : index)}>{abierto === index ? <FaChevronUp /> : <FaChevronDown />}</button></td></tr>
            {abierto === index && <tr><td colSpan="7" className="bg-slate-50 p-3 text-xs">{item.origenes.map((origen) => <p key={origen.detalle_id}>{origen.programa} · {origen.actividad_codigo} {origen.actividad_nombre} — planificado {cantidad(origen.cantidad)}, comprado {cantidad(origen.cantidad_comprada)}, pendiente {cantidad(origen.cantidad_pendiente)}</p>)}</td></tr>}
          </React.Fragment>)}
          {!datos.items?.length && <tr><td colSpan="7" className="p-8 text-center text-slate-500">No hay materiales planificados con estos filtros.</td></tr>}
          </tbody>
        </table></div>
      </section>

      <section className="space-y-3">
        <div><h3 className="font-bold text-slate-900">Compras registradas y recepciones pendientes</h3><p className="text-xs text-slate-600">Cada proveedor tiene su propia compra. Las recepciones parciales ingresan al stock por separado.</p></div>
        {ordenes.map((compra) => <article key={compra.id} className="rounded-xl border bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><b>Compra {compra.numero} · {compra.proveedor}</b><p className="text-sm text-slate-600">{compra.fecha} · {STATUS[compra.estado] || compra.estado}</p>{compra.respaldo && <a className="text-xs font-semibold text-blue-700 underline" href={archivoUrl(compra.respaldo)} target="_blank" rel="noreferrer">Ver respaldo de compra</a>}</div>{compra.estado !== 'cancelada' && botonAnular('orden', compra.id, `la compra ${compra.numero}`)}</div>
          <div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-600"><th>Material</th><th>Comprado</th><th>Recibido</th><th>Pendiente de recepción</th><th>Costo unitario</th><th>Costo compra</th></tr></thead><tbody>{compra.detalles.map((linea) => <tr key={linea.id} className="border-t"><td className="py-2">{linea.item}<small className="block text-slate-500">{linea.partida} · {linea.unidad_medida}</small></td><td>{cantidad(linea.cantidad_comprada)}</td><td>{cantidad(linea.cantidad_recibida)}</td><td>{cantidad(linea.saldo_recepcion)}</td><td>Bs. {dinero(linea.costo_unitario_real)}</td><td>Bs. {dinero(linea.costo_total_real)}</td></tr>)}</tbody></table></div>
          {compra.estado !== 'cancelada' && canEdit && compra.detalles.some((linea) => Number(linea.saldo_recepcion) > 0) && <button className="btn-primary mt-3 rounded px-3 py-2 text-sm" onClick={() => setRecepcion(compra)}><FaTruck className="mr-1 inline" />Registrar recepción parcial o total</button>}
          {(compra.recepciones || []).map((acta) => <div key={acta.id} className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><div><b>Recepción {acta.numero_respaldo || `#${acta.id}`}</b><span className="ml-2 text-slate-600">{acta.fecha} · recibido por {acta.recibido_por || '—'}{acta.anulada ? ' · ANULADA' : ''}</span>{acta.respaldo && <a className="ml-2 text-xs font-semibold text-blue-700 underline" href={archivoUrl(acta.respaldo)} target="_blank" rel="noreferrer">Ver factura/acta</a>}{acta.motivo_anulacion && <p className="text-xs text-red-700">Motivo: {acta.motivo_anulacion}</p>}</div>{!acta.anulada && botonAnular('recepcion', acta.id, 'esta recepción')}</div><div className="mt-2 text-xs text-slate-600">{acta.detalles.map((detalle) => { const linea = compra.detalles.find((item) => Number(item.id) === Number(detalle.detalle_orden)); return <p key={detalle.id}>{linea?.item}: recibidos {cantidad(detalle.cantidad_recibida)} a Bs. {dinero(detalle.costo_unitario_real)} por unidad</p>; })}</div></div>)}
        </article>)}
        {!ordenes.length && <p className="rounded-xl border border-dashed p-8 text-center text-slate-500">Todavía no hay compras registradas en esta gestión.</p>}
      </section>
    </>}

    {seccion === 'entregas' && <section className="space-y-3">
      <div className="rounded-xl border bg-amber-50 p-4 text-sm text-amber-950">El stock refleja únicamente materiales físicamente recibidos menos entregas no anuladas. Las cantidades se asignan solo a las actividades de origen y dentro del saldo comprado para ellas.</div>
      <article className="overflow-hidden rounded-xl border bg-white">
        <div className="p-4"><h3 className="font-bold text-slate-900">Stock disponible por material</h3><p className="text-xs text-slate-600">Suma existencias de todas las recepciones y proveedores de la gestión.</p></div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">Partida</th><th>Material</th><th>Unidad</th><th>Recibido</th><th>Disponible</th><th>Valor disponible</th></tr></thead><tbody>
          {stockResumen.map((fila) => <tr key={`${fila.partida}-${fila.item}-${fila.unidad}`} className="border-t"><td className="p-3">{fila.partida}</td><td className="font-semibold">{fila.item}</td><td>{fila.unidad}</td><td>{cantidad(fila.recibido)}</td><td className="font-bold text-emerald-800">{cantidad(fila.disponible)}</td><td>Bs. {dinero(fila.valor)}</td></tr>)}
          {!stockResumen.length && <tr><td colSpan="6" className="p-6 text-center text-slate-500">Todavía no hay materiales en stock.</td></tr>}
        </tbody></table></div>
      </article>
      <div><h3 className="font-bold text-slate-900">Lotes recibidos e historial de distribución</h3><p className="text-xs text-slate-600">Conserve la trazabilidad por proveedor, factura y recepción.</p></div>
      {movimientosStock.map(({ compra, acta, detalle, linea }) => {
        const puedeEntregar = canEdit && !acta.anulada && compra.estado !== 'cancelada' && Number(detalle.saldo_entrega) > 0 && (linea?.actividades_origen || []).some((actividad) => Number(actividad.cantidad_requerida) > Number(actividad.cantidad_entregada || 0));
        return <article key={detalle.id} className="rounded-xl border bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><b>{linea?.item || 'Material'}</b><p className="text-sm text-slate-600">{linea?.partida} · {linea?.unidad_medida} · compra {compra.numero} de {compra.proveedor} · recepción {acta.fecha}</p><p className="mt-1 text-sm font-bold text-emerald-800">En stock: {cantidad(detalle.saldo_entrega)} · recibidos: {cantidad(detalle.cantidad_recibida)} · costo recibido: Bs. {dinero(Number(detalle.cantidad_recibida) * Number(detalle.costo_unitario_real))}</p></div>{puedeEntregar && <button className="btn-primary rounded px-3 py-2 text-sm" onClick={() => setEntrega({ detalleRecepcion: detalle, detalleOrden: linea })}><FaBoxOpen className="mr-1 inline" />Preparar entrega</button>}</div>
          <div className="mt-3 border-t pt-2"><h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">Historial de distribución</h4>{(detalle.entregas || []).map((movimiento) => <div key={movimiento.id} className="mt-2 flex flex-wrap justify-between gap-2 text-sm"><span>{movimiento.actividad_codigo} · {movimiento.actividad_nombre}: {cantidad(movimiento.cantidad_entregada)} {linea?.unidad_medida} a {movimiento.nombre_receptor} · {movimiento.fecha}{movimiento.anulada ? ' · ANULADA' : ''}{movimiento.acta_archivo && <a className="ml-2 text-xs font-semibold text-blue-700 underline" href={archivoUrl(movimiento.acta_archivo)} target="_blank" rel="noreferrer">Ver acta</a>}{movimiento.motivo_anulacion && <small className="ml-2 text-red-700">Motivo: {movimiento.motivo_anulacion}</small>}</span>{!movimiento.anulada && botonAnular('entrega', movimiento.id, 'esta entrega')}</div>)}{!detalle.entregas?.length && <p className="mt-2 text-xs text-slate-500">Aún no hay entregas registradas para este material.</p>}</div>
        </article>;
      })}
      {!movimientosStock.length && <p className="rounded-xl border border-dashed p-8 text-center text-slate-500">No hay recepciones registradas para esta gestión.</p>}
    </section>}

    {orden && <NuevaOrdenCompraModal gestion={filtros.gestion} items={datos.items} onClose={() => setOrden(null)} onCreated={cargar} />}
    {recepcion && <RegistrarRecepcionModal orden={recepcion} onClose={() => setRecepcion(null)} onSaved={cargar} />}
    {entrega && <RegistrarEntregaModal {...entrega} onClose={() => setEntrega(null)} onSaved={cargar} />}
    <Dialog open={!!anular} type="danger" title="Anular movimiento" message={`Se conservará el historial de ${anular?.etiqueta || 'este movimiento'}.`} confirmText="Anular" onConfirm={confirmarAnulacion} onClose={() => { setAnular(null); setMotivo(''); }}><textarea className="poa-input w-full" placeholder="Motivo obligatorio" value={motivo} onChange={(event) => setMotivo(event.target.value)} /></Dialog>
    <FullscreenPDFViewer isOpen={!!pdfAbierto} onClose={() => setPdfAbierto(false)} pdfUrl={pdfAbierto === 'consolidado' ? consolidadoPdfUrl : informePdfUrl} downloadFileName={pdfAbierto === 'consolidado' ? `solicitud_compra_poa_${filtros.gestion}.pdf` : `seguimiento_materiales_poa_${filtros.gestion}.pdf`} title={pdfAbierto === 'consolidado' ? `Requerimientos de compra - Gestión ${filtros.gestion}` : `Seguimiento de abastecimiento - Gestión ${filtros.gestion}`} />
  </section>;
}
