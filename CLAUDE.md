# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

XMP Editor — a client-side web app for editing XMP metadata (dc:description) in JPEG, PNG, and WebP images. Uses the File System Access API to read/write files directly from the browser with no backend. Requires a Chromium-based browser.

## Commands

- `bun install` — install dependencies
- `bun run dev` — start Vite dev server with HMR
- `bun run build` — typecheck (`tsc -b`) then build for production
- `bun run lint` — run ESLint
- `bun run preview` — preview production build locally
- `bun run deploy` — build and deploy to Cloudflare Pages via wrangler

## Architecture

**Tech stack:** React 19, TypeScript, Vite, Tailwind CSS 4, daisyUI 5, Bun

**Path alias:** `@/` maps to `src/` (configured in vite.config.ts and tsconfig.app.json)

### Core modules (`src/lib/`)

Each image format has a dedicated module exporting `readXmp(buffer)` and `writeXmp(buffer, xml)` that do direct binary manipulation (Uint8Array/DataView):

- **jpeg.ts** — APP1 segment handling, XMP namespace prefix, 65535-byte segment limit
- **png.ts** — iTXt chunk with CRC-32 checksums, inserted before IDAT
- **webp.ts** — RIFF container, "XMP " FourCC chunk, VP8X flag management
- **xmp.ts** — XML parsing/serialization via DOMParser, handles dc:description with rdf:Alt/xml:lang, adds 2KB padding for in-place edits
- **folder.ts** — recursive async directory scanning, builds FolderNode tree with image counts

### State management

All state lives in `App.tsx` using React hooks (useState/useCallback/useRef). No external state library. `SourceMode` union type (`none | files | folder`) controls layout branching.

### Key types (`src/types.ts`)

- **ImageFile** — image metadata, file handle, format, description, XMP blob, UI state
- **FolderNode** — recursive folder tree structure
- **SourceMode** — app state discriminator

### UI

daisyUI components with two themes (dim/cupcake). Theme persisted to localStorage with dynamic favicon color. Components use responsive flexbox layout with sidebar for folder tree.
