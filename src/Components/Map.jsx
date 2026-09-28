import { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import L from 'leaflet';
import { db } from '../firebase';
import 'leaflet/dist/leaflet.css';
import './Map.css';

// ICONS
const CustomIcon = L.Icon.extend({
  options: {
    iconSize: [40, 40],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  }
});

const defaultIcon = new CustomIcon({
    iconUrl: 'src/assets/Location.svg',
})

const outageIcon = new CustomIcon({
    iconUrl: 'src/assets/Outage.svg',
})

const serviceIcon = new CustomIcon({
    iconUrl: 'src/assets/Service.svg',
})

const marketPlaceIcon = new CustomIcon({
    iconUrl: 'src/assets/Marketplace.svg',
})

const reportIcon = new CustomIcon({
    iconUrl: 'src/assets/Report.svg',
})

const temporaryLocationIcon = new CustomIcon({
    iconUrl: 'src/assets/TemporaryLocation.svg',
})


// INITIAL LOCATIONS
const categories = ['Location', 'Outage', 'Service', 'Marketplace', 'Report']
const timeSensitiveCategories = ['Outage', 'Service']
const timeStampedCategories = ['Report']
const categoryIcons = {
    'Location': defaultIcon, 
    'Outage': outageIcon, 
    'Service': serviceIcon, 
    'Marketplace': marketPlaceIcon, 
    'Report': reportIcon
}
function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });

  return null;
}

export default function Map({ user, onRequestLogin }) {
  const [locations, setLocations] = useState([]);
  const [locationsStatus, setLocationsStatus] = useState(db ? 'loading' : 'unavailable');
  const [locationsError, setLocationsError] = useState('');
  const [adminCheck, setAdminCheck] = useState({ uid: null, status: 'checking' });
  const [saveError, setSaveError] = useState('');
  const [deleteFeedback, setDeleteFeedback] = useState({ locationId: null, status: '', error: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: categories[0],
    description: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
  });
  const adminStatus = !db
    ? 'unavailable'
    : !user
      ? 'signed-out'
      : adminCheck.uid === user.uid ? adminCheck.status : 'checking';
  const userId = user?.uid;

  useEffect(() => {
    if (!db) return undefined;

    return onSnapshot(collection(db, 'Locations'), (snapshot) => {
      const nextLocations = snapshot.docs
        .map((locationDoc) => ({ id: locationDoc.id, ...locationDoc.data() }))
        .filter((location) => Number.isFinite(location.lat) && Number.isFinite(location.lng));
      setLocations(nextLocations);
      setLocationsStatus('ready');
      setLocationsError('');
    }, () => {
      setLocationsStatus('error');
      setLocationsError('Locations could not be loaded. Check the Firestore database and its read rules.');
    });
  }, []);

  useEffect(() => {
    if (!db || !userId) return undefined;

    return onSnapshot(doc(db, 'admin', userId), (adminDoc) => {
      setAdminCheck({
        uid: userId,
        status: adminDoc.exists() && adminDoc.data().enabled === true ? 'admin' : 'not-admin',
      });
    }, () => {
      setAdminCheck({ uid: userId, status: 'error' });
    });
  }, [userId]);

  // Updates selected position
  const handleMapClick = (latlng) => {
    if (adminStatus !== 'admin') return;
    setSelectedPosition(latlng);
  };

  // Updates formData when user inputs a change
  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Saves a new location based on formData
  const handleAddLocation = async (event) => {
    event.preventDefault();

    if (!db || !user || adminStatus !== 'admin' || !selectedPosition || !formData.name.trim()) {
      return;
    }

    const newLocation = {
      name: formData.name.trim(),
      category: formData.category,
      description: formData.description.trim() || 'New location added by the user.',
      lat: selectedPosition.lat,
      lng: selectedPosition.lng,
      startDate: formData.startDate || null,
      startTime: formData.startTime || null,
      endDate: formData.endDate || null,
      endTime: formData.endTime || null,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    };

    if (timeStampedCategories.includes(formData.category)) {
      const now = new Date();
      newLocation.startDate = now.toISOString().split('T')[0];
      newLocation.startTime = now.toTimeString().split(' ')[0];
    }

    setIsSaving(true);
    setSaveError('');

    try {
      await addDoc(collection(db, 'Locations'), newLocation);
      setFormData({
        name: '',
        category: categories[0],
        description: '',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
      });
      setSelectedPosition(null);
    } catch {
      setSaveError('This location could not be saved. Check your admin access and Firestore rules.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLocation = async (location) => {
    if (!db || !user || adminStatus !== 'admin') return;
    if (!window.confirm(`Delete "${location.name}"? This cannot be undone.`)) return;

    setDeleteFeedback({ locationId: location.id, status: 'deleting', error: '' });

    try {
      await deleteDoc(doc(db, 'Locations', location.id));
      setDeleteFeedback({ locationId: null, status: '', error: '' });
    } catch {
      setDeleteFeedback({
        locationId: location.id,
        status: 'error',
        error: 'This location could not be deleted. Check your admin access and Firestore rules.',
      });
    }
  };

  return (
    <div className="map-page">
      <div className="map-stage" id="map">
        <button
          className={`map-panel-toggle${panelOpen ? ' map-panel-toggle--panel-open' : ''}`}
          type="button"
          onClick={() => setPanelOpen((isOpen) => !isOpen)}
          aria-expanded={panelOpen}
          aria-controls="map-panel"
          aria-label={panelOpen ? 'Hide map tools' : 'Show map tools'}
        >
          <span aria-hidden="true">{panelOpen ? '‹' : '›'}</span>
        </button>

        {panelOpen && (
          <aside className="map-panel" id="map-panel" aria-label="Add a location">
            <div className="map-header">
              <div>
                <p className="map-eyebrow">Community map</p>
                <h2>{adminStatus === 'admin' ? 'Add a Location' : 'Map Locations'}</h2>
                <p>{adminStatus === 'admin' ? 'Choose a point on the map to get started.' : 'Browse places shared with your community.'}</p>
              </div>
            </div>

            {adminStatus === 'admin' ? (
            <form className="add-location-form" onSubmit={handleAddLocation}>
              <label>
                Name
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. Riverside Library"
                />
              </label>

              <label>
                Category
                <select name="category" value={formData.category} onChange={handleInputChange}>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>))
                  }
                </select>
              </label>

              {(timeSensitiveCategories.includes(formData.category)) &&
              (<><label>
                Start Date
                <input
                  name="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={handleInputChange}
                />
              </label>

              <label>
                Start Time
                <input
                  name="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={handleInputChange}
                />
              </label>

              <label>
                End Date
                <input
                  name="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={handleInputChange}
                />
              </label>

              <label>
                End Time
                <input
                  name="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={handleInputChange}
                />
              </label></>)}

              <label>
                Description
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Short description"
                />
              </label>

              <button type="submit" disabled={!selectedPosition || !formData.name.trim() || isSaving}>
                {isSaving ? 'Saving location…' : 'Add Location'}
              </button>
              {saveError && <p className="map-feedback map-feedback--error" role="alert">{saveError}</p>}
            </form>
            ) : (
              <div className="map-access-message" role="status">
                {adminStatus === 'signed-out' && (
                  <>
                    <p>Sign in to request access to add community locations.</p>
                    <button type="button" onClick={onRequestLogin}>Log in</button>
                  </>
                )}
                {adminStatus === 'checking' && <p>Checking location editor access…</p>}
                {adminStatus === 'not-admin' && <p>Your account can view locations. An admin account is required to add or edit places.</p>}
                {adminStatus === 'error' && <p>Admin access could not be verified. Check the Firestore rules and try again.</p>}
                {adminStatus === 'unavailable' && <p>Firestore is not configured. Add Firebase project settings to enable shared locations.</p>}
              </div>
            )}
            {locationsStatus === 'loading' && <p className="map-feedback" role="status">Loading locations…</p>}
            {locationsStatus === 'error' && <p className="map-feedback map-feedback--error" role="alert">{locationsError}</p>}
            {locationsStatus === 'ready' && locations.length === 0 && (
              <p className="map-feedback" role="status">No locations have been added yet.</p>
            )}
          </aside>
        )}

        <div className="map-container">
          <MapContainer center={[7.0435, 125.5315]} zoom={16.5} scrollWheelZoom className="leaflet-map">
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {adminStatus === 'admin' && <ClickHandler onMapClick={handleMapClick} />}

            {adminStatus === 'admin' && selectedPosition && (
              <Marker
                key={`temporary-${selectedPosition.lat}-${selectedPosition.lng}`}
                position={[selectedPosition.lat, selectedPosition.lng]}
                icon={temporaryLocationIcon}
              >
                <Popup>
                  <div className="popup-card popup-card--temporary">
                    <strong>New location</strong>
                    <span>Temporary</span>
                    <p>Select a name and save this location.</p>
                  </div>
                </Popup>
              </Marker>
            )}

            {locations.map((location) => (
              <Marker key={location.id} position={[location.lat, location.lng]} icon={categoryIcons[location.category] || defaultIcon}>
                <Popup>
                  <div className="popup-card">
                    <strong>{location.name}</strong>
                    <span>{location.category}</span>
                    <p>{location.description}</p>

                    {timeSensitiveCategories.includes(location.category) && (
                      <>
                        <p><strong>Date:</strong> {location.startDate} - {location.endDate}</p>
                        <p><strong>Time:</strong> {location.startTime} - {location.endTime}</p>
                      </>
                    )}

                    {timeStampedCategories.includes(location.category) && (
                      <>
                        <p><strong>Date:</strong> {location.startDate}</p>
                        <p><strong>Time:</strong> {location.startTime}</p>
                      </>
                    )}

                    {adminStatus === 'admin' && (
                      <>
                        <button
                          className="popup-delete-button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteLocation(location);
                          }}
                          disabled={deleteFeedback.locationId === location.id && deleteFeedback.status === 'deleting'}
                        >
                          {deleteFeedback.locationId === location.id && deleteFeedback.status === 'deleting'
                            ? 'Deleting…'
                            : 'Delete location'}
                        </button>
                        {deleteFeedback.locationId === location.id && deleteFeedback.error && (
                          <p className="popup-delete-error" role="alert">{deleteFeedback.error}</p>
                        )}
                      </>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
