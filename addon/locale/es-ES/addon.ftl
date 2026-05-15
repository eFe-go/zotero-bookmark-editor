plugin-name = Editor de marcadores
# Botones del panel lateral (visibles arriba del arbol de outline)
outline = Indice (Editor de marcadores)
bookmark = Marcadores (Editor de marcadores)
# Botones de la barra de outline (tooltip)
outline-expand-all = Expandir todo
outline-collapse-all = Colapsar todo
outline-add = Agregar marcador
outline-delete = Borrar marcador
outline-save-to-pdf = Guardar indice en el PDF (escribe el campo /Outlines dentro del archivo)
outline-import-pdf = Importar marcadores que el PDF ya tenga embebidos
outline-import-pdf-confirm = El outline actual sera reemplazado con los marcadores embebidos del PDF. Tus cambios no guardados al PDF se pierden. Continuar?
outline-import-pdf-no-outline = Este PDF no tiene marcadores embebidos para importar.
outline-open-editor = Abrir editor de niveles en una ventana grande
# Modal del editor de niveles
level-editor-title = Editor de niveles
level-editor-save = Guardar
level-editor-discard = Descartar
level-editor-move-up = Subir entre hermanos
level-editor-move-down = Bajar entre hermanos
level-editor-nest = Anidar (mover hacia adentro)
level-editor-unnest = Desanidar (mover hacia afuera)
level-editor-discard-confirm = Tenes cambios sin guardar. Descartarlos?
level-editor-new-sibling = Nuevo marcador (hermano)
level-editor-new-child = Nuevo marcador (hijo del seleccionado)
level-editor-delete = Borrar marcador seleccionado
level-editor-rename = Renombrar marcador (F2)
level-editor-expand-all = Expandir todo
level-editor-collapse-all = Colapsar todo
level-editor-status-count = { $count } marcadores
level-editor-status-levels = { $levels } niveles
level-editor-status-modified = modificado
level-editor-export-ai = Copiar el indice como JSON para pegarlo en una IA
level-editor-import-json = Pegar un indice en JSON (devuelto por una IA)
level-editor-copied = Copiado al portapapeles
level-editor-copy-failed = No se pudo copiar al portapapeles
level-editor-import-title = Importar indice desde JSON
level-editor-import-help = Pega aca el JSON que te devolvio la IA. La estructura es: { "{" } "outline": [ { "{" } "title": "...", "page": 1, "children": [...] { "}" } ] { "}" }
level-editor-import-placeholder = Pega aca tu JSON...
level-editor-import-apply = Aplicar y reemplazar
level-editor-import-cancel = Cancelar
level-editor-import-invalid = JSON invalido: { $error }
level-editor-import-confirm = Esto reemplaza TODO el indice actual. Continuar?
level-editor-import-success = Indice importado: { $count } marcadores
outline-edit-placeholder = Titulo del marcador
outline-new-node-title = Nuevo marcador
outline-delete-confirm =
    Este nodo tiene hijos. Borrarlo igual?
    { " " }
    Si lo borras, tambien se borran todos los hijos.
outline-empty-prompt = Haces click en { $icon } para crear tu primer marcador
# Botones de la barra de bookmarks (tooltip)
bookmark-add = Agregar marcador
bookmark-delete = Borrar marcador
