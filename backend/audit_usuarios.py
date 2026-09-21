#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from fondos.models import PerfilUsuario

print('='*80)
print('USER AUDIT REPORT - SISTEMA DOCENTES UABJB')
print('='*80)

# General statistics
total_users = User.objects.count()
active_users = User.objects.filter(is_active=True).count()
inactive_users = User.objects.filter(is_active=False).count()
superusers = User.objects.filter(is_superuser=True).count()
staff_users = User.objects.filter(is_staff=True).count()

print(f'\n📊 GENERAL STATISTICS:')
print(f'   Total Users: {total_users}')
print(f'   Active Users: {active_users}')
print(f'   Inactive Users: {inactive_users}')
print(f'   Superusers: {superusers}')
print(f'   Staff Users: {staff_users}')

# Users by role
print(f'\n👥 USERS BY ROLE:')
roles = PerfilUsuario.objects.values('rol').annotate(count=__import__('django.db.models', fromlist=['Count']).Count('id')).order_by('-count')
for role_info in roles:
    role = role_info['rol'] or 'NOT_ASSIGNED'
    count = role_info['count']
    print(f'   {role}: {count}')

# Users without profile
users_without_profile = User.objects.filter(perfil__isnull=True).count()
print(f'\n⚠️  Users without PerfilUsuario: {users_without_profile}')

# Detailed user list
print(f'\n📋 DETAILED USER LIST:')
print('-'*80)
print(f'{"ID":<4} {"Username":<15} {"Email":<25} {"Staff":<6} {"Super":<6} {"Active":<7} {"Role":<15} {"Carrera":<10} {"Last Login":<20}')
print('-'*80)

users = User.objects.all().order_by('username')
for u in users:
    perfil = PerfilUsuario.objects.filter(user=u).first()
    rol = perfil.rol if perfil else 'N/A'
    carrera = perfil.carrera.codigo if (perfil and perfil.carrera) else 'N/A'
    activo = 'YES' if u.is_active else 'NO'
    staff = 'YES' if u.is_staff else 'NO'
    super = 'YES' if u.is_superuser else 'NO'
    last_login = u.last_login.strftime('%Y-%m-%d %H:%M') if u.last_login else 'Never'
    
    print(f'{u.id:<4} @{u.username:<14} {u.email:<25} {staff:<6} {super:<6} {activo:<7} {str(rol):<15} {str(carrera):<10} {last_login:<20}')

print('-'*80)

# Users with must_change_password flag
print(f'\n🔐 Users with debe_cambiar_password=True:')
users_must_change = PerfilUsuario.objects.filter(debe_cambiar_password=True)
for perfil in users_must_change:
    if perfil.user:
        print(f'   @{perfil.user.username} (Rol: {perfil.rol})')

if not users_must_change:
    print('   None')

print('\n' + '='*80)
print('END OF AUDIT REPORT')
print('='*80)
