import sys
import re

filepath = r'c:\Users\DenyTv\OneDrive\Desktop\avance proyecto\fondo_tiempo_uabjb\frontend\src\components\DetalleFondo.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Change col-span-6 to col-span-9
target_6 = '            {/* COLUMNA CENTRAL (CONTENIDO PRINCIPAL) */}\n            {/* ================================================= */}\n            <div className="lg:col-span-6 space-y-8">'
replacement_9 = '            {/* COLUMNA CENTRAL Y DERECHA COMBINADAS */}\n            {/* ================================================= */}\n            <div className="lg:col-span-9 space-y-8">'
if target_6 in content:
    content = content.replace(target_6, replacement_9)
else:
    print("Could not find COLUMNA CENTRAL target!")

# 2. Extract the Acciones widgets
start_marker = '            {/* Widget Estado */}'
end_marker = '            {/* Widget Observaciones Pendientes (si aplica) */}'
end_widget_str = '              </div>\n            )}'

start_idx = content.find(start_marker)
end_obs_idx = content.find(end_marker)
end_idx = content.find(end_widget_str, end_obs_idx) + len(end_widget_str)
widgets_content = content[start_idx:end_idx]

# Remove the whole right panel (from the marker down to its closing divs)
panel_derecho_marker = '          {/* PANEL DERECHO - Widgets de acciones */}'
panel_derecho_start = content.find(panel_derecho_marker) - 60
if panel_derecho_start < 0: panel_derecho_start = content.find(panel_derecho_marker)

# We want to remove from panel_derecho_start down to the end of the col-span-3 div
# Basically, right after widgets_content, there are a few closing divs
closing_divs = content[end_idx:content.find('      </div>', end_idx)]
# There should be `\n\n          </div>\n        </div>\n\n`
panel_derecho_end = content.find('          </div>\n        </div>', panel_derecho_start) + len('          </div>\n        </div>')

content = content[:panel_derecho_start] + '\n        </div>' + content[panel_derecho_end:]


# 3. Inject the grid and widgets around DistribuirHoras
distribuir_start = content.find('              {/* Distribuir Horas (Solo editable en borrador/observado) */}')
distribuir_end_str = '                  </p>\n                </div>\n              )}'
distribuir_end = content.find(distribuir_end_str, distribuir_start) + len(distribuir_end_str)

distribuir_content = content[distribuir_start:distribuir_end]

nested_grid = f"""              {{/* DISTRIBUCIÓN Y WIDGETS DERECHOS EN LA MISMA FILA */}}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {{/* Izquierda: Distribuir Horas (2/3) */}}
                <div className="xl:col-span-2">
{distribuir_content}
                </div>

                {{/* Derecha: Acciones y otros widgets (1/3) */}}
                <div className="xl:col-span-1 space-y-6">
{widgets_content}
                </div>
              </div>"""

content = content[:distribuir_start] + nested_grid + content[distribuir_end:]

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
