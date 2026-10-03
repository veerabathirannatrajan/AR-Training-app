import type { SiteOverview } from '@ar-training/shared';
import L from 'leaflet';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, Marker, Popup, TileLayer, Tooltip } from 'react-leaflet';
import { percent } from '@/lib/utils';

// A map pin drawn in SVG (no image assets to bundle or resolve).
const PIN = L.divIcon({
  className: '',
  html: `<svg width="26" height="38" viewBox="0 0 26 38" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 2px rgb(0 0 0 / .3))"><path d="M13 1C6.4 1 1 6.3 1 12.9 1 22 13 37 13 37s12-15 12-24.1C25 6.3 19.6 1 13 1z" fill="#2563eb" stroke="#1d4ed8" stroke-width="1.2"/><circle cx="13" cy="13" r="4.6" fill="#fff"/></svg>`,
  iconSize: [26, 38],
  iconAnchor: [13, 37],
  popupAnchor: [0, -32],
  tooltipAnchor: [10, -22],
});

const JHARKHAND_CENTER: [number, number] = [23.75, 85.75];

/** Training sites on an OpenStreetMap base map, with compliance in each pin's popup. */
export function SitesMap({ sites }: { sites: SiteOverview[] }) {
  const { t } = useTranslation();
  const bounds = useMemo(() => {
    if (sites.length === 0) return null;
    return L.latLngBounds(
      sites.map((site) => [site.latitude, site.longitude] as [number, number]),
    ).pad(0.35);
  }, [sites]);

  return (
    <MapContainer
      key={sites.map((site) => site.id).join(',')}
      {...(bounds != null ? { bounds } : { center: JHARKHAND_CENTER, zoom: 7 })}
      scrollWheelZoom={false}
      // On phones a one-finger swipe scrolls the page instead of panning the map.
      dragging={!L.Browser.mobile}
      className="isolate z-0 h-full min-h-[260px] w-full rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {sites.map((site) => (
        <Marker key={site.id} position={[site.latitude, site.longitude]} icon={PIN}>
          <Tooltip permanent direction="right" className="site-label">
            {site.district}
          </Tooltip>
          <Popup>
            <p className="mb-1 font-semibold">{site.name}</p>
            <table className="text-xs">
              <tbody>
                <tr>
                  <td className="pr-3 text-zinc-500">{t('map.workers')}</td>
                  <td className="font-medium tabular-nums">{site.workers}</td>
                </tr>
                <tr>
                  <td className="pr-3 text-zinc-500">{t('map.certified')}</td>
                  <td className="font-medium tabular-nums">{site.certified}</td>
                </tr>
                <tr>
                  <td className="pr-3 text-zinc-500">{t('map.compliance')}</td>
                  <td className="font-medium tabular-nums">{site.compliancePercent}%</td>
                </tr>
                <tr>
                  <td className="pr-3 text-zinc-500">{t('map.avgScore')}</td>
                  <td className="font-medium tabular-nums">{percent(site.avgScore)}</td>
                </tr>
              </tbody>
            </table>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
