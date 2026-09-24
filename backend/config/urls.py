from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from rest_framework_simplejwt.views import (
    TokenRefreshView,
)
from poa_document.api.views import ReporteGeneralPOAView
from fondos.views import CustomTokenObtainPairView
from config.media import serve_signed_media

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('fondos.urls')),
    path('api/poa/', include('poa_document.api.urls')),
    path('api/reportes/generar-reporte-general/', ReporteGeneralPOAView.as_view(), name='reporte-general-poa'),
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    # Archivos subidos: se sirven en desarrollo y en producción, solo con URL firmada.
    re_path(rf'^{settings.MEDIA_URL.strip("/")}/(?P<path>.+)$', serve_signed_media, name='media'),
]
