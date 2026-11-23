"use client";

import { useReducedMotion } from "motion/react";
import type * as React from "react";
import {
  Component,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Container,
  NaverMap,
  NavermapsProvider,
  useMap,
  useNavermaps,
} from "react-naver-maps";
import type { MapInset, MapScene } from "./contract";
import {
  frame,
  fromWorld,
  ORIGIN_LL,
  quantize,
  setVars,
  toWorld,
} from "./map/geo";
import { Overlay } from "./map/Overlay";
import { PlaceholderMap } from "./map/Placeholder";
import type { Room } from "./mock";

// The Maps JS API needs only the client ID. The client secret is for server-side
// REST calls and must not reach the browser bundle.
const CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

type MapProps = { room: Room; scene: MapScene; inset: MapInset };

export function MapCanvas(props: MapProps) {
  const naver = useNaverScript(CLIENT_ID);
  if (!CLIENT_ID) return <PlaceholderMap {...props} />;
  const failed = (
    <PlaceholderMap {...props} note="네이버 지도를 불러오지 못했어요" />
  );
  // The boundary stays mounted in every state: an auth failure tears the live map
  // down, and whatever Naver throws on the way out must land here, not crash the page.
  return (
    <MapErrorBoundary fallback={failed}>
      {naver === "ready" ? (
        <NaverCanvas clientId={CLIENT_ID} {...props} />
      ) : naver === "failed" ? (
        failed
      ) : (
        <div className="absolute inset-0 bg-land" />
      )}
    </MapErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// Script loading. react-naver-maps drops its cached promise when maps.js fails and
// retries on every render, which appends <script> tags forever when the script is
// blocked. Load it once here instead: never retry, give up after a timeout (a blocked
// maps-gl.js never fires onJSContentLoaded), and treat Naver's auth-failure callback
// (wrong key, unregistered domain) as a failure too. The library then finds
// naver.maps already loaded and never adds a script of its own.

type NaverStatus = "loading" | "ready" | "failed";
let naverStatus: NaverStatus = "loading";
let naverStarted = false;
const naverListeners = new Set<() => void>();
// Generous: maps.js plus the GL submodule on a slow phone connection.
const NAVER_TIMEOUT_MS = 15_000;

function setNaverStatus(next: NaverStatus) {
  if (naverStatus === "failed") return;
  naverStatus = next;
  for (const listener of naverListeners) listener();
}

function startNaver(clientId: string) {
  if (naverStarted) return;
  naverStarted = true;
  const timer = setTimeout(() => setNaverStatus("failed"), NAVER_TIMEOUT_MS);
  const ready = () => {
    clearTimeout(timer);
    setNaverStatus("ready");
  };
  (window as { navermap_authFailure?: () => void }).navermap_authFailure = () =>
    setNaverStatus("failed");
  const script = document.createElement("script");
  script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}&submodules=gl`;
  script.async = true;
  script.onerror = () => setNaverStatus("failed");
  script.onload = () => {
    const maps = typeof naver === "undefined" ? undefined : naver.maps;
    if (!maps) setNaverStatus("failed");
    else if (maps.jsContentLoaded) ready();
    else (maps as { onJSContentLoaded?: () => void }).onJSContentLoaded = ready;
  };
  document.head.append(script);
}

function useNaverScript(clientId: string | undefined): NaverStatus {
  return useSyncExternalStore(
    (onChange) => {
      if (clientId) startNaver(clientId);
      naverListeners.add(onChange);
      return () => naverListeners.delete(onChange);
    },
    () => naverStatus,
    () => "loading",
  );
}

/** Catches what still breaks after the script loaded, such as the map failing to start. */
class MapErrorBoundary extends Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { error: unknown }
> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    // Only the library's loader errors, an error from Naver's own script, or fallout
    // from a map Naver already gave up on fall back; anything else is a bug and must
    // surface, not pose as "no map".
    if (
      naverStatus === "failed" ||
      (error instanceof Error &&
        (/^Failed to load naver maps script$|^naver\.maps not available/.test(
          error.message,
        ) ||
          error.stack?.includes("map.naver.com")))
    )
      return this.props.fallback;
    throw error;
  }
}

function NaverCanvas({ clientId, ...props }: MapProps & { clientId: string }) {
  // GL: the raster map only zooms in whole steps and reports a morph's end state
  // up front, so the overlay could not follow it frame by frame.
  return (
    <NavermapsProvider ncpKeyId={clientId} submodules={["gl"]}>
      <Container
        role="region"
        aria-label="두 사람의 사진 위치 지도"
        data-wh-map=""
        className="inset-0 bg-land"
        // Container sets an inline position: relative, which would beat a class.
        style={{ position: "absolute" }}
      >
        <NaverMap
          gl
          defaultCenter={ORIGIN_LL}
          defaultZoom={11}
          scaleControl={false}
          zoomControl={false}
          mapTypeControl={false}
        >
          <NaverLayer {...props} />
        </NaverMap>
      </Container>
    </NavermapsProvider>
  );
}

const EAST_LL = { lat: ORIGIN_LL.lat, lng: ORIGIN_LL.lng + 0.01 };
const EAST_DX = toWorld(EAST_LL).x - toWorld(ORIGIN_LL).x;

/** Screen px of ORIGIN and px per world unit, read from the map itself so GL's zoom scale needs no constant. */
function measure(map: naver.maps.Map) {
  const proj = map.getProjection();
  const o = proj.fromCoordToOffset(
    new naver.maps.LatLng(ORIGIN_LL.lat, ORIGIN_LL.lng),
  );
  const e = proj.fromCoordToOffset(
    new naver.maps.LatLng(EAST_LL.lat, EAST_LL.lng),
  );
  // Raster offsets are relative to the tile pane, which moves as the map pans (GL's are
  // already screen px): shift by where the map's center lands.
  const c = proj.fromCoordToOffset(map.getCenter());
  const { width, height } = map.getSize();
  return {
    x: o.x + width / 2 - c.x,
    y: o.y + height / 2 - c.y,
    k: (e.x - o.x) / EAST_DX,
  };
}

/** Whole zoom levels only: px per world unit is then a power of two. */
const snapToRaster = (k: number) => 2 ** Math.floor(Math.log2(k));

function NaverLayer({ room, scene, inset }: MapProps) {
  const navermaps = useNavermaps();
  const map = useMap();
  const ref = useRef<SVGSVGElement>(null);
  const placedAt = useRef(Number.NaN);
  const reduced = useReducedMotion();
  const [scale, setScale] = useState(0);
  // log2 of px per world unit at zoom 0: changes once when the GL renderer takes over.
  const [ratio, setRatio] = useState(Number.NaN);
  // Without WebGL (or on a blocklisted GPU) Naver silently falls back to raster tiles.
  const [gl, setGl] = useState(true);
  const [size, setSize] = useState(() => map.getSize());

  // GL fires bounds_changed on every frame of a drag, pinch or morph; writing three
  // CSS variables keeps the overlay glued to the map without re-rendering.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Re-cluster once the map settles: remounting the marks mid-flight drops frames.
    // (GL fires no "idle" after a morph, so settle on a short quiet period instead.)
    let quiet = 0;
    const settle = () => setScale(quantize(measure(map).k));
    const sync = () => {
      const m = measure(map);
      setVars(el, m.x, m.y, m.k);
      setRatio(Math.round(Math.log2(m.k / 2 ** map.getZoom())));
      setGl(Boolean(map.getOptions("gl")));
      clearTimeout(quiet);
      quiet = window.setTimeout(settle, 150);
    };
    sync();
    const listeners = [
      navermaps.Event.addListener(map, "bounds_changed", sync),
      // Raster maps don't report every move through bounds_changed; they do go idle.
      navermaps.Event.addListener(map, "idle", sync),
      navermaps.Event.addListener(map, "size_changed", () => {
        sync();
        setSize(map.getSize());
      }),
    ];
    return () => {
      clearTimeout(quiet);
      navermaps.Event.removeListener(listeners);
    };
  }, [navermaps, map]);

  // Move only when the framing itself changes, not on every render.
  const view = frame(
    room,
    scene,
    inset,
    size.width,
    size.height,
    gl ? undefined : snapToRaster,
  );
  const cx = Math.round(view.c.x);
  const cy = Math.round(view.c.y);
  const k = Number(view.k.toPrecision(4));
  const cramped = view.cramped;
  useEffect(() => {
    const now = measure(map);
    if (Number.isNaN(ratio) || !(now.k > 0 && k > 0)) return;
    if (cramped && placedAt.current === ratio) return;
    const center = fromWorld({ x: cx, y: cy });
    const zoom = map.getZoom() + Math.log2(k / now.k);
    // The GL renderer starts after the map exists and doubles px per zoom level, so
    // place (not animate) again whenever that scale changes under us. Raster morphs
    // report their end state up front and the overlay can't follow them: jump there.
    if (placedAt.current === ratio && gl && !reduced)
      map.morph(center, zoom, { duration: 900, easing: "easeOutCubic" });
    else {
      map.updateBy(center, gl ? zoom : Math.round(zoom));
      const m = measure(map);
      if (ref.current) setVars(ref.current, m.x, m.y, m.k);
      setScale(quantize(m.k));
    }
    placedAt.current = ratio;
  }, [map, cx, cy, k, ratio, gl, cramped, reduced]);

  // The logo and copyright must stay visible: lift Naver's control corners out from
  // under the sheet and panel. On desktop the Legend also sits bottom-right (24px
  // margin + 32px tall). When the moment card leaves no map above it, the strip under
  // the card is the only map left, so leave them at the bottom edge.
  const lift =
    scene.moment?.phase === "on" && size.height - inset.top - inset.bottom < 40
      ? 0
      : inset.bottom;
  const liftRight = lift + (size.width >= 768 ? 40 : 0);
  return (
    <>
      {/* Naver adds the controls late, so a rule beats an effect. */}
      <style>{`
        [data-wh-map] > div > div[style*="z-index: 100"] {
          transition: ${reduced ? "none" : "translate 300ms ease-out"};
          translate: ${-inset.right}px ${-liftRight}px;
        }
        [data-wh-map] > div > div[style*="z-index: 100"][style*="left: 0px"] {
          translate: ${inset.left}px ${-lift}px;
        }
      `}</style>
      <Overlay ref={ref} room={room} scene={scene} scale={scale} />
    </>
  );
}
