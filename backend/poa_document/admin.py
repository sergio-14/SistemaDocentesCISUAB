from django.contrib import admin
from poa_document.models import (
    UsuarioPOA,
    DocumentoPOA,
    HistorialDocumentoPOA,
    ObservacionDocumentoPOA,
    SolicitudCambioPOA,
    ProgramaPOA,
    VersionDocumentoPOA,
    SeguimientoActividadPOA,
    ItemCatalogo,
    IndicadorCatalogo,
)

@admin.register(UsuarioPOA)
class UsuarioPOAAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'rol', 'carrera', 'nombre_entidad', 'activo', 'fecha_asignacion')
    list_filter = ('rol', 'activo', 'carrera')
    search_fields = ('user__username', 'user__first_name', 'user__last_name',
                     'docente__nombres', 'docente__apellido_paterno', 'nombre_entidad')
    ordering = ('carrera', 'rol')


@admin.register(ProgramaPOA)
class ProgramaPOAAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'carrera', 'activo', 'actualizado_en')
    list_filter = ('activo', 'carrera')
    search_fields = ('nombre', 'carrera__nombre', 'carrera__codigo')
    ordering = ('carrera', 'nombre')


@admin.register(ItemCatalogo)
class ItemCatalogoAdmin(admin.ModelAdmin):
    list_display = ('detalle', 'unidad_medida', 'partida')
    search_fields = ('detalle', 'partida', 'unidad_medida')
    list_filter = ('partida',)


@admin.register(IndicadorCatalogo)
class IndicadorCatalogoAdmin(admin.ModelAdmin):
    list_display = ('indicador',)
    search_fields = ('indicador',)


@admin.register(DocumentoPOA)
class DocumentoPOAAdmin(admin.ModelAdmin):  
    list_display = ('gestion', 'unidad_solicitante', 'programa', 'estado', 'elaborado_por', 'jefe_unidad', 'fecha_elaboracion')
    search_fields = ('programa', 'objetivo_gestion_institucional')
    list_filter = ('gestion', 'unidad_solicitante', 'estado')
    ordering = ('-gestion', 'unidad_solicitante', 'programa')   
    date_hierarchy = 'fecha_elaboracion'
    readonly_fields = ('creado_en', 'actualizado_en')
    fieldsets = (
        (None, {
            'fields': ('gestion', 'unidad_solicitante', 'programa', 'objetivo_gestion_institucional', 'estado', 'observaciones')
        }),
        ('Responsables', {
            'fields': ('elaborado_por', 'jefe_unidad')
        }),
        ('Fechas', {
            'fields': ('fecha_elaboracion', 'creado_en', 'actualizado_en')
        }),
    )


@admin.register(VersionDocumentoPOA)
class VersionDocumentoPOAAdmin(admin.ModelAdmin):
    list_display = ('documento', 'numero', 'vigente', 'creado_por', 'creado_en')
    list_filter = ('vigente',)
    readonly_fields = ('documento', 'numero', 'snapshot', 'motivo', 'creado_por', 'creado_en', 'vigente')


@admin.register(SeguimientoActividadPOA)
class SeguimientoActividadPOAAdmin(admin.ModelAdmin):
    list_display = ('actividad', 'estado_anterior', 'estado_nuevo', 'avance_porcentaje', 'registrado_por', 'registrado_en')
    list_filter = ('estado_nuevo',)
    readonly_fields = ('actividad', 'estado_anterior', 'estado_nuevo', 'avance_porcentaje', 'nota', 'registrado_por', 'registrado_en')


@admin.register(HistorialDocumentoPOA)
class HistorialDocumentoPOAAdmin(admin.ModelAdmin):
    list_display = ('documento', 'tipo_evento', 'usuario', 'estado_anterior', 'estado_nuevo', 'fecha')
    list_filter = ('tipo_evento', 'estado_nuevo')
    search_fields = ('documento__programa', 'descripcion', 'usuario__username')
    ordering = ('-fecha',)


@admin.register(ObservacionDocumentoPOA)
class ObservacionDocumentoPOAAdmin(admin.ModelAdmin):
    list_display = ('documento', 'ciclo_revision', 'resuelta', 'creado_por', 'creado_en', 'resuelto_por', 'resuelto_en')
    list_filter = ('resuelta', 'ciclo_revision')
    search_fields = ('documento__programa', 'texto')
    ordering = ('-creado_en',)


@admin.register(SolicitudCambioPOA)
class SolicitudCambioPOAAdmin(admin.ModelAdmin):
    list_display = ('documento', 'tipo_objeto', 'accion', 'estado', 'solicitado_por', 'revisado_por', 'creado_en', 'respondido_en')
    list_filter = ('tipo_objeto', 'accion', 'estado')
    search_fields = ('documento__programa', 'descripcion', 'solicitado_por__username')
    ordering = ('-creado_en',)
