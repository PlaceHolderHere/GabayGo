import { Polygon } from 'react-leaflet'
import { bagoAplayaRing } from '../data/bagoAplaya'

export default function BagoAplayaBorder() {
  return (
    <Polygon
      positions={bagoAplayaRing}
      interactive={false}
      pathOptions={{ color: '#b93824', weight: 3, opacity: 0.95, fill: false }}
    />
  )
}