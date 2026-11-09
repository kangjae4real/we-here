"use client";

import { cn } from "cn";
import type * as React from "react";
import { Component, useEffect, useRef, useState } from "react";
import {
  Circle,
  Container,
  Marker,
  NaverMap,
  NavermapsProvider,
  useMap,
  useNavermaps,
} from "react-naver-maps";
import {
  type HeatCell,
  type LatLng,
  MAP_LABELS,
  type PhotoPoint,
  type Who,
} from "./mock";

// The Maps JS API needs only the client ID. The client secret is for server-side
// REST calls and must not reach the browser bundle.
const CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

type MapProps = {
  points: PhotoPoint[];
  highlight: { a: LatLng; b: LatLng } | null;
  heat: HeatCell[] | null;
};

export function MapCanvas(props: MapProps) {
  if (!CLIENT_ID) return <PlaceholderMap {...props} />;
  return (
    <MapErrorBoundary
      fallback={
        <PlaceholderMap {...props} note="네이버 지도를 불러오지 못했어요" />
      }
    >
      <NaverMapCanvas clientId={CLIENT_ID} {...props} />
    </MapErrorBoundary>
  );
}

export function ParticipantMark({
  who,
  className,
  style,
}: {
  who: Who;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      style={style}
      className={cn(
        "inline-block shrink-0 border-2 border-white shadow-sm",
        who === "a"
          ? "size-3 rounded-full bg-participant-a"
          : "size-2.5 rotate-45 bg-participant-b",
        className,
      )}
    />
  );
}

/** Screen edges the floating UI covers, so the map fits points into the rest. */
function freeArea(w: number) {
  return {
    top: 96,
    right: w >= 768 ? 24 : 44,
    bottom: w < 768 ? 140 : 32,
    left: w >= 1024 ? 432 : w >= 768 ? 352 : 44,
  };
}

// ---------------------------------------------------------------------------
// Placeholder map: used when NEXT_PUBLIC_NAVER_MAP_CLIENT_ID is not set or the
// Naver script fails to load.

const LNG_SCALE = Math.cos((37.55 * Math.PI) / 180);
const HAN_RIVER: [number, number][] = [
  [37.566, 126.86],
  [37.556, 126.89],
  [37.54, 126.915],
  [37.533, 126.935],
  [37.522, 126.96],
  [37.515, 126.985],
  [37.52, 127.01],
  [37.528, 127.03],
  [37.538, 127.06],
  [37.535, 127.085],
  [37.525, 127.11],
];

/** Fits `bounds` into the part of the screen the floating UI leaves free. */
function fit(bounds: LatLng[], w: number, h: number) {
  const xs = bounds.map((p) => p.lng * LNG_SCALE);
  const ys = bounds.map((p) => -p.lat);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  const { top, right, bottom, left } = freeArea(w);
  const freeW = w - left - right;
  const freeH = h - top - bottom;
  const s = Math.min(freeW / spanX, freeH / spanY);
  const ox = left + (freeW - spanX * s) / 2;
  const oy = top + (freeH - spanY * s) / 2;
  return (p: LatLng) => ({
    x: ox + (p.lng * LNG_SCALE - minX) * s,
    y: oy + (-p.lat - minY) * s,
  });
}

function PlaceholderMap({
  points,
  highlight,
  heat,
  note = "네이버 지도 키 없음",
}: MapProps & { note?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Zoom to the selected pair like the real map would (D6), else show everything.
  const bounds = highlight
    ? [
        highlight.a,
        highlight.b,
        {
          lat: (highlight.a.lat + highlight.b.lat) / 2 - 0.004,
          lng: (highlight.a.lng + highlight.b.lng) / 2 - 0.006,
        },
        {
          lat: (highlight.a.lat + highlight.b.lat) / 2 + 0.004,
          lng: (highlight.a.lng + highlight.b.lng) / 2 + 0.006,
        },
      ]
    : points;
  const project = size.w > 0 ? fit(bounds, size.w, size.h) : null;
  const pa = highlight && project ? project(highlight.a) : null;
  const pb = highlight && project ? project(highlight.b) : null;

  return (
    <div
      ref={ref}
      role="img"
      aria-label="두 사람의 사진 위치 지도 미리보기"
      className="absolute inset-0 overflow-hidden bg-muted"
      style={{
        backgroundImage:
          "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
        backgroundSize: "56px 56px",
      }}
    >
      {project && (
        <>
          <svg
            className="absolute inset-0"
            width={size.w}
            height={size.h}
            aria-hidden="true"
          >
            <polyline
              points={HAN_RIVER.map(([lat, lng]) => {
                const p = project({ lat, lng });
                return `${p.x},${p.y}`;
              }).join(" ")}
              fill="none"
              strokeWidth={highlight ? 120 : 16}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="stroke-sky-200/70"
            />
            {heat?.map((cell) => {
              const p = project(cell);
              return (
                <circle
                  key={cell.place}
                  cx={p.x}
                  cy={p.y}
                  r={(6 + cell.days * 1.6) * (size.w < 768 ? 1 : 1.5)}
                  fill="var(--heatmap)"
                  fillOpacity={0.12 + (cell.days / 14) * 0.45}
                />
              );
            })}
            {pa && pb && (
              <circle
                cx={(pa.x + pb.x) / 2}
                cy={(pa.y + pb.y) / 2}
                r={Math.hypot(pa.x - pb.x, pa.y - pb.y) / 2}
                fill="var(--foreground)"
                fillOpacity={0.04}
                stroke="var(--foreground)"
                strokeWidth={2}
                strokeDasharray="6 5"
              />
            )}
          </svg>

          {MAP_LABELS.map((label) => {
            const p = project(label);
            return (
              <span
                key={label.name}
                aria-hidden
                className="absolute -translate-x-1/2 translate-y-2 text-[11px] font-medium whitespace-nowrap text-muted-foreground"
                style={{ left: p.x, top: p.y }}
              >
                {label.name}
              </span>
            );
          })}

          {!heat &&
            points.map((point) => {
              const p = project(point);
              return (
                <ParticipantMark
                  key={point.id}
                  who={point.who}
                  className={cn(
                    "absolute -translate-1/2",
                    highlight && "opacity-30",
                  )}
                  style={{ left: p.x, top: p.y }}
                />
              );
            })}

          {pa && pb && (
            <>
              <ParticipantMark
                who="a"
                className="absolute size-4 -translate-1/2 ring-2 ring-participant-a/30"
                style={{ left: pa.x, top: pa.y }}
              />
              <ParticipantMark
                who="b"
                className="absolute size-3.5 -translate-1/2 ring-2 ring-participant-b/30"
                style={{ left: pb.x, top: pb.y }}
              />
            </>
          )}
        </>
      )}

      <span className="absolute right-4 bottom-36 rounded-full bg-background/90 px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm md:bottom-4">
        지도 미리보기 · {note}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Naver Maps JS v3 through react-naver-maps.

class MapErrorBoundary extends Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function markerIcon(who: Who, size: number, opacity = 1): naver.maps.HtmlIcon {
  const shape =
    who === "a" ? "border-radius:9999px" : "transform:rotate(45deg)";
  return {
    content: `<span style="display:block;width:${size}px;height:${size}px;border:2px solid white;${shape};background:var(--participant-${who});opacity:${opacity};box-shadow:0 1px 2px rgb(0 0 0 / .3)"></span>`,
    anchor: { x: size / 2, y: size / 2 },
  };
}

// Module constants so markers keep the same icon object across renders.
const ICONS = {
  normal: { a: markerIcon("a", 12), b: markerIcon("b", 10) },
  dim: { a: markerIcon("a", 12, 0.3), b: markerIcon("b", 10, 0.3) },
  focus: { a: markerIcon("a", 16), b: markerIcon("b", 14) },
};

function NaverMapCanvas({
  clientId,
  points,
  highlight,
  heat,
}: MapProps & { clientId: string }) {
  return (
    <NavermapsProvider ncpKeyId={clientId} submodules={["visualization"]}>
      {/* On mobile the map stops above the 112px sheet so Naver's logo and copyright stay visible. */}
      <Container
        role="application"
        aria-label="두 사람의 사진 위치 지도"
        className="inset-0 bg-muted max-md:bottom-28"
        // Container sets an inline position: relative, which would beat a class.
        style={{ position: "absolute" }}
      >
        {(navermaps) => (
          <NaverMap
            defaultCenter={{ lat: 37.54, lng: 126.99 }}
            defaultZoom={12}
            logoControlOptions={{ position: navermaps.Position.BOTTOM_RIGHT }}
            mapDataControlOptions={{
              position: navermaps.Position.BOTTOM_RIGHT,
            }}
          >
            <FitBounds points={points} highlight={highlight} heat={heat} />
            {heat ? (
              <HeatLayer cells={heat} />
            ) : (
              points.map((p) => (
                <Marker
                  key={p.id}
                  defaultPosition={p}
                  icon={highlight ? ICONS.dim[p.who] : ICONS.normal[p.who]}
                />
              ))
            )}
            {highlight && <EncounterCircle a={highlight.a} b={highlight.b} />}
            {highlight && (
              <>
                <Marker
                  position={highlight.a}
                  icon={ICONS.focus.a}
                  zIndex={10}
                />
                <Marker
                  position={highlight.b}
                  icon={ICONS.focus.b}
                  zIndex={10}
                />
              </>
            )}
          </NaverMap>
        )}
      </Container>
    </NavermapsProvider>
  );
}

/** Zooms to the selected pair (D6), the heat cells, or every photo. */
function FitBounds({ points, highlight, heat }: MapProps) {
  const map = useMap();
  useEffect(() => {
    const coords = highlight ? [highlight.a, highlight.b] : (heat ?? points);
    const w = window.innerWidth;
    const margin = freeArea(w);
    // The map already ends above the mobile sheet, so drop that part of the margin.
    if (w < 768) margin.bottom = 28;
    // fitBounds swaps array items for LatLng objects in place, so pass a copy
    // or it corrupts the shared points and heat cells.
    map.fitBounds([...coords], { ...margin, maxZoom: 17 });
  }, [map, points, highlight, heat]);
  return null;
}

function EncounterCircle({ a, b }: { a: LatLng; b: LatLng }) {
  const color = getComputedStyle(document.documentElement)
    .getPropertyValue("--foreground")
    .trim();
  const radius =
    Math.hypot(
      (a.lat - b.lat) * 111_000,
      (a.lng - b.lng) * 111_000 * LNG_SCALE,
    ) / 2;
  return (
    <Circle
      center={{ lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 }}
      radius={radius}
      strokeColor={color}
      strokeStyle="dash"
      strokeWeight={2}
      fillColor={color}
      fillOpacity={0.05}
    />
  );
}

function HeatLayer({ cells }: { cells: HeatCell[] }) {
  const navermaps = useNavermaps();
  const map = useMap();
  useEffect(() => {
    const layer = new navermaps.visualization.HeatMap({
      map,
      radius: 50,
      opacity: 0.8,
      data: cells.map(
        (c) =>
          new navermaps.visualization.WeightedLocation(c.lat, c.lng, c.days),
      ),
    });
    return () => layer.setMap(null);
  }, [navermaps, map, cells]);
  return null;
}
