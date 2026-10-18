import { useEffect, useRef } from 'react'
import { Polygon, useMap } from 'react-leaflet'
import { bagoAplayaRing } from '../data/bagoAplaya'
import './BagoAplayaBorder.css'

export default function BagoAplayaBorder({
  blurOutside = true,
  borderColor = '#b93824',
  borderWidth = 3,
  borderOpacity = 0.95,
}) {
  const map = useMap()
  const overlayRef = useRef(null)

  useEffect(() => {
    if (!map || !blurOutside) return undefined

    const container = map.getContainer()
    if (!container) return undefined

    // Remove any stale overlay from previous mounts/HMR
    const existing = container.querySelector('.bago-outside-blur-overlay')
    if (existing) {
      existing.remove()
    }

    const overlay = document.createElement('div')
    overlay.className = 'bago-outside-blur-overlay'
    overlay.setAttribute('aria-hidden', 'true')

    // Insert before control container so zoom buttons/attribution stay on top
    const controlContainer = container.querySelector('.leaflet-control-container')
    if (controlContainer) {
      container.insertBefore(overlay, controlContainer)
    } else {
      container.appendChild(overlay)
    }
    overlayRef.current = overlay

    const updateClip = () => {
      if (!overlayRef.current) return
      const size = map.getSize()
      if (!size || size.x === 0 || size.y === 0) return

      const points = bagoAplayaRing.map(([lat, lng]) => {
        const pt = map.latLngToContainerPoint([lat, lng])
        return `${pt.x.toFixed(1)}px ${pt.y.toFixed(1)}px`
      })

      // The outer box covers the viewport, and bagoAplayaRing cuts out the interior hole via evenodd
      const clip = `polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${points.join(', ')})`
      overlayRef.current.style.clipPath = clip
      overlayRef.current.style.webkitClipPath = clip
    }

    updateClip()

    map.on('move', updateClip)
    map.on('zoom', updateClip)
    map.on('viewreset', updateClip)
    map.on('resize', updateClip)
    map.whenReady(updateClip)

    return () => {
      map.off('move', updateClip)
      map.off('zoom', updateClip)
      map.off('viewreset', updateClip)
      map.off('resize', updateClip)
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay)
      }
      overlayRef.current = null
    }
  }, [map, blurOutside])

  return (
    <Polygon
      positions={bagoAplayaRing}
      interactive={false}
      pathOptions={{
        color: borderColor,
        weight: borderWidth,
        opacity: borderOpacity,
        fill: false,
      }}
    />
  )
}