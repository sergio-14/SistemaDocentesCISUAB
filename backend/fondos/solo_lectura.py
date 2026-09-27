"""Una carrera desactivada queda como histórico de solo lectura.

Todos, incluido el superusuario, pueden ver sus datos, pero cualquier escritura
(POST/PUT/PATCH/DELETE, incluidas las acciones personalizadas) se rechaza si
toca una carrera inactiva:

1. la del objeto de la URL,
2. la de las relaciones que vienen en el cuerpo de la petición, o
3. la carrera en la que el usuario está trabajando (cada módulo la define).

La única excepción es que el superusuario edite la carrera para reactivarla
(ver CarreraViewSet.permite_escritura_en_carrera_inactiva).

Lo usan las vistas de fondos (fondos/views.py) y las del POA
(poa_document/api/views.py).
"""
import json

from django.core.exceptions import ObjectDoesNotExist, ValidationError
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import SAFE_METHODS

from .models import Carrera

MENSAJE_CARRERA_INACTIVA = 'La carrera está inactiva: sus datos son de solo lectura.'

# Atributos por los que un objeto llega a su carrera, en orden de preferencia.
# Cubre fondos (fondo, calendario, carga horaria, materia) y POA (documento,
# objetivo, actividad, orden de compra, recepción, evidencia).
RUTAS_A_CARRERA = (
    'carrera', 'unidad_solicitante',
    'fondo_tiempo', 'fondo', 'calendario_academico', 'calendario', 'carga_horaria', 'materia',
    'documento', 'objetivo', 'actividad', 'evidencia',
    'orden', 'recepcion', 'detalle_recepcion', 'detalle_orden',
)


def carrera_de_objeto(obj, profundidad=0):
    """Carrera a la que pertenece obj, o None si no se puede determinar."""
    if obj is None or profundidad > 6:
        return None
    if isinstance(obj, Carrera):
        return obj
    for atributo in RUTAS_A_CARRERA:
        try:
            relacionado = getattr(obj, atributo, None)
        except ObjectDoesNotExist:
            relacionado = None
        if relacionado is not None and hasattr(relacionado, '_meta'):
            return carrera_de_objeto(relacionado, profundidad + 1)
    return None


class CarreraInactivaSoloLecturaMixin:
    """Rechaza escrituras sobre carreras inactivas, también para el superusuario.

    Cada módulo indica qué campos del cuerpo apuntan a una carrera
    (`campos_con_carrera`) y en qué carrera trabaja el usuario
    (`carreras_de_contexto`).
    """

    MENSAJE_CARRERA_INACTIVA = MENSAJE_CARRERA_INACTIVA
    campos_con_carrera = {'carrera': Carrera}

    def carreras_de_contexto(self, request):
        return []

    def permite_escritura_en_carrera_inactiva(self, request):
        return False

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        user = request.user
        if request.method in SAFE_METHODS or not user or not user.is_authenticated:
            return
        if self.permite_escritura_en_carrera_inactiva(request):
            return
        for carrera in self._carreras_afectadas(request):
            if carrera is not None and not carrera.activo:
                raise PermissionDenied(self.MENSAJE_CARRERA_INACTIVA)

    @staticmethod
    def _buscar(modelo, pk):
        try:
            return modelo._default_manager.filter(pk=pk).first()
        except (ValueError, TypeError, ValidationError):
            return None

    def _relaciones_en_cuerpo(self, request):
        data = request.data
        bloques = [data] if hasattr(data, 'get') else []
        asignaciones = data.get('asignaciones') if hasattr(data, 'get') else None
        if isinstance(asignaciones, str):
            try:
                asignaciones = json.loads(asignaciones)
            except ValueError:
                asignaciones = None
        if isinstance(asignaciones, list):
            bloques.extend(item for item in asignaciones if isinstance(item, dict))

        for bloque in bloques:
            for campo, modelo in self.campos_con_carrera.items():
                valor = bloque.get(campo)
                if valor not in (None, '') and not isinstance(valor, (list, dict)):
                    yield carrera_de_objeto(self._buscar(modelo, valor))

    def _modelo_de_la_vista(self):
        # Varias vistas no declaran `queryset` y solo definen get_queryset().
        queryset = getattr(self, 'queryset', None)
        if queryset is not None:
            return queryset.model
        try:
            return self.get_queryset().model
        except (AttributeError, AssertionError, TypeError):
            meta = getattr(getattr(self, 'serializer_class', None), 'Meta', None)
            return getattr(meta, 'model', None)

    def _carreras_afectadas(self, request):
        # 1) El objeto de la URL (detalle y acciones detail=True).
        lookup = getattr(self, 'lookup_url_kwarg', None) or getattr(self, 'lookup_field', None)
        if lookup and lookup in self.kwargs:
            modelo = self._modelo_de_la_vista()
            if modelo is not None:
                yield carrera_de_objeto(self._buscar(modelo, self.kwargs[lookup]))

        # 2) Relaciones enviadas en el cuerpo (al crear o reasignar).
        yield from self._relaciones_en_cuerpo(request)

        # 3) La carrera en la que trabaja el usuario.
        yield from self.carreras_de_contexto(request)
