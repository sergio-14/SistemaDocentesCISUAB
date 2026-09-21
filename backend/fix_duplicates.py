import sqlite3
import os

def fix_duplicates():
    db_path = 'db.sqlite3'
    
    if not os.path.exists(db_path):
        print(f"❌ No se encontró el archivo {db_path}")
        return

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        print("🔍 Buscando materias con siglas duplicadas...")
        
        # Verificar si hay duplicados
        # Nota: Usamos 'fondos_materia' asumiendo que es el nombre de la tabla en Django
        cursor.execute("SELECT sigla, COUNT(*) FROM fondos_materia GROUP BY sigla HAVING COUNT(*) > 1")
        duplicados = cursor.fetchall()

        if not duplicados:
            print("✅ No se encontraron duplicados. Intenta ejecutar 'python manage.py migrate' nuevamente.")
        else:
            print(f"⚠️ Se encontraron {len(duplicados)} siglas duplicadas.")
            
            # Eliminar duplicados dejando solo uno (el de menor ID)
            print("🛠️ Eliminando registros duplicados...")
            cursor.execute("""
                DELETE FROM fondos_materia 
                WHERE id NOT IN (
                    SELECT MIN(id) 
                    FROM fondos_materia 
                    GROUP BY sigla
                )
            """)
            
            eliminados = cursor.rowcount
            conn.commit()
            print(f"✅ Se eliminaron {eliminados} registros duplicados exitosamente.")
            print("🚀 Ahora puedes ejecutar: python manage.py migrate")

    except sqlite3.OperationalError as e:
        print(f"❌ Error de base de datos: {e}")
    except Exception as e:
        print(f"❌ Error inesperado: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    fix_duplicates()