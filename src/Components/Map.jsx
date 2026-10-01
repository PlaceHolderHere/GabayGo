import { useEffect, useState } from 'react';
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import BagoAplayaBorder from './BagoAplayaBorder';
import { categoryIcons, defaultIcon, temporaryLocationIcon } from './mapIcons';
import 'leaflet/dist/leaflet.css';
import './Map.css';

// INITIAL LOCATIONS
const categories = ['Location', 'Outage', 'Service', 'Marketplace', 'Report', 'Hazard']
const timeSensitiveCategories = ['Marketplace', 'Outage', 'Service']
const timeStampedCategories = ['Report']
const defaultHazardRadius = 500

function formatRouteDistance(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function formatRouteDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

function describeRouteStep(step) {
  const { type, modifier } = step.maneuver || {};
  const name = step.name ? ` onto ${step.name}` : '';
  const modifierText = modifier ? ` ${modifier}` : '';
  const instructions = {
    depart: 'Start',
    arrive: 'Arrive at your destination',
    turn: `Turn${modifierText}`,
    'new name': 'Continue',
    merge: 'Merge',
    'on ramp': 'Take the ramp',
    'off ramp': 'Take the exit',
    fork: `Keep${modifierText}`,
    'end of road': `Turn${modifierText}`,
    continue: 'Continue',
    roundabout: 'Enter the roundabout',
    rotary: 'Enter the rotary',
    'roundabout turn': 'Take the roundabout exit',
    notification: 'Continue',
  };
  const instruction = instructions[type] || 'Continue';
  return `${instruction}${['depart', 'arrive'].includes(type) ? '' : name}`;
}

function parseLocationDate(date, time) {
  if (!date) return null;
  const parsedDate = new Date(`${date}T${time || '00:00'}`);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function getTimestampDate(timestamp) {
  return typeof timestamp?.toDate === 'function' ? timestamp.toDate() : null;
}

function formatHazardUpdatedAt(location) {
  const updatedAt = getTimestampDate(location.updatedAt) || getTimestampDate(location.createdAt);
  return updatedAt ? updatedAt.toLocaleString() : 'Unavailable';
}

function getAlertOrder(location, now) {
  if (location.category === 'Hazard') {
    const updatedAt = getTimestampDate(location.updatedAt) || getTimestampDate(location.createdAt);
    return { priority: 0, sortTime: updatedAt?.getTime() || 0, timing: `Last updated ${formatHazardUpdatedAt(location)}` };
  }

  const startsAt = parseLocationDate(location.startDate, location.startTime);
  const endsAt = parseLocationDate(location.endDate, location.endTime);
  if (startsAt && startsAt > now) {
    return { priority: 2, sortTime: startsAt.getTime(), timing: `Starts ${startsAt.toLocaleString()}` };
  }
  if ((startsAt && startsAt <= now && (!endsAt || endsAt >= now)) || (!startsAt && endsAt && endsAt >= now)) {
    return { priority: 1, sortTime: endsAt?.getTime() || Number.MAX_SAFE_INTEGER, timing: 'Happening now' };
  }
  if (!startsAt && !endsAt) {
    return { priority: 3, sortTime: Number.MAX_SAFE_INTEGER, timing: 'Timing not specified' };
  }
  return { priority: 4, sortTime: endsAt?.getTime() || startsAt?.getTime() || 0, timing: 'Ended' };
}

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });

  return null;
}

function FocusLocation({ location }) {
  const map = useMap();

  useEffect(() => {
    if (!location) return;
    map.flyTo([location.lat, location.lng], Math.max(map.getZoom(), 17), { duration: 0.55 });
  }, [location, map]);

  return null;
}

export default function Map({ user, demoMode, locations, locationsStatus, locationsError, onRequestLogin, focusedMapLocation }) {
  const [adminCheck, setAdminCheck] = useState({ uid: null, status: 'checking' });
  const [saveError, setSaveError] = useState('');
  const [deleteFeedback, setDeleteFeedback] = useState({ locationId: null, status: '', error: '' });
  const [reportStatusFeedback, setReportStatusFeedback] = useState({ locationId: null, status: '', error: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(() => !focusedMapLocation);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activePanelTab, setActivePanelTab] = useState('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilters, setCategoryFilters] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [selectedHazardId, setSelectedHazardId] = useState(null);
  const [selectedLocationId, setSelectedLocationId] = useState(focusedMapLocation?.id || null);
  const [routeState, setRouteState] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: categories[0],
    description: '',
    officeHours: '',
    contactInfo: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    hazardRadius: String(defaultHazardRadius),
  });
  const isDemoAdmin = demoMode && user?.isAnonymous === true;
  const adminStatus = !db
    ? 'unavailable'
    : !user
      ? 'signed-out'
      : isDemoAdmin
        ? 'admin'
      : adminCheck.uid === user.uid ? adminCheck.status : 'checking';
  const userId = user?.uid;
  const isAdmin = adminStatus === 'admin';
  const canCreateReports = Boolean(db && user);
  const canCreateMarkers = isAdmin || canCreateReports;
  const availableCategories = isAdmin ? categories : ['Report'];
  const selectedFormCategory = isAdmin ? formData.category : 'Report';
  const selectedLocation = locations.find((location) => location.id === selectedLocationId) || null;
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const visibleLocations = locations.filter((location) => {
    const matchesCategory = categoryFilters.length === 0 || categoryFilters.includes(location.category);
    const searchableText = `${location.name} ${location.category} ${location.description}`.toLocaleLowerCase();
    return matchesCategory && (!normalizedSearch || searchableText.includes(normalizedSearch));
  });
  const urgentAlerts = locations
    .filter((location) => ['Hazard', 'Outage'].includes(location.category))
    .map((location) => ({ location, ...getAlertOrder(location, currentTime) }))
    .sort((first, second) => {
      if (first.priority !== second.priority) return first.priority - second.priority;
      if (first.priority === 0 || first.priority === 4) return second.sortTime - first.sortTime;
      return first.sortTime - second.sortTime;
    });

  useEffect(() => {
    const refreshCurrentTime = () => setCurrentTime(Date.now());
    refreshCurrentTime();
    const intervalId = window.setInterval(refreshCurrentTime, 60000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!db || !userId || isDemoAdmin) return undefined;

    return onSnapshot(doc(db, 'admin', userId), (adminDoc) => {
      setAdminCheck({
        uid: userId,
        status: adminDoc.exists() && adminDoc.data().enabled === true ? 'admin' : 'not-admin',
      });
    }, () => {
      setAdminCheck({ uid: userId, status: 'error' });
    });
  }, [userId, isDemoAdmin]);

  useEffect(() => {
    if (routeState?.status !== 'loading' || !routeState.destination) return undefined;

    const controller = new AbortController();
    const { origin, destination } = routeState;
    const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true`;

    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('The directions service is unavailable. Please try again.');
        return response.json();
      })
      .then((data) => {
        const route = data.routes?.[0];
        if (data.code !== 'Ok' || !route) throw new Error('No driving route was found between these places.');
        const steps = route.legs.flatMap((leg) => leg.steps.map((step) => ({
          instruction: describeRouteStep(step),
          distance: step.distance,
        })));
        setRouteState((current) => current?.origin === origin && current?.destination === destination
          ? {
            ...current,
            status: 'ready',
            geometry: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
            distance: route.distance,
            duration: route.duration,
            steps,
          }
          : current);
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setRouteState((current) => current?.origin === origin && current?.destination === destination
          ? { ...current, status: 'error', error: error.message || 'Directions could not be loaded.' }
          : current);
      });

    return () => controller.abort();
  }, [routeState]);

  // Updates selected position
  const handleMapClick = (latlng) => {
    if (routeState) {
      if (routeState.status === 'selecting') {
        setRouteState((current) => ({
          ...current,
          destination: { lat: latlng.lat, lng: latlng.lng, name: 'Map point' },
          status: 'loading',
        }));
        setActivePanelTab('search');
        setPanelOpen(true);
      }
      return;
    }
    setSelectedHazardId(null);
    setSelectedLocationId(null);
    if (!canCreateMarkers) return;
    setSelectedPosition(latlng);
    setActivePanelTab('create');
    setPanelOpen(true);
  };

  const handleStartRoute = (location) => {
    setSelectedLocationId(null);
    setRouteState({
      origin: { lat: location.lat, lng: location.lng, name: location.name },
      destination: null,
      status: 'selecting',
    });
    setSelectedPosition(null);
    setEditingLocationId(null);
    setActivePanelTab('search');
    setPanelOpen(true);
  };

  const handleStartRouteFromCurrentLocation = (destinationLocation = null) => {
    setSelectedLocationId(null);
    const origin = { name: 'Your location' };
    const destination = destinationLocation
      ? { lat: destinationLocation.lat, lng: destinationLocation.lng, name: destinationLocation.name }
      : null;
    setRouteState({ origin, destination, status: 'locating' });
    setSelectedPosition(null);
    setEditingLocationId(null);
    setActivePanelTab('search');
    setPanelOpen(true);

    const handleLocationError = (message) => {
      setRouteState((current) => current?.origin === origin
        ? { ...current, status: 'error', error: message }
        : current);
    };

    if (!navigator.geolocation) {
      handleLocationError('Your browser does not support location access.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setRouteState((current) => current?.origin === origin
          ? {
            ...current,
            origin: { ...origin, lat: coords.latitude, lng: coords.longitude },
            status: current.destination ? 'loading' : 'selecting',
          }
          : current);
      },
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? 'Location access was denied. Allow location access in your browser and try again.'
          : error.code === error.TIMEOUT
            ? 'Your location could not be found in time. Please try again.'
            : 'Your current location is unavailable. Please try again.';
        handleLocationError(message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
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

    if (!db || !user || !canCreateMarkers || (!selectedPosition && !editingLocationId) || !formData.name.trim()) {
      return;
    }

    const locationDetails = {
      name: formData.name.trim(),
      description: formData.description.trim() || (editingLocationId ? '' : 'New location added by the user.'),
    };
    if (selectedFormCategory === 'Location') {
      locationDetails.officeHours = formData.officeHours.trim();
      locationDetails.contactInfo = formData.contactInfo.trim();
    }
    if (timeSensitiveCategories.includes(selectedFormCategory)
      || (editingLocationId && timeStampedCategories.includes(selectedFormCategory))) {
      locationDetails.startDate = formData.startDate || null;
      locationDetails.startTime = formData.startTime || null;
      locationDetails.endDate = formData.endDate || null;
      locationDetails.endTime = formData.endTime || null;
    }
    if (selectedFormCategory === 'Hazard') {
      locationDetails.hazardRadius = Number(formData.hazardRadius);
      locationDetails.updatedAt = serverTimestamp();
    }

    setIsSaving(true);
    setSaveError('');

    try {
      if (editingLocationId) {
        await updateDoc(doc(db, 'Locations', editingLocationId), locationDetails);
        setEditingLocationId(null);
        setPanelOpen(false);
      } else {
        const newLocation = {
          ...locationDetails,
          category: selectedFormCategory,
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

        await addDoc(collection(db, 'Locations'), newLocation);
      }
      setFormData({
        name: '',
        category: isAdmin ? categories[0] : 'Report',
        description: '',
        officeHours: '',
        contactInfo: '',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        hazardRadius: String(defaultHazardRadius),
      });
      setSelectedPosition(null);
    } catch {
      setSaveError('This location could not be saved. Check your admin access and Firestore rules.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditLocation = (location) => {
    setFormData({
      name: location.name || '',
      category: location.category || categories[0],
      description: location.description || '',
      officeHours: location.officeHours || '',
      contactInfo: location.contactInfo || '',
      startDate: location.startDate || '',
      startTime: location.startTime || '',
      endDate: location.endDate || '',
      endTime: location.endTime || '',
      hazardRadius: String(location.hazardRadius || defaultHazardRadius),
    });
    setEditingLocationId(location.id);
    setSelectedLocationId(location.id);
    setSelectedPosition(null);
    setActivePanelTab('create');
    setPanelOpen(true);
  };

  const handleCancelEdit = () => {
    setEditingLocationId(null);
    setPanelOpen(false);
    setFormData({
      name: '',
      category: isAdmin ? categories[0] : 'Report',
      description: '',
      officeHours: '',
      contactInfo: '',
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
      hazardRadius: String(defaultHazardRadius),
    });
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
          className={`map-panel-toggle${panelOpen ? ' map-panel-toggle--panel-open' : ''}${editingLocationId ? ' map-panel-toggle--editing' : ''}`}
          type="button"
          aria-expanded={panelOpen}
          aria-controls="map-panel"
          aria-label={panelOpen ? 'Hide map tools' : 'Show map tools'}
          onClick={() => {
            setPanelOpen((isOpen) => !isOpen);
            if (window.innerWidth <= 860) setNotificationsOpen(false);
          }}
        >
          <span aria-hidden="true">{panelOpen ? '‹' : '›'}</span>
        </button>

        {panelOpen && (
          <aside className={`map-panel${editingLocationId ? ' map-panel--editing' : ''}`} id="map-panel" aria-label={editingLocationId ? 'Edit marker' : 'Add or search for a location'}>
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
                {routeState && (
                  <section className="route-panel" aria-label="Driving directions">
                    <div className="route-panel-header">
                      <h3>Driving directions</h3>
                      <button className="map-danger-button" type="button" onClick={() => setRouteState(null)}>Cancel</button>
                    </div>
                    <p className="route-endpoint"><strong>From</strong> {routeState.origin?.name || 'Your location'}</p>
                    {routeState.destination && (
                      <p className="route-endpoint"><strong>To</strong> {routeState.destination.name}</p>
                    )}
                    {routeState.status === 'locating' && (
                      <p className="map-feedback" role="status">Finding your current location…</p>
                    )}
                    {routeState.status === 'selecting' && (
                      <p className="map-feedback" role="status">Click the map to choose your destination.</p>
                    )}
                    {routeState.status === 'loading' && (
                      <p className="map-feedback" role="status">Finding a driving route…</p>
                    )}
                    {routeState.status === 'error' && (
                      <p className="map-feedback map-feedback--error" role="alert">{routeState.error}</p>
                    )}
                    {routeState.status === 'ready' && (
                      <>
                        <p className="route-summary" role="status">
                          {formatRouteDistance(routeState.distance)} · {formatRouteDuration(routeState.duration)}
                        </p>
                        <ol className="route-steps">
                          {routeState.steps.map((step, index) => (
                            <li key={`${step.instruction}-${index}`}>
                              <span>{step.instruction}</span>
                              <small>{formatRouteDistance(step.distance)}</small>
                            </li>
                          ))}
                        </ol>
                      </>
                    )}
                  </section>
                )}
                {!routeState && (
                  <button
                    className="route-start-button"
                    type="button"
                    onClick={() => handleStartRouteFromCurrentLocation()}
                  >
                    Directions from my location
                  </button>
                )}
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
              <h3>{editingLocationId ? 'Edit marker' : 'Add a location'}</h3>
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
                <select name="category" value={selectedFormCategory} onChange={handleInputChange} disabled={!isAdmin || Boolean(editingLocationId)}>
                  {availableCategories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>

              {selectedFormCategory === 'Hazard' && (
                <label>
                  Coverage radius (meters)
                  <input
                    name="hazardRadius"
                    type="number"
                    min="50"
                    max="50000"
                    step="any"
                    required
                    value={formData.hazardRadius}
                    onChange={handleInputChange}
                  />
                </label>
              )}

              {(timeSensitiveCategories.includes(selectedFormCategory)
                || (editingLocationId && timeStampedCategories.includes(selectedFormCategory))) && (
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
                {selectedFormCategory === 'Hazard' ? 'Warning and instructions' : 'Description'}
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder={selectedFormCategory === 'Hazard'
                    ? 'Describe the hazard and what people should do'
                    : 'Short description'}
                />
              </label>

              {selectedFormCategory === 'Location' && (
                <>
                  <label>
                    Office hours
                    <textarea
                      name="officeHours"
                      value={formData.officeHours}
                      onChange={handleInputChange}
                      rows="2"
                      maxLength="500"
                      placeholder="e.g. Mon-Fri, 8:00 AM-5:00 PM"
                    />
                  </label>
                  <label>
                    Contact information
                    <input
                      type="text"
                      name="contactInfo"
                      value={formData.contactInfo}
                      onChange={handleInputChange}
                      maxLength="500"
                      placeholder="Phone, email, or website"
                    />
                  </label>
                </>
              )}

              <button type="submit" disabled={(!selectedPosition && !editingLocationId) || !formData.name.trim() || isSaving}>
                {isSaving ? (isAdmin ? 'Saving location…' : 'Submitting report…') : editingLocationId ? 'Save changes' : isAdmin ? 'Add Location' : 'Submit Report'}
              </button>
              {editingLocationId && <button className="map-danger-button" type="button" onClick={handleCancelEdit}>Cancel edit</button>}
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

        {selectedLocation && !editingLocationId && (
          <aside className="marker-details-panel" aria-label={`Details for ${selectedLocation.name}`}>
            <header className="marker-details-header">
              <div>
                <p className="map-eyebrow">{selectedLocation.category}</p>
                <h2>{selectedLocation.name}</h2>
              </div>
              <button
                className="marker-details-close"
                type="button"
                aria-label="Close location details"
                onClick={() => {
                  setSelectedLocationId(null);
                  setSelectedHazardId(null);
                }}
              >
                ×
              </button>
            </header>

            {selectedLocation.description && (
              <p className={selectedLocation.category === 'Hazard' ? 'marker-details-warning' : 'marker-details-description'}>
                {selectedLocation.category === 'Hazard' && <strong>Warning: </strong>}
                {selectedLocation.description}
              </p>
            )}
            {selectedLocation.category === 'Hazard' && (
              <dl className="marker-details-facts">
                <div><dt>Coverage radius</dt><dd>{selectedLocation.hazardRadius || defaultHazardRadius} m</dd></div>
                <div><dt>Last updated</dt><dd>{formatHazardUpdatedAt(selectedLocation)}</dd></div>
              </dl>
            )}
            {selectedLocation.category === 'Location' && (selectedLocation.officeHours || selectedLocation.contactInfo) && (
              <dl className="marker-details-facts">
                {selectedLocation.officeHours && <div><dt>Office hours</dt><dd>{selectedLocation.officeHours}</dd></div>}
                {selectedLocation.contactInfo && <div><dt>Contact</dt><dd>{selectedLocation.contactInfo}</dd></div>}
              </dl>
            )}
            {timeSensitiveCategories.includes(selectedLocation.category) && (
              <dl className="marker-details-facts">
                <div><dt>Date</dt><dd>{selectedLocation.startDate || 'Not specified'}{selectedLocation.endDate ? ` – ${selectedLocation.endDate}` : ''}</dd></div>
                <div><dt>Time</dt><dd>{selectedLocation.startTime || 'Not specified'}{selectedLocation.endTime ? ` – ${selectedLocation.endTime}` : ''}</dd></div>
              </dl>
            )}
            {timeStampedCategories.includes(selectedLocation.category) && (
              <dl className="marker-details-facts">
                <div><dt>Opened</dt><dd>{selectedLocation.startDate || 'Not specified'}</dd></div>
                <div><dt>Status</dt><dd>{selectedLocation.status || (selectedLocation.resolvedAt ? 'Resolved' : 'Submitted')}</dd></div>
                {selectedLocation.resolvedAt && <div><dt>Resolved</dt><dd>{selectedLocation.resolvedAt.toDate().toLocaleString()}</dd></div>}
              </dl>
            )}
            {selectedLocation.createdBy && <p className="marker-details-by">Added by account: {selectedLocation.createdBy}</p>}

            <div className="marker-details-actions">
              <button type="button" onClick={() => handleStartRoute(selectedLocation)}>Directions from here</button>
              <button type="button" onClick={() => handleStartRouteFromCurrentLocation(selectedLocation)}>Directions from my location</button>
            </div>

            {isAdmin && selectedLocation.category === 'Report' && (
              <div className="marker-details-actions">
                {(selectedLocation.status || (selectedLocation.resolvedAt ? 'Resolved' : 'Submitted')) === 'Submitted' && (
                  <button
                    type="button"
                    onClick={() => handleReportStatusChange(selectedLocation, 'Under review')}
                    disabled={reportStatusFeedback.locationId === selectedLocation.id && reportStatusFeedback.status === 'updating'}
                  >Mark under review</button>
                )}
                {(selectedLocation.status || (selectedLocation.resolvedAt ? 'Resolved' : 'Submitted')) === 'Under review' && (
                  <button
                    type="button"
                    onClick={() => handleReportStatusChange(selectedLocation, 'Resolved')}
                    disabled={reportStatusFeedback.locationId === selectedLocation.id && reportStatusFeedback.status === 'updating'}
                  >Mark resolved</button>
                )}
                {reportStatusFeedback.locationId === selectedLocation.id && reportStatusFeedback.error && (
                  <p className="popup-delete-error" role="alert">{reportStatusFeedback.error}</p>
                )}
              </div>
            )}

            {isAdmin && (
              <div className="marker-details-admin-actions">
                <button type="button" onClick={() => handleEditLocation(selectedLocation)}>Edit marker</button>
                <button
                  className="popup-delete-button map-danger-button"
                  type="button"
                  onClick={() => handleDeleteLocation(selectedLocation)}
                  disabled={deleteFeedback.locationId === selectedLocation.id && deleteFeedback.status === 'deleting'}
                >
                  {deleteFeedback.locationId === selectedLocation.id && deleteFeedback.status === 'deleting' ? 'Deleting…' : 'Delete location'}
                </button>
                {deleteFeedback.locationId === selectedLocation.id && deleteFeedback.error && (
                  <p className="popup-delete-error" role="alert">{deleteFeedback.error}</p>
                )}
              </div>
            )}
          </aside>
        )}

        <button
          className="notifications-toggle"
          type="button"
          onClick={() => {
            setNotificationsOpen((isOpen) => !isOpen);
            if (!notificationsOpen && window.innerWidth <= 860) setPanelOpen(false);
          }}
          aria-expanded={notificationsOpen}
          aria-controls="urgent-alerts-panel"
          aria-label={notificationsOpen
            ? 'Close urgent alerts'
            : `Urgent alerts${urgentAlerts.length ? `, ${urgentAlerts.length} active` : ''}`}
          title="Urgent alerts"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {notificationsOpen
              ? <path d="m6 6 12 12M18 6 6 18" />
              : <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />}
          </svg>
          {urgentAlerts.length > 0 && (
            <span className="notifications-count" aria-hidden="true">
              {urgentAlerts.length > 99 ? '99+' : urgentAlerts.length}
            </span>
          )}
        </button>

        {notificationsOpen && (
          <aside className="urgent-alerts-panel" id="urgent-alerts-panel" aria-label="Urgent alerts">
            <header className="urgent-alerts-header">
              <div>
                <p className="map-eyebrow">Live updates</p>
                <h2>Urgent alerts</h2>
              </div>
            </header>

            {locationsStatus === 'loading' && <p className="map-feedback" role="status">Loading alerts…</p>}
            {locationsStatus === 'error' && <p className="map-feedback map-feedback--error" role="alert">{locationsError}</p>}
            {locationsStatus === 'ready' && urgentAlerts.length === 0 && (
              <p className="urgent-alerts-empty" role="status">No hazards or outages reported.</p>
            )}
            {urgentAlerts.length > 0 && (
              <ul className="urgent-alerts-list" aria-live="polite">
                {urgentAlerts.map(({ location, timing }) => (
                  <li className={`urgent-alert-item urgent-alert-item--${location.category.toLowerCase()}`} key={location.id}>
                    <span className="urgent-alert-category">{location.category}</span>
                    <strong>{location.name}</strong>
                    <p>{location.description || 'No additional details provided.'}</p>
                    {location.category === 'Hazard' && (
                      <>
                        <span className="urgent-alert-meta">Coverage radius: {location.hazardRadius || defaultHazardRadius} m</span>
                        <span className="urgent-alert-meta">{timing}</span>
                      </>
                    )}
                    {location.category === 'Outage' && <span className="urgent-alert-meta">{timing}</span>}
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}

        <div className="map-container">
          <MapContainer center={[7.0435, 125.5315]} zoom={16.5} scrollWheelZoom className="leaflet-map">
            <FocusLocation
              location={focusedMapLocation?.id
                ? locations.find((location) => location.id === focusedMapLocation.id)
                : focusedMapLocation}
            />
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <BagoAplayaBorder />

            <ClickHandler onMapClick={handleMapClick} />

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

            {focusedMapLocation && !focusedMapLocation.id && (
              <Marker
                position={[focusedMapLocation.lat, focusedMapLocation.lng]}
                icon={temporaryLocationIcon}
              >
                <Popup>
                  <div className="popup-card popup-card--temporary">
                    <strong>{focusedMapLocation.name || 'Custom Marketplace pin'}</strong>
                    <span>{focusedMapLocation.lat.toFixed(5)}, {focusedMapLocation.lng.toFixed(5)}</span>
                  </div>
                </Popup>
              </Marker>
            )}

            {canCreateMarkers && selectedPosition && selectedFormCategory === 'Hazard' && (
              <Circle
                key={`hazard-radius-preview-${selectedPosition.lat}-${selectedPosition.lng}`}
                center={[selectedPosition.lat, selectedPosition.lng]}
                radius={Number(formData.hazardRadius) || defaultHazardRadius}
                interactive={false}
                pathOptions={{
                  color: '#b93824',
                  fillColor: '#e56a42',
                  fillOpacity: 0.1,
                  weight: 2,
                  dashArray: '6 6',
                }}
              />
            )}

            {routeState?.status === 'ready' && (
              <Polyline
                positions={routeState.geometry}
                pathOptions={{ color: '#236b5c', weight: 5, opacity: 0.88 }}
              />
            )}

            {routeState?.destination && (
              <Marker
                position={[routeState.destination.lat, routeState.destination.lng]}
                icon={temporaryLocationIcon}
              >
                <Popup>
                  <div className="popup-card popup-card--temporary">
                    <strong>Destination</strong>
                    <span>{routeState.destination.name}</span>
                  </div>
                </Popup>
              </Marker>
            )}

            {visibleLocations.filter((location) => location.category === 'Hazard' && selectedHazardId === location.id).map((location) => (
              <Circle
                key={`hazard-radius-${location.id}`}
                center={[location.lat, location.lng]}
                radius={location.hazardRadius || defaultHazardRadius}
                interactive={false}
                pathOptions={{ color: '#b93824', fillColor: '#e56a42', fillOpacity: 0.16, weight: 2 }}
              />
            ))}

            {visibleLocations.map((location) => (
              <Marker
                key={location.id}
                position={[location.lat, location.lng]}
                icon={categoryIcons[location.category] || defaultIcon}
                eventHandlers={{
                  click: () => {
                    setSelectedLocationId(location.id);
                    setSelectedHazardId(location.category === 'Hazard' ? location.id : null);
                    setPanelOpen(false);
                    setNotificationsOpen(false);
                    setRouteState(null);
                  },
                }}
              >
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
