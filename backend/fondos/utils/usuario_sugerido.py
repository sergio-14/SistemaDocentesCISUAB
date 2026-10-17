"""Sugerencias de usuario al crear una cuenta, a partir del nombre completo: tres, de
patrones elegidos al azar cada vez (inicial + apellido, parte del nombre + parte del
apellido, apellido + inicial, iniciales + segundo apellido, etc.). Todas en minúsculas, sin
tildes ni ñ (á → a, ñ → n), sin espacios ni símbolos, de 4 a 20 caracteres y sin repetir un
usuario que ya existe (sin distinguir mayúsculas, como el inicio de sesión)."""
import random
import unicodedata

from django.contrib.auth.models import User
from django.db.models.functions import Lower

CANTIDAD = 3
MINIMO = 4
MAXIMO = 20


def _limpiar(palabra):
    """'Peña' → 'pena', "D'Arcy" → 'darcy'."""
    sin_tildes = unicodedata.normalize('NFKD', palabra).encode('ascii', 'ignore').decode('ascii')
    return ''.join(letra for letra in sin_tildes.lower() if letra.isalnum())


def _separar(nombre_completo):
    """(nombres, apellidos): con 3 palabras, 1 nombre y 2 apellidos; con 4 o más, los dos
    últimos son los apellidos; con 2, nombre y apellido."""
    palabras = [_limpiar(palabra) for palabra in str(nombre_completo or '').split()]
    palabras = [palabra for palabra in palabras if palabra]
    if len(palabras) >= 4:
        return palabras[:-2], palabras[-2:]
    return palabras[:1], palabras[1:]


def _patrones(nombres, apellidos):
    """Un usuario por patrón (los que no aplican, como los del segundo apellido cuando no
    hay, quedan fuera)."""
    n1 = nombres[0]
    n2 = nombres[1] if len(nombres) > 1 else ''
    a1 = apellidos[0]
    a2 = apellidos[1] if len(apellidos) > 1 else ''
    patrones = [
        n1[0] + a1,                    # inicial + apellido: wchao
        n1[:3] + a1[:4],               # 3 letras del nombre + 4 del apellido: wilchao
        n1[:4] + a1[:4],               # 4 + 4: willchao
        a1 + n1[0],                    # apellido + inicial: chaow
        a1[:4] + n1[:3],               # parte del apellido + parte del nombre: chaowil
        n1 + a1[0],                    # nombre + inicial del apellido: williamc
    ]
    if a2:
        patrones += [
            n1[:3] + a1[:3] + a2[:3],  # parte del nombre y de ambos apellidos: wilchariv
            n1[0] + a1[0] + a2,        # iniciales + segundo apellido: wcrivero
            n1[0] + a1 + a2[0],        # inicial + apellido + inicial del segundo: wchaor
        ]
    if n2:
        patrones.append(n1[0] + n2[0] + a1)  # iniciales de los nombres + apellido
    return patrones


def _validos(candidatos):
    vistos = []
    for candidato in candidatos:
        candidato = candidato[:MAXIMO]
        if len(candidato) >= MINIMO and candidato not in vistos:
            vistos.append(candidato)
    return vistos


def _existentes(candidatos):
    return set(
        User.objects.annotate(minuscula=Lower('username'))
        .filter(minuscula__in=candidatos).values_list('minuscula', flat=True)
    )


def sugerencias_usuario(nombre_completo, excluir=(), azar=None):
    """Hasta tres usuarios libres, en orden al azar. `excluir` son los que ya se mostraron
    ("Ver otras"): se evitan mientras haya otros; si no alcanzan, se repiten."""
    azar = azar or random
    nombres, apellidos = _separar(nombre_completo)
    if not nombres or not apellidos:
        return []
    candidatos = _validos(_patrones(nombres, apellidos))
    ocupados = _existentes(candidatos)
    libres = [candidato for candidato in candidatos if candidato not in ocupados]
    excluir = {_limpiar(usuario) for usuario in excluir}
    nuevos = [candidato for candidato in libres if candidato not in excluir]
    azar.shuffle(nuevos)
    elegidos = nuevos[:CANTIDAD]
    if len(elegidos) < CANTIDAD:
        repetidos = [candidato for candidato in libres if candidato not in elegidos]
        azar.shuffle(repetidos)
        elegidos += repetidos[:CANTIDAD - len(elegidos)]
    # Si casi todos están ocupados: un patrón con un número al final (wchao27).
    intentos = 0
    while len(elegidos) < CANTIDAD and candidatos and intentos < 50:
        intentos += 1
        base = azar.choice(candidatos)[:MAXIMO - 2]
        candidato = f'{base}{azar.randint(10, 99)}'
        if candidato not in elegidos and candidato not in _existentes([candidato]):
            elegidos.append(candidato)
    return elegidos
