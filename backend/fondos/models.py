from django.db import models
from datetime import date
from decimal import Decimal
from django.core.validators import MinValueValidator, MaxValueValidator, MinLengthValidator, FileExtensionValidator
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.utils import timezone
from django.conf import settings
from django.db.models.functions import Lower, Trim
from simple_history.models import HistoricalRecords
from cryptography.fernet import Fernet, InvalidToken, MultiFernet
import base64
import hashlib
import mimetypes
import os


def _get_image_cipher():
    """Cifrador de fotos de perfil y logos de carrera.

    Cifra con PROFILE_IMAGE_ENCRYPTION_KEY si está definida y descifra también
    con la clave derivada de SECRET_KEY, que es la que se usó históricamente,
    para no perder las imágenes ya guardadas al configurar una clave propia.
    """
    legacy_key = base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode('utf-8')).digest())
    key_from_env = getattr(settings, 'PROFILE_IMAGE_ENCRYPTION_KEY', '')
    if not key_from_env:
        return Fernet(legacy_key)
    key = key_from_env.encode('utf-8') if isinstance(key_from_env, str) else key_from_env
    return MultiFernet([Fernet(key), Fernet(legacy_key)])


# ================================================================
# Imágenes de perfil y logos de carrera en MEDIA
#
# Se guardan como archivos organizados por carpeta:
#   media/carreras/carrera_<id>/logo.<ext>
#   media/usuarios/usuario_<id>/foto_perfil.<ext>
# La API las sigue entregando como data URI (mismo contrato que antes), así
# que el frontend y los PDF no cambian. Las imágenes antiguas guardadas
# cifradas en la BD se siguen leyendo hasta pasarlas a media con
# `python manage.py organizar_media`.
# ================================================================

def _extension_imagen(filename, mime=''):
    ext = os.path.splitext(filename or '')[1].lower()
    if ext:
        return ext
    return mimetypes.guess_extension(mime or '') or '.jpg'


def logo_carrera_upload_path(instance, filename):
    return f'carreras/carrera_{instance.pk or "nueva"}/logo{_extension_imagen(filename)}'


def foto_perfil_upload_path(instance, filename):
    return f'usuarios/usuario_{instance.user_id or "sin_usuario"}/foto_perfil{_extension_imagen(filename)}'


def _imagen_a_data_uri(field_file, mime=''):
    """Lee un ImageField del almacenamiento y lo devuelve como data URI."""
    if not field_file or not field_file.name:
        return None
    try:
        with field_file.storage.open(field_file.name, 'rb') as archivo:
            contenido = archivo.read()
    except OSError:
        return None
    mime = mime or mimetypes.guess_type(field_file.name)[0] or 'image/jpeg'
    return f"data:{mime};base64,{base64.b64encode(contenido).decode('ascii')}"


def _descifrar_imagen_legado(cifrada, mime=''):
    """Data URI de una imagen del almacenamiento antiguo (cifrada en la BD)."""
    if not cifrada:
        return None
    try:
        contenido = _get_image_cipher().decrypt(bytes(cifrada))
    except InvalidToken:
        return None
    return f"data:{mime or 'image/jpeg'};base64,{base64.b64encode(contenido).decode('ascii')}"


def _guardar_imagen(field_file, uploaded_file):
    """Reemplaza el archivo de un ImageField por la imagen subida."""
    if not uploaded_file or not getattr(uploaded_file, 'size', 0):
        raise ValidationError("La imagen está vacía.")
    if field_file and field_file.name:
        field_file.delete(save=False)
    field_file.save(os.path.basename(uploaded_file.name or 'imagen'), uploaded_file, save=False)


MENSAJE_INCOMPATIBILIDAD_DEDICACION_GESTION = (
    'Según normativa UABJB, los cargos de gestión (Director/Jefe/Instituto) '
    'solo son compatibles con docencia a Tiempo Horario. '
    'No se permite dedicación Tiempo Completo o Medio Tiempo.'
)


CARGA_SEMANAL_ROL_GESTION = {
    'iiisyp': Decimal('40'),
    'director': Decimal('40'),
    'jefe_estudios': Decimal('40'),
}

TOPE_HORAS_SEMANALES_FONDO = Decimal('40')

# Las dedicaciones "horario" figuran en RR.HH. en horas MENSUALES ("24 HRS MES").
# El sistema trabaja en horas semanales: se dividen entre las semanas del mes.
SEMANAS_POR_MES = Decimal('4')

HORAS_MENSUALES_DEDICACION_HORARIO = {
    'horario_16': Decimal('16'),
    'horario_24': Decimal('24'),
    'horario_40': Decimal('40'),
    'horario_48': Decimal('48'),
}

SEMANAS_POR_ANIO = 52
DIAS_LABORABLES_POR_SEMANA = Decimal('5')
# Estados en los que el fondo ya fue presentado: su contenido queda congelado.
ESTADOS_FONDO_BLOQUEADOS = [
    'presentado_director',
    'aprobado_director',
    'en_ejecucion',
    'informe_presentado',
    'finalizado',
    'archivado',
]


def calcular_horas_fondo(horas_semana, dias_vacacion, dias_feriados):
    """Horas anuales del fondo de tiempo.

    Vacaciones y feriados (CalendarioAcademico.dias_feriados_gestion) se
    descuentan proporcionales a la jornada diaria (horas semanales / 5): un
    tiempo completo (8 h/día) con 20 días de vacación descuenta 160 h. Cada
    término se redondea hacia abajo.
    La vista previa del frontend (utils/horasFondo.js) replica esta función.
    """
    horas_semana = Decimal(str(horas_semana))
    horas_diarias = horas_semana / DIAS_LABORABLES_POR_SEMANA
    contrato_horas = int(horas_semana * SEMANAS_POR_ANIO)
    horas_vacacion = int(Decimal(dias_vacacion) * horas_diarias)
    horas_feriados = int(Decimal(dias_feriados) * horas_diarias)
    return {
        'contrato_horas': contrato_horas,
        'horas_vacacion': horas_vacacion,
        'horas_feriados': horas_feriados,
        'horas_efectivas': max(contrato_horas - horas_vacacion - horas_feriados, 0),
    }


HORAS_SEMANALES_DEDICACION = {
    'tiempo_completo': Decimal('40'),
    'medio_tiempo': Decimal('20'),
    **{
        dedicacion: horas_mes / SEMANAS_POR_MES
        for dedicacion, horas_mes in HORAS_MENSUALES_DEDICACION_HORARIO.items()
    },
    # dedicacion_exclusiva: 0 (exenta de fondo de tiempo)
}


def actualizar_con_historial(queryset, **campos):
    """Como queryset.update(**campos), pero guardando objeto por objeto para que
    quede historial (HistoricalRecords) con el usuario que hizo el cambio."""
    for obj in queryset:
        for campo, valor in campos.items():
            setattr(obj, campo, valor)
        obj.save(update_fields=list(campos))


def inicio_de_gestion(fechas_inicio, gestion):
    """Inicio de la gestión: la fecha de inicio más temprana de sus calendarios o, sin
    calendarios, el 1 de enero. La vista previa (utils/horasFondo.js) usa la misma regla."""
    fechas = [fecha for fecha in fechas_inicio if fecha]
    return min(fechas) if fechas else date(gestion, 1, 1)


def fecha_referencia_antiguedad(valor=None):
    """Fecha a la que se mide la antigüedad: una fecha, una gestión (1 de enero) o hoy."""
    if valor is None:
        return timezone.localdate()
    if isinstance(valor, int):
        return date(valor, 1, 1)
    return valor.date() if hasattr(valor, 'date') and callable(valor.date) else valor


class DatosLaborales(models.Model):
    """
    'ADN Laboral' universal para cualquier persona que trabaja en la U.A.B.J.B.

    Este modelo centraliza los datos de empleo que antes estaban en Docente:
    - CI (Cédula de Identidad)
    - Fecha de ingreso (base para cálculo de antigüedad)
    - Días de vacación (según antigüedad, Art. 11 y 24)
    - Horas de feriados de la gestión

    Sirve para TODOS los roles: Docente, Director, Jefe de Estudios, IIISYP.
    Una sola persona = un solo registro de DatosLaborales, sin importar
    cuántos roles tenga.
    """

    ci = models.CharField(
        max_length=20,
        unique=True,
        verbose_name="Cédula de Identidad"
    )
    fecha_ingreso = models.DateField(
        default=timezone.now,
        help_text="Fecha de ingreso a la institución para cálculo de antigüedad"
    )
    # Se recalcula en cada save() a partir de fecha_ingreso (ver calcular_dias_vacacion).
    dias_vacacion = models.IntegerField(
        default=15,
        help_text="Días de vacación correspondientes según antigüedad"
    )

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_modificacion = models.DateTimeField(auto_now=True)

    # Auditoría: quién cambió qué y cuándo (usuario vía HistoryRequestMiddleware).
    history = HistoricalRecords()

    class Meta:
        verbose_name = "Datos Laborales"
        verbose_name_plural = "Datos Laborales"
        ordering = ['-fecha_creacion']

    def __str__(self):
        return f"{self.ci} - Ingreso: {self.fecha_ingreso}"

    def calcular_antiguedad(self, fecha_referencia=None):
        """Años COMPLETOS cumplidos a la fecha de referencia (mira día y mes).

        fecha_referencia: una fecha, una gestión (año: se toma el 1 de enero) o
        None (hoy). Para un fondo se usa el inicio de su gestión
        (FondoTiempo.fecha_referencia_antiguedad).
        """
        referencia = fecha_referencia_antiguedad(fecha_referencia)
        if not self.fecha_ingreso:
            return 0
        ingreso = self.fecha_ingreso
        anios = referencia.year - ingreso.year - ((referencia.month, referencia.day) < (ingreso.month, ingreso.day))
        return max(0, anios)

    def calcular_dias_vacacion(self, fecha_referencia=None):
        """Días hábiles de vacación según antigüedad (Art. 11 y 24).

        Menos de 1 año: 0; de 1 a 5 años: 15; de 5 a 10 años: 20; desde 10 años: 30.
        """
        antiguedad = self.calcular_antiguedad(fecha_referencia)
        if antiguedad >= 10:
            return 30
        if antiguedad >= 5:
            return 20
        if antiguedad >= 1:
            return 15
        return 0

    def save(self, *args, **kwargs):
        # Los días de vacación no se escriben a mano: salen de la fecha de ingreso.
        self.dias_vacacion = self.calcular_dias_vacacion()
        update_fields = kwargs.get('update_fields')
        if update_fields is not None:
            kwargs['update_fields'] = set(update_fields) | {'dias_vacacion'}
        super().save(*args, **kwargs)

    def clean(self):
        """Validaciones personalizadas."""
        super().clean()

        if self.fecha_ingreso:
            fecha_fundacion = timezone.localdate().replace(year=1967, month=11, day=18)
            hoy = timezone.localdate()
            if self.fecha_ingreso > hoy:
                raise ValidationError({
                    'fecha_ingreso': 'La fecha de ingreso no puede ser una fecha futura.'
                })
            if self.fecha_ingreso < fecha_fundacion:
                raise ValidationError({
                    'fecha_ingreso': 'La fecha de ingreso no puede ser anterior a la fundación de la UABJB (18 de noviembre de 1967).'
                })


class Docente(models.Model):
    """Modelo para almacenar información personal de docentes (sin carrera).

    Los datos de empleo (vacaciones, feriados, fecha_ingreso, CI) ahora
    viven en DatosLaborales. Este modelo se enfoca en la identidad
    académica del docente.
    """

    CATEGORIA_CHOICES = [
        ('catedratico', 'Catedrático'),
        ('adjunto', 'Adjunto'),
        ('asistente', 'Asistente'),
    ]

    DEDICACION_CHOICES = [
        ('tiempo_completo', 'Tiempo Completo'),
        ('medio_tiempo', 'Medio Tiempo'),
        ('horario_16', 'Horario 16 hrs/mes'),
        ('horario_24', 'Horario 24 hrs/mes'),
        ('horario_40', 'Horario 40 hrs/mes'),
        ('horario_48', 'Horario 48 hrs/mes'),
        ('dedicacion_exclusiva', 'Dedicacion Exclusiva'),
    ]

    user = models.OneToOneField(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='docente_relacion',
        help_text="Usuario del sistema vinculado al docente"
    )

    # === Datos legacy de compatibilidad ===
    nombres = models.CharField(max_length=100, blank=True, default='')
    apellido_paterno = models.CharField(max_length=100, blank=True, default='')
    apellido_materno = models.CharField(max_length=100, blank=True, default='')

    # === Datos laborales compartidos ===
    datos_laborales = models.OneToOneField(
        DatosLaborales,
        on_delete=models.CASCADE,
        related_name='docente',
        help_text="Datos de empleo compartidos (CI, vacaciones, feriados, antigüedad)"
    )

    # === Contacto ===
    email = models.EmailField(blank=True, null=True)
    telefono = models.CharField(max_length=20, blank=True, null=True)

    activo = models.BooleanField(
        default=True,
        help_text="Indica si el docente está activo en la institución"
    )

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_modificacion = models.DateTimeField(auto_now=True)

    # Auditoría: quién cambió qué y cuándo (usuario vía HistoryRequestMiddleware).
    history = HistoricalRecords()

    class Meta:
        verbose_name = "Docente"
        verbose_name_plural = "Docentes"
        ordering = ['apellido_paterno', 'apellido_materno', 'nombres']

    def __str__(self):
        return self.nombre_completo or f"Docente #{self.pk}"

    @property
    def nombre_completo(self):
        if self.user_id:
            full_name = self.user.get_full_name().strip()
            if full_name:
                return full_name
            return self.user.username
        return f"{self.nombres} {self.apellido_paterno} {self.apellido_materno}".strip()

    @property
    def correo_institucional(self):
        if self.user_id:
            return self.user.email
        return self.email

    @property
    def ci(self):
        """Propiedad de compatibilidad: accede al CI desde DatosLaborales."""
        return self.datos_laborales.ci if self.datos_laborales else None

    @property
    def fecha_ingreso(self):
        """Propiedad de compatibilidad: accede a fecha_ingreso desde DatosLaborales."""
        return self.datos_laborales.fecha_ingreso if self.datos_laborales else None

    @property
    def dias_vacacion(self):
        """Días de vacación según la antigüedad (DatosLaborales.fecha_ingreso)."""
        return self.datos_laborales.calcular_dias_vacacion() if self.datos_laborales else 0

    @dias_vacacion.setter
    def dias_vacacion(self, value):
        """Setter de compatibilidad para tests y código legacy."""
        if self.datos_laborales:
            self.datos_laborales.dias_vacacion = value
            self.datos_laborales.save()


    def calcular_antiguedad(self, fecha_referencia=None):
        """Años completos de antigüedad (ver DatosLaborales.calcular_antiguedad)."""
        if self.datos_laborales:
            return self.datos_laborales.calcular_antiguedad(fecha_referencia)
        return 0

    def calcular_dias_vacacion(self, fecha_referencia=None):
        """Días de vacación según antigüedad (Art. 11 y 24)."""
        if self.datos_laborales:
            return self.datos_laborales.calcular_dias_vacacion(fecha_referencia)
        return 0


class DocenteCarrera(models.Model):
    """Vínculo de un docente con una carrera específica.

    Un mismo Docente puede tener múltiples DocenteCarrera,
    cada uno con su propia categoría y dedicación.
    """

    CONDICION_CHOICES = [
        ('titular', 'Titular'),
        ('invitado', 'Invitado'),
    ]

    docente = models.ForeignKey(
        Docente,
        on_delete=models.CASCADE,
        related_name='vinculos_carrera'
    )
    carrera = models.ForeignKey(
        'Carrera',
        on_delete=models.PROTECT,
        related_name='docentes_carrera'
    )

    # === Datos específicos del vínculo con esta carrera ===
    categoria = models.CharField(max_length=20, choices=Docente.CATEGORIA_CHOICES)
    dedicacion = models.CharField(max_length=20, choices=Docente.DEDICACION_CHOICES)
    es_exento_fondo_tiempo = models.BooleanField(default=False)
    condicion = models.CharField(max_length=10, choices=CONDICION_CHOICES, default='titular', blank=False)
    activo = models.BooleanField(default=True)

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_modificacion = models.DateTimeField(auto_now=True)

    # Auditoría: quién cambió qué y cuándo (usuario vía HistoryRequestMiddleware).
    history = HistoricalRecords()

    class Meta:
        verbose_name = "Vínculo Docente-Carrera"
        verbose_name_plural = "Vínculos Docente-Carrera"
        unique_together = ['docente', 'carrera']
        ordering = ['carrera__nombre', 'docente__apellido_paterno']

    def __str__(self):
        return f"{self.docente.nombre_completo} — {self.carrera.nombre}"

    @property
    def horas_semanales_maximas(self):
        """Horas semanales según la dedicación (las de horario vienen en horas/mes)."""
        return HORAS_SEMANALES_DEDICACION.get(self.dedicacion, Decimal('0'))

    def clean(self):
        from django.core.exceptions import ValidationError
        super().clean()

        user_ids = set()
        if self.docente and self.docente.user_id:
            user_ids.add(self.docente.user_id)

        perfiles_relacionados = PerfilUsuario.objects.filter(
            docente=self.docente,
            user__isnull=False,
            activo=True,
        ).values_list('user_id', flat=True)
        user_ids.update(user_id for user_id in perfiles_relacionados if user_id)

        roles_asignacion = set(AsignacionCarrera.objects.filter(
            user_id__in=user_ids,
            activo=True,
        ).values_list('rol', flat=True)) if user_ids else set()
        roles_perfil = set(PerfilUsuario.objects.filter(
            user_id__in=user_ids,
            activo=True,
        ).values_list('rol', flat=True)) if user_ids else set()
        roles_activos = roles_asignacion | roles_perfil
        tiene_rol_docente = 'docente' in roles_activos
        tiene_rol_director = 'director' in roles_activos

        if self.dedicacion == 'dedicacion_exclusiva' and tiene_rol_docente:
            raise ValidationError({
                'dedicacion': 'Los usuarios con rol docente deben registrar dedicacion a Tiempo Horario.'
            })

        if self.dedicacion == 'dedicacion_exclusiva' and not tiene_rol_director:
            raise ValidationError({
                'dedicacion': 'La dedicacion exclusiva solo aplica al Director de Carrera.'
            })

        if self.dedicacion in {'tiempo_completo', 'medio_tiempo'}:
            tiene_rol_gestion = bool(roles_activos & {'iiisyp', 'director', 'jefe_estudios'})

            if tiene_rol_gestion and tiene_rol_docente:
                raise ValidationError({
                    'dedicacion': MENSAJE_INCOMPATIBILIDAD_DEDICACION_GESTION
                })

        # Un docente tiene UN solo vínculo activo (una dedicación), en la carrera de su usuario.
        otros = DocenteCarrera.objects.filter(docente=self.docente, activo=True)
        if self.pk:
            otros = otros.exclude(pk=self.pk)
        otro = otros.select_related('carrera').first() if self.activo else None
        if otro:
            raise ValidationError({
                'carrera': (
                    f'El docente ya tiene su vínculo en {otro.carrera.nombre}: '
                    'un docente tiene un solo vínculo, en la carrera de su usuario.'
                )
            })

        # Tope de horas semanales de su único vínculo.
        if self.horas_semanales_maximas > TOPE_HORAS_SEMANALES_FONDO:
            raise ValidationError({
                'dedicacion': f'La dedicación supera el límite de {TOPE_HORAS_SEMANALES_FONDO:g} h/semana.'
            })

    def save(self, *args, **kwargs):
        """Garantiza que full_clean() (y por tanto clean()) se ejecute antes de guardar."""
        self.es_exento_fondo_tiempo = self.dedicacion == 'dedicacion_exclusiva'
        update_fields = kwargs.get('update_fields')
        if update_fields is not None and 'dedicacion' in update_fields:
            kwargs['update_fields'] = set(update_fields) | {'es_exento_fondo_tiempo'}
        self.full_clean()
        return super().save(*args, **kwargs)


class SaldoVacacionesGestion(models.Model):
    """
    Saldo de vacaciones por docente y gestión académica.
    Permite especificar de forma granular los días de vacación disponibles
    para cada docente en cada año/gestión.
    """
    docente = models.ForeignKey(Docente, on_delete=models.PROTECT, related_name='saldos_vacaciones')
    gestion = models.IntegerField(
        validators=[MinValueValidator(2020), MaxValueValidator(2100)],
        help_text="Año/Gestión académica"
    )
    dias_disponibles = models.IntegerField(
        help_text="Días de vacación disponibles para esta gestión"
    )
    
    class Meta:
        verbose_name = "Saldo de Vacaciones"
        verbose_name_plural = "Saldos de Vacaciones"
        unique_together = ['docente', 'gestion']
        ordering = ['-gestion', 'docente']
    
    def __str__(self):
        return f"{self.docente.nombre_completo} - {self.gestion}: {self.dias_disponibles} días"
    
    def clean(self):
        """
        Validar que si hay FondoDeTiempo aprobados para este docente en esta gestión,
        NO se permita cambiar el saldo de vacaciones (consistencia regulatoria).
        """
        super().clean()
        
        # Solo validar si el objeto ya existe (está siendo actualizado)
        if self.pk:
            saldo_anterior = SaldoVacacionesGestion.objects.get(pk=self.pk)
            
            # Si los días cambiaron
            if saldo_anterior.dias_disponibles != self.dias_disponibles:
                # Verificar si hay fondos aprobados
                fondos_aprobados = FondoTiempo.objects.filter(
                    docente=self.docente,
                    gestion=self.gestion,
                    estado='aprobado_director'
                ).count()
                
                if fondos_aprobados > 0:
                    raise ValidationError({
                        'dias_disponibles': (
                            f'⚠️ NO SE PUEDE MODIFICAR: Hay {fondos_aprobados} Fondo(s) de Tiempo '
                            f'aprobado(s) para este docente en la gestión {self.gestion}. '
                            f'Cambiar el saldo de vacaciones desalinearía las horas_efectivas '
                            f'legalmente aprobadas. Contacte al administrador si necesita corregir.'
                        )
                    })
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class FacultadCatalogo(models.Model):
    """Catálogo editable de facultades para formularios de carrera."""

    nombre = models.CharField(max_length=200, unique=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Facultad"
        verbose_name_plural = "Facultades"
        ordering = ['nombre']

    def __str__(self):
        return self.nombre

    @staticmethod
    def _normalizar(texto):
        """Normaliza texto: minúsculas, sin tildes, sin espacios extra."""
        import unicodedata
        texto = texto.strip().lower()
        texto = unicodedata.normalize('NFKD', texto).encode('ascii', 'ignore').decode('ascii')
        return ' '.join(texto.split())

    def clean(self):
        from django.core.exceptions import ValidationError
        super().clean()
        if not self.nombre or not self.nombre.strip():
            raise ValidationError({'nombre': 'El nombre de la facultad es obligatorio.'})

        nombre_normalizado = self._normalizar(self.nombre)

        # Comparar con todos los registros existentes ignorando mayúsculas y acentos
        qs = FacultadCatalogo.objects.all()
        if self.pk:
            qs = qs.exclude(pk=self.pk)
        for fac in qs:
            if self._normalizar(fac.nombre) == nombre_normalizado:
                raise ValidationError({
                    'nombre': f'Ya existe una facultad con nombre equivalente: "{fac.nombre}".'
                })

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class Carrera(models.Model):
    """Carreras de la universidad"""

    DEFAULT_FACULTADES = [
        'Facultad de Ciencias Pecuarias',
        'Facultad de Ciencias de la Salud',
        'Facultad de Ciencias Económicas',
        'Facultad de Humanidades y Ciencias de la Educación',
        'Facultad de Ciencias Jurídicas, Políticas y Sociales',
        'Facultad de Ingeniería y Tecnología',
        'Facultad de Ciencias Agrícolas',
        'Facultad de Ciencias Forestales',
    ]
    
    nombre = models.CharField(max_length=200, unique=True)
    codigo = models.CharField(max_length=20, unique=True, validators=[MinLengthValidator(2)])
    facultad = models.ForeignKey(FacultadCatalogo, on_delete=models.PROTECT, related_name='carreras')
    mision = models.TextField(blank=True, default='')
    vision = models.TextField(blank=True, default='')
    perfil_profesional = models.TextField(blank=True, default='', help_text='Descripción del perfil profesional del egresado')
    objetivo_carrera = models.TextField(blank=True, default='', help_text='Objetivo general de la carrera')
    responsable = models.CharField(max_length=200, blank=True, default='', help_text='Nombre/cargo del responsable de la carrera')
    resolucion_ministerial = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text='Número/código de la resolución ministerial o universitaria que respalda la carrera',
    )
    fecha_resolucion = models.DateField(
        null=True,
        blank=True,
        help_text='Fecha oficial de la resolución ministerial o universitaria',
    )
    logo_carrera = models.ImageField(upload_to=logo_carrera_upload_path, null=True, blank=True)
    # Almacenamiento antiguo (cifrado en la BD). Solo lectura: ver organizar_media.
    logo_carrera_cifrada = models.BinaryField(null=True, blank=True, editable=False)
    logo_carrera_mime = models.CharField(max_length=64, blank=True, default='')
    activo = models.BooleanField(default=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()
    
    class Meta:
        verbose_name = "Carrera"
        verbose_name_plural = "Carreras"
        ordering = ['facultad__nombre', 'nombre']
    
    def __str__(self):
        return f"{self.nombre} - {self.facultad}"

    def clean(self):
        super().clean()
        self.codigo = (self.codigo or '').strip().upper()

        if not self.codigo:
            raise ValidationError({'codigo': 'El codigo de carrera es obligatorio.'})

        if self.fecha_resolucion and self.fecha_resolucion > timezone.localdate():
            raise ValidationError({'fecha_resolucion': 'La fecha de resolución de creación (HCU) no puede ser futura.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def set_logo_carrera(self, uploaded_file):
        """Guarda el logo en media/carreras/carrera_<id>/ (reemplaza el anterior)."""
        _guardar_imagen(self.logo_carrera, uploaded_file)
        self.logo_carrera_mime = getattr(uploaded_file, 'content_type', '') or ''
        self.logo_carrera_cifrada = None

    def clear_logo_carrera(self):
        if self.logo_carrera and self.logo_carrera.name:
            self.logo_carrera.delete(save=False)
        self.logo_carrera = None
        self.logo_carrera_cifrada = None
        self.logo_carrera_mime = ''

    def get_logo_carrera_data_uri(self):
        return (
            _imagen_a_data_uri(self.logo_carrera, self.logo_carrera_mime)
            or _descifrar_imagen_legado(self.logo_carrera_cifrada, self.logo_carrera_mime)
        )


class Materia(models.Model):
    nombre = models.CharField(max_length=200)
    sigla = models.CharField(max_length=20, unique=True, validators=[MinLengthValidator(2)])
    carrera = models.ForeignKey(Carrera, on_delete=models.PROTECT, related_name='materias')
    semestre = models.IntegerField()
    horas_teoricas = models.IntegerField(default=0)
    horas_practicas = models.IntegerField(default=0)
    # Inactiva: no se asigna en cargas nuevas, pero se conserva en las que ya tiene.
    activo = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                Lower(Trim('sigla')),
                name='materia_sigla_unique_ci_trim',
            ),
        ]

    def clean(self):
        super().clean()
        self.sigla = (self.sigla or '').strip().upper()
        if not self.sigla:
            raise ValidationError({'sigla': 'La sigla de la materia es obligatoria.'})

    def __str__(self):
        return f"{self.sigla} - {self.nombre}"

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def horas_totales(self):
        return (self.horas_teoricas or 0) + (self.horas_practicas or 0)


class CalendarioAcademico(models.Model):
    """Calendario académico según Art. 15, 18 del reglamento"""
    
    PERIODO_CHOICES = [
        ('1', 'Primer Semestre'),
        ('2', 'Segundo Semestre'),
        ('anual', 'Anual'),
    ]
    
    gestion = models.IntegerField(
        validators=[MinValueValidator(2020), MaxValueValidator(2100)],
        help_text="Año académico"
    )
    carrera = models.ForeignKey(
        Carrera,
        on_delete=models.PROTECT,
        related_name='calendarios_academicos',
        help_text="Carrera a la que pertenece este calendario academico"
    )
    periodo = models.CharField(max_length=10, choices=PERIODO_CHOICES)
    fecha_inicio = models.DateField(help_text="Inicio del periodo académico")
    fecha_fin = models.DateField(help_text="Fin del periodo académico")
    fecha_inicio_presentacion_proyectos = models.DateField(
        help_text="Inicio de presentación de proyectos y programas analíticos"
    )
    fecha_limite_presentacion_proyectos = models.DateField(
        help_text="Fecha límite para presentar proyectos"
    )
    # El fondo descuenta días de feriado x jornada diaria del docente (calcular_horas_fondo).
    dias_feriados_gestion = models.PositiveIntegerField(
        validators=[MaxValueValidator(30)],
        verbose_name='Días de feriado de la gestión',
        help_text='Feriados de la gestión que caen de lunes a viernes.',
    )
    fecha_limite_programas_analiticos = models.DateField(
        null=True,
        blank=True,
        help_text="Fecha limite para presentar programas analiticos"
    )
    fecha_inicio_receso = models.DateField(
        null=True,
        blank=True,
        help_text="Inicio del receso academico"
    )
    fecha_fin_receso = models.DateField(
        null=True,
        blank=True,
        help_text="Fin del receso academico"
    )
    activo = models.BooleanField(
        default=False,
        help_text="Solo puede haber un calendario activo por periodo"
    )
    
    class Meta:
        verbose_name = "Calendario Académico"
        verbose_name_plural = "Calendarios Académicos"
        ordering = ['-gestion', '-periodo']
        unique_together = ['carrera', 'gestion', 'periodo']
    
    def __str__(self):
        carrera = self.carrera.nombre if self.carrera else 'Sin carrera'
        return f"{carrera} - Gestión {self.gestion} - {self.get_periodo_display()}"

    @property
    def semanas_de_clase(self):
        """Semanas de clases en aula: 20 en un semestre, 40 en un calendario anual."""
        return 40 if self.periodo == 'anual' else 20
    
    def save(self, *args, **kwargs):
        """Al guardar, si este calendario está activo, desactiva cualquier otro."""
        if self.activo:
            # Desactiva todos los demás calendarios que estén activos.
            # El .exclude(pk=self.pk) es crucial para no desactivarse a sí mismo
            # antes de guardar, especialmente al editar un calendario ya activo.
            CalendarioAcademico.objects.filter(activo=True, carrera=self.carrera).exclude(pk=self.pk).update(activo=False)
        super().save(*args, **kwargs)


def resolucion_consejo_upload_path(instance, filename):
    """Ruta: usuarios/usuario_<id>/resolucion_jefe_estudios_carrera_<id>.pdf"""
    return (
        f'usuarios/usuario_{instance.user_id or "sin_usuario"}/'
        f'resolucion_jefe_estudios_carrera_{instance.carrera_id or "sin_carrera"}.pdf'
    )


def documento_decanatura_upload_path(instance, filename):
    """Ruta: fondos/aprobaciones/docente_<id>/gestion_<año>/decanatura_fondo_<id>.pdf"""
    return (
        f'fondos/aprobaciones/docente_{instance.docente_id}/gestion_{instance.gestion}/'
        f'decanatura_fondo_{instance.pk}.pdf'
    )


def documento_decanatura_informe_upload_path(instance, filename):
    """Ruta: fondos/aprobaciones/docente_<id>/gestion_<año>/decanatura_informe_fondo_<id>.pdf"""
    return (
        f'fondos/aprobaciones/docente_{instance.docente_id}/gestion_{instance.gestion}/'
        f'decanatura_informe_fondo_{instance.pk}.pdf'
    )


def usuarios_del_docente(docente):
    """Usuarios vinculados a la ficha de docente (directo o por su perfil)."""
    user_ids = {docente.user_id} if docente.user_id else set()
    user_ids.update(
        PerfilUsuario.objects.filter(docente=docente, user__isnull=False, activo=True)
        .values_list('user_id', flat=True)
    )
    return user_ids


def roles_del_docente_en_carrera(docente, carrera):
    """Roles activos de los usuarios del docente en UNA carrera."""
    user_ids = usuarios_del_docente(docente)
    if not user_ids or not carrera:
        return set()
    roles = set(AsignacionCarrera.objects.filter(
        user_id__in=user_ids, activo=True, carrera=carrera,
    ).values_list('rol', flat=True))
    roles.update(PerfilUsuario.objects.filter(
        user_id__in=user_ids, activo=True, carrera=carrera,
    ).exclude(rol='').values_list('rol', flat=True))
    return roles


def horas_semanales_contractuales(docente, carrera):
    """Horas semanales de un docente en UNA carrera (base del fondo de esa carrera).

    El docente tiene un solo vínculo (el de la carrera de su usuario): contrato,
    vacaciones y feriados salen de esas horas. Si en esa carrera además tiene un
    cargo (Director, Jefe o Instituto), el cargo y la docencia van juntos dentro
    de las 40 h/sem.
    """
    vinculo = DocenteCarrera.objects.filter(docente=docente, carrera=carrera, activo=True).first()
    horas_docencia = Decimal(vinculo.horas_semanales_maximas or 0) if vinculo else Decimal('0')
    horas_gestion = max(
        (CARGA_SEMANAL_ROL_GESTION[rol] for rol in roles_del_docente_en_carrera(docente, carrera)
         if rol in CARGA_SEMANAL_ROL_GESTION),
        default=Decimal('0'),
    )
    return min(max(horas_docencia, horas_gestion), TOPE_HORAS_SEMANALES_FONDO)


class FondoTiempo(models.Model):
    """Modelo principal para el fondo de tiempo anual de un docente"""
    
    ESTADO_CHOICES = [
        ('borrador', 'Borrador'),
        ('observado', 'Con Observaciones'),
        ('presentado_director', 'Presentado a Director de Carrera'),
        ('aprobado_director', 'Aprobado por Director de Carrera'),
        ('en_ejecucion', 'En Ejecución'),
        ('informe_presentado', 'Informe Presentado'),
        ('finalizado', 'Finalizado'),
        ('rechazado', 'Rechazado'),
        ('archivado', 'Archivado'),
    ]
    
    # Un fondo por docente y gestión, en la carrera de su vínculo: reúne las cargas
    # de todos los calendarios de esa gestión.
    docente = models.ForeignKey(Docente, on_delete=models.PROTECT, related_name='fondos_tiempo')
    carrera = models.ForeignKey(Carrera, on_delete=models.PROTECT, related_name='fondos_tiempo')
    gestion = models.IntegerField(validators=[MinValueValidator(2020), MaxValueValidator(2100)])

    # Configuración temporal
    semanas_año = models.DecimalField(
        max_digits=4,
        decimal_places=1,
        default=Decimal('45.8'),
        help_text="Número de semanas efectivas del año para cálculo de horas anuales"
    )
    horas_semana = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text="Horas semanales del docente según su dedicación")
    # Días de vacación por antigüedad con los que se calcularon horas_vacacion (el PDF los muestra).
    dias_vacacion = models.IntegerField(default=0)
    horas_vacacion = models.IntegerField(default=120)
    horas_feriados = models.IntegerField(default=0) # Often not subtracted from total effective hours
    contrato_horas = models.IntegerField(default=2080)
    horas_efectivas = models.DecimalField(max_digits=6, decimal_places=2, default=1832.0)
    
    estado = models.CharField(max_length=30, choices=ESTADO_CHOICES, default='borrador')
    observaciones = models.TextField(blank=True)
    
    # Programa analítico
    tiene_programa_analitico = models.BooleanField(
        default=False,
        help_text="Indica si se adjuntó el programa analítico (obligatorio Art. 15)"
    )
    programa_analitico_url = models.URLField(
        blank=True,
        help_text="URL del programa analítico (Google Drive, etc.)"
    )
    fecha_presentacion = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Fecha de presentación a Director de Carrera"
    )
    
    # Sistema de permisos
    archivado = models.BooleanField(default=False, help_text="Fondo archivado (no visible, no eliminado)")
    comentarios_admin = models.TextField(blank=True, help_text="Observaciones del administrador o director")
    fecha_aprobacion = models.DateTimeField(blank=True, null=True, help_text="Fecha en que fue aprobado")
    fecha_validacion = models.DateTimeField(blank=True, null=True, help_text="Fecha en que fue validado")
    
    aprobado_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fondos_aprobados',
        help_text="Usuario que aprobó el fondo"
    )
    # El fondo de un Director lo aprueba el superusuario con el documento de la
    # Decanatura (PDF obligatorio): nadie aprueba su propio fondo.
    documento_decanatura = models.FileField(
        upload_to=documento_decanatura_upload_path,
        null=True,
        blank=True,
        validators=[FileExtensionValidator(['pdf'])],
        help_text="Documento de la Decanatura que respalda la aprobación del fondo de un Director",
    )
    # Art. 28: el informe final del Director se eleva a Decanatura; al evaluarlo y
    # finalizar su fondo el superusuario adjunta ese documento (PDF obligatorio).
    documento_decanatura_informe = models.FileField(
        upload_to=documento_decanatura_informe_upload_path,
        null=True,
        blank=True,
        validators=[FileExtensionValidator(['pdf'])],
        help_text="Documento de la Decanatura sobre el informe final del fondo de un Director",
    )
    validado_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fondos_validados',
        help_text="Usuario que validó el fondo"
    )
    
    fecha_inicio_ejecucion = models.DateTimeField(null=True, blank=True)
    fecha_informe = models.DateTimeField(null=True, blank=True)
    fecha_finalizacion = models.DateTimeField(null=True, blank=True)

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_modificacion = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Fondo de Tiempo"
        verbose_name_plural = "Fondos de Tiempo"
        ordering = ['-gestion', 'docente']
        constraints = [
            # Un solo fondo vigente por docente y gestión (los archivados no cuentan).
            models.UniqueConstraint(
                fields=['docente', 'gestion'],
                condition=models.Q(archivado=False),
                name='unique_fondo_por_docente_y_gestion',
            )
        ]

    def __str__(self):
        return f"{self.docente.nombre_completo} - {self.descripcion}"

    @property
    def descripcion(self):
        """Cómo se nombra el fondo en pantallas y documentos: "Gestión 2026 · Carrera"."""
        carrera = self.carrera.nombre if self.carrera_id else 'Sin carrera'
        return f"Gestión {self.gestion} · {carrera}"
    
    @property
    def porcentaje_completado(self):
        if not self.horas_efectivas or self.horas_efectivas == 0:
            return Decimal('0.00')
        
        # Operación puramente Decimal
        resultado = (self.total_asignado / self.horas_efectivas) * 100
        
        # Retornar redondeado a 2 decimales
        return resultado.quantize(Decimal('0.01'))
    
    @property
    def horas_disponibles(self):
        return self.horas_efectivas - self.total_asignado
    
    def puede_editar(self, usuario):
        """Determina si un usuario puede editar este fondo"""
        if usuario.is_superuser:
            return True

        estados_editables = ['borrador', 'observado']

        # Solo el staff con rol de gestión real puede editar.
        if usuario.is_staff and hasattr(usuario, 'perfil') and usuario.perfil.rol in ['director', 'jefe_estudios']:
            return self.estado in estados_editables
        
        # El docente dueño puede editar si el estado lo permite.
        if hasattr(usuario, 'perfil') and usuario.perfil.docente:
            return (
                self.docente == usuario.perfil.docente and
                self.estado in estados_editables
            )
        
        return False
    
    def _obtener_vinculo(self):
        """Obtiene el vínculo DocenteCarrera activo para este fondo."""
        if not self.docente_id or not self.carrera_id:
            return None
        return DocenteCarrera.objects.filter(
            docente=self.docente,
            carrera=self.carrera,
            activo=True
        ).first()

    def pertenece_a(self, user):
        """True si el fondo es del propio usuario (su ficha de docente)."""
        return bool(self.docente_id and user and user.id in usuarios_del_docente(self.docente))

    def es_de_director_de_su_carrera(self):
        """True si el docente del fondo es el Director de la carrera del fondo."""
        if not self.docente_id:
            return False
        return AsignacionCarrera.objects.filter(
            user_id__in=usuarios_del_docente(self.docente),
            carrera=self.carrera,
            rol='director',
            activo=True,
        ).exists()

    def calendarios_de_la_gestion(self):
        """Calendarios académicos de la carrera del fondo en su gestión."""
        return CalendarioAcademico.objects.filter(carrera_id=self.carrera_id, gestion=self.gestion)

    def fecha_referencia_antiguedad(self):
        """Inicio de la gestión (ver inicio_de_gestion): ahí se mide la antigüedad."""
        return inicio_de_gestion(self.calendarios_de_la_gestion().values_list('fecha_inicio', flat=True), self.gestion)

    def _encabezado_congelado(self):
        """Fondo ya presentado o aprobado: contrato, vacaciones, feriados y horas efectivas
        quedan con los valores presentados."""
        return bool(self.pk) and FondoTiempo.objects.filter(
            pk=self.pk, estado__in=ESTADOS_FONDO_BLOQUEADOS,
        ).exists()

    def _dias_feriados_gestion(self):
        """Días de feriado de la gestión: todos los calendarios de la carrera en la gestión
        tienen el mismo valor, así que se descuentan una sola vez."""
        calendario = self.calendarios_de_la_gestion().first()
        return calendario.dias_feriados_gestion if calendario else 0

    def _calcular_horas_fondo(self):
        """Contrato, vacaciones, feriados y horas efectivas del docente en esta gestión.

        Horas semanales: del vínculo (DocenteCarrera) y los roles de gestión.
        Vacaciones: días por antigüedad (15/20/30) proporcionales a la jornada.
        """
        horas_semana = self._obtener_horas_semanales_contractuales()
        if not self.docente or horas_semana <= 0:
            return None
        return calcular_horas_fondo(
            horas_semana,
            self.docente.calcular_dias_vacacion(self.fecha_referencia_antiguedad()),
            self._dias_feriados_gestion(),
        )

    def _obtener_horas_vacacion_docente(self):
        resultado = self._calcular_horas_fondo()
        return resultado['horas_vacacion'] if resultado else 0

    def _obtener_horas_feriados_docente(self):
        resultado = self._calcular_horas_fondo()
        return resultado['horas_feriados'] if resultado else 0

    def _obtener_user_ids_docente(self):
        return usuarios_del_docente(self.docente) if self.docente_id else set()

    def _obtener_roles_activos_docente(self):
        """Roles del docente en la carrera de ESTE fondo."""
        return roles_del_docente_en_carrera(self.docente, self.carrera) if self.docente_id else set()

    def _tiene_rol_gestion_activo(self):
        return bool(self._obtener_roles_activos_docente() & set(CARGA_SEMANAL_ROL_GESTION.keys()))

    def _obtener_horas_semanales_contractuales(self):
        """Horas semanales del fondo: solo las de su carrera (ver horas_semanales_contractuales)."""
        if not self.docente_id:
            return Decimal('0')
        return horas_semanales_contractuales(self.docente, self.carrera)

    def _recalcular_horas_automaticas(self):
        """
        Regla UABJB — Cálculo de horas efectivas según dedicación del docente.

        HORAS SEMANALES: se obtienen del vínculo DocenteCarrera(docente, carrera).
        VACACIONES Y FERIADOS: se obtienen del Docente (son de la persona).
        """
        if not self.docente or self._encabezado_congelado():
            return

        # Buscar el vínculo DocenteCarrera para esta carrera
        horas_semana = self._obtener_horas_semanales_contractuales()

        if horas_semana <= 0:
            # Si no hay vínculo, no se puede calcular
            return

        # Horas semanales del vínculo; contrato, vacaciones (por antigüedad) y
        # feriados salen de calcular_horas_fondo.
        self.horas_semana = Decimal(horas_semana)
        self.dias_vacacion = self.docente.calcular_dias_vacacion(self.fecha_referencia_antiguedad())
        resultado = self._calcular_horas_fondo()
        self.contrato_horas = resultado['contrato_horas']
        self.horas_vacacion = resultado['horas_vacacion']
        self.horas_feriados = resultado['horas_feriados']
        self.horas_efectivas = Decimal(resultado['horas_efectivas'])

    CAMPOS_ENCABEZADO = [
        'horas_semana', 'dias_vacacion', 'contrato_horas', 'horas_vacacion', 'horas_feriados', 'horas_efectivas',
    ]

    @classmethod
    def recalcular_encabezados_de_gestion(cls, carrera_id, gestion):
        """Tras cambiar los calendarios de una gestión (feriados o fechas), los fondos que
        aún no se presentaron toman los nuevos valores. Sin validaciones de contenido:
        solo se actualiza el encabezado."""
        fondos = cls.objects.filter(carrera_id=carrera_id, gestion=gestion, archivado=False).exclude(
            estado__in=ESTADOS_FONDO_BLOQUEADOS,
        ).select_related('docente', 'carrera')
        for fondo in fondos:
            fondo._recalcular_horas_automaticas()
            cls.objects.filter(pk=fondo.pk).update(
                **{campo: getattr(fondo, campo) for campo in cls.CAMPOS_ENCABEZADO}
            )

    def clean(self):
        super().clean()

        # Sin docente no es posible validar reglas de carga horaria.
        if not self.docente:
            return

        # ============================================================
        # VALIDACIÓN 1: Bloqueo por Estado
        # ============================================================
        # Si el fondo está en un estado bloqueado (presentado, aprobado, etc.),
        # NO permitir cambios. Solo 'borrador' y 'observado' son editables.
        
        ESTADOS_BLOQUEADOS = ESTADOS_FONDO_BLOQUEADOS
        
        TRANSICIONES_ESTADO_PERMITIDAS = {
            ('borrador', 'presentado_director'),
            ('observado', 'presentado_director'),
            ('presentado_director', 'aprobado_director'),
            ('presentado_director', 'observado'),
            ('presentado_director', 'rechazado'),
            # Un fondo rechazado vuelve a borrador para corregirlo (Jefe o superusuario).
            ('rechazado', 'borrador'),
            ('aprobado_director', 'en_ejecucion'),
            ('en_ejecucion', 'informe_presentado'),
            ('informe_presentado', 'finalizado'),
            # El Director solicita correcciones al informe: vuelve a ejecucion
            # para que el docente pueda editarlo y reenviarlo.
            ('informe_presentado', 'en_ejecucion'),
        }
        
        # Si el fondo ya existe en DB, verificar si está en estado bloqueado
        if self.pk:
            fondo_actual = FondoTiempo.objects.get(pk=self.pk)
            
            # Si está en estado bloqueado, comparar con cambios
            if fondo_actual.estado in ESTADOS_BLOQUEADOS:
                # Campos de CONTENIDO del fondo (lo que se presento): quedan
                # congelados apenas el fondo entra a un estado bloqueado.
                # Auditoria 2026-09-12: la lista original solo cubria 7 campos
                # (docente, carrera, gestion, periodo, horas_vacacion,
                # horas_feriados, horas_efectivas) y dejaba editables campos
                # como semanas_año, horas_semana, contrato_horas,
                # tiene_programa_analitico, programa_analitico_url y
                # observaciones aunque el fondo ya estuviera presentado.
                #
                # `observaciones` (texto libre en el propio FondoTiempo) se
                # incluye aqui como bloqueado: los comentarios reales del
                # Director/Jefatura con auditoria de quien/cuando ya tienen
                # su propio canal (ObservacionFondo + MensajeObservacion, via
                # el endpoint `agregar-comentario`), asi que este campo no
                # necesita quedar editable.
                #
                # Deliberadamente NO estan en esta lista los campos de
                # workflow/auditoria que las propias transiciones de estado
                # deben poder escribir aunque el fondo ya este en un estado
                # bloqueado (aprobar, observar, iniciar ejecucion, etc.):
                # `estado` (validado aparte, mas abajo), `fecha_presentacion`,
                # `fecha_aprobacion`, `fecha_validacion`,
                # `fecha_inicio_ejecucion`, `fecha_informe`,
                # `fecha_finalizacion`, `aprobado_por`, `validado_por`,
                # `comentarios_admin`, `archivado`, y los automaticos
                # `fecha_creacion`/`fecha_modificacion`.
                campos_criticos = [
                    'docente', 'carrera', 'gestion',
                    'semanas_año', 'horas_semana',
                    'horas_vacacion', 'horas_feriados', 'contrato_horas', 'horas_efectivas',
                    'observaciones', 'tiene_programa_analitico', 'programa_analitico_url',
                ]

                cambios_detectados = False
                for campo in campos_criticos:
                    if getattr(self, campo) != getattr(fondo_actual, campo):
                        cambios_detectados = True
                        break

                if cambios_detectados:
                    raise ValidationError({
                        'estado': (
                            f'No se puede editar un Fondo de Tiempo en estado '
                            f'"{fondo_actual.get_estado_display()}". '
                            f'Solo se pueden editar fondos en estado "Borrador" u "Observado".'
                        )
                    })
            
            # Solo las transiciones del flujo: no se vuelve a borrador, observado o
            # rechazado desde cualquier estado.
            transicion_estado = (fondo_actual.estado, self.estado)
            if self.estado != fondo_actual.estado and transicion_estado not in TRANSICIONES_ESTADO_PERMITIDAS:
                raise ValidationError({
                    'estado': (
                        f'Transición de estado no permitida: de "{fondo_actual.get_estado_display()}" '
                        f'a "{dict(self.ESTADO_CHOICES).get(self.estado, self.estado)}".'
                    )
                })

        # ============================================================
        # VALIDACIÓN 2: Recalor de horas
        # ============================================================
        # Recalcula aquí también para que la validación use valores actualizados.
        self._recalcular_horas_automaticas()

        # Validación reglamentaria: suma de las 7 dimensiones no debe exceder las horas efectivas.
        total_dimensiones = Decimal('0.00')
        if self.pk:
            total_dimensiones = self.categorias.aggregate(total=models.Sum('total_horas'))['total'] or Decimal('0.00')

        if Decimal(total_dimensiones) > Decimal(self.horas_efectivas):
            raise ValidationError({
                'horas_efectivas': (
                    'La suma de las 7 dimensiones no puede superar las horas disponibles '
                    f'({self.horas_efectivas}). Total actual: {total_dimensiones}.'
                )
            })
        
    def save(self, *args, **kwargs):
        self._recalcular_horas_automaticas()
        self.full_clean()

        super(FondoTiempo, self).save(*args, **kwargs)
        
    @property
    def total_asignado(self):
      return self.categorias.aggregate(
        total=models.Sum('total_horas')
    )['total'] or 0


def fondo_de_la_carga(docente, gestion):
    """Fondo de Tiempo vigente (no archivado) del docente en esa gestión."""
    if not docente or not gestion:
        return None
    return FondoTiempo.objects.filter(docente=docente, gestion=gestion, archivado=False).first()


def mensaje_sin_fondo(gestion):
    return f'El docente aún no tiene Fondo de Tiempo de la gestión {gestion} en su carrera.'


class CategoriaFuncion(models.Model):
    """Categorías de funciones sustantivas"""
    
    TIPO_CHOICES = [
        ('academica', 'Académica'),
        ('investigacion', 'Investigación'),
        ('extension_universitaria', 'Extensión universitaria'),
        ('interaccion_social', 'Interacción social'),
        ('gestion', 'Gestión'),
        ('academica_administrativa', 'Académica-administrativa'),
        ('social_cultural_deportiva', 'Social, cultural, deportiva y Otros'),
    ]
    
    fondo_tiempo = models.ForeignKey(FondoTiempo, on_delete=models.CASCADE, related_name='categorias')
    tipo = models.CharField(max_length=30, choices=TIPO_CHOICES)
    total_horas = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    porcentaje = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    class Meta:
        verbose_name = "Categoría de Función"
        verbose_name_plural = "Categorías de Funciones"
        ordering = ['fondo_tiempo', 'tipo']
        unique_together = ['fondo_tiempo', 'tipo']
    
    def __str__(self):
        return f"{self.get_tipo_display()} - {self.total_horas}h ({self.porcentaje}%)"


def evidencia_upload_path(instance, filename):
    """Ruta: fondos/evidencias_actividades/docente_<id>/gestion_<año>/<categoria>/<archivo>"""
    try:
        fondo = instance.categoria.fondo_tiempo
        docente_id = fondo.docente.id
        gestion = fondo.gestion
        categoria_tipo = instance.categoria.tipo
        return f'fondos/evidencias_actividades/docente_{docente_id}/gestion_{gestion}/{categoria_tipo}/{filename}'
    except Exception:
        return f'fondos/evidencias_actividades/sin_clasificar/{filename}'

class Actividad(models.Model):
    """
    OBSOLETO desde 2026-09-12 — no usar en código nuevo.

    Este modelo era el catálogo original de sub-actividades por CategoriaFuncion,
    de la primera versión del Fondo de Tiempo. Quedó reemplazado por
    `CargaHoraria.tipo_actividad` (texto libre validado contra
    `CARGA_HORARIA_TIPOS_POR_CATEGORIA` en `fondos/serializers.py`), que es el
    único catálogo que alimenta hoy la carga horaria real de un docente.

    Motivo de la deprecación (auditoría técnica de Fondo de Tiempo, 2026-09-12):
    - 0 filas en toda la base de datos: ningún fondo real usa este modelo.
    - Sus 15 `SUBACTIVIDAD_ACADEMICA_CHOICES` ya divergieron de los tipos
      vigentes en `CARGA_HORARIA_TIPOS_POR_CATEGORIA['academica']` (p. ej.
      `practica_laboratorios` aquí vs. `practica_laboratorios_centro_computo`
      en el catálogo vivo), por lo que ya no son intercambiables.
    - El único formulario que lo usaba (`FormularioActividad.jsx`) fue
      eliminado del frontend; en `DetalleFondo.jsx` la sección que leía
      `categoria.actividades` quedó deshabilitada de forma permanente
      (`{false && ...}`).
    - El único código que aún podía escribir filas aquí,
      `fondos/management/commands/cargar_excel.py`, ya está roto por
      cambios previos e independientes en `Docente` (usa campos
      `categoria`/`dedicacion` que ya no existen en ese modelo), así que en
      la práctica no hay ninguna ruta de escritura activa.

    No se elimina la tabla ni el modelo para no romper el historial de
    migraciones ni la serialización existente (`ActividadSerializer`,
    expuesta como `CategoriaFuncion.actividades`), que sigue devolviendo una
    lista vacía sin efectos secundarios. `ActividadAdmin` quedó en solo
    lectura para impedir que se creen filas nuevas manualmente desde
    /admin/. No agregar funcionalidad nueva sobre este modelo: cualquier
    necesidad de sub-actividades académicas debe implementarse sobre
    `CargaHoraria`.
    """

    SUBACTIVIDAD_ACADEMICA_CHOICES = [
        ('preparacion_temas', 'Preparación de temas'),
        ('clases_aula', 'Clases en aula'),
        ('elaboracion_trabajos_practicos', 'Elaboración de Trabajos Prácticos'),
        ('revision_calificacion_trabajos_practicos', 'Revisión y Calificación de Trabajos Prácticos'),
        ('elaboracion_examenes', 'Elaboración de Exámenes'),
        ('revision_calificacion_examenes', 'Revisión y Calificación de Exámenes'),
        ('practica_laboratorios', 'Práctica de Laboratorios'),
        ('practicas_campo', 'Prácticas de Campo'),
        ('produccion_docente_textos_guias', 'Producción docente (textos guías)'),
        ('consultas_reclamos_calificaciones', 'Consultas y Reclamos de Calificaciones'),
        ('elaboracion_planillas_introduccion_notas', 'Elaboración de planillas e Introducción de notas'),
        ('planificacion_gestion_practica_extra_aula', 'Planificación y gestión de práctica extra aula'),
        ('ejecucion_practica_extra_aula', 'Ejecución de práctica extra aula'),
        ('informe_descargo_viaje_practicas_extra_aula', 'Informe de descargo de viaje en prácticas extra aula'),
        ('cursos_verano', 'Cursos de verano'),
    ]
    
    categoria = models.ForeignKey(CategoriaFuncion, on_delete=models.CASCADE, related_name='actividades')
    subactividad_academica = models.CharField(
        max_length=60,
        choices=SUBACTIVIDAD_ACADEMICA_CHOICES,
        blank=True,
        help_text="Sub-actividad pedagógica reglamentaria para la categoría Académica"
    )
    detalle = models.CharField(max_length=300)
    horas_semana = models.DecimalField(max_digits=5, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    horas_año = models.DecimalField(max_digits=6, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    evidencias = models.TextField(blank=True, default='')
    archivo_evidencia = models.FileField(
        upload_to=evidencia_upload_path, 
        null=True, 
        blank=True,
        help_text="Prueba visual (Imagen/PDF)"
    )
    orden = models.IntegerField(default=0)
    proyecto = models.ForeignKey(
        'Proyecto',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='actividades',
        help_text="Proyecto al que pertenece esta actividad"
    )
    
    class Meta:
        # Nombres visibles en /admin/ marcados a proposito: ver docstring de la clase (OBSOLETO desde 2026-09-12).
        verbose_name = "Actividad (OBSOLETO - usar CargaHoraria)"
        verbose_name_plural = "Actividades (OBSOLETO - usar CargaHoraria)"
        ordering = ['categoria', 'orden', 'id']
    
    def __str__(self):
        return f"{self.detalle} - {self.horas_año}h/año"


class CargaHoraria(models.Model):
    """Asignación de horas a un docente por parte de una autoridad (Jefe de Estudios)."""
    
    CATEGORIA_CHOICES = CategoriaFuncion.TIPO_CHOICES
    PARALELO_CHOICES = [
        ('A', 'A'),
        ('B', 'B'),
        ('C', 'C'),
        ('D', 'D'),
        ('E', 'E'),
        ('F', 'F'),
    ]
    DIA_SEMANA_CHOICES = [
        ('lunes', 'Lunes'),
        ('martes', 'Martes'),
        ('miercoles', 'Miercoles'),
        ('jueves', 'Jueves'),
        ('viernes', 'Viernes'),
        ('sabado', 'Sabado'),
    ]

    docente = models.ForeignKey(Docente, on_delete=models.PROTECT, related_name='cargas_horarias')
    # Se asigna solo al guardar desde la API (fondo_de_la_carga): no se elige a mano.
    fondo = models.ForeignKey(FondoTiempo, on_delete=models.PROTECT, related_name='cargas')
    # Solo Académica (materias): semestre o año de la materia y horario. El resto son
    # horas por año del fondo, sin calendario.
    calendario = models.ForeignKey(
        CalendarioAcademico, on_delete=models.PROTECT, related_name='cargas_horarias', null=True, blank=True,
    )
    categoria = models.CharField(max_length=30, choices=CATEGORIA_CHOICES)
    materia = models.ForeignKey(
        Materia,
        on_delete=models.PROTECT,
        related_name='asignaciones_horarias',
        null=True,
        blank=True,
        help_text='Materia del plan de estudios asignada al docente.'
    )
    paralelo = models.CharField(max_length=1, choices=PARALELO_CHOICES, default='A')
    dia_semana = models.CharField(max_length=10, choices=DIA_SEMANA_CHOICES, default='lunes')
    hora_inicio = models.TimeField(null=True, blank=True)
    hora_fin = models.TimeField(null=True, blank=True)
    aula = models.CharField(max_length=100, default='', blank=True)
    titulo_actividad = models.CharField(
        max_length=200,
        blank=True,
        help_text='Descripcion de la actividad para cargas no academicas.'
    )
    tipo_actividad = models.CharField(
        max_length=80,
        blank=True,
        help_text='Sub-actividad especifica segun la categoria del Fondo de Tiempo.'
    )
    horas = models.PositiveIntegerField(help_text="Cantidad de horas anuales asignadas para esta actividad.")
    evidencias = models.TextField(
        blank=True,
        default='',
        help_text='Evidencias o respaldo descriptivo de la actividad.'
    )
    documento_respaldo = models.CharField(
        max_length=100,
        blank=True,
        help_text='Opcional. Ej: "Memo #123", "Res. HCF #456/2024"'
    )
    creado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='cargas_creadas')
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_modificacion = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Carga Horaria"
        verbose_name_plural = "Cargas Horarias"
        ordering = ['-fondo__gestion', 'docente', 'categoria']
        unique_together = ['docente', 'calendario', 'materia', 'paralelo', 'dia_semana', 'hora_inicio']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(hora_fin__gt=models.F('hora_inicio')),
                name='cargahoraria_hora_fin_gt_inicio',
            ),
            # Blindaje a nivel de base de datos (auditoria 2026-09-12): la regla de
            # "materia obligatoria en Academica" antes solo vivia en
            # CargaHorariaSerializer.validate(). Cualquier escritura que no pase por
            # el serializer (admin, shell, un endpoint nuevo) quedaba sin protegerse.
            models.CheckConstraint(
                condition=models.Q(categoria='academica', materia__isnull=False)
                | ~models.Q(categoria='academica'),
                name='cargahoraria_materia_obligatoria_si_academica',
            ),
            models.CheckConstraint(
                condition=models.Q(categoria='academica', calendario__isnull=False)
                | (~models.Q(categoria='academica') & models.Q(calendario__isnull=True)),
                name='cargahoraria_calendario_solo_en_academica',
            ),
            # Blindaje a nivel de base de datos (auditoria 2026-09-12): la regla de
            # "no repetir tipo_actividad en la misma categoria" antes solo vivia en
            # CargaHorariaSerializer.validate(). Se separa en dos constraints porque
            # en Academica dos materias distintas SI pueden compartir el mismo
            # tipo_actividad (p. ej. 'clases_aula' de dos materias), mientras que en
            # el resto de categorias el tipo_actividad debe ser unico sin mas.
            # Con el paralelo: un docente puede dar varios paralelos de la misma materia.
            models.UniqueConstraint(
                fields=['docente', 'calendario', 'categoria', 'tipo_actividad', 'materia', 'paralelo'],
                condition=models.Q(categoria='academica'),
                name='cargahoraria_unique_tipo_academica_por_materia_paralelo',
            ),
            # Fuera de Académica el ítem es del fondo (horas por año), no de un calendario.
            models.UniqueConstraint(
                fields=['fondo', 'categoria', 'tipo_actividad'],
                condition=~models.Q(categoria='academica'),
                name='cargahoraria_unique_tipo_no_academica_por_fondo',
            ),
        ]

    def clean(self):
        if self.hora_inicio and self.hora_fin and self.hora_fin <= self.hora_inicio:
            raise ValidationError({'hora_fin': 'La hora de fin debe ser mayor que la hora de inicio.'})

    def __str__(self):
        materia_txt = self.materia.sigla if self.materia else 'SIN-MATERIA'
        return (
            f"{self.docente.nombre_completo} - {materia_txt} {self.paralelo} "
            f"({self.dia_semana} {self.hora_inicio}-{self.hora_fin})"
        )


def evidencia_carga_horaria_upload_path(instance, filename):
    """Ruta: fondos/evidencias_carga/docente_<id>/gestion_<año>/<categoria>/actividad_<id>/<archivo>"""
    try:
        carga = instance.carga_horaria
        docente_id = carga.docente_id
        gestion = carga.fondo.gestion
        return f'fondos/evidencias_carga/docente_{docente_id}/gestion_{gestion}/{carga.categoria}/actividad_{carga.id}/{filename}'
    except Exception:
        return f'fondos/evidencias_carga/sin_clasificar/{filename}'


def _carpeta_informe(instance):
    """Carpeta de un informe: fondos/informes/docente_<id>/gestion_<año>"""
    try:
        fondo = instance.fondo_tiempo
        return f'fondos/informes/docente_{fondo.docente_id}/gestion_{fondo.gestion}'
    except Exception:
        return 'fondos/informes/sin_clasificar'


def informe_adjunto_upload_path(instance, filename):
    return f'{_carpeta_informe(instance)}/adjuntos/{filename}'


def informe_evidencia_upload_path(instance, filename):
    return f'{_carpeta_informe(instance)}/evidencias/{filename}'


class EvidenciaCargaHoraria(models.Model):
    """
    Archivo de respaldo (evidencia de cumplimiento) que el docente adjunta a
    una actividad especifica de su carga horaria (CargaHoraria) mientras el
    fondo esta 'en_ejecucion'.

    Es independiente del campo de texto `CargaHoraria.evidencias` (la
    descripcion esperada de que evidencia corresponde): este modelo guarda
    los archivos reales que prueban que la actividad se cumplio, y permite
    varios archivos por actividad.
    """

    EXTENSIONES_PERMITIDAS = ['pdf', 'jpg', 'jpeg', 'png', 'docx']
    TAMANO_MAXIMO_MB = 10

    carga_horaria = models.ForeignKey(
        CargaHoraria,
        on_delete=models.CASCADE,
        related_name='archivos_evidencia',
    )
    archivo = models.FileField(
        upload_to=evidencia_carga_horaria_upload_path,
        validators=[FileExtensionValidator(allowed_extensions=EXTENSIONES_PERMITIDAS)],
        help_text='PDF, imagen (JPG/PNG) o documento Word (DOCX) que respalda el cumplimiento de la actividad.',
    )
    descripcion = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text='Descripcion opcional del archivo adjunto.',
    )
    subido_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='evidencias_carga_horaria_subidas',
    )
    fecha_subida = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Evidencia de Carga Horaria'
        verbose_name_plural = 'Evidencias de Carga Horaria'
        ordering = ['-fecha_subida']

    def __str__(self):
        return f'Evidencia #{self.pk} - {self.carga_horaria}'

    def clean(self):
        super().clean()
        if self.archivo and self.archivo.size > self.TAMANO_MAXIMO_MB * 1024 * 1024:
            raise ValidationError({
                'archivo': f'El archivo supera el tamaño maximo permitido de {self.TAMANO_MAXIMO_MB}MB.'
            })


class Proyecto(models.Model):
    """Proyectos obligatorios según Art. 14-17 del reglamento"""
    
    TIPO_CHOICES = [
        ('investigacion', 'Investigación'),
        ('extension', 'Extensión Universitaria'),
        ('interaccion', 'Interacción Social'),
    ]
    
    MODALIDAD_CHOICES = [
        ('presencial', 'Presencial'),
        ('virtual', 'Virtual'),
        ('hibrida', 'Híbrida'),
    ]
    
    ESTADO_CHOICES = [
        ('borrador', 'Borrador'),
        ('presentado', 'Presentado'),
        ('aprobado', 'Aprobado'),
        ('en_ejecucion', 'En Ejecución'),
        ('finalizado', 'Finalizado'),
        ('observado', 'Con Observaciones'),
    ]
    
    fondo_tiempo = models.ForeignKey(FondoTiempo, on_delete=models.CASCADE, related_name='proyectos')
    categoria = models.ForeignKey(CategoriaFuncion, on_delete=models.CASCADE, related_name='proyectos')
    titulo = models.CharField(max_length=200)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    
    # Campos obligatorios según Art. 16
    antecedentes = models.TextField(help_text="Antecedentes del proyecto (Art. 16)")
    justificacion = models.TextField(help_text="Justificación del proyecto (Art. 16)")
    objetivos = models.TextField(help_text="Objetivos del proyecto (Art. 16)")
    problema = models.TextField(blank=True, help_text="Problema que aborda el proyecto (Art. 16)")
    cronograma = models.JSONField(default=dict, blank=True, help_text="Cronograma: lugar, fecha, hora")
    
    # Para cursos/seminarios (Art. 17)
    es_curso_seminario = models.BooleanField(default=False)
    bibliografia = models.TextField(blank=True)
    grupo_objetivo = models.CharField(max_length=200, blank=True)
    requisitos_asistencia = models.TextField(blank=True)
    modalidad = models.CharField(max_length=20, choices=MODALIDAD_CHOICES, default='presencial')
    frecuencia = models.CharField(max_length=100, blank=True)
    horas_diarias = models.IntegerField(null=True, blank=True)
    material_didactico = models.TextField(blank=True)
    
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='borrador')
    fecha_presentacion = models.DateField(null=True, blank=True)
    fecha_aprobacion = models.DateField(null=True, blank=True)
    fecha_inicio = models.DateField(null=True, blank=True)
    fecha_fin = models.DateField(null=True, blank=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_modificacion = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Proyecto"
        verbose_name_plural = "Proyectos"
        ordering = ['-fecha_creacion']
    
    def __str__(self):
        return f"{self.titulo} ({self.get_tipo_display()})"


class InformeFondo(models.Model):
    """Informes según Art. 28 del reglamento"""
    
    TIPO_CHOICES = [
        ('parcial', 'Informe Parcial'),
        ('final', 'Informe Final de Gestión'),
    ]
    
    CUMPLIMIENTO_CHOICES = [
        ('cumplido', 'Cumplido'),
        ('parcial', 'Cumplimiento Parcial'),
        ('incumplido', 'Incumplido'),
    ]
    
    ESTADO_CHOICES = [
        ('borrador', 'Borrador'),
        ('enviado', 'Enviado'),
        ('observado', 'Observado'),
        ('aprobado', 'Aprobado'),
    ]

    fondo_tiempo = models.ForeignKey(FondoTiempo, on_delete=models.CASCADE, related_name='informes')
    elaborado_por = models.ForeignKey(User, on_delete=models.PROTECT, related_name='informes_elaborados')
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    estado = models.CharField(
        max_length=10, choices=ESTADO_CHOICES, default='borrador',
        help_text='Flujo de revision: borrador (el docente edita libremente) -> enviado '
                   '(formal, ya no editable) -> observado (el Director pidio correcciones, '
                   'vuelve a ser editable) -> aprobado (cierre del fondo).'
    )
    fecha_elaboracion = models.DateField(auto_now_add=True)
    
    # Campos legados (pre 2026-09-13): el formulario ya no los pide de forma
    # individual, quedaron blank=True para no romper filas ya guardadas ni
    # el guardado desde el nuevo formulario por secciones. El contenido real
    # del informe vive ahora en las 7 secciones de abajo.
    resumen_ejecutivo = models.TextField(blank=True, default='', help_text="Resumen de las actividades realizadas (legado)")
    actividades_realizadas = models.TextField(blank=True, default='', help_text="Detalle de actividades ejecutadas (legado)")
    resultados = models.TextField(blank=True, default='', help_text="Resultados obtenidos (legado)")
    logros = models.TextField(blank=True, default='', help_text="Logros alcanzados (legado)")
    dificultades = models.TextField(blank=True, help_text="Dificultades encontradas (legado)")
    evidencias = models.TextField(blank=True, help_text="Evidencias de cumplimiento")
    observaciones = models.TextField(blank=True)

    # Secciones del informe por categoria del Fondo de Tiempo (Art. 28):
    # el docente redacta libremente cada una; ninguna es obligatoria a nivel
    # de modelo porque no todos los docentes tienen actividad en las 7
    # categorias (p. ej. no todos hacen gestion o asesorias/tutorias). La
    # validacion de minimos (Academica y Conclusiones) vive en el formulario
    # y en el endpoint de presentacion.
    seccion_academica = models.TextField(
        blank=True, default='',
        help_text='Cumplimiento de objetivos, resultados por materia (inscritos/aprobados/reprobados), metodologia de evaluacion.'
    )
    seccion_investigacion = models.TextField(
        blank=True, default='',
        help_text='Proyectos de investigacion realizados, colaboraciones, resultados concretos.'
    )
    seccion_extension_interaccion = models.TextField(
        blank=True, default='',
        help_text='Extension universitaria e interaccion social: ferias, consultorias, cursos de actualizacion.'
    )
    seccion_asesorias_tutorias = models.TextField(
        blank=True, default='',
        help_text='Tribunales de graduacion, tutorias de proyectos.'
    )
    seccion_academica_administrativa = models.TextField(
        blank=True, default='',
        help_text='Actividades de gestion, POA, comisiones.'
    )
    seccion_social_cultural_deportiva = models.TextField(
        blank=True, default='',
        help_text='Participacion en eventos universitarios sociales, culturales y deportivos.'
    )
    conclusiones_generales = models.TextField(
        blank=True, default='',
        help_text='Resumen final del informe y recomendaciones.'
    )

    # Bloques editables del documento tipo carta (encabezado, datos del
    # documento, saludo/introduccion, cierre y firma), en reemplazo del
    # editor "7 cajas sueltas": ahora todo el informe se edita como un
    # documento continuo tipo Word. Quedan blank por defecto: mientras el
    # docente no guarde un valor propio, el editor y el PDF precargan el
    # texto calculado desde Docente/Carrera/Director en
    # fondos/utils/informe_texto.py (construir_defaults_informe).
    encabezado_texto = models.TextField(
        blank=True, default='',
        help_text='Encabezado institucional (Universidad/Vicerrectorado/Facultad/Carrera), una línea por renglón.'
    )
    fecha_texto = models.CharField(max_length=100, blank=True, default='')
    destinatario_nombre = models.CharField(max_length=255, blank=True, default='')
    destinatario_cargo = models.CharField(max_length=255, blank=True, default='')
    remitente_nombre = models.CharField(max_length=255, blank=True, default='')
    remitente_cargo = models.CharField(max_length=255, blank=True, default='')
    referencia_texto = models.CharField(max_length=255, blank=True, default='')
    saludo_intro_html = models.TextField(
        blank=True, default='',
        help_text='Saludo y párrafo introductorio, en HTML (mismo formato que las 7 secciones).'
    )
    cierre_html = models.TextField(
        blank=True, default='',
        help_text='Párrafos de cierre y "Atentamente,", en HTML.'
    )
    firma_nombre = models.CharField(max_length=255, blank=True, default='')
    firma_cargo = models.CharField(max_length=255, blank=True, default='')
    firma_email = models.CharField(max_length=255, blank=True, default='')

    cumplimiento = models.CharField(max_length=15, choices=CUMPLIMIENTO_CHOICES, blank=True)
    evaluacion_director = models.TextField(blank=True)
    fecha_evaluacion = models.DateField(null=True, blank=True)
    evaluado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='informes_evaluados')
    archivo_adjunto = models.FileField(
        upload_to=informe_adjunto_upload_path,
        null=True,
        blank=True,
        help_text="Archivo de evidencia adjunto al informe (PDF, ZIP, etc.)"
    )
    evidencia = models.FileField(
        upload_to=informe_evidencia_upload_path,
        null=True,
        blank=True,
        help_text="Evidencia digital del informe final (PDF/Imagen)"
    )
    fecha_modificacion = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Informe de Fondo"
        verbose_name_plural = "Informes de Fondos"
        ordering = ['-fecha_elaboracion']
    
    def __str__(self):
        return f"Informe {self.get_tipo_display()} - {self.fondo_tiempo.docente.nombre_completo}"

    def save(self, *args, **kwargs):
        # Las imágenes insertadas en el editor llegan en base64: se guardan como
        # archivos en media y en la BD queda solo la ruta (ver informe_imagenes).
        from fondos.utils.informe_imagenes import extraer_imagenes_informe, limpiar_imagenes_huerfanas

        cambiados = extraer_imagenes_informe(self)
        if cambiados and kwargs.get('update_fields') is not None:
            kwargs['update_fields'] = set(kwargs['update_fields']) | set(cambiados)
        super().save(*args, **kwargs)
        limpiar_imagenes_huerfanas(self)


@receiver(post_delete, sender=InformeFondo)
def limpiar_imagenes_de_informe_borrado(sender, instance, **kwargs):
    from fondos.utils.informe_imagenes import limpiar_imagenes_huerfanas
    try:
        limpiar_imagenes_huerfanas(instance)
    except FondoTiempo.DoesNotExist:
        pass


class InformeAsignaturaEjecutada(models.Model):
    """Materias ejecutadas reportadas dinámicamente en el informe final."""

    fondo_tiempo = models.ForeignKey(FondoTiempo, on_delete=models.CASCADE, related_name='asignaturas_ejecutadas')
    nombre_materia = models.CharField(max_length=200)
    inscritos = models.PositiveIntegerField(default=0)
    aprobados = models.PositiveIntegerField(default=0)
    reprobados = models.PositiveIntegerField(default=0)
    habilitados = models.PositiveIntegerField(default=0)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Asignatura Ejecutada en Informe"
        verbose_name_plural = "Asignaturas Ejecutadas en Informes"
        ordering = ['nombre_materia']

    def __str__(self):
        return f"{self.nombre_materia} - {self.fondo_tiempo.docente.nombre_completo}"


class ObservacionFondo(models.Model):
    """Hilo de conversación de observaciones"""
    
    fondo_tiempo = models.ForeignKey(FondoTiempo, on_delete=models.CASCADE, related_name='observaciones_detalladas')
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    
    # Estado de resolución
    resuelta = models.BooleanField(default=False)
    resuelta_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='observaciones_resueltas')
    fecha_resolucion = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        verbose_name = "Observación"
        verbose_name_plural = "Observaciones"
        ordering = ['-fecha_creacion']
    
    def __str__(self):
        return f"Observación #{self.id} - Fondo {self.fondo_tiempo.id}"
    
    def marcar_resuelta(self, usuario):
        """Marca el hilo como resuelto"""
        from django.utils import timezone
        self.resuelta = True
        self.resuelta_por = usuario
        self.fecha_resolucion = timezone.now()
        self.save()
    
    def reabrir(self):
        """Reabre el hilo si se agrega un nuevo mensaje"""
        if self.resuelta:
            self.resuelta = False
            self.resuelta_por = None
            self.fecha_resolucion = None
            self.save()


class MensajeObservacion(models.Model):
    """Mensaje individual dentro de un hilo de observación"""

    observacion = models.ForeignKey(ObservacionFondo, on_delete=models.CASCADE, related_name='mensajes')
    autor = models.ForeignKey(User, on_delete=models.PROTECT, related_name='mensajes_observacion')
    responde_a = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='respuestas'
    )
    texto = models.TextField()
    fecha = models.DateTimeField(auto_now_add=True)
    leido_en = models.DateTimeField(null=True, blank=True)
    es_admin = models.BooleanField(default=False)  # True si lo envió un admin/director
    es_interno = models.BooleanField(
        default=False,
        help_text=(
            'Si es True, el mensaje es una nota interna entre Director y Jefe de '
            'Estudios: no se muestra al docente dueño del fondo, solo a Director, '
            'Jefe de Estudios y administradores.'
        ),
    )

    class Meta:
        verbose_name = "Mensaje de Observación"
        verbose_name_plural = "Mensajes de Observación"
        ordering = ['fecha']
    
    def __str__(self):
        return f"Mensaje de {self.autor.username} - {self.fecha.strftime('%d/%m/%Y %H:%M')}"

    def marcar_como_leido(self):
        if not self.leido_en:
            from django.utils import timezone
            self.leido_en = timezone.now()
            self.save(update_fields=['leido_en'])


class HistorialFondo(models.Model):
    """Historial de cambios para auditoría"""

    TIPO_CAMBIO_CHOICES = [
        ('creacion', 'Creación'),
        ('edicion', 'Edición'),
        ('presentacion', 'Presentación'),
        ('validacion', 'Validación'),
        ('aprobacion', 'Aprobación'),
        ('observacion', 'Observación'),
        ('rechazo', 'Rechazo'),
        ('inicio_ejecucion', 'Inicio de Ejecución'),
        ('informe_presentado', 'Informe Presentado'),
        ('finalizacion', 'Finalización'),
        ('archivado', 'Archivado'),
    ]

    fondo_tiempo = models.ForeignKey(FondoTiempo, on_delete=models.CASCADE, related_name='historial')
    usuario = models.ForeignKey(User, on_delete=models.PROTECT)
    fecha = models.DateTimeField(auto_now_add=True)
    tipo_cambio = models.CharField(max_length=20, choices=TIPO_CAMBIO_CHOICES)
    descripcion = models.TextField()
    estado_anterior = models.CharField(max_length=30, blank=True)
    estado_nuevo = models.CharField(max_length=30, blank=True)
    datos_cambio = models.JSONField(default=dict, blank=True, help_text="Snapshot de los datos modificados")

    class Meta:
        verbose_name = "Historial"
        verbose_name_plural = "Historiales"
        ordering = ['-fecha']
    
    def __str__(self):
        return f"{self.get_tipo_cambio_display()} - {self.fecha.strftime('%d/%m/%Y %H:%M')}"


class AsignacionCarrera(models.Model):
    """Vincula un usuario con una carrera, un rol y, opcionalmente, un docente."""

    ROLES = [
        ('iiisyp', 'Instituto I.I.S. y P.'),
        ('director', 'Director de Carrera'),
        ('jefe_estudios', 'Jefe de Estudios'),
        ('docente', 'Docente'),
    ]

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='asignaciones_carrera')
    carrera = models.ForeignKey(Carrera, on_delete=models.PROTECT, null=True, blank=True, related_name='asignaciones_carrera')
    rol = models.CharField(max_length=20, choices=ROLES)
    docente = models.ForeignKey(Docente, on_delete=models.SET_NULL, null=True, blank=True, related_name='asignaciones_carrera')
    activo = models.BooleanField(default=True)
    # Jefe de Estudios: resolución del Consejo de Carrera (PDF) que lo designa.
    resolucion_consejo = models.FileField(upload_to=resolucion_consejo_upload_path, null=True, blank=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    # Auditoría: quién cambió qué y cuándo (usuario vía HistoryRequestMiddleware).
    history = HistoricalRecords()

    class Meta:
        verbose_name = "Asignación de Carrera"
        verbose_name_plural = "Asignaciones de Carrera"
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'carrera', 'rol'],
                name='uniq_usuario_carrera_rol_asignacion',
            ),
        ]

    def __str__(self):
        usuario = self.user.username if self.user else 'Sin usuario'
        carrera = self.carrera.nombre if self.carrera else 'Sin carrera'
        return f"{usuario} - {carrera} - {self.get_rol_display()}"


class PerfilUsuario(models.Model):
    """Perfil extendido para usuarios del sistema.

    Ahora incluye acceso a DatosLaborales para que los roles administrativos
    puros (Director, Jefe de Estudios, IIISYP) tengan sus propios derechos
    de vacaciones y feriados, aunque no tengan ficha de Docente.
    """

    ROLES = [
        ('iiisyp', 'Instituto I.I.S. y P.'),
        ('director', 'Director de Carrera'),
        ('jefe_estudios', 'Jefe de Estudios'),
        ('docente', 'Docente'),
    ]

    user = models.OneToOneField(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='perfil')
    docente = models.ForeignKey(Docente, on_delete=models.SET_NULL, null=True, blank=True, related_name='perfiles_usuario')

    # === Datos laborales: si el usuario es administrativo puro,
    #     tiene sus propios DatosLaborales. Si también es Docente,
    #     puede compartir los del docente (ver propiedad). ===
    datos_laborales = models.ForeignKey(
        DatosLaborales,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='perfiles',
        help_text="Datos de empleo para usuarios administrativos. "
                  "Si es null y tiene docente, se usan los del docente."
    )

    ci = models.CharField(max_length=20, blank=True, null=True, unique=True, verbose_name='Cedula de Identidad')
    # Vacío solo para el superusuario: no tiene rol de carrera (ni es 'iiisyp').
    rol = models.CharField(max_length=20, choices=ROLES, default='docente', blank=True)
    carrera = models.ForeignKey(Carrera, on_delete=models.PROTECT, null=True, blank=True)
    telefono = models.CharField(max_length=20, blank=True)
    foto_perfil = models.ImageField(upload_to=foto_perfil_upload_path, null=True, blank=True)
    # Almacenamiento antiguo (cifrado en la BD). Solo lectura: ver organizar_media.
    foto_perfil_cifrada = models.BinaryField(null=True, blank=True, editable=False)
    foto_perfil_mime = models.CharField(max_length=64, blank=True, default='')
    debe_cambiar_password = models.BooleanField(default=True, help_text="Indica si el usuario debe cambiar su contraseña en el próximo inicio de sesión")
    activo = models.BooleanField(default=True)
    # Desactivación automática (no manual): usuario solo docente sin ficha de
    # docente. Se reactiva solo al crearle la ficha.
    inactivo_por_ficha_pendiente = models.BooleanField(default=False)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    # Auditoría: quién cambió qué y cuándo (usuario vía HistoryRequestMiddleware).
    history = HistoricalRecords(excluded_fields=['foto_perfil_cifrada'])

    class Meta:
        verbose_name = "Perfil de Usuario"
        verbose_name_plural = "Perfiles de Usuarios"
        # Director, Jefe de Estudios e Instituto (IIISyP) únicos por carrera: se
        # valida con las AsignacionCarrera activas (validar_unicidad_cargo_por_carrera).

    def __str__(self):
        username = self.user.username if self.user else 'Sin usuario'
        return f"{username} - {self.get_rol_display()}"

    # ================================================================
    # Acceso unificado a DatosLaborales (Docente y Administrativo)
    # ================================================================

    def obtener_datos_laborales(self):
        """
        Retorna los DatosLaborales de este usuario.

        Prioridad:
        1. Si tiene datos_laborales propios → los retorna
        2. Si tiene docente vinculado → retorna docente.datos_laborales
        3. Si no tiene ninguno → retorna None

        Esto garantiza que una persona con doble rol (ej: Director + Docente)
        tenga un solo saldo de vacaciones.
        """
        if self.datos_laborales:
            return self.datos_laborales
        if self.docente and self.docente.datos_laborales:
            return self.docente.datos_laborales
        return None

    @property
    def fecha_ingreso(self):
        """Accede a fecha_ingreso desde DatosLaborales (propio o del docente)."""
        datos = self.obtener_datos_laborales()
        return datos.fecha_ingreso if datos else None

    @property
    def dias_vacacion(self):
        """Accede a dias_vacacion desde DatosLaborales (propio o del docente)."""
        datos = self.obtener_datos_laborales()
        return datos.calcular_dias_vacacion() if datos else 0

    def calcular_antiguedad(self, fecha_referencia=None):
        """Años completos de antigüedad (ver DatosLaborales.calcular_antiguedad)."""
        datos = self.obtener_datos_laborales()
        if datos:
            return datos.calcular_antiguedad(fecha_referencia)
        return 0

    def calcular_dias_vacacion(self, fecha_referencia=None):
        """Días de vacación según antigüedad (Art. 11 y 24)."""
        datos = self.obtener_datos_laborales()
        if datos:
            return datos.calcular_dias_vacacion(fecha_referencia)
        return 0

    # ================================================================
    # Métodos existentes
    # ================================================================

    def get_asignaciones_activas(self):
        if not self.user_id:
            return AsignacionCarrera.objects.none()
        return self.user.asignaciones_carrera.filter(activo=True).select_related('carrera', 'docente')

    def get_carreras_activas(self):
        if not self.user_id:
            return Carrera.objects.none()
        return Carrera.objects.filter(
            asignaciones_carrera__user=self.user,
            asignaciones_carrera__activo=True,
        ).distinct()

    def get_carrera_activa_id(self):
        return self.carrera_id

    def set_foto_perfil(self, uploaded_file):
        """Guarda la foto en media/usuarios/usuario_<id>/ (reemplaza la anterior)."""
        _guardar_imagen(self.foto_perfil, uploaded_file)
        self.foto_perfil_mime = getattr(uploaded_file, 'content_type', '') or ''
        self.foto_perfil_cifrada = None

    def clear_foto_perfil(self):
        if self.foto_perfil and self.foto_perfil.name:
            self.foto_perfil.delete(save=False)
        self.foto_perfil = None
        self.foto_perfil_cifrada = None
        self.foto_perfil_mime = ''

    @property
    def tiene_foto_propia(self):
        return bool((self.foto_perfil and self.foto_perfil.name) or self.foto_perfil_cifrada)

    def get_foto_perfil_data_uri(self):
        # Primero la foto propia del usuario (archivo en media o, si aún no se
        # migró, la del almacenamiento cifrado antiguo).
        propia = (
            _imagen_a_data_uri(self.foto_perfil, self.foto_perfil_mime)
            or _descifrar_imagen_legado(self.foto_perfil_cifrada, self.foto_perfil_mime)
        )
        if propia:
            return propia

        # Si no tiene foto propia, usa el logo de su carrera asignada.
        if self.carrera:
            return self.carrera.get_logo_carrera_data_uri()

        return None


@receiver(post_save, sender=User)
def crear_perfil_usuario(sender, instance, created, **kwargs):
    if created:
        # El superusuario no tiene rol de carrera: sus permisos salen de is_superuser.
        rol_inicial = '' if instance.is_superuser else 'docente'
        # Si es superusuario (creado por consola), no obligar cambio de contraseña
        debe_cambiar = not instance.is_superuser
        PerfilUsuario.objects.create(user=instance, rol=rol_inicial, debe_cambiar_password=debe_cambiar)

@receiver(post_save, sender=User)
def guardar_perfil_usuario(sender, instance, **kwargs):
    # Usuario desactivado: se liberan TODAS sus asignaciones (también Director y
    # Jefe de Estudios), para que el cargo se pueda asignar a otra persona.
    if not instance.is_active:
        actualizar_con_historial(AsignacionCarrera.objects.filter(user=instance, activo=True), activo=False)

    perfil = PerfilUsuario.objects.filter(user=instance).first()

    if not perfil:
        return

    updates = {'activo': instance.is_active}

    if instance.is_superuser:
        updates['rol'] = ''
        updates['carrera'] = None
        updates['debe_cambiar_password'] = False

    for field, value in updates.items():
        setattr(perfil, field, value)

    perfil.save(update_fields=list(updates.keys()))

@receiver(post_save, sender=Docente)
def crear_datos_laborales_si_no_existen(sender, instance, created, **kwargs):
    """
    Si un Docente se crea sin datos_laborales (migración legacy),
    crear un registro de DatosLaborales con sus datos actuales.
    """
    if not instance.datos_laborales_id:
        # Esto no debería pasar en código nuevo, pero es seguro para legacy
        datos, created_dl = DatosLaborales.objects.get_or_create(
            ci=instance.ci if hasattr(instance, 'ci') and instance.ci else f"TEMP_{instance.pk}",
            defaults={
                'fecha_ingreso': instance.fecha_ingreso if hasattr(instance, 'fecha_ingreso') else timezone.localdate(),
                'dias_vacacion': instance.dias_vacacion if hasattr(instance, 'dias_vacacion') else 15,
            }
        )
        if created_dl:
            actualizar_con_historial(Docente.objects.filter(pk=instance.pk), datos_laborales=datos)

@receiver(post_save, sender=Actividad)
@receiver(post_delete, sender=Actividad)
def actualizar_horas_categoria(sender, instance, **kwargs):
    """Actualiza el total de horas de la categoría al modificar actividades"""
    categoria = instance.categoria
    total = categoria.actividades.aggregate(models.Sum('horas_año'))['horas_año__sum'] or 0
    categoria.total_horas = total
    categoria.save()

@receiver(post_save, sender=Docente)
def actualizar_fondos_docente(sender, instance, **kwargs):
    """
    Sincroniza los fondos de tiempo cuando cambian datos críticos del docente
    (antigüedad, vacaciones) para recalcular horas efectivas.
    """
    fondos = FondoTiempo.objects.filter(docente=instance)
    for fondo in fondos:
        fondo.save()

@receiver(post_save, sender=DocenteCarrera)
def actualizar_fondos_al_cambiar_vinculo(sender, instance, **kwargs):
    """
    Sincroniza los fondos de tiempo cuando cambia la dedicación del vínculo.
    """
    fondos = FondoTiempo.objects.filter(
        docente=instance.docente,
        carrera=instance.carrera
    )
    for fondo in fondos:
        fondo.save()


@receiver(post_save, sender=AsignacionCarrera)
@receiver(post_delete, sender=AsignacionCarrera)
def auto_poblar_responsable_carrera(sender, instance, **kwargs):
    """
    Cuando se asigna un director a una carrera, auto-pobla el campo
    'responsable' de la Carrera con el nombre completo del docente
    vinculado al director. Si no hay docente vinculado, usa el nombre
    del usuario.
    """
    if instance.rol != 'director' or not instance.activo:
        return

    carrera = getattr(instance, 'carrera', None)
    if not carrera:
        return

    # Determinar el nombre del responsable
    responsable_nombre = ''
    if instance.docente:
        responsable_nombre = instance.docente.nombre_completo
    elif instance.user:
        responsable_nombre = f"{instance.user.first_name} {instance.user.last_name}".strip() or instance.user.username

    if responsable_nombre and carrera.responsable != responsable_nombre:
        Carrera.objects.filter(pk=carrera.pk).update(responsable=responsable_nombre)
