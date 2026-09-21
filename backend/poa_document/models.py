# backend/core/models.py
from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.utils import timezone
from fondos.models import Carrera


class ItemCatalogo(models.Model):
    detalle = models.CharField(max_length=255, default='')
    unidad_medida = models.CharField(max_length=50, default='Sin unidad')
    partida = models.CharField(max_length=50, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['partida'], name='poa_item_partida_idx'),
        ]

    def __str__(self):
        return self.detalle


class IndicadorCatalogo(models.Model):
    indicador = models.CharField(max_length=500, unique=True, db_index=True)

    class Meta:
        ordering = ['indicador']

    def __str__(self):
        return self.indicador


class UsuarioPOA(models.Model):
    """
    Vincula a un usuario del sistema con un rol dentro del módulo POA.
    Actualmente solo se asigna el rol de elaborador.
    El campo docente es opcional para permitir usuarios que no son docentes.
    """
    ROL_CHOICES = [
        ('elaborador',      'Elaborador del POA'),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='accesos_poa',
        verbose_name='Usuario del sistema',
        null=True,
        blank=True,
    )
    docente = models.ForeignKey(
        'fondos.Docente',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='accesos_poa_docente',
        verbose_name='Docente vinculado',
    )
    carrera = models.ForeignKey(
        Carrera,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='accesos_poa',
        verbose_name='Carrera',
        help_text='Carrera a la que pertenece este acceso POA.',
    )
    rol = models.CharField(max_length=30, choices=ROL_CHOICES, verbose_name='Rol POA')
    nombre_entidad = models.CharField(
        max_length=150, blank=True,
        help_text='No se utiliza en la configuración actual del módulo POA.',
    )
    activo = models.BooleanField(default=True)
    fecha_asignacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Usuario POA'
        verbose_name_plural = 'Usuarios POA'
        ordering = ['rol', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'rol', 'carrera'],
                condition=models.Q(user__isnull=False),
                name='unique_user_rol_carrera_poa',
            ),
            models.UniqueConstraint(
                fields=['carrera', 'rol'],
                condition=models.Q(activo=True, rol='elaborador', carrera__isnull=False),
                name='unique_active_elaborador_poa_por_carrera',
            ),
        ]

    def __str__(self):
        if self.user:
            nombre = self.user.get_full_name() or self.user.username
            return f"{nombre} — {self.get_rol_display()}"
        if self.docente:
            return f"{self.docente.nombre_completo} — {self.get_rol_display()}"
        return f"UsuarioPOA #{self.pk} — {self.get_rol_display()}"


class ProgramaPOA(models.Model):
    """Programa interno de una carrera para clasificar sus documentos POA."""

    carrera = models.ForeignKey(
        Carrera,
        on_delete=models.PROTECT,
        related_name='programas_poa',
        verbose_name='Carrera',
    )
    nombre = models.CharField(max_length=200, verbose_name='Nombre del programa')
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Programa POA'
        verbose_name_plural = 'Programas POA'
        ordering = ['nombre', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['carrera', 'nombre'],
                name='unique_programa_poa_por_carrera',
            ),
        ]
        indexes = [
            models.Index(fields=['carrera', 'activo'], name='poa_prog_carr_act_idx'),
        ]

    def __str__(self):
        return f"{self.nombre} ({self.carrera})"


class DocumentoPOA(models.Model):
    ESTADO_CHOICES = [
        ('elaboracion', 'En elaboración'),
        ('revision',    'En revisión'),
        ('observado',   'Observado'),
        ('aprobado',    'Aprobado'),
        ('ejecucion',   'En ejecución'),
    ]

    gestion = models.IntegerField(verbose_name="Año de Gestión")
    unidad_solicitante = models.ForeignKey(
        Carrera,
        on_delete=models.PROTECT,
        related_name='documentos_poa',
        verbose_name='Carrera solicitante',
    )
    programa = models.CharField(max_length=200)
    objetivo_gestion_institucional = models.TextField()
    elaborado_por = models.CharField(max_length=255, blank=True, default='')
    jefe_unidad = models.CharField(max_length=255, blank=True, default='')
    fecha_elaboracion = models.DateField()
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='elaboracion', verbose_name='Estado')
    # Comentarios/ajustes que registra la entidad revisora durante la revisión del documento.
    observaciones = models.TextField(blank=True, default='')
    # Nota interna de formulación. No sustituye las observaciones del Director.
    observacion_elaboracion = models.TextField(blank=True, default='')
    ciclo_revision_actual = models.PositiveIntegerField(default=0)

    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        # Evitar duplicados exactos: misma gestión + misma unidad + mismo programa
        unique_together = ('gestion', 'unidad_solicitante', 'programa')
        indexes = [
            models.Index(fields=['gestion', 'unidad_solicitante'], name='poa_doc_gestion_unidad_idx'),
        ]

    def __str__(self):
        return f"{self.programa} ({self.gestion})"


class VersionDocumentoPOA(models.Model):
    """Instantánea inmutable de un POA aprobado o de un cambio autorizado."""
    documento = models.ForeignKey(DocumentoPOA, on_delete=models.CASCADE, related_name='versiones')
    numero = models.PositiveIntegerField()
    snapshot = models.JSONField(default=dict)
    motivo = models.TextField()
    creado_por = models.ForeignKey(User, on_delete=models.PROTECT, related_name='versiones_poa_creadas')
    creado_en = models.DateTimeField(auto_now_add=True)
    vigente = models.BooleanField(default=True)

    class Meta:
        ordering = ['-numero']
        constraints = [models.UniqueConstraint(fields=['documento', 'numero'], name='poa_version_documento_numero_unico')]

    def __str__(self):
        return f"{self.documento} - Versión {self.numero}"


class HistorialDocumentoPOA(models.Model):
    TIPO_EVENTO_CHOICES = [
        ('creacion', 'Creacion'),
        ('edicion', 'Edicion'),
        ('envio_revision', 'Envio a revision'),
        ('aprobacion_revision', 'Aprobacion de revision'),
        ('observacion_revision', 'Observacion de revision'),
        ('aprobacion_final', 'Aprobacion final'),
        ('inicio_ejecucion', 'Inicio de ejecucion'),
        ('solicitud_cambio', 'Solicitud de cambio'),
        ('aprobacion_cambio', 'Aprobacion de cambio'),
        ('rechazo_cambio', 'Rechazo de cambio'),
        ('evidencia', 'Evidencia'),
    ]

    documento = models.ForeignKey(DocumentoPOA, on_delete=models.CASCADE, related_name='historial')
    usuario = models.ForeignKey(User, on_delete=models.PROTECT, related_name='historial_documentos_poa')
    fecha = models.DateTimeField(auto_now_add=True)
    tipo_evento = models.CharField(max_length=30, choices=TIPO_EVENTO_CHOICES)
    descripcion = models.TextField()
    estado_anterior = models.CharField(max_length=30, blank=True)
    estado_nuevo = models.CharField(max_length=30, blank=True)
    datos_evento = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = 'Historial de Documento POA'
        verbose_name_plural = 'Historiales de Documento POA'
        ordering = ['-fecha']

    def __str__(self):
        return f"{self.get_tipo_evento_display()} - Documento {self.documento_id}"


class ObservacionDocumentoPOA(models.Model):
    documento = models.ForeignKey(DocumentoPOA, on_delete=models.CASCADE, related_name='observaciones_checklist')
    ciclo_revision = models.PositiveIntegerField(default=1)
    texto = models.TextField()
    creado_por = models.ForeignKey(User, on_delete=models.PROTECT, related_name='observaciones_poa_creadas')
    creado_en = models.DateTimeField(auto_now_add=True)
    resuelta = models.BooleanField(default=False)
    resuelto_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='observaciones_poa_resueltas',
    )
    resuelto_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Observacion de Documento POA'
        verbose_name_plural = 'Observaciones de Documento POA'
        ordering = ['ciclo_revision', 'id']
        indexes = [
            models.Index(fields=['documento', 'ciclo_revision']),
        ]

    def __str__(self):
        return f"Observacion #{self.pk} - Documento {self.documento_id}"


class SolicitudCambioPOA(models.Model):
    TIPO_OBJETO_CHOICES = [
        ('documento', 'Documento'),
        ('objetivo', 'Objetivo especifico'),
        ('actividad', 'Actividad'),
        ('presupuesto', 'Presupuesto'),
    ]

    ACCION_CHOICES = [
        ('crear', 'Crear'),
        ('editar', 'Editar'),
        ('eliminar', 'Eliminar'),
    ]

    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('aprobado', 'Aprobado'),
        ('rechazado', 'Rechazado'),
    ]

    documento = models.ForeignKey(DocumentoPOA, on_delete=models.CASCADE, related_name='solicitudes_cambio')
    tipo_objeto = models.CharField(max_length=20, choices=TIPO_OBJETO_CHOICES)
    objeto_id = models.PositiveIntegerField(null=True, blank=True)
    accion = models.CharField(max_length=20, choices=ACCION_CHOICES)
    payload = models.JSONField(default=dict, blank=True)
    resumen = models.JSONField(default=dict, blank=True)
    descripcion = models.TextField(blank=True, default='')
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')
    solicitado_por = models.ForeignKey(User, on_delete=models.PROTECT, related_name='solicitudes_cambio_poa')
    revisado_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='solicitudes_cambio_poa_revisadas',
    )
    respuesta = models.TextField(blank=True, default='')
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)
    respondido_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Solicitud de Cambio POA'
        verbose_name_plural = 'Solicitudes de Cambio POA'
        ordering = ['-creado_en']
        indexes = [
            models.Index(fields=['documento', 'estado']),
            models.Index(fields=['tipo_objeto', 'objeto_id']),
        ]

    def __str__(self):
        return f"Solicitud #{self.pk} - {self.tipo_objeto} {self.accion}"

#objetivos especificos que pertenece a un solo documento poa

class ObjetivoEspecifico(models.Model):
    documento = models.ForeignKey(DocumentoPOA, on_delete=models.CASCADE, related_name="objetivos")
    codigo = models.CharField(max_length=20, blank=True)
    descripcion = models.TextField()

    def __str__(self):
        return f"{self.codigo}: {self.descripcion[:50]}..."
    

#actividades que pertenece a un solo objetivo especifico    

class Actividad(models.Model):
    ESTADOS = [
        ('programado', 'Programado'),
        ('en_ejecucion', 'En ejecución'),
        ('completado', 'Completado'),
        ('cancelado', 'Cancelado'),
    ]

    UNIDADES_INDICADOR = [
        ('numero', 'Número'),
        ('porcentaje', 'Porcentaje'),
    ]

    objetivo = models.ForeignKey(ObjetivoEspecifico, on_delete=models.CASCADE, related_name="actividades")
    codigo = models.CharField(max_length=20)  # 510-0-1
    nombre = models.CharField(max_length=300)
    responsable = models.CharField(max_length=500)
    productos_esperados = models.TextField()
    mes_inicio = models.CharField(max_length=20)
    mes_fin = models.CharField(max_length=20)
    # Ahora almacenamos la descripción del indicador como texto libre (no FK)
    indicador_descripcion = models.TextField(null=True, blank=True)
    indicador_unidad = models.CharField(max_length=50, choices=UNIDADES_INDICADOR, default='numero')
    indicador_linea_base = models.IntegerField()
    indicador_meta = models.IntegerField()
    # Plan de metas, por ejemplo [{"periodo": "Enero", "meta": 10}].
    # Se almacena en la actividad para que la planificación permanezca autocontenida.
    riesgo_previsto = models.TextField(blank=True, default='')
    monto_funcion = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    monto_inversion = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    estado = models.CharField(max_length=20, choices=ESTADOS, default='programado')

    @property
    def indicador_descripcion_texto(self):
        """Retorna solo la descripción del indicador"""
        # Antes indicador_descripcion era FK; ahora es texto, así que lo devolvemos directamente
        return self.indicador_descripcion if self.indicador_descripcion else None
    # Ya no validamos por FK en save() porque ahora se almacena texto libre.

    def __str__(self):
        return f"{self.codigo} - {self.nombre}"


class SeguimientoActividadPOA(models.Model):
    """Bitácora breve de ejecución; no otorga acceso al receptor o responsable."""
    actividad = models.ForeignKey(Actividad, on_delete=models.CASCADE, related_name='seguimientos')
    estado_anterior = models.CharField(max_length=20, blank=True, default='')
    estado_nuevo = models.CharField(max_length=20, choices=Actividad.ESTADOS)
    avance_porcentaje = models.PositiveSmallIntegerField(default=0)
    nota = models.TextField(blank=True, default='')
    registrado_por = models.ForeignKey(User, on_delete=models.PROTECT, related_name='seguimientos_actividad_poa')
    registrado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-registrado_en']
        indexes = [models.Index(fields=['actividad', 'registrado_en'], name='poa_documen_activid_a53145_idx')]



#detalle de los presupuestos solicitados por actividad

class DetallePresupuesto(models.Model):
    actividad = models.ForeignKey(Actividad, on_delete=models.CASCADE, related_name='detalles_presupuesto')
    TIPOS = [
        ('funcion', 'Funcionamiento'),
        ('funcionamiento', 'Funcionamiento'),  # alias para front
        ('inversion', 'Inversión'),
    ]
    tipo = models.CharField(max_length=20, choices=TIPOS, default='funcion', db_index=True)
    # Guardaremos los códigos/etiquetas como texto corto (no FK).
    # Usamos CharField para preservar formatos como ceros a la izquierda y
    # para mejorar búsquedas y validación en formularios.
    partida = models.CharField(max_length=50, db_index=True)
    item = models.CharField(max_length=150)
    unidad_medida = models.CharField(max_length=50)
    caracteristicas = models.TextField(blank=True)
    # En desarrollo se solicita que la cantidad sea un entero (número de unidades)
    cantidad = models.IntegerField()
    costo_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    costo_total = models.DecimalField(max_digits=12, decimal_places=2)
    mes_requerimiento = models.CharField(max_length=50)

    def save(self, *args, **kwargs):
        self.costo_total = self.cantidad * self.costo_unitario
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.actividad} - {self.item} ({self.cantidad})"


class OrdenCompraPOA(models.Model):
    ESTADOS = [('borrador', 'Borrador'), ('emitida', 'Emitida'), ('recibiendo', 'Recibiendo'), ('recibida', 'Recibida'), ('cancelada', 'Cancelada')]
    carrera = models.ForeignKey(Carrera, on_delete=models.PROTECT, related_name='ordenes_compra_poa')
    gestion = models.PositiveIntegerField()
    numero = models.CharField(max_length=80)
    proveedor = models.CharField(max_length=255)
    fecha = models.DateField()
    estado = models.CharField(max_length=20, choices=ESTADOS, default='emitida')
    respaldo = models.FileField(upload_to='poa/compras/%Y/%m', null=True, blank=True)
    observacion = models.TextField(blank=True, default='')
    creado_por = models.ForeignKey(User, on_delete=models.PROTECT, related_name='ordenes_compra_poa_creadas')
    creado_en = models.DateTimeField(auto_now_add=True)
    anulado_por = models.ForeignKey(User, on_delete=models.PROTECT, null=True, blank=True, related_name='ordenes_compra_poa_anuladas')
    motivo_anulacion = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-fecha', '-id']
        constraints = [models.UniqueConstraint(fields=['carrera', 'gestion', 'numero'], name='poa_orden_numero_carrera_gestion')]


class DetalleOrdenCompraPOA(models.Model):
    orden = models.ForeignKey(OrdenCompraPOA, on_delete=models.PROTECT, related_name='detalles')
    partida = models.CharField(max_length=50)
    item = models.CharField(max_length=150)
    unidad_medida = models.CharField(max_length=50)
    caracteristicas = models.TextField(blank=True, default='')
    tipo = models.CharField(max_length=20)
    cantidad_planificada = models.PositiveIntegerField()
    cantidad_comprada = models.PositiveIntegerField()
    costo_unitario_real = models.DecimalField(max_digits=12, decimal_places=2)
    origen_detalles = models.JSONField(default=list)  # IDs de presupuesto incluidos, como trazabilidad de origen.

    @property
    def costo_total_real(self):
        return self.cantidad_comprada * self.costo_unitario_real


class RecepcionMaterialPOA(models.Model):
    orden = models.ForeignKey(OrdenCompraPOA, on_delete=models.PROTECT, related_name='recepciones')
    fecha = models.DateField()
    numero_respaldo = models.CharField(max_length=100, blank=True, default='')
    recibido_por = models.CharField(max_length=255)
    respaldo = models.FileField(upload_to='poa/recepciones/%Y/%m', null=True, blank=True)
    observacion = models.TextField(blank=True, default='')
    registrado_por = models.ForeignKey(User, on_delete=models.PROTECT, related_name='recepciones_poa_registradas')
    registrado_en = models.DateTimeField(auto_now_add=True)
    anulada = models.BooleanField(default=False)
    motivo_anulacion = models.TextField(blank=True, default='')

    class Meta: ordering = ['-fecha', '-id']


class DetalleRecepcionMaterialPOA(models.Model):
    recepcion = models.ForeignKey(RecepcionMaterialPOA, on_delete=models.PROTECT, related_name='detalles')
    detalle_orden = models.ForeignKey(DetalleOrdenCompraPOA, on_delete=models.PROTECT, related_name='recepciones_detalle')
    cantidad_recibida = models.PositiveIntegerField()
    costo_unitario_real = models.DecimalField(max_digits=12, decimal_places=2)


class EntregaMaterialActividad(models.Model):
    detalle_recepcion = models.ForeignKey(DetalleRecepcionMaterialPOA, on_delete=models.PROTECT, related_name='entregas')
    actividad = models.ForeignKey(Actividad, on_delete=models.PROTECT, related_name='entregas_material')
    cantidad_entregada = models.PositiveIntegerField()
    fecha = models.DateField()
    nombre_receptor = models.CharField(max_length=255)
    ci_receptor = models.CharField(max_length=50, blank=True, default='')
    cargo_receptor = models.CharField(max_length=255, blank=True, default='')
    telefono_receptor = models.CharField(max_length=50, blank=True, default='')
    acta_archivo = models.FileField(upload_to='poa/entregas/%Y/%m', null=True, blank=True)
    observacion = models.TextField(blank=True, default='')
    registrado_por = models.ForeignKey(User, on_delete=models.PROTECT, related_name='entregas_material_poa_registradas')
    registrado_en = models.DateTimeField(auto_now_add=True)
    anulada = models.BooleanField(default=False)
    motivo_anulacion = models.TextField(blank=True, default='')

    class Meta: ordering = ['-fecha', '-id']


class MensajeChat(models.Model):
    """Mensaje directo independiente entre dos usuarios del sistema."""

    emisor = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='mensajes_chat_enviados',
        verbose_name='Emisor',
    )
    receptor = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='mensajes_chat_recibidos',
        verbose_name='Receptor',
    )
    texto = models.TextField(verbose_name='Mensaje')
    fecha = models.DateTimeField(auto_now_add=True)
    leido_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Mensaje de chat'
        verbose_name_plural = 'Mensajes de chat'
        ordering = ['fecha']
        db_table = 'mensajes_chat'
        indexes = [
            models.Index(fields=['emisor', 'receptor', 'fecha']),
            models.Index(fields=['receptor', 'emisor', 'fecha']),
        ]

    def marcar_como_leido(self):
        if not self.leido_en:
            self.leido_en = timezone.now()
            self.save(update_fields=['leido_en'])

    def __str__(self):
        return f"{self.emisor.username} → {self.receptor.username} ({self.fecha.strftime('%d/%m/%Y %H:%M')})"


class BloqueoChat(models.Model):
    """Registro de bloqueo entre usuarios para chat directo."""

    bloqueador = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='bloqueos_chat_realizados',
        verbose_name='Usuario que bloquea',
    )
    bloqueado = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='bloqueos_chat_recibidos',
        verbose_name='Usuario bloqueado',
    )
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Bloqueo de chat'
        verbose_name_plural = 'Bloqueos de chat'
        db_table = 'bloqueos_chat'
        unique_together = ('bloqueador', 'bloqueado')
        indexes = [
            models.Index(fields=['bloqueador', 'bloqueado']),
        ]

    def clean(self):
        if self.bloqueador_id and self.bloqueado_id and self.bloqueador_id == self.bloqueado_id:
            raise ValidationError('No se puede bloquear al mismo usuario.')

    def __str__(self):
        return f"{self.bloqueador.username} bloqueó a {self.bloqueado.username}"


class Evidencia(models.Model):
    """Evidencias asociadas a una actividad POA."""
    actividad = models.ForeignKey(
        Actividad,
        on_delete=models.CASCADE,
        related_name='evidencias',
        verbose_name='Actividad',
    )
    resultados_logrados = models.TextField(blank=True, default='', verbose_name='Resultados logrados')
    programado = models.IntegerField(default=0, verbose_name='Programado')
    ejecutado = models.IntegerField(default=0, verbose_name='Ejecutado')
    grado_cumplimiento = models.DecimalField(max_digits=5, decimal_places=2, default=0.0, verbose_name='Grado de cumplimiento (%)')
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Evidencia de actividad'
        verbose_name_plural = 'Evidencias de actividad'
        ordering = ['-creado_en']

    def __str__(self):
        return f"Evidencia #{self.pk} - Actividad {self.actividad_id} - {self.creado_en.date()}"


class EvidenciaArchivo(models.Model):
    """Archivos / enlaces que validan una evidencia."""
    TIPOS = [
        ('imagen', 'Imagen'),
        ('link', 'Link'),
    ]
    evidencia = models.ForeignKey(Evidencia, on_delete=models.CASCADE, related_name='archivos')
    tipo = models.CharField(max_length=16, choices=TIPOS, default='imagen')
    archivo = models.FileField(upload_to='evidencias/%Y/%m', null=True, blank=True)
    url = models.URLField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Archivo de evidencia'
        verbose_name_plural = 'Archivos de evidencia'
        ordering = ['-creado_en']

    def __str__(self):
        if self.tipo == 'link':
            return f"Link: {self.url}"
        return f"Archivo: {self.archivo.name if self.archivo else 'sin archivo'}"
