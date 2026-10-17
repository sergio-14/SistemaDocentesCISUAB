"""Usuario sugerido al crear una cuenta, a partir del nombre completo (sin azar):
inicial del primer nombre + primer apellido (William Chao Rivero → WChao); si ya existe,
se agrega la inicial del segundo apellido (WChaoR) y después un número (WChao2, WChao3…).
La comparación no distingue mayúsculas, como el inicio de sesión de la mayoría."""
import unicodedata

from django.contrib.auth.models import User


def _limpiar(palabra):
    """Sin tildes ni símbolos: 'Peña' → 'Pena', "D'Arcy" → 'DArcy'."""
    sin_tildes = unicodedata.normalize('NFKD', palabra).encode('ascii', 'ignore').decode('ascii')
    return ''.join(letra for letra in sin_tildes if letra.isalnum())


def _separar(nombre_completo):
    """(nombres, apellidos): con 3 palabras, 1 nombre y 2 apellidos; con 4 o más, los dos
    últimos son los apellidos; con 2, nombre y apellido."""
    palabras = [_limpiar(palabra) for palabra in str(nombre_completo or '').split()]
    palabras = [palabra for palabra in palabras if palabra]
    if len(palabras) >= 4:
        return palabras[:-2], palabras[-2:]
    return palabras[:1], palabras[1:]


def usuario_sugerido(nombre_completo, existe=None):
    existe = existe or (lambda usuario: User.objects.filter(username__iexact=usuario).exists())
    nombres, apellidos = _separar(nombre_completo)
    if not nombres:
        return ''
    if not apellidos:
        base = nombres[0].capitalize()
    else:
        base = nombres[0][0].upper() + apellidos[0].capitalize()
    candidatos = [base]
    if len(apellidos) > 1:
        candidatos.append(base + apellidos[1][0].upper())
    for candidato in candidatos:
        if not existe(candidato):
            return candidato
    numero = 2
    while existe(f'{base}{numero}'):
        numero += 1
    return f'{base}{numero}'
