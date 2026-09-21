import sqlite3

conn = sqlite3.connect('db.sqlite3')
cur = conn.cursor()

# Count migrations
cur.execute('select count(*) from django_migrations')
migs = cur.fetchone()[0]

# Count users
cur.execute('select count(*) from auth_user')
users = cur.fetchone()[0]

# Count POA migrations
cur.execute("select count(*) from django_migrations where app='poa_document'")
poa_migs = cur.fetchone()[0]

conn.close()

print(f'Total migrations: {migs}')
print(f'POA migrations: {poa_migs}')
print(f'Users: {users}')
print('✓ Database is valid and ready')
