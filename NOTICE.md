# NOTICE

`zotero-bookmark-editor` is a derivative work based on **Jasminum** by [l0o0](https://github.com/l0o0).

## Original work

- **Project**: Jasminum
- **Repository**: https://github.com/l0o0/jasminum
- **Author**: l0o0 and Jasminum contributors
- **License**: GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later)
- **Forked from version**: 1.1.37 (commit `671ab51`)

## What this fork does

This fork extracts the **PDF outline / bookmark editing** module from Jasminum and removes all components specific to Chinese-language literature (CNKI, WanFangData, Yiigle, ChinaDOI integration; Chinese translator updates; WPS Office plugin; Chinese name splitting/merging utilities). The UI has been translated to Spanish (primary) and English (secondary).

The core mechanism that writes bookmarks into the PDF file — using `pdf-lib` to populate the `/Outlines` entry of the PDF catalog — is preserved as-is from upstream.

## License compliance

Because Jasminum is licensed under AGPL-3.0-or-later, this derivative work is also licensed under AGPL-3.0-or-later. The original `LICENSE` file from Jasminum is included unchanged. Any future contributions to this fork must remain AGPL-3.0-or-later compatible.

## Attribution

Significant portions of the codebase — particularly `src/modules/outline/`, `src/modules/workers/`, and the `pdf-lib` integration — were written by l0o0 and the Jasminum community. We thank them for their work and for releasing it under a copyleft license that allows derivatives like this one.

If you find this fork useful, please also consider starring or contributing to the [upstream Jasminum project](https://github.com/l0o0/jasminum).
