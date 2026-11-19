# asset-versioning Specification

## Purpose
Keep public assets fresh and cacheable by giving each file a deterministic content-hash URL, preserving offline behavior, and preventing stale client bundles after deployment.

## Requirements

### Requirement: Content-hash asset URLs

Public assets SHALL be addressed with a version query parameter derived deterministically from the asset's bytes. The version SHALL change when the bytes change and SHALL remain stable when the bytes are unchanged.

#### Scenario: Changed asset gets a new version
- **GIVEN** a deployed image with version `abc123`
- **WHEN** the image bytes change and the build runs
- **THEN** the image URL uses a new version
- **AND** unrelated assets keep their existing versions

#### Scenario: Unchanged assets keep their versions
- **GIVEN** a build with no asset changes
- **WHEN** the build runs again
- **THEN** every public asset keeps the same versioned URL

#### Scenario: New asset is versioned
- **GIVEN** a new image added under `public/img/`
- **WHEN** the build runs
- **THEN** the image URL includes a deterministic version

### Requirement: Worker-rendered entry assets are versioned

Worker-rendered HTML SHALL reference versioned URLs for scripts, stylesheets, icons, and the web manifest. Page configuration paths passed to the shared layout SHALL be resolved centrally; standalone pages SHALL resolve their own asset URLs.

#### Scenario: Journey page references versioned entry assets
- **GIVEN** a request for the journey page
- **WHEN** the Worker renders the page
- **THEN** the client bundle, CSS, and manifest URLs include a version query

#### Scenario: Standalone auth page references versioned assets
- **GIVEN** a request for the login page
- **WHEN** the Worker renders the page
- **THEN** its stylesheets, icons, and client bundle URLs include a version query

#### Scenario: Page-specific stylesheet is versioned through the layout
- **GIVEN** a page that passes `/css/events.css` to the shared layout
- **WHEN** the Worker renders the page
- **THEN** the emitted stylesheet link includes the version for `events.css`

### Requirement: Client-rendered images resolve through a runtime version map

Client-rendered images under `/img/` SHALL resolve their version from a runtime image map. Image changes SHALL NOT require a client bundle change.

#### Scenario: Badge artwork uses the current image version
- **GIVEN** a badge whose image bytes changed in the latest build
- **WHEN** the badge renders
- **THEN** its image URL uses the new version

#### Scenario: Image change does not change the client bundle
- **GIVEN** only one image changed
- **WHEN** the build runs
- **THEN** the client bundle URL is unchanged
- **AND** only the changed image's URL and the runtime image map change

#### Scenario: Missing runtime image map falls back safely
- **GIVEN** the runtime image map cannot be fetched
- **WHEN** a client-rendered image is requested
- **THEN** the client uses the last cached map or the unversioned path
- **AND** island hydration is not blocked

### Requirement: Runtime version maps and map metadata are available offline

The service worker SHALL cache the runtime image map and map-tile metadata for offline use and SHALL prefer the network for those two resources while falling back to the cached copy.

#### Scenario: Offline image resolution uses the cached map
- **GIVEN** the runtime image map was cached during an earlier online visit
- **WHEN** the user opens the app offline
- **THEN** the client resolves image versions from the cached map

#### Scenario: Updated image map is fetched online
- **GIVEN** the runtime image map changed since the last visit
- **WHEN** the user opens the app online
- **THEN** the service worker fetches the new map
- **AND** the client uses the new versions

### Requirement: Versioned assets preserve offline behavior

The service worker SHALL serve versioned static assets cache-first so previously cached versions remain available offline. A new version SHALL be fetched from the network on first use.

#### Scenario: Offline cached asset still loads
- **GIVEN** a versioned stylesheet was cached during an earlier visit
- **WHEN** the user is offline and the page requests that version
- **THEN** the service worker serves the cached response

#### Scenario: New version bypasses an old service worker cache
- **GIVEN** an old service worker controls the page
- **WHEN** the page requests an asset with a new version query
- **THEN** the cache lookup misses
- **AND** the service worker fetches the new asset from the network

#### Scenario: Precache list contains only existing versioned shell assets
- **GIVEN** the generated service worker
- **WHEN** its precache list is inspected
- **THEN** every entry exists under `public/` and carries a version query

### Requirement: Superseded image versions are pruned

The service worker SHALL remove cached `/img/` entries outside `/img/map/tiles/**` that the current runtime image map no longer references, while retaining the current versions.

#### Scenario: Image-only deploy removes the old version
- **GIVEN** a cached image at version `old`
- **WHEN** the runtime image map reports version `new`
- **THEN** the service worker removes the `old` entry
- **AND** the `new` entry remains available

### Requirement: Map tiles share one tile-set version

Map tiles SHALL use one version for the tile set. Tile metadata and tile URLs SHALL carry that version, and `/img/map/tiles/**` SHALL NOT be included in the per-image runtime map.

#### Scenario: Map update changes the tile-set version
- **GIVEN** a regenerated map tile set
- **WHEN** the build runs
- **THEN** the metadata and every tile URL use the new tile-set version

#### Scenario: Map tiles are not individually version-mapped
- **GIVEN** the runtime image map
- **WHEN** it is generated
- **THEN** it excludes `/img/map/tiles/**`
- **AND** the tile-set version is available to the map island

#### Scenario: Stale tile-set version fails the build check
- **GIVEN** tile bytes changed without rerunning the tile generator
- **WHEN** the asset-version check runs
- **THEN** it fails because `metadata.json.version` does not match the tiles

### Requirement: Server-generated asset references are versioned

Server-generated payloads outside HTML SHALL reference existing public assets and SHALL include the asset version when the asset has one.

#### Scenario: Push notification icon uses the versioned icon path
- **GIVEN** a scheduled push notification
- **WHEN** the payload is built
- **THEN** the icon resolves to `/icons/icon-192x192.png` with a `?v=<hash>` query

### Requirement: Build artifacts and drift checks are deterministic

The build SHALL generate the server version map, runtime image map, service-worker file, and image manifest deterministically. CI SHALL fail when generated artifacts are stale, required build inputs are missing, or raw public asset URLs appear outside the approved helpers.

#### Scenario: Stale generated map fails CI
- **GIVEN** a changed image and an unregenerated runtime image map
- **WHEN** CI runs the asset-version check
- **THEN** the check fails and reports the stale artifact

#### Scenario: Unchanged rebuild produces no drift
- **GIVEN** no asset or client-source changes
- **WHEN** the build and drift checks run
- **THEN** the generated artifacts are unchanged

#### Scenario: Missing client build fails fast
- **GIVEN** a fresh checkout without `public/js/client/`
- **WHEN** the asset-version generator runs without the client build
- **THEN** it fails with a missing-input error
- **AND** it does not write an empty map

#### Scenario: Raw asset URL fails the reference check
- **GIVEN** client code that hardcodes `/img/highres/example.webp`
- **WHEN** the reference check runs
- **THEN** it fails and reports the file and line
- **AND** the message points to the approved resolver
