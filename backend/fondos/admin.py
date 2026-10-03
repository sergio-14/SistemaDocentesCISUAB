from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from .models import (
    Docente, DocenteCarrera, Carrera, CalendarioAcademico, FondoTiempo,
    InformeFondo,
    ObservacionFondo, HistorialFondo, PerfilUsuario,
    MensajeObservacion, DatosLaborales,
)


# =====================================================
# DATOS LABORALES ADMIN
# =====================================================

@admin.register(DatosLaborales)
class DatosLaboralesAdmin(admin.ModelAdmin):
    list_display = ['id', 'ci', 'fecha_ingreso', 'dias_vacacion', 'tiene_docente', 'tiene_perfil']
    list_filter = []
    search_fields = ['ci']
    ordering = ['-fecha_creacion']

    fieldsets = (
        ('Identidad Laboral', {
            'fields': ('ci', 'fecha_ingreso')
        }),
        ('Beneficios', {
            'fields': ('dias_vacacion',)
        }),
    )
    readonly_fields = ('fecha_creacion', 'fecha_modificacion')

    def tiene_docente(self, obj):
        return hasattr(obj, 'docente') and obj.docente is not None
    tiene_docente.boolean = True
    tiene_docente.short_description = 'Tiene Docente'

    def tiene_perfil(self, obj):
        return obj.perfiles.exists()
    tiene_perfil.boolean = True
    tiene_perfil.short_description = 'Tiene Perfil'


# =====================================================
# DOCENTE ADMIN
# =====================================================

@admin.register(Docente)
class DocenteAdmin(admin.ModelAdmin):
    list_display = [
        'id','nombre_completo', 'ci_display',
        'email', 'activo'
    ]
    list_filter = ['activo']
    search_fields = ['nombres', 'apellido_paterno', 'apellido_materno', 'datos_laborales__ci', 'email']
    ordering = ['apellido_paterno', 'apellido_materno', 'nombres']

    fieldsets = (
        ('Información Personal', {
            'fields': ('nombres', 'apellido_paterno', 'apellido_materno')
        }),
        ('Datos Laborales', {
            'fields': ('datos_laborales_link',),
            'description': 'Los campos de CI, vacaciones y feriados se gestionan desde Datos Laborales.'
        }),
        ('Contacto', {
            'fields': ('email', 'telefono')
        }),
        ('Estado', {
            'fields': ('activo',)
        }),
    )
    readonly_fields = ('fecha_creacion', 'fecha_modificacion', 'datos_laborales_link')

    def ci_display(self, obj):
        return obj.ci if obj.ci else 'N/A'
    ci_display.short_description = 'CI'

    def datos_laborales_link(self, obj):
        if obj.datos_laborales:
            return format_html(
                '<a href="{}">{}</a>',
                reverse('admin:fondos_datoslaborales_change', args=[obj.datos_laborales.id]),
                obj.datos_laborales
            )
        return 'Sin datos laborales'
    datos_laborales_link.short_description = 'Datos Laborales'


class DocenteCarreraInline(admin.TabularInline):
    model = DocenteCarrera
    extra = 1
    fields = ('carrera', 'categoria', 'dedicacion', 'activo')


@admin.register(DocenteCarrera)
class DocenteCarreraAdmin(admin.ModelAdmin):
    list_display = ['docente', 'carrera', 'categoria', 'dedicacion', 'horas_semanales', 'activo']
    list_filter = ['dedicacion', 'categoria', 'activo']
    search_fields = ['docente__nombres', 'docente__apellido_paterno', 'carrera__nombre']
    ordering = ['carrera__nombre', 'docente__apellido_paterno']

    def horas_semanales(self, obj):
        return obj.horas_semanales_maximas
    horas_semanales.short_description = 'Hrs/Sem'

# Register inline on DocenteAdmin
DocenteAdmin.inlines = [DocenteCarreraInline]


# =====================================================
# CARRERA ADMIN
# =====================================================

@admin.register(Carrera)
class CarreraAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'codigo', 'facultad', 'activo']
    list_filter = ['facultad', 'activo']
    search_fields = ['nombre', 'codigo', 'facultad__nombre']
    ordering = ['facultad__nombre', 'nombre']

    # Crear y eliminar carreras es solo del superusuario, igual que en la API.
    def has_add_permission(self, request):
        return request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


# =====================================================
# CALENDARIO ACADÉMICO ADMIN (NUEVO)
# =====================================================

@admin.register(CalendarioAcademico)
class CalendarioAcademicoAdmin(admin.ModelAdmin):
    list_display = [
        '__str__', 'fecha_inicio', 'fecha_fin', 'activo_badge'
    ]
    list_filter = ['gestion', 'periodo', 'activo']
    search_fields = ['gestion']
    ordering = ['-gestion', '-periodo']
    
    fieldsets = (
        ('Periodo Académico', {
            'fields': ('gestion', 'periodo')
        }),
        ('Fechas del Periodo', {
            'fields': ('fecha_inicio', 'fecha_fin')
        }),
        ('Presentación de Proyectos (Art. 18)', {
            'fields': (
                'fecha_inicio_presentacion_proyectos',
                'fecha_limite_presentacion_proyectos'
            ),
            'description': 'Fechas para presentación de proyectos y programas analíticos'
        }),
        ('Estado', {
            'fields': ('activo',)
        }),
    )
    
    def activo_badge(self, obj):
        if obj.activo:
            return mark_safe(
                '<span style="color: white; background: #10b981; padding: 3px 10px; border-radius: 3px; font-weight: bold;">✓ ACTIVO</span>'
            )
        return mark_safe('<span style="color: gray;">Inactivo</span>')
    activo_badge.short_description = 'Estado'


# =====================================================
# FONDO DE TIEMPO ADMIN
# =====================================================

@admin.register(FondoTiempo)
class FondoTiempoAdmin(admin.ModelAdmin):
    list_display = [
        'docente', 'carrera', 'gestion',
        'estado_badge', 'porcentaje_badge', 'programa_badge'
    ]
    list_filter = ['estado', 'gestion', 'carrera', 'archivado']
    search_fields = [
        'docente__nombres', 'docente__apellido_paterno',
        'docente__apellido_materno', 'carrera__nombre'
    ]
    ordering = ['-gestion', 'docente__apellido_paterno']
    
    fieldsets = (
        ('Información Básica', {
            'fields': ('docente', 'carrera', 'gestion')
        }),
        ('Configuración de Horas', {
            'fields': (
                'horas_semana', 'horas_vacacion',
                'horas_feriados', 'horas_efectivas'
            ),
            'classes': ('collapse',)
        }),
        ('Control de Estado', {
            'fields': (
                'estado', 'fecha_presentacion', 'fecha_aprobacion',
                'fecha_validacion', 'aprobado_por', 'validado_por'
            )
        }),
        ('Observaciones y Archivado', {
            'fields': ('observaciones', 'comentarios_admin', 'archivado'),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ['fecha_creacion', 'fecha_modificacion']
    
    def estado_badge(self, obj):
        colores = {
            'borrador': '#6b7280',
            'presentado_director': '#3b82f6',
            'revision_director': '#f59e0b',
            'aprobado_director': '#10b981',
            'en_ejecucion': '#8b5cf6',
            'finalizado': '#059669',
            'observado': '#ef4444',
            'rechazado': '#dc2626',
        }
        color = colores.get(obj.estado, '#6b7280')
        return format_html(
            '<span style="color: white; background: {}; padding: 3px 10px; border-radius: 3px;">{}</span>',
            color, obj.get_estado_display()
        )
    estado_badge.short_description = 'Estado'
    
    def porcentaje_badge(self, obj):
        porcentaje = obj.porcentaje_completado
        if porcentaje < 30:
            color = '#ef4444'
        elif porcentaje < 70:
            color = '#f59e0b'
        elif porcentaje < 100:
            color = '#10b981'
        else:
            color = '#059669'
        
        return format_html(
            '<span style="color: white; background: {}; padding: 3px 10px; border-radius: 3px; font-weight: bold;">{}%</span>',
            color,
            round(porcentaje, 1) 
        )
    porcentaje_badge.short_description = '% Completado'
    
    def programa_badge(self, obj):
        faltantes = len(obj.programas_analiticos_faltantes())
        if not faltantes:
            return mark_safe('<span style="color: green; font-weight: bold;">✓ Completos</span>')
        return mark_safe(f'<span style="color: red;">✗ Faltan {faltantes}</span>')
    programa_badge.short_description = 'Programas analíticos'


# =====================================================
# INFORME FONDO ADMIN (NUEVO)
# =====================================================

@admin.register(InformeFondo)
class InformeFondoAdmin(admin.ModelAdmin):
    list_display = [
        'fondo_tiempo', 'tipo_display', 'cumplimiento_badge',
        'fecha_elaboracion', 'elaborado_por'
    ]
    list_filter = ['tipo', 'cumplimiento', 'fecha_elaboracion']
    search_fields = [
        'fondo_tiempo__carrera__nombre',
        'fondo_tiempo__docente__apellido_paterno',
        'elaborado_por__username'
    ]
    ordering = ['-fecha_elaboracion']
    
    fieldsets = (
        ('Información Básica', {
            'fields': ('fondo_tiempo', 'tipo', 'elaborado_por')
        }),
        ('Contenido del Informe', {
            'fields': (
                'seccion_academica', 'seccion_investigacion', 'seccion_extension_universitaria',
                'seccion_interaccion_social', 'seccion_gestion', 'seccion_academica_administrativa',
                'seccion_social_cultural_deportiva', 'conclusiones_generales',
            )
        }),
        ('Evaluación (Director)', {
            'fields': (
                'cumplimiento', 'evaluacion_director',
                'fecha_evaluacion', 'evaluado_por'
            ),
            'description': 'Evaluación realizada por el Director de Carrera'
        }),
    )
    
    readonly_fields = ['fecha_elaboracion', 'fecha_modificacion']
    
    def tipo_display(self, obj):
        return obj.get_tipo_display()
    tipo_display.short_description = 'Tipo'
    
    def cumplimiento_badge(self, obj):
        if not obj.cumplimiento:
            return mark_safe('<span style="color: gray;">Pendiente</span>')
        
        colores = {
            'cumplido': '#10b981',
            'parcial': '#f59e0b',
            'incumplido': '#ef4444',
        }
        color = colores.get(obj.cumplimiento, '#6b7280')
        return format_html(
            '<span style="color: white; background: {}; padding: 3px 10px; border-radius: 3px;">{}</span>',
            color, obj.get_cumplimiento_display()
        )
    cumplimiento_badge.short_description = 'Cumplimiento'


# =====================================================
# OBSERVACIÓN FONDO ADMIN (NUEVO)
# =====================================================

@admin.register(ObservacionFondo)
class ObservacionFondoAdmin(admin.ModelAdmin):
    list_display = ['id', 'fondo_tiempo', 'fecha_creacion', 'resuelta']
    list_filter = ['resuelta', 'fecha_creacion']
    search_fields = ['fondo_tiempo__docente__nombres']
    readonly_fields = ['fecha_creacion', 'fecha_resolucion']
    ordering = ['-fecha_creacion']


@admin.register(MensajeObservacion)
class MensajeObservacionAdmin(admin.ModelAdmin):
    list_display = ['id', 'observacion', 'autor', 'fecha', 'es_admin']
    list_filter = ['es_admin', 'fecha']
    search_fields = ['texto', 'autor__username']
    readonly_fields = ['fecha']
    ordering = ['-fecha']


# =====================================================
# HISTORIAL FONDO ADMIN (NUEVO)
# =====================================================

@admin.register(HistorialFondo)
class HistorialFondoAdmin(admin.ModelAdmin):
    list_display = [
        'fondo_tiempo', 'tipo_cambio_display', 'usuario',
        'fecha', 'estado_anterior', 'estado_nuevo'
    ]
    list_filter = ['tipo_cambio', 'fecha']
    search_fields = [
        'fondo_tiempo__carrera__nombre',
        'fondo_tiempo__docente__apellido_paterno',
        'usuario__username', 'descripcion'
    ]
    ordering = ['-fecha']
    
    fieldsets = (
        ('Información', {
            'fields': ('fondo_tiempo', 'usuario', 'fecha', 'tipo_cambio')
        }),
        ('Cambio de Estado', {
            'fields': ('estado_anterior', 'estado_nuevo', 'descripcion')
        }),
        ('Datos del Cambio', {
            'fields': ('datos_cambio',),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ['fecha']
    
    def tipo_cambio_display(self, obj):
        return obj.get_tipo_cambio_display()
    tipo_cambio_display.short_description = 'Tipo'
    
    def has_add_permission(self, request):
        # El historial se crea automáticamente
        return False
    
    def has_delete_permission(self, request, obj=None):
        # El historial no se puede eliminar
        return False


# =====================================================
# PERFIL USUARIO ADMIN
# =====================================================

@admin.register(PerfilUsuario)
class PerfilUsuarioAdmin(admin.ModelAdmin):
    list_display = ['user', 'rol_display', 'carrera', 'docente', 'datos_laborales_link', 'activo']
    list_filter = ['rol', 'activo', 'carrera']
    search_fields = [
        'user__username', 'user__first_name', 'user__last_name',
        'docente__nombres', 'docente__apellido_paterno',
        'datos_laborales__ci'
    ]

    fieldsets = (
        ('Usuario', {
            'fields': ('user', 'rol', 'activo')
        }),
        ('Relaciones', {
            'fields': ('docente', 'carrera', 'datos_laborales')
        }),
        ('Datos Laborales (solo lectura)', {
            'fields': ('dl_fecha_ingreso', 'dl_dias_vacacion', 'dl_antiguedad'),
            'classes': ('collapse',),
            'description': 'Estos campos se muestran desde DatosLaborales asociados. Para editarlos, vaya al registro de Datos Laborales.'
        }),
        ('Contacto', {
            'fields': ('telefono',)
        }),
    )
    readonly_fields = ('dl_fecha_ingreso', 'dl_dias_vacacion', 'dl_antiguedad')

    def rol_display(self, obj):
        return obj.get_rol_display()
    rol_display.short_description = 'Rol'

    def datos_laborales_link(self, obj):
        dl = obj.obtener_datos_laborales()
        if dl:
            return format_html(
                '<a href="{}">{}</a>',
                reverse('admin:fondos_datoslaborales_change', args=[dl.id]), str(dl)
            )
        return 'Sin datos'
    datos_laborales_link.short_description = 'Datos Lab.'

    def dl_fecha_ingreso(self, obj):
        return obj.fecha_ingreso or 'N/A'
    dl_fecha_ingreso.short_description = 'Fecha Ingreso'

    def dl_dias_vacacion(self, obj):
        return obj.dias_vacacion
    dl_dias_vacacion.short_description = 'Días Vacación'

    def dl_antiguedad(self, obj):
        return f"{obj.calcular_antiguedad()} años"
    dl_antiguedad.short_description = 'Antigüedad'


# Personalización del sitio admin
admin.site.site_header = "Sistema de Fondos de Tiempo - UAB"
admin.site.site_title = "Admin Fondos UAB"
admin.site.index_title = "Panel de Administración"