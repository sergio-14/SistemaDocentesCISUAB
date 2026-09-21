from rest_framework import routers
from django.urls import path
from .views import (
    DocumentoPOAViewSet,
    DocumentoPOAReadOnlyViewSet,
    UsuarioPOAViewSet,
    DocenteBusquedaView,
    UsuarioBusquedaView,
    UsuarioBusquedaChatView,
    DirectorCarreraActualView,
    ChatContactosPOAView,
    MensajeChatViewSet,
    ObservacionDocumentoPOAViewSet,
    SolicitudCambioPOAViewSet,
    EvidenciaViewSet,
    CurrentUserAPIView,
    ProgramaPOAViewSet,
    ConsolidadoRequerimientosView,
    ReporteSeguimientoInstitucionalPOAView,
    OrdenCompraPOAView, RecepcionMaterialPOAView, EntregaMaterialActividadView, AnularMovimientoMaterialPOAView,
    TableroPOAView, BandejaSeguimientoPOAView, DetalleSeguimientoProgramaPOAView,
)
from .views import ObjetivoEspecificoViewSet, ActividadViewSet, DetallePresupuestoViewSet
from .views import (
    ItemCatalogoViewSet,
    ItemCatalogoReadOnlyViewSet,
    IndicadorCatalogoViewSet,
    IndicadorCatalogoReadOnlyViewSet,
    PartidaPresupuestariaViewSet,
)

router = routers.DefaultRouter()
router.register('usuarios-poa', UsuarioPOAViewSet, basename='usuario_poa')
router.register('programas', ProgramaPOAViewSet, basename='programa_poa')
router.register('documentos_poa', DocumentoPOAViewSet, basename='documento_poa')
router.register('documentos_poa_encabezados', DocumentoPOAReadOnlyViewSet, basename='documento_poa_encabezado')

# endpoints para objetivos, actividades y detalle de presupuesto
router.register(r'objetivos-especificos', ObjetivoEspecificoViewSet, basename='objetivos_especificos')
router.register(r'actividades', ActividadViewSet, basename='actividades')
router.register(r'observaciones-documento', ObservacionDocumentoPOAViewSet, basename='observaciones_documento')
router.register(r'solicitudes-cambio', SolicitudCambioPOAViewSet, basename='solicitudes_cambio')
router.register(r'evidencias', EvidenciaViewSet, basename='evidencias')

# detalle de presupuesto (CRUD estándar): list/create -> /detalle-presupuesto/ ; detail -> /detalle-presupuesto/{pk}/
router.register(r'detalle-presupuesto', DetallePresupuestoViewSet, basename='detalle_presupuesto')

router.register(r'mensajes-chat', MensajeChatViewSet, basename='mensaje_chat')

# Catálogos internos del módulo POA.
router.register(r'catalogos/partidas', PartidaPresupuestariaViewSet, basename='poa_partidapresupuestaria')
router.register(r'catalogos/items', ItemCatalogoViewSet, basename='poa_itemcatalogo')
router.register(r'catalogos/indicadores', IndicadorCatalogoViewSet, basename='poa_indicadorcatalogo')
router.register(r'catalogos/items-catalogo', ItemCatalogoReadOnlyViewSet, basename='poa_itemcatalogo_readonly')
router.register(r'catalogos/indicadores-catalogo', IndicadorCatalogoReadOnlyViewSet, basename='poa_indicadorcatalogo_readonly')

urlpatterns = router.urls + [
    path('docentes/buscar/', DocenteBusquedaView.as_view(), name='docente-buscar-poa'),
    path('usuarios/buscar/', UsuarioBusquedaView.as_view(), name='usuario-buscar-poa'),
    path('usuarios-chat/buscar/', UsuarioBusquedaChatView.as_view(), name='usuario-buscar-chat-poa'),
    path('director-carrera-actual/', DirectorCarreraActualView.as_view(), name='director-carrera-actual-poa'),
    path('chat-contactos/', ChatContactosPOAView.as_view(), name='chat-contactos-poa'),
    path('me/', CurrentUserAPIView.as_view(), name='current-user-poa'),
    path('consolidado-requerimientos/', ConsolidadoRequerimientosView.as_view(), name='consolidado-requerimientos-poa'),
    path('reportes/seguimiento-institucional/', ReporteSeguimientoInstitucionalPOAView.as_view(), name='reporte-seguimiento-institucional-poa'),
    path('ordenes-compra/', OrdenCompraPOAView.as_view(), name='ordenes-compra-poa'),
    path('recepciones-material/', RecepcionMaterialPOAView.as_view(), name='recepciones-material-poa'),
    path('entregas-material/', EntregaMaterialActividadView.as_view(), name='entregas-material-poa'),
    path('materiales/<str:tipo>/<int:pk>/anular/', AnularMovimientoMaterialPOAView.as_view(), name='anular-movimiento-material-poa'),
    path('tablero/', TableroPOAView.as_view(), name='tablero-poa'),
    path('seguimiento/bandeja/', BandejaSeguimientoPOAView.as_view(), name='bandeja-seguimiento-poa'),
    path('seguimiento/programas/<int:pk>/', DetalleSeguimientoProgramaPOAView.as_view(), name='detalle-seguimiento-programa-poa'),
]
