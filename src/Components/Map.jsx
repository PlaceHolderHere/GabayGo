import { useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
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
const initialLocations = [
  {
    id: 1,
    name: 'Barangay Hall',
    category: 'Location',
    description: 'Bago Aplaya Barangay Hall.',
    lat: 7.0435,
    lng: 125.5315,
  },
  {
    id: 2,
    name: 'Health Service',
    category: 'Service',
    description: 'A Medical and Health Service Run',
    lat: 7.042658321058582,
    lng: 125.52893733731472,
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
    category: categories[0],
    description: '',
  });

  // Updates selected position
  const handleMapClick = (latlng) => {
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
      startDate: null,
      startTime: null,
      endDate: null,
      endTime: null,
    };

    // If the category is time-sensitive, add the start and end date/time to the new location
    if (timeSensitiveCategories.includes(formData.category)) {
      newLocation.startDate = formData.startDate;
      newLocation.startTime = formData.startTime;
      newLocation.endDate = formData.endDate;
      newLocation.endTime = formData.endTime;
    }

    // If the category is time-stamped, add the current date and time to the new location
    if (timeStampedCategories.includes(formData.category)) {
        const now = new Date();
        newLocation.startDate = now.toISOString().split('T')[0]; // Current date in YYYY-MM-DD format
        newLocation.startTime = now.toTimeString().split(' ')[0]; // Current time in HH:MM:SS format
    }

    setLocations((prev) => [...prev, newLocation]);
    setFormData({
      name: '',
      category: categories[0],
      description: '',
    });
    setSelectedPosition(null);
  };

  return (
    <div className="map-page">
      <div className="map-panel">
        <div className="map-header">
          <div>
            <h2>Add a Location</h2>
            <p>Click anywhere on the map to choose a location.</p>
          </div>
        </div>

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
            <Marker key={location.id} position={[location.lat, location.lng]} icon={categoryIcons[location.category]}>
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
                  
                  
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
