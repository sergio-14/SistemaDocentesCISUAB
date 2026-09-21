#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from fondos.models import Docente, DatosLaborales, PerfilUsuario
from django.utils import timezone

print('=' * 60)
print('PRUEBA DE REFACTORIZACIÓN: DatosLaborales')
print('=' * 60)

# Test 1: Verificar que el modelo existente funciona
print('\n[Test 1] Datos existentes en la base de datos...')
dl_count = DatosLaborales.objects.count()
docente_count = Docente.objects.count()
perfil_count = PerfilUsuario.objects.count()
print(f'  DatosLaborales: {dl_count}')
print(f'  Docentes: {docente_count}')
print(f'  Perfiles: {perfil_count}')

# Test 2: Verificar propiedades de compatibilidad en Docente
if docente_count > 0:
    print('\n[Test 2] Propiedades de compatibilidad en Docente...')
    docente = Docente.objects.first()
    print(f'  Docente: {docente.nombre_completo}')
    print(f'  ci (property): {docente.ci}')
    print(f'  fecha_ingreso (property): {docente.fecha_ingreso}')
    print(f'  dias_vacacion (property): {docente.dias_vacacion}')
    print(f'  horas_feriados_gestion (property): {docente.horas_feriados_gestion}')
    print(f'  calcular_dias_vacacion(2026): {docente.calcular_dias_vacacion(2026)}')
    print(f'  calcular_antiguedad(2026): {docente.calcular_antiguedad(2026)}')
    print('  ✓ OK')

# Test 3: Verificar PerfilUsuario.obtener_datos_laborales()
if perfil_count > 0:
    print('\n[Test 3] PerfilUsuario.obtener_datos_laborales()...')
    perfil = PerfilUsuario.objects.first()
    datos = perfil.obtener_datos_laborales()
    print(f'  Perfil: {perfil}')
    print(f'  datos_laborales propios: {perfil.datos_laborales}')
    print(f'  docente vinculado: {perfil.docente}')
    print(f'  obtener_datos_laborales(): {datos}')
    if datos:
        print(f'    CI: {datos.ci}')
        print(f'    dias_vacacion: {datos.dias_vacacion}')
        print(f'    horas_feriados_gestion: {datos.horas_feriados_gestion}')
    print('  ✓ OK')

# Test 4: Verificar serializer
print('\n[Test 4] Serializer roundtrip...')
from fondos.serializers import DocenteSerializer, PerfilUsuarioSerializer, DatosLaboralesSerializer

if docente_count > 0:
    docente = Docente.objects.first()
    serializer = DocenteSerializer(docente)
    data = serializer.data
    print(f'  DocenteSerializer data keys: {list(data.keys())[:10]}...')
    assert 'ci' in data, 'ci should be in serialized data'
    assert 'fecha_ingreso' in data, 'fecha_ingreso should be in serialized data'
    assert 'dias_vacacion' in data, 'dias_vacacion should be in serialized data'
    print('  ✓ OK')

if perfil_count > 0:
    perfil = PerfilUsuario.objects.first()
    serializer = PerfilUsuarioSerializer(perfil)
    data = serializer.data
    print(f'  PerfilUsuarioSerializer data keys: {list(data.keys())[:15]}...')
    assert 'fecha_ingreso' in data, 'fecha_ingreso should be in serialized data'
    assert 'dias_vacacion' in data, 'dias_vacacion should be in serialized data'
    print('  ✓ OK')

print('\n' + '=' * 60)
print('✓ TODAS LAS PRUEBAS PASARON - REFACTORIZACIÓN EXITOSA')
print('=' * 60)
