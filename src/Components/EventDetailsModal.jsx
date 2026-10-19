import { useEffect, useState } from 'react'
import { deleteDoc, doc } from 'firebase/firestore'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import { db } from '../firebase'
import BagoAplayaBorder from './BagoAplayaBorder'
import CommunityEngagementActions from './CommunityEngagementActions'
import { categoryIcons, defaultIcon } from './mapIcons'
import { bagoAplayaMaxBounds, bagoAplayaMinZoom } from '../data/bagoAplaya'
import { scheduledCategories, getReportStatus, reportHistory, timestampDateKey } from '../utils/eventUtils'
import 'leaflet/dist/leaflet.css'
import './EventDetailsModal.css'
import { LocalizedContent, PreservedContent } from '../i18n'

export default function EventDetailsModal({ selectedEvent, user, onClose, onScheduleDeleted, onRequestLogin, onNavigate }) {
  const [scheduleDeleteState, setScheduleDeleteState] = useState({ id: null, status: '', error: '' })

  useEffect(() => {
    if (!selectedEvent) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedEvent, onClose])

  if (!selectedEvent || !selectedEvent.location) return null

  const selectedLocation = selectedEvent.location

  const handleDeleteSchedule = async (schedule) => {
    if (!db || !user || user.uid !== schedule.createdBy || scheduleDeleteState.status === 'deleting') return
    if (!window.confirm(`Delete schedule "${schedule.name}"? This cannot be undone.`)) return

    setScheduleDeleteState({ id: schedule.id, status: 'deleting', error: '' })
    try {
      await deleteDoc(doc(db, 'Schedules', schedule.id))
      setScheduleDeleteState({ id: null, status: '', error: '' })
      if (onScheduleDeleted) {
        onScheduleDeleted(schedule.id)
      }
      onClose()
    } catch {
      setScheduleDeleteState({
        id: schedule.id,
        status: '',
        error: 'Schedule could not be deleted. Check your access and Firestore rules.',
      })
    }
  }

  return (
    <LocalizedContent>
    <div className="event-details-backdrop" onClick={onClose} role="presentation">
      <aside
        className="event-details"
        role="dialog"
        aria-modal="true"
        aria-live="polite"
        aria-labelledby="event-details-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="event-details-header">
          <div>
            <p className={`event-detail-category event-detail-category--${selectedLocation.category.toLowerCase().replace(/\s+/g, '-')}`}>
              {selectedLocation.category}
            </p>
            <h2 id="event-details-title"><PreservedContent>{selectedLocation.name}</PreservedContent></h2>
          </div>
          <div className="event-details-actions">
            {selectedLocation.category === 'Report' && (
              <span className={`event-report-status event-report-status--${getReportStatus(selectedLocation).toLowerCase().replace(' ', '-')}`}>
                {getReportStatus(selectedLocation)}
              </span>
            )}
            <button
              className="event-details-close"
              type="button"
              onClick={onClose}
              aria-label="Close details"
            >
              ×
            </button>
          </div>
        </header>

        {Number.isFinite(selectedLocation.lat) && Number.isFinite(selectedLocation.lng) ? (
          <div className="event-detail-map" aria-label={`Map location for ${selectedLocation.name}`}>
            <MapContainer
              center={[selectedLocation.lat, selectedLocation.lng]}
              zoom={15}
              minZoom={bagoAplayaMinZoom}
              maxBounds={bagoAplayaMaxBounds}
              maxBoundsViscosity={0.85}
              scrollWheelZoom={false}
              zoomControl
              className="event-detail-leaflet"
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <BagoAplayaBorder />
              <Marker
                position={[selectedLocation.lat, selectedLocation.lng]}
                icon={categoryIcons[selectedLocation.category] || defaultIcon}
              />
            </MapContainer>
          </div>
        ) : (
          <p className="event-detail-locationless">This schedule has no map location.</p>
        )}

        <p className="event-detail-description"><PreservedContent>{selectedLocation.description}</PreservedContent></p>

        {scheduledCategories.includes(selectedLocation.category) && (
          <p className="event-detail-date">
            <strong>Date: </strong>{selectedEvent.startDate || 'Date not set'}{selectedEvent.endDate && selectedEvent.endDate !== selectedEvent.startDate ? ` – ${selectedEvent.endDate}` : ''}
            <br />
            <strong>Time: </strong>{selectedEvent.startTime ? `${selectedEvent.startTime}` : ''}
            {selectedEvent.endTime ? ` – ${selectedEvent.endTime}` : ''}
          </p>
        )}

        {selectedLocation.category === 'Community engagement' && selectedLocation.engagementStatus === 'approved' && (
          <CommunityEngagementActions
            location={selectedLocation}
            user={user}
            onRequestLogin={onRequestLogin}
            onNavigate={onNavigate}
          />
        )}

        {selectedLocation.category === 'Report' && (
          <ol className="event-report-history">
            {reportHistory(selectedLocation).map((item) => {
              const itemDate = timestampDateKey(item.timestamp) || item.fallbackDate
              const itemTime = item.status === 'Submitted'
                ? null
                : item.timestamp?.toDate?.().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
              return (
                <li
                  className={`event-report-history-item${getReportStatus(selectedLocation) === item.status ? ' event-report-history-item--current' : ''}`}
                  key={item.label}
                >
                  <span className="event-history-dot" />
                  <div>
                    <strong>{item.label}</strong>
                    <span>{itemDate || 'Date unavailable'}{itemTime ? ` · ${itemTime}` : ''}</span>
                    {item.by && <span>Account {item.by}</span>}
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        {Number.isFinite(selectedLocation.lat) && Number.isFinite(selectedLocation.lng) && (
          <>
            <p className="event-detail-latitude"><strong>Latitude:</strong> {selectedLocation.lat.toFixed(5)}</p>
            <p className="event-detail-longitude"><strong>Longitude:</strong> {selectedLocation.lng.toFixed(5)}</p>
          </>
        )}

        {selectedLocation.category === 'Schedule' && user?.uid === selectedLocation.createdBy && (
          <div className="event-schedule-actions">
            <button
              className="event-schedule-delete"
              type="button"
              onClick={() => handleDeleteSchedule(selectedLocation)}
              disabled={scheduleDeleteState.status === 'deleting'}
            >
              {scheduleDeleteState.status === 'deleting' ? 'Deleting schedule…' : 'Delete schedule'}
            </button>
            {scheduleDeleteState.id === selectedLocation.id && scheduleDeleteState.error && (
              <p className="event-detail-error" role="alert">{scheduleDeleteState.error}</p>
            )}
          </div>
        )}
      </aside>
    </div>
    </LocalizedContent>
  )
}
