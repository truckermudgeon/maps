# Refactor: `packages/apps/navigator/src/controllers/`

End goal: a codebase where a new contributor can browse `src/` and understand the
architecture from the directory tree alone.

## Problems with the current shape

- **`AppStoreImpl` (260 LOC) is a kitchen sink.** Telemetry status, theme, map enum,
  camera mode, bearing mode, segment-complete toast, route, route-index, truck/trailer
  points, plus nine derived geometry getters all share one class with one change frequency.
- **`AppControllerImpl` (665 LOC) does six unrelated jobs.** Map adapter, telemetry
  subscription, render loop, map source/layer mutations, tRPC route mutations,
  choose-on-map marker lifecycle, wake lock, force re-pair. Tests cope via
  `as unknown as AppControllerImpl` because the surface is too big to mock honestly.
- **Methods take their own store as a first arg.** `controller.setActiveRoute(store, ...)` —
  `store` is the singleton this controller is bound to. The pattern is a stateless-utility
  holdover and confuses ownership.
- **Stores expose mutable internals across the controller boundary.** `pageStack: NavPageKey[]`
  is mutated from the outside. No chokepoint to enforce invariants.
- **Two telemetry subscriptions.** Both `AppControllerImpl.startListening` and
  `ControlsControllerImpl.startListening` call `subscribeToDevice.subscribe`. Same socket,
  decoded twice.
- **Side effects leak into controller closures.** `data-joy-color-scheme` mutation on
  `document.documentElement` happens inside the telemetry switch.
- **Mixed reactive + imperative rendering.** Some renders are driven by reactions, others by
  direct `controller.render*()` calls scattered through handlers and the telemetry switch.

## Architecture

Three layers, narrow seams between them:

```
            ┌────────────────────────────────────┐
            │            RootStore               │   composition root
            │  ┌────────┐ ┌────────┐ ┌────────┐  │   (no logic; just owns
            │  │Session │ │ Route  │ │NavSheet│  │    child stores)
            │  └────────┘ └────────┘ └────────┘  │
            │  ┌────────┐ ┌────────┐             │
            │  │Camera  │ │  UI    │             │
            │  └────────┘ └────────┘             │
            └────────────────────────────────────┘
                       ▲                ▲
        (read-only,    │                │  (commit via actions)
         via computeds)│                │
            ┌──────────┴───┐    ┌───────┴────────┐
            │   Reactions  │    │    Services    │
            │ (autorun /   │    │  (lifecycle:   │
            │  reaction)   │    │   init/dispose,│
            │              │    │   IO + DOM)    │
            └──────────────┘    └────────────────┘
                    ▲                  ▲
                    └─────────┬────────┘
                              │
                React (observer components,
                domain hooks: useRouteStore,
                useCameraStore, ...)
```

### Stores (5)

State + computeds only. No IO, no DOM.

| Store           | Owns                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SessionStore`  | auth (`isAuthenticated`, formerly `readyToLoad`), theme, map, telemetry status (`hasReceivedFirstTelemetry`, `bindingStale`, derived `telemetryStatus` enum) |
| `RouteStore`    | active route + index, truck/trailer points, segment-complete toast, all 9 derived geometry computeds                                                         |
| `NavSheetStore` | page stack (private; action methods), search query/results/destinations/routes/selection, `isLoading`                                                        |
| `CameraStore`   | `cameraMode`, `bearingMode`, setter actions                                                                                                                  |
| `UIStore`       | viewport size/orientation + computed map padding/offset                                                                                                      |

`Controls` becomes a pure derivation (`useControlsViewModel()` hook reads from
`Route` + `Camera` + `Session`); no separate store.

### Services (7 + small utilities)

Lifecycle (`init` / `dispose`), side effects, IO.

| Module                       | Shape                                                                  |
| ---------------------------- | ---------------------------------------------------------------------- |
| `services/map-adapter.ts`    | class — owns `MapRef`, player marker; the only file importing maplibre |
| `services/telemetry.ts`      | class — single tRPC subscription, dispatches to stores                 |
| `services/route-animator.ts` | class — 500ms render loop + camera/marker animation                    |
| `services/route-renderer.ts` | class — autorun-driven; map source/paint mutations                     |
| `services/route-api.ts`      | functions — tRPC route IO                                              |
| `services/search-api.ts`     | functions — tRPC search IO                                             |
| `services/choose-on-map.ts`  | class — draggable marker lifecycle                                     |

Browser one-offs collapse: `wake-lock`, `forceRePair` → functions in `util/browser.ts`;
the theme `data-*` attribute autorun → `reactions/theme.ts`.

### Controllers (1)

After the above, "controllers" are thin coordinators:

- `controllers/nav-sheet.ts` — flow methods (`startChooseDestinationFlow`, `onSearchSelect`,
  `onBackClick`, etc.). Methods drop the `(store, ...)` first arg.
- The camera "controller" disappears: its 4 setters become actions on `CameraStore`.

### React layer

- `stores/context.tsx`: `RootStoreContext` + `useRootStore()` + provider. `useRootStore()` is
  an internal primitive.
- `stores/hooks/use-{session,route,nav-sheet,camera,ui}.ts`: domain hooks. **Components
  import these, never `useRootStore` directly.**
- `stores/hooks/use-controls-view-model.ts`: pure derivation hook for the HUD.
- `create-app-reactions.ts` splits into `reactions/{route,camera,nav-sheet,theme}.ts`.

## Directory layout (the file tree reveals the architecture)

```
packages/apps/navigator/src/
  stores/             ← state + computeds
    hooks/            ← domain hooks (use-route, use-camera, ...)
    context.tsx       ← RootStoreContext + useRootStore
    root-store.ts     ← composition root
    session.ts
    route.ts
    nav-sheet.ts
    camera.ts
    ui.ts
    constants.ts      ← NavPageKey, CameraMode, BearingMode
    types.ts
  services/           ← IO, DOM, lifecycle
    map-adapter.ts
    telemetry.ts
    route-animator.ts
    route-renderer.ts
    route-api.ts
    search-api.ts
    choose-on-map.ts
    types.ts
  reactions/          ← MobX glue
    route.ts
    camera.ts
    nav-sheet.ts
    theme.ts
  controllers/        ← only flow-orchestration (NavSheet)
    nav-sheet.ts
  util/               ← pure helpers
    telemetry-timeline.ts
    route-geometry.ts
    camera-options.ts
    browser.ts
    clamp.ts
  components/         ← (unchanged)
  tests/              ← mirrors the tree above
  ARCHITECTURE.md     ← new
  create-app.tsx      ← shrinks; provides RootStoreContext
  index.tsx
```

## Migration order

Build green at every step. No big-bang.

0. **Move single-concern files into new top-level dirs.** Pure rename. The multi-concern
   files (`app.ts`, `nav-sheet.ts`, `controls.ts`) stay until their splits in later steps —
   moving them now would just be churn since they'll relocate when split.
1. **Extract pure utils** (`route-geometry`, `camera-options`, `clamp`); add unit tests; existing
   classes call helpers but keep their public shapes. No behavior change.
2. **Split `AppStoreImpl` → SessionStore + CameraStore + RouteStore.** Keep an `AppStore`
   facade type that intersects them so `create-app.tsx`/handlers/tests still compile during
   transition. Add focused store tests. Fold `segmentComplete` into `RouteStore`.
3. **Split NavSheetStore.** Move page-stack mutations to action methods on the store. Update
   NavSheetController. Fold search fields in (no separate SearchStore).
4. **Extract `MapAdapter` + `WakeLockService` + `SessionService` + `ChooseOnMapService` +
   theme reaction** out of AppController.
5. **Extract `RouteRenderer`.** Replace direct `controller.render*()` calls with autoruns on
   RouteStore where possible; keep imperative entry only for the rAF-animated route preview.
6. **Extract `TelemetryService` + `RouteAnimator`.** Single subscription. Drop
   ControlsController's duplicate subscription; `useControlsViewModel` becomes pure derivation.
7. **Extract `RouteService` + `SearchService`.** tRPC out of controllers.
8. **Introduce `RootStoreContext` + domain hooks.** Drop store prop-drilling.
9. **Split `create-app-reactions.ts` per domain.** File moves only.
10. **Cleanup.** Delete the `AppStore` facade alias; delete unused `(store, ...)` first args.
11. **Write `ARCHITECTURE.md`.** Done last so it describes the actual end state.

## Decisions resolved

- **A. Granularity** → 5 stores, 7 services. Fewer files, clearer domains.
- **B. RootStoreContext + domain hooks** → yes. `useRootStore` is the internal primitive;
  components import per-domain hooks (`useRouteStore`, etc.) so a component's imports tell
  you what it observes.
- **C. Separate `CameraStore`** → yes.
- **D. `RouteRenderer` fully reactive** → yes, with route-preview animation kickoff as the
  documented exception.
- **E. Fold in deferred renames** → yes (`readyToLoad → isAuthenticated`, derived
  `telemetryStatus` enum). Audit cost is the same; orienting twice is worse.
- **F. Drop ControlsController's duplicate subscription** → yes (in step 6).
- **G. Save the plan** → yes (this file). `ARCHITECTURE.md` is a separate deliverable from
  step 11, written against the actual end state.
- **H. Promote layers to top-level dirs** → yes. The current `controllers/` directory name
  is misleading (holds stores, controllers, types, constants); it goes away.
