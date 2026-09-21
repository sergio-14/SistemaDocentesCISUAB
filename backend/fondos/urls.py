from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# =====================================================
# CONFIGURACIÓN DEL ROUTER PARA VIEWSETS
# =====================================================

router = DefaultRouter()
router.register(r'docentes', views.DocenteViewSet)
router.register(r'datos-laborales', views.DatosLaboralesViewSet)
router.register(r'saldos-vacaciones', views.SaldoVacacionesGestionViewSet)
router.register(r'carreras', views.CarreraViewSet)
router.register(r'materias', views.MateriaViewSet)
router.register(r'cargas-horarias', views.CargaHorariaViewSet, basename='cargahoraria')
router.register(r'evidencias-carga-horaria', views.EvidenciaCargaHorariaViewSet, basename='evidenciacargahoraria')
router.register(r'calendarios', views.CalendarioAcademicoViewSet)
router.register(r'fondos-tiempo', views.FondoTiempoViewSet)
router.register(r'categorias', views.CategoriaFuncionViewSet)
router.register(r'proyectos', views.ProyectoViewSet)
router.register(r'informes', views.InformeFondoViewSet)
router.register(r'observaciones', views.ObservacionFondoViewSet)
router.register(r'historial', views.HistorialFondoViewSet)
router.register(r'usuarios', views.UsuarioViewSet)

# =====================================================
# URLS DE LA APLICACIÓN
# =====================================================

urlpatterns = [
    # 1. URLs generadas automáticamente por el router para los ViewSets
    path('', include(router.urls)),
    
    # 2. URLs para vistas basadas en funciones (las que no son ViewSets)
    
    # Endpoint para obtener el usuario actual
    path('usuario/', views.usuario_actual, name='usuario-actual'),
    path('perfil/', views.perfil_actual, name='perfil-actual'),
    
    # Endpoint para las estadísticas del dashboard (¡ESTE ES EL QUE FALTABA!)
    path('dashboard-stats/', views.dashboard_stats, name='dashboard-stats'),
    
    # Endpoint para actualizar la foto de perfil
    path('perfil/foto/', views.FotoPerfilUpdateView.as_view(), name='foto-perfil-update'),

    # Endpoint de diagnostico: PDF minimo para aislar problemas de libreria vs. logica
    path('test-pdf-hola-mundo/', views.test_pdf_hola_mundo, name='test-pdf-hola-mundo'),

    # Endpoint para cambio de contraseña inicial obligatorio
    path('auth/cambiar-password-inicial/', views.cambiar_password_inicial, name='cambiar-password-inicial'),
    
    # Endpoint de Login personalizado (Ajustado para coincidir con la llamada /api/token/ de tu frontend)
    path('api/token/', views.CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
]

# Nota: Las URLs para el login y refresh de tokens (ej. /api/token/)
# generalmente se configuran en el archivo de URLs principal del proyecto,
# no aquí.
