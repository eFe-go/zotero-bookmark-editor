<div align="center">

# Bookmark Editor para Zotero

[![Zotero target version](https://img.shields.io/badge/Zotero-7%2B-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org) [![License: AGPL-3.0-or-later](https://img.shields.io/badge/License-AGPL--3.0--or--later-blue?style=flat-square)](LICENSE) [![Fork of Jasminum](https://img.shields.io/badge/fork%20of-Jasminum-purple?style=flat-square)](https://github.com/l0o0/jasminum)

**Editor minimalista de marcadores (outline) editables para PDFs en Zotero**

</div>

---

## Qué es

Un plugin de Zotero 7+ que agrega un panel editable en la barra lateral del lector de PDFs. Permite crear, renombrar, anidar, reordenar y borrar marcadores, y **escribirlos dentro del archivo PDF** (en el campo `/Outlines` del catálogo, según el estándar PDF). Los marcadores viajan con el archivo: cualquier lector que respete el estándar PDF (Adobe Acrobat, Xodo, SumatraPDF, la app de Android de Zotero, etc.) los va a ver.

## Por qué existe

Este plugin es un **fork minimalista** de [Jasminum](https://github.com/l0o0/jasminum) (de [l0o0](https://github.com/l0o0)). Jasminum es un plugin excelente, pero está orientado a la comunidad china y trae mucho que no le sirve a usuarios fuera de ese contexto: integración con CNKI, WanFang, Yiigle, ChinaDOI; descarga de traductores chinos; plugin de WPS Office; herramientas de nombres chinos.

Este fork extirpa todo eso y deja **sólo el módulo de marcadores y outline editables**, con UI en español e inglés.

## Cómo funciona internamente

Usa la librería [`pdf-lib`](https://github.com/Hopding/pdf-lib) (embebida en un Web Worker) para inyectar el outline dentro del archivo PDF respetando el spec PDF §12.3.3. La operación es:

```
1. Lee el PDF a memoria
2. Construye un PDFDict para cada bookmark (Title, Parent, Prev, Next, Dest)
3. Lo asigna al catalog.Outlines del documento
4. Reescribe el archivo PDF
```

Mientras no apretás "Guardar en el PDF", los marcadores viven en un JSON dentro de Zotero. Cuando guardás, quedan persistidos dentro del archivo.

## Instalación

1. Descargá el `.xpi` desde [Releases](https://github.com/eFe-go/zotero-bookmark-editor/releases)
2. En Zotero: **Tools → Plugins → ⚙️ → Install Plugin From File** → elegí el `.xpi`
3. Reiniciá Zotero

## Uso

1. Abrí un PDF en el lector de Zotero
2. En la barra lateral izquierda aparece un icono nuevo del plugin (📑)
3. Click → se despliega el panel
4. Usá los botones de la toolbar:
   - **➕** Agregar marcador en la página actual
   - **🗑** Borrar el marcador seleccionado
   - **💾** Guardar el outline dentro del archivo PDF
   - **⤢** Expandir todo / **⤡** Colapsar todo
5. Arrastrá nodos para reordenar y anidar
6. Doble click sobre el nombre para renombrarlo

### Atajos de teclado

| Tecla | Acción |
|---|---|
| ↑ / ↓ | Navegar entre marcadores |
| ← / → | Colapsar / expandir nodo |
| Espacio | Editar nombre |
| `[` / `]` | Mover marcador al nivel superior / inferior |
| `\` | Crear marcador hijo |
| Delete / Backspace | Borrar marcador |

## Compatibilidad

- **Zotero 7+** (compatible con Zotero 8 cuando se libere)
- Funciona con PDFs almacenados (`stored attachments`) y vinculados (`linked attachments`)
- Los marcadores escritos al PDF son leídos por Adobe Acrobat, Xodo, SumatraPDF, Foxit, PDF-XChange y la app oficial de Zotero para Android

## Desarrollo

```bash
pnpm install
pnpm start    # dev con hot reload
pnpm build    # genera el .xpi en build/
```

Stack: TypeScript + [zotero-plugin-scaffold](https://github.com/windingwind/zotero-plugin-scaffold) (de [windingwind](https://github.com/windingwind)).

## Atribución y licencia

Este proyecto es un fork del trabajo original de [@l0o0](https://github.com/l0o0) en [l0o0/jasminum](https://github.com/l0o0/jasminum). Todo el código del módulo de outline y bookmarks fue creado por l0o0 y la comunidad de Jasminum. Este fork solo poda el código orientado a la literatura china y traduce la UI.

Distribuido bajo **AGPL-3.0-or-later** (heredada de Jasminum). Ver [LICENSE](LICENSE) y [NOTICE.md](NOTICE.md).

## Estado del proyecto

Versión inicial **v0.1.0** — recién forkeado. Espero issues y PRs.
