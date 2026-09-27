import { useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './Map.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// ICONS
const defaultIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const temporaryLocationIcon = new L.DivIcon({
  className: 'temporary-location-pin-wrapper',
  html: '<div class="temporary-location-pin"><span class="temporary-location-pin__inner"></span></div>',
  iconSize: [22, 32],
  iconAnchor: [11, 31],
  popupAnchor: [0, -26],
});

L.Marker.prototype.options.icon = defaultIcon;

// INITIAL LOCATIONS
const initialLocations = [
  {
    id: 1,
    name: 'Barangay Hall',
    category: 'Landmark',
    description: 'Bago Aplaya Barangay Hall.',
    lat: 7.0435,
    lng: 125.5315,
  },
];

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });

  return null;
}

export default function Map() {
  const [locations, setLocations] = useState(initialLocations);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Landmark',
    description: '',
  });

  const handleMapClick = (latlng) => {
    setSelectedPosition(latlng);
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddLocation = (event) => {
    event.preventDefault();

    if (!selectedPosition || !formData.name.trim()) {
      return;
    }

    const newLocation = {
      id: Date.now(),
      name: formData.name.trim(),
      category: formData.category,
      description: formData.description.trim() || 'New location added by the user.',
      lat: selectedPosition.lat,
      lng: selectedPosition.lng,
    };

    setLocations((prev) => [...prev, newLocation]);
    setFormData({
      name: '',
      category: 'Landmark',
      description: '',
    });
    setSelectedPosition(null);
  };

  return (
    <div className="map-page">
      <div className="map-panel">
        <div className="map-header">
          <div>
            <p className="eyebrow">Map View</p>
            <h2>Locations</h2>
          </div>
        </div>

        <ul className="location-list">
          {locations.map((location) => (
            <li key={location.id} className="location-item">
              <strong>{location.name}</strong>
              <span>{location.category}</span>
            </li>
          ))}
        </ul>

        <form className="add-location-form" onSubmit={handleAddLocation}>
          <div className="form-header">
            <h3>Add New Pin</h3>
            <p>Click anywhere on the map to choose a location.</p>
          </div>
          
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
              <option value="Landmark">Landmark</option>
              <option value="Cafe">Cafe</option>
              <option value="Park">Park</option>
              <option value="Shopping">Shopping</option>
              <option value="Office">Office</option>
            </select>
          </label>

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

          <button type="submit" disabled={!selectedPosition || !formData.name.trim()}>
            Add Location
          </button>
        </form>
      </div>

      <div className="map-container">
        <MapContainer center={[7.0435, 125.5315]} zoom={16.5} scrollWheelZoom className="leaflet-map">
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <ClickHandler onMapClick={handleMapClick} />

          {selectedPosition && (
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
            <Marker key={location.id} position={[location.lat, location.lng]} icon={defaultIcon}>
              <Popup>
                <div className="popup-card">
                  <strong>{location.name}</strong>
                  <span>{location.category}</span>
                  <p>{location.description}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
