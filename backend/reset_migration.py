import sqlite3

conn = sqlite3.connect('db.sqlite3')
cur = conn.cursor()

print('=== Check 0054 migration record ===')
cur.execute("SELECT name, applied FROM django_migrations WHERE app='fondos' AND name='0054_docente_carrera_obligatoria'")
result = cur.fetchone()

if result:
    print(f'Found: {result[0]} (applied: {result[1]})')
    cur.execute("DELETE FROM django_migrations WHERE app='fondos' AND name='0054_docente_carrera_obligatoria'")
    conn.commit()
    print('Deleted migration record')
else:
    print('Not found: 0054 is not recorded')

print('\n=== Check carrera field in Docente ===')
cur.execute("PRAGMA table_info(fondos_docente)")
cols = {row[1]: row for row in cur.fetchall()}

if 'carrera_id' in cols:
    print('carrera_id column EXISTS - need to drop it')
    cur.execute("ALTER TABLE fondos_docente DROP COLUMN carrera_id")
    conn.commit()
    print('Dropped carrera_id column')
else:
    print('carrera_id column does not exist (good)')

conn.close()
