import { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { categoryIcons, defaultIcon, temporaryLocationIcon } from './mapIcons';
import 'leaflet/dist/leaflet.css';
import './Map.css';

// INITIAL LOCATIONS
const categories = ['Location', 'Outage', 'Service', 'Marketplace', 'Report']
const timeSensitiveCategories = ['Marketplace', 'Outage', 'Service']
const timeStampedCategories = ['Report']
function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });

  return null;
}

export default function Map({ user, locations, locationsStatus, locationsError, onRequestLogin }) {
  const [adminCheck, setAdminCheck] = useState({ uid: null, status: 'checking' });
  const [saveError, setSaveError] = useState('');
  const [deleteFeedback, setDeleteFeedback] = useState({ locationId: null, status: '', error: '' });
  const [reportStatusFeedback, setReportStatusFeedback] = useState({ locationId: null, status: '', error: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [activePanelTab, setActivePanelTab] = useState('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilters, setCategoryFilters] = useState([]);
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
  const isAdmin = adminStatus === 'admin';
  const canCreateReports = Boolean(db && user);
  const canCreateMarkers = isAdmin || canCreateReports;
  const availableCategories = isAdmin ? categories : ['Report'];
  const selectedFormCategory = isAdmin ? formData.category : 'Report';
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const visibleLocations = locations.filter((location) => {
    const matchesCategory = categoryFilters.length === 0 || categoryFilters.includes(location.category);
    const searchableText = `${location.name} ${location.category} ${location.description}`.toLocaleLowerCase();
    return matchesCategory && (!normalizedSearch || searchableText.includes(normalizedSearch));
  });

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
    if (!canCreateMarkers) return;
    setSelectedPosition(latlng);
    setActivePanelTab('create');
    setPanelOpen(true);
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

    if (!db || !user || !canCreateMarkers || !selectedPosition || !formData.name.trim()) {
      return;
    }

    const newLocation = {
      name: formData.name.trim(),
      category: selectedFormCategory,
      description: formData.description.trim() || 'New location added by the user.',
      lat: selectedPosition.lat,
      lng: selectedPosition.lng,
      startDate: formData.startDate || null,
      startTime: formData.startTime || null,
      endDate: formData.endDate || null,
      endTime: formData.endTime || null,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      status: selectedFormCategory === 'Report' ? 'Submitted' : null,
      underReviewAt: null,
      underReviewBy: null,
      resolvedAt: null,
      resolvedBy: null,
    };

    if (timeStampedCategories.includes(selectedFormCategory)) {
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
        category: isAdmin ? categories[0] : 'Report',
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

  const handleReportStatusChange = async (location, nextStatus) => {
    if (!db || !user || adminStatus !== 'admin' || location.category !== 'Report') return;

    const currentStatus = location.status || (location.resolvedAt ? 'Resolved' : 'Submitted');
    const canMoveToReview = currentStatus === 'Submitted' && nextStatus === 'Under review';
    const canResolve = currentStatus === 'Under review' && nextStatus === 'Resolved';
    if (!canMoveToReview && !canResolve) return;
    if (!window.confirm(`Change "${location.name}" to ${nextStatus.toLowerCase()}?`)) return;

    setReportStatusFeedback({ locationId: location.id, status: 'updating', error: '' });
    try {
      const updates = { status: nextStatus };
      if (canMoveToReview) {
        updates.underReviewAt = serverTimestamp();
        updates.underReviewBy = user.uid;
      } else {
        updates.resolvedAt = serverTimestamp();
        updates.resolvedBy = user.uid;
      }
      await updateDoc(doc(db, 'Locations', location.id), updates);
      setReportStatusFeedback({ locationId: null, status: '', error: '' });
    } catch {
      setReportStatusFeedback({
        locationId: location.id,
        status: 'error',
        error: 'Report status could not be updated. Check your admin access and Firestore rules.',
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
                <h2>Community map</h2>
                <p>Find places or add a location.</p>
              </div>
            </div>

            <div className="sidebar-tabs" role="group" aria-label="Map sidebar views">
              <button
                className={activePanelTab === 'search' ? 'sidebar-tab sidebar-tab--active' : 'sidebar-tab'}
                type="button"
                onClick={() => setActivePanelTab('search')}
                aria-pressed={activePanelTab === 'search'}
              >
                Search
              </button>
              <button
                className={activePanelTab === 'create' ? 'sidebar-tab sidebar-tab--active' : 'sidebar-tab'}
                type="button"
                onClick={() => setActivePanelTab('create')}
                aria-pressed={activePanelTab === 'create'}
              >
                Create
              </button>
            </div>

            <div className="sidebar-view" aria-label={activePanelTab === 'search' ? 'Search locations' : 'Create a location'}>
            {activePanelTab === 'search' && (
              <>
                <section className="location-filters" aria-label="Search and filter locations">
                  <label>
                    Search locations
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Name, category, or details"
                    />
                  </label>
                  <fieldset className="location-category-filter">
                    <legend>Categories</legend>
                    <div className="location-category-options">
                      {categories.map((category) => (
                        <label className="location-category-option" key={category}>
                          <input
                            type="checkbox"
                            checked={categoryFilters.includes(category)}
                            onChange={(event) => {
                              setCategoryFilters((selected) => event.target.checked
                                ? [...selected, category]
                                : selected.filter((selectedCategory) => selectedCategory !== category))
                            }}
                          />
                          <span>{category}</span>
                        </label>
                      ))}
                    </div>
                    {categoryFilters.length > 0 && (
                      <button className="clear-category-filters" type="button" onClick={() => setCategoryFilters([])}>
                        Clear categories
                      </button>
                    )}
                  </fieldset>
                  {locationsStatus === 'ready' && (
                    <p className="location-result-count" role="status">
                      {visibleLocations.length} of {locations.length} locations
                    </p>
                  )}
                </section>
                {locationsStatus === 'loading' && <p className="map-feedback" role="status">Loading locations…</p>}
                {locationsStatus === 'error' && <p className="map-feedback map-feedback--error" role="alert">{locationsError}</p>}
                {locationsStatus === 'ready' && locations.length === 0 && (
                  <p className="map-feedback" role="status">No locations have been added yet.</p>
                )}
                {locationsStatus === 'ready' && locations.length > 0 && visibleLocations.length === 0 && (
                  <p className="map-feedback" role="status">No locations match those filters.</p>
                )}
              </>
            )}

            {activePanelTab === 'create' && (
            <>
              {canCreateMarkers ? (
              <form className="add-location-form" onSubmit={handleAddLocation}>
              {!isAdmin && <p className="report-access-note">You can submit a report. Other location types are reserved for admins.</p>}
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
                <select name="category" value={selectedFormCategory} onChange={handleInputChange} disabled={!isAdmin}>
                  {availableCategories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>

              {timeSensitiveCategories.includes(selectedFormCategory) && (
                <>
                  <label>
                    Start Date
                    <input name="startDate" type="date" value={formData.startDate} onChange={handleInputChange} />
                  </label>
                  <label>
                    Start Time
                    <input name="startTime" type="time" value={formData.startTime} onChange={handleInputChange} />
                  </label>
                  <label>
                    End Date
                    <input name="endDate" type="date" value={formData.endDate} onChange={handleInputChange} />
                  </label>
                  <label>
                    End Time
                    <input name="endTime" type="time" value={formData.endTime} onChange={handleInputChange} />
                  </label>
                </>
              )}

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
                {isSaving ? (isAdmin ? 'Saving location…' : 'Submitting report…') : isAdmin ? 'Add Location' : 'Submit Report'}
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
            </>
            )}
            </div>
          </aside>
        )}

        <div className="map-container">
          <MapContainer center={[7.0435, 125.5315]} zoom={16.5} scrollWheelZoom className="leaflet-map">
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {canCreateMarkers && <ClickHandler onMapClick={handleMapClick} />}

            {canCreateMarkers && selectedPosition && (
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

            {visibleLocations.map((location) => (
              <Marker key={location.id} position={[location.lat, location.lng]} icon={categoryIcons[location.category] || defaultIcon}>
                <Popup>
                  <div className="popup-card">
                    <strong>{location.name}</strong>
                    <span>{location.category}</span>
                    <p>{location.description}</p>
                    {location.createdBy && (
                      <p className="popup-created-by">Added by account: {location.createdBy}</p>
                    )}

                    {timeSensitiveCategories.includes(location.category) && (
                      <>
                        <p><strong>Date:</strong> {location.startDate} - {location.endDate}</p>
                        <p><strong>Time:</strong> {location.startTime} - {location.endTime}</p>
                      </>
                    )}

                    {timeStampedCategories.includes(location.category) && (
                      <>
                        <p><strong>Opened:</strong> {location.startDate}</p>
                        <p className="popup-report-status">
                          <strong>Status:</strong> {location.status || (location.resolvedAt ? 'Resolved' : 'Submitted')}
                        </p>
                      </>
                    )}

                    {location.category === 'Report' && location.resolvedAt && (
                      <p className="popup-resolution-status">
                        <strong>Resolved:</strong> {location.resolvedAt.toDate().toLocaleString()}
                        {location.resolvedBy && ` · by ${location.resolvedBy}`}
                      </p>
                    )}

                    {adminStatus === 'admin' && location.category === 'Report' && (
                      <>
                        {(location.status || (location.resolvedAt ? 'Resolved' : 'Submitted')) === 'Submitted' && (
                          <button
                            className="popup-resolve-button"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleReportStatusChange(location, 'Under review');
                            }}
                            disabled={reportStatusFeedback.locationId === location.id && reportStatusFeedback.status === 'updating'}
                          >
                            Mark under review
                          </button>
                        )}
                        {(location.status || (location.resolvedAt ? 'Resolved' : 'Submitted')) === 'Under review' && (
                          <button
                            className="popup-resolve-button"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleReportStatusChange(location, 'Resolved');
                            }}
                            disabled={reportStatusFeedback.locationId === location.id && reportStatusFeedback.status === 'updating'}
                          >
                            Mark resolved
                          </button>
                        )}
                        {reportStatusFeedback.locationId === location.id && reportStatusFeedback.error && (
                          <p className="popup-delete-error" role="alert">{reportStatusFeedback.error}</p>
                        )}
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
