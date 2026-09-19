# Share-by-URL — implementation plan

Plan for [#33](https://github.com/jarbid/OpenShaper/issues/33): a **Share** action that
turns the board on screen into a self-contained link, and an `/app#board=…` bootstrap that
opens such a link as an editable copy. No server, no account, no upload — roadmap phase
7.3 (`docs/ROADMAP.md`).

This document is the plan, not the feature. It records the decisions the issue and its
review thread left open, so the three PRs below can be written and reviewed against
something concrete.

---

## 1. Shape of the thing

```
        SHARER                                    RECIPIENT
  board + BoardMeta                      /app#board=v1.<payload>
        │                                          │
  writeBoardJson()          @openshaper/io   main.tsx (module scope)
        │                   share-link.ts    extract + history.replaceState
  encodeShareFragment() ────────┐               │   (before React mounts,
        │                       │               │    before initAnalytics)
  "v1.<base64url(gzip(json))>"  │          takeSharedPayload()
        │                       │               │
  buildShareUrl()  ◄── SITE_URL │          decodeShareFragment()
        │            or origin  │               │
  ShareDialog → clipboard       └──────────►  App.tsx startup precedence
                                                 │
                                          adoptSharedBoard()
```

The codec is pure and lives in `packages/io`; URL assembly, the dialog and the bootstrap
live in `apps/web`. `CompressionStream` is a platform global (WHATWG Compression Streams),
not a DOM API, so `packages/io` keeps its layering promise and the limit/corruption/version
tests are plain package tests with no jsdom.

---

## 2. Decisions settled before coding

The issue review raised four open questions plus some smaller gaps. Settling them here so
they are choices, not accidents.

### 2.1 Board Info is offered, never required

Per the review: a board with no Board Info shares as an anonymous link, which is exactly
the case where posting to a forum is least useful. So:

- When `meta.model` or `meta.designer` is empty, the dialog shows an **editable** field for
  the missing one(s), prefilled, in place of the read-only `model — designer` line.
- Those fields call the same `setMeta` the sidebar's Board info panel calls
  (`apps/web/src/Sidebar.tsx:326`). One source of truth; the value persists on the board
  after sharing, not just in the link.
- **Copy link** stays enabled with the fields blank.
- The privacy line sits with the fields, not below the fold. Prompting for `designer` /
  `surfer` makes real names in a public forum _more_ likely, so the disclosure matters more
  here, not less.

### 2.2 Where the fragment is stripped, and when

`initAnalytics()` runs in a `useEffect` in `apps/web/src/layouts/RootLayout.tsx:15` — after
React mounts. "Before analytics initializes" therefore means **module scope in
`apps/web/src/main.tsx`, above the `ViteReactSSG(...)` call**. That module also executes in
Node during prerender, so the extractor is `typeof window === 'undefined'` guarded and
returns without touching anything.

The payload then lives in a module-local `let`, handed out exactly once by
`takeSharedPayload()`. It is never written to storage, never put in React state before it
is needed, and never reaches PostHog: by the time `initAnalytics()` reads
`window.location`, the address bar is already `/app` with its query string intact and no
`board=` in the hash.

### 2.3 The startup race, and why the store stays untouched

The review flagged that precedence steps 2–4 race the async IndexedDB session restore. The
resolution is simpler than gating autosave:

> **The shared board never enters `boardStore` before the user accepts it.**

The hydration effect in `App.tsx:153` becomes one `await` chain:

```
const shared = takeSharedPayload()            // sync, module-local
const session = await loadSession()           // existing call
const decoded = shared ? await decode(shared) : null   // may throw → error toast only

  decoded && !session   → adoptSharedBoard(decoded)      // open immediately
  decoded &&  session   → restore session, then open the confirm dialog
 !decoded &&  session   → restore session          (unchanged)
 !decoded && !session   → bundled sample           (unchanged)
```

Because the store only ever holds the restored workspace until the user chooses,
`hydrated.current` and the existing autosave debounce (`App.tsx:368`) need no changes:
autosaving the restored board writes back exactly what was already stored, so **Keep
current** and **Open shared board** stay distinguishable. Decode failure is handled inside
the chain and falls through to the session/sample branches — an invalid payload can never
replace a workspace.

### 2.4 Recent Boards name collisions: accept them

`recordRecentBoard` de-duplicates by name (`apps/web/src/recent-boards.ts:97`), so two
different shared boards with the same `model` both become `<model> (shared)` and the second
replaces the first. **Accept the collision.** A counter suffix would contradict the issue's
own acceptance criterion (`<model> (shared)`), and the replace-by-name rule is documented,
deliberate behaviour for every other entry in that list. Pin it with a test so it is a
decision rather than a surprise.

### 2.5 Where the caps are measured

The issue caps "the complete generated URL"; a recipient's origin differs from the
sharer's, so the two sides cannot measure the same string.

| Side    | Measured                                    | Warn   | Reject |
| ------- | ------------------------------------------- | ------ | ------ |
| Produce | the whole `https://…/app#board=v1.…` string | 30,000 | 50,000 |
| Accept  | the fragment payload after `#board=`        | —      | 50,000 |

The accept cap is deliberately a little more permissive than the produce cap by the length
of the origin, so **a link OpenShaper generated is always one OpenShaper will open** —
including a Tauri-generated `https://openshaper.com/…` link opened from a longer origin.
The decompression cap (1,000,000 bytes) is independent of both and is what actually defends
memory.

### 2.6 Tauri clipboard: verify, don't pre-solve

`apps/desktop/src-tauri/capabilities/default.json` grants `core:default` only and no
clipboard plugin is installed. `navigator.clipboard.writeText` is expected to work in the
Tauri v2 WebView under a user gesture on a secure context, but that is unverified.

Plan: build the web-standard path with the manual-copy fallback the issue already requires,
then **verify by hand** in `pnpm dev:desktop` before claiming parity. Only if the WebView
refuses do we add `tauri-plugin-clipboard-manager` and the matching capability — a
dependency we should not take on speculation. PR 2 is not done until that check has been
run and its result written into the PR description.

### 2.7 Smaller gaps

- **Ghost.** Accepting a shared board clears `ghost` state _and_ rewrites the session
  record without `ghostJson` (`apps/web/src/session-store.ts:26`), or a reload resurrects
  it. Clearing the React state alone is not enough.
- **No keyboard shortcut.** None is proposed and none is added. If one is ever wanted it
  belongs in `apps/web/src/shortcuts.ts`, never in the key handler — the handler, the
  tooltips and `/docs/shortcuts` all read that table.
- **TinyURL is prose only.** The oversize hint names a third-party shortener and discloses
  that it receives the complete board link. Nothing in the app submits anything anywhere;
  this is a sentence, not an integration.
- **Test environment.** jsdom inherits Node's `CompressionStream`/`DecompressionStream`, so
  round-trip tests run unmocked. `navigator.clipboard` is **undefined** in jsdom, so the
  manual-copy fallback is the default path in tests and the success path needs an explicit
  stub.
- **Size expectations.** Measured on the bundled sample: 12,546 chars of `.board.json` →
  2,122 bytes gzipped → ~2,830 chars of base64url. A realistic board is ~2.9 KB of link, so
  neither the 30,000 warning nor the 50,000 rejection is reachable in practice. Those
  branches need a **synthetic board with hundreds of stations** to exercise; do not expect
  a real board to reach them.

---

## 3. PR 1 — the codec (`packages/io`)

**New:** `packages/io/src/share-link.ts`, `packages/io/src/share-link.test.ts`
**Edited:** `packages/io/src/index.ts`

### API

```ts
export const SHARE_ENVELOPE_VERSION = 'v1';
export const SHARE_URL_WARN_CHARS = 30_000;
export const SHARE_URL_MAX_CHARS = 50_000;
export const SHARE_DECODED_MAX_BYTES = 1_000_000;

export type ShareLinkErrorCode =
  | 'unsupported'        // no CompressionStream / DecompressionStream
  | 'bad-envelope'       // missing or unrecognised "v1." prefix
  | 'too-large'          // encoded payload over the cap
  | 'decompress-failed'  // malformed base64url, corrupt or truncated gzip
  | 'too-large-decoded'  // decompressed output exceeded the byte cap
  | 'bad-board';         // valid JSON, not a board — or a newer board version

export class ShareLinkError extends Error {
  constructor(readonly code: ShareLinkErrorCode, message: string);
}

/** Both stream constructors present. Checked before offering Share at all. */
export const shareCodecSupported: () => boolean;

/** board (+ metadata) → "v1.<unpadded base64url of gzip of the .board.json UTF-8 bytes>" */
export const encodeShareFragment: (
  board: BezierBoard,
  metadata?: Record<string, unknown>,
) => Promise<string>;

/** Inverse. Throws ShareLinkError; never throws anything else. */
export const decodeShareFragment: (
  fragment: string,
) => Promise<{ board: BezierBoard; metadata?: Record<string, unknown> }>;
```

### Implementation notes

- **Serialization** reuses `writeBoardJson` / `readBoardJson` verbatim
  (`packages/io/src/board-json.ts`). That is the issue's "native `.board` representation",
  it already carries geometry, `interpolationType`, the v2 `fins` block and `metadata`, and
  `readBoardJson` already throws `BoardJsonError` on a newer `version` — so "reject a newer
  board version" needs no new mechanism, only a mapping to `code: 'bad-board'`.
- **What is excluded is excluded by construction.** Trace images live in their own
  IndexedDB store (`apps/web/src/trace-store.ts`), the ghost is separate React state, undo
  history lives in `boardStore`, and view/app settings are separate localStorage keys.
  Nothing in `writeBoardJson`'s output can reach any of them. The test that matters asserts
  the _absence_ of `data:`, `blob:` and `ghost` in the encoded output, so this stays true.
- **Base64url** is hand-rolled over `btoa`/`atob` (both are Node and browser globals):
  `+`→`-`, `/`→`_`, padding stripped on encode and restored on decode. Convert bytes to the
  binary string in **8 KiB chunks** — `String.fromCharCode(...bytes)` on a 100 KB array
  blows the call stack.
- **Order of checks on decode** — cheapest and most defensive first:
  1. envelope prefix (`bad-envelope`)
  2. encoded length vs `SHARE_URL_MAX_CHARS` (`too-large`) — **before** any allocation
  3. base64url → bytes (`decompress-failed`)
  4. streamed gunzip with a running byte counter; on exceeding
     `SHARE_DECODED_MAX_BYTES`, `reader.cancel()` and throw `too-large-decoded`
  5. `readBoardJson` (`bad-board`)
- **Streaming, not buffering.** Feed the bytes through `DecompressionStream('gzip')` and
  pull chunks with a reader, summing `chunk.byteLength` as you go. Buffering the whole
  output and then measuring it defeats the cap — the point is that a 3 KB zip bomb never
  gets to allocate 500 MB.

### Tests (`share-link.test.ts`)

| Group      | Cases                                                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Round-trip | sample board; board with fins; all seven `BoardMeta` fields; **Unicode** metadata (accents, emoji, CJK) survives UTF-8 → gzip → base64url |
| URL safety | output matches `/^v1\.[A-Za-z0-9_-]+$/` — no `+`, `/`, `=`, no raw JSON                                                                   |
| Exclusion  | encoded output contains no `data:`/`blob:`/`ghost` substrings                                                                             |
| Envelope   | `v2.…`, `v0.…`, no prefix, empty string, `.` alone → `bad-envelope`                                                                       |
| Corruption | malformed base64url; gzip truncated at 50%; random bytes → `decompress-failed`                                                            |
| Board      | valid gzip of `{}`; of `"not json"`; of a doc with `version: 99` → `bad-board`                                                            |
| Caps       | synthetic many-station board over 50,000 encoded chars → `too-large`; a crafted high-ratio payload → `too-large-decoded`                  |
| Support    | `shareCodecSupported()` false when the globals are stubbed away; `encode`/`decode` then throw `unsupported`                               |

Run: `pnpm --filter @openshaper/io test`.

---

## 4. PR 2 — Share dialog and wiring (`apps/web`)

**New:** `apps/web/src/share-url.ts` (+ test), `apps/web/src/ShareDialog.tsx` (+ test)
**Edited:** `App.tsx`, `docs/design/analytics.md`

### 4.1 `share-url.ts` — origin and limits

```ts
/** True inside the Tauri WebView (v2 injects __TAURI_INTERNALS__). */
export const isTauri: () => boolean;

/** Tauri → SITE_URL (a public web address); web → window.location.origin. */
export const shareOrigin: () => string;

export const buildShareUrl: (fragment: string) => string; // `${origin}/app#board=${fragment}`

export type ShareSize = 'ok' | 'warn' | 'reject';
export const shareSize: (url: string) => ShareSize;
```

`SITE_URL` already exists and is overridable with `VITE_SITE_URL`
(`apps/web/src/seo/site.ts:11`) — no new configuration. A Tauri build that pointed the link
at its own internal URL would produce a link nobody else can open, which is the whole
reason this indirection exists.

### 4.2 `ShareDialog.tsx`

Follows the existing modal pattern — fixed-inset backdrop over a `Panel` card, as
`SettingsDialog.tsx` and `ExportStepDialog.tsx` do. No new UI primitive; `@openshaper/ui`
has no `Dialog` and this feature is not the place to introduce one.

Content, top to bottom:

1. **Identity** — `model — designer` read-only when both exist; otherwise the inline
   editable fields of §2.1.
2. **What this link is** — an editable snapshot; it will not change when you keep editing
   this board; it cannot be updated or revoked.
3. **Who can read it** — anyone with the link can open the board and read its Board Info.
4. **Included / not included** — two short lists (geometry + interpolation, fins, Board
   Info / trace images, ghost, undo history, recent boards, view and app settings).
5. **Size** — "About 2.9 KB" from `url.length`. The multi-kilobyte URL itself is **never**
   rendered unless the clipboard fails.
6. **Actions** — primary **Copy link**; **Cancel**.

State-dependent behaviour:

- `shareCodecSupported()` false → no link is generated. Explain that the browser needs
  updating and offer **Download `.board`** (`downloadBoard` from `file-io.ts`) instead.
- `shareSize === 'warn'` → copy still allowed, with the compatibility warning, the
  suggestion to send the `.board` file, and the TinyURL sentence including its disclosure.
- `shareSize === 'reject'` → **Copy link** is replaced by **Download `.board`**.
- Copy succeeds → close, toast `Share link copied`, `track('share_link_copied')`.
- Copy fails or is rejected → **stay open**, reveal a `readOnly` `<input>` holding the URL,
  focus and `select()` it. No toast; the user is now doing the copying.

**Privacy markup.** The dialog root and the fallback URL field both carry `ph-no-capture`
— they display board metadata and the payload, and PostHog's replay masking is configured
around that class (`apps/web/src/analytics.ts:213`).

### 4.3 Entry points (`App.tsx`)

- **Top nav**, in the row-1 menubar cluster (`App.tsx:1204`): icon + label at `sm` and up,
  icon-only below. Disabled when `!board`.
- **File menu** (`App.tsx:795`): `Share…`, after `Save`, `disabled: !board`. The command
  palette derives from the menus (`commandsFromMenus`, `CommandPalette.tsx:20`), so
  `File: Share…` appears there for free — no second registry.
- Both open the same dialog; neither copies anything on its own.

### 4.4 Analytics

Two events, **count only**, no properties at all:

| Event                 | Where                                     |
| --------------------- | ----------------------------------------- |
| `share_link_copied`   | after a successful clipboard write        |
| `shared_board_opened` | after `adoptSharedBoard` completes (PR 3) |

Neither may carry anything derived from the URL, the board, its metadata, its dimensions or
the payload. `apps/web/src/analytics.coverage.test.ts` **fails the build** until both are
added to the catalogue table in `docs/design/analytics.md` — and in the other direction
too, so a rename cannot leave a dead row. Also update the user-facing privacy description
on `/privacy`.

### 4.5 Tests

- `share-url.test.ts` — Tauri vs web origin; `buildShareUrl` shape; the three `shareSize`
  bands at their exact boundaries.
- `ShareDialog.test.tsx` — identity line vs inline fields; `setMeta` write-back; copy
  success with a stubbed `navigator.clipboard`; copy failure revealing a selected read-only
  field; warn band copy-with-warning; reject band offering the download; unsupported-codec
  branch; `ph-no-capture` present on the root and the fallback field.
- `App.test.tsx` additions — the nav button and the File item are disabled with no board,
  and `File: Share…` is reachable from the command palette.

---

## 5. PR 3 — bootstrap, adoption, traces, docs, e2e

The risky one, deliberately reviewed on its own.

### 5.1 `share-bootstrap.ts`

```ts
/** Called once at module scope from main.tsx, above ViteReactSSG(...). */
export const extractSharedFragment: () => void;
/** Hands the payload out exactly once; null afterwards. */
export const takeSharedPayload: () => string | null;
```

- `typeof window === 'undefined'` → return (prerender runs this module in Node).
- Parse `location.hash.slice(1)` with `URLSearchParams`, read `board`, `delete('board')`,
  rebuild. base64url's alphabet (`A-Za-z0-9-_`) plus `.` survives that round-trip
  unchanged. **Unrelated fragment entries are preserved**; an empty remainder means no `#`
  at all.
- `history.replaceState(null, '', pathname + search + rebuiltHash)` — the query string is
  untouched.
- Payload is held in a module `let`, returned once, then nulled.

`main.tsx` becomes:

```ts
import { extractSharedFragment } from './share-bootstrap';
extractSharedFragment(); // before anything else can read location
export const createRoot = ViteReactSSG({ routes, basename: import.meta.env.BASE_URL });
```

### 5.2 Startup precedence (`App.tsx`)

The chain of §2.3, replacing the body of the hydration effect at `App.tsx:153`. When a
session exists, `setPendingShare(decoded)` opens an **Open shared board?** confirmation:

- **Keep current** — drop the decoded board; nothing changes anywhere.
- **Open shared board** — `adoptSharedBoard(decoded)`.

Decode errors produce a specific, useful message via the existing `showError`
(`App.tsx:610`) — "That share link is damaged or incomplete", "…was made by a newer version
of OpenShaper", "…is too large to open" — and **never** include payload content or the raw
parser message. `captureError` is not used: a bad link is a bad input, not our bug, and its
content must not reach an error report.

### 5.3 `adoptSharedBoard(board, metadata)`

In order:

1. `boardStore.getState().load(board)` — already resets `past: []` / `future: []`
   (`packages/store/src/board-store.ts:193`), so undo/redo is cleared by construction.
2. `setMeta(metadata ?? {})` — full Board Info restored.
3. `setGhost(null)` **and** re-save the session without `ghostJson`, or a reload brings it
   back (§2.7).
4. `recordRecentBoard(name, boardJson)` where `name` is `<model> (shared)` when a model
   exists and `Shared board` otherwise. The suffix
   is the _display name only_ — `meta.model` itself is untouched.
5. `hideAllTraces()` (§5.4).
6. `setPickedView('quad')`.
7. `setCsIndex(nearestMidpointSection(board))` — see below.
8. Clear `pendingViews2d.current` and `liveViewState.current.views2d`, then
   `sendViewCmd('fit')` on the next effect tick, once the quad panes have mounted.
9. Clear `liveViewState.current.camera3d`, persist, and bump a `cameraEpoch` counter used
   as the `key` on `ThreeDPane`. `Board3DView` reads `initialCamera` as the Canvas's
   _initial_ state (`packages/render3d/src/Board3DView.tsx:73`), so a remount is what
   "reset to the board-relative default" actually means here.
10. `showToast('Shared board opened as an editable copy. Changes stay in this browser.')`
11. `track('shared_board_opened')`
12. Set `hydrated.current = true` last, so normal autosave resumes from the adopted board.

**Midpoint station.** New pure helper beside `clampSectionIndex`
(`apps/web/src/section-index.ts`):

```ts
/** Real station (1..count-2) nearest board-length/2; lower index wins a tie. */
export const nearestMidpointSection = (board: BezierBoard): number;
```

Iterate the real stations only, compare `|position - getLength(board) / 2|`, and take
strict `<` so the first (lower) index survives a tie. Unit-tested against an even station
count, an odd one, and an exact tie.

### 5.4 Trace visibility

New `apps/web/src/trace-visibility.ts` — a small versioned localStorage module in the shape
of `settings.ts`, key `bs.traceVisible`, holding `{ outline: boolean; rocker: boolean }`.

- **Absent key ⇒ visible.** Existing users' traces do not vanish on upgrade.
- `useTrace` exposes `visible`, `setVisible(view, v)` and `hideAll()`; `backgroundFor(view)`
  returns `undefined` when that view is hidden, so the editor panes need no change.
- Loading or replacing an image makes that view visible again — you did not load a trace in
  order to not see it.
- Accepting a shared board calls `hideAll()`. **The image bytes are not deleted**; the
  IndexedDB records in `trace-store.ts` are untouched and the toggles bring them straight
  back.
- Two checkboxes in the existing Trace image panel (`Sidebar.tsx:473`).

Why it is coupled here at all: a shared link never contains a trace, so a recipient's own
trace silently overlaying someone else's outline is a wrong-picture bug. The visibility
toggle is independently useful, and it is the honest way to do it without destroying data.

### 5.5 Documentation

`apps/web/src/pages/docs/Files.tsx` gains a `<Section id="share" title="Sharing a link">`
covering, per the issue: editable snapshots and not live collaboration; links cannot be
updated or revoked; full Board Info is included; images, traces, ghosts and settings are
not; the 30,000 warning and the 50,000 limit; generic OpenShaper link previews (per-board
thumbnails are out of scope); the browser-support and `.board` fallback; and the
third-party shortener caveats.

`apps/web/src/docs/registry.ts` enumerates fin setups/systems/profiles, rail presets, export
formats, templates and shortcuts — a Share button matches no `FeatureKind`, so
`coverage.test.ts` will **not** catch a missing section. This docs update is a manual
obligation; do not mistake a green build for it being done.

Also update `docs/ROADMAP.md` phase 7.3 to `(done)` with a pointer to this file, matching
how 7.1 and 7.2 read.

### 5.6 Tests

**Unit / integration (Vitest, jsdom)**

- `share-bootstrap.test.ts` — `#board=…` extracted and removed; `?x=1#board=…` keeps
  `?x=1`; `#board=…&tab=2` keeps `tab=2`; `#other` untouched; `takeSharedPayload()` returns
  once then null; no-window path is inert.
- `App.share-open.test.tsx` — valid link with no session opens immediately; with a session
  shows the confirm, **Keep current** leaves the board untouched, **Open shared board**
  replaces it; invalid link with a session leaves it alone; invalid link with no session
  falls back to the sample.
- Adoption assertions — undo stack empty; metadata restored; ghost cleared _and_ absent
  from the re-saved session; recent entry named `<model> (shared)` / `Shared board`, plus
  the §2.4 collision pinned; `pickedView === 'quad'`; midpoint station selected; both
  traces hidden with their IndexedDB records intact and re-enableable.
- `nearestMidpointSection` — even, odd, exact tie.
- Analytics — both events fire exactly once, with **no properties**; assert the payload
  object is empty rather than merely "has no board fields".

**E2E (Playwright)**

- `e2e/share.spec.ts` — modify a board, Share, copy the link (grant
  `clipboard-read`/`clipboard-write`), open it in a **fresh browser context**, and verify:
  geometry and metadata match, Quad view, the editable-copy toast, `page.url()` carries no
  `board=`, and the board is still editable afterwards.
- `e2e-offline/` extension — an already-cached `/app` opens a self-contained shared link
  with the network blocked. This is the strongest statement the feature makes: the link is
  the board, not a pointer to a server.

**Gate**

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @openshaper/web e2e
pnpm --filter @openshaper/web e2e:offline
```

CI runs the first three; the two Playwright suites are run locally for PR 3.

---

## 6. Risks

| Risk                                                                 | Mitigation                                                                                                            |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Fragment reaches PostHog via `$current_url` or replay                | Strip at module scope in `main.tsx`, above `ViteReactSSG`; asserted by a bootstrap unit test and by the e2e URL check |
| A hostile payload exhausts memory                                    | Encoded-length cap before allocation; streamed gunzip with a running byte counter and `reader.cancel()`               |
| A shared board silently destroys local work                          | The store is never written before acceptance (§2.3)                                                                   |
| Tauri clipboard refuses, fallback becomes the desktop default        | Verified by hand in `pnpm dev:desktop` before PR 2 is called done (§2.6)                                              |
| Recipient's trace overlays a stranger's outline                      | `hideAll()` on adopt, bytes preserved (§5.4)                                                                          |
| Docs ship stale — no test enforces the Files section                 | Called out as a manual obligation (§5.5)                                                                              |
| The warn/reject branches are unreachable in real use and go untested | Synthetic many-station fixtures, not a real board (§2.7)                                                              |

## 7. Out of scope

Accounts or server-side storage; live collaboration; link revocation or expiry; a
compatibility promise beyond the `v1` envelope; board-specific Open Graph thumbnails; a
built-in URL shortener; sharing trace images, screenshots, ghosts or presentation state.
