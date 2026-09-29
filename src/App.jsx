import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { collection, onSnapshot } from 'firebase/firestore'
import { auth, db } from './firebase'
import './App.css'
import Map from './Components/Map'
import Navbar from './Components/Navbar'
import Updates from './Pages/Updates'
import Marketplace from './Pages/Marketplace'
import Login from './Pages/Login'
import Chat from './Pages/Chat'

function App() {
  const [user, setUser] = useState(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [activePage, setActivePage] = useState('map')
  const [locations, setLocations] = useState([])
  const [locationsStatus, setLocationsStatus] = useState(db ? 'loading' : 'unavailable')
  const [locationsError, setLocationsError] = useState('')
  const [marketplaceListings, setMarketplaceListings] = useState([])
  const [marketplaceListingsStatus, setMarketplaceListingsStatus] = useState(db ? 'loading' : 'unavailable')
  const [marketplaceListingsError, setMarketplaceListingsError] = useState('')
  const [focusedMapLocationId, setFocusedMapLocationId] = useState(null)
  const [hazardNoticeDismissed, setHazardNoticeDismissed] = useState(false)
  const activeHazards = locations
    .filter((location) => location.category === 'Hazard')
    .sort((first, second) => {
      const firstTime = first.updatedAt?.toMillis?.() || first.createdAt?.toMillis?.() || 0
      const secondTime = second.updatedAt?.toMillis?.() || second.createdAt?.toMillis?.() || 0
      return secondTime - firstTime
    })

  useEffect(() => {
    if (!auth) return undefined

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      if (!nextUser) setActivePage('map')
    }, () => {
      setUser(null)
      setActivePage('map')
    })
  }, [])

  useEffect(() => {
    if (!db) return undefined

    return onSnapshot(collection(db, 'Locations'), (snapshot) => {
      const nextLocations = snapshot.docs
        .map((locationDoc) => ({ id: locationDoc.id, ...locationDoc.data() }))
        .filter((location) => Number.isFinite(location.lat) && Number.isFinite(location.lng))
      setLocations(nextLocations)
      setLocationsStatus('ready')
      setLocationsError('')
    }, () => {
      setLocationsStatus('error')
      setLocationsError('Locations could not be loaded. Check the Firestore database and its read rules.')
    })
  }, [])

  useEffect(() => {
    if (!db) return undefined

    return onSnapshot(collection(db, 'MarketplaceListings'), (snapshot) => {
      setMarketplaceListings(snapshot.docs.map((listingDoc) => ({ id: listingDoc.id, ...listingDoc.data() })))
      setMarketplaceListingsStatus('ready')
      setMarketplaceListingsError('')
    }, () => {
      setMarketplaceListingsStatus('error')
      setMarketplaceListingsError('Marketplace listings could not be loaded. Check Firestore rules and try again.')
    })
  }, [])

  return (
    <div className="app-shell">
      <Navbar
        user={user}
        activePage={activePage}
        onNavigate={setActivePage}
        onLogin={() => setLoginOpen(true)}
        onSignOut={() => signOut(auth)}
      />
      {activeHazards.length > 0 && !hazardNoticeDismissed && (
        <aside className="hazard-notice" aria-label="Hazard alerts" role="status">
          <header className="hazard-notice-header">
            <div>
              <p className="hazard-notice-eyebrow">Community safety</p>
              <h2>{activeHazards.length === 1 ? 'Hazard reported' : `${activeHazards.length} hazards reported`}</h2>
            </div>
            <button
              className="hazard-notice-close"
              type="button"
              onClick={() => setHazardNoticeDismissed(true)}
              aria-label="Dismiss hazard alerts until next app visit"
              title="Dismiss until next app visit"
            >
              ×
            </button>
          </header>
          <ul className="hazard-notice-list">
            {activeHazards.slice(0, 3).map((hazard) => (
              <li key={hazard.id}>
                <button
                  className="hazard-notice-item"
                  type="button"
                  onClick={() => {
                    setFocusedMapLocationId(hazard.id)
                    setActivePage('map')
                  }}
                >
                  <strong>{hazard.name}</strong>
                  <span>{hazard.description || 'No additional safety information provided.'}</span>
                  <small>Coverage radius: {hazard.hazardRadius || 500}m</small>
                </button>
              </li>
            ))}
          </ul>
          {activeHazards.length > 3 && (
            <p className="hazard-notice-more">And {activeHazards.length - 3} more. Open the map for all hazards.</p>
          )}
        </aside>
      )}
      {activePage === 'updates' && (
        <Updates locations={locations} locationsStatus={locationsStatus} locationsError={locationsError} />
      )}
      {activePage === 'marketplace' && (
        <Marketplace
          user={user}
          locations={locations}
          marketplaceListings={marketplaceListings}
          locationsStatus={locationsStatus}
          marketplaceListingsStatus={marketplaceListingsStatus}
          marketplaceListingsError={marketplaceListingsError}
          onRequestLogin={() => setLoginOpen(true)}
          onShowLocation={(locationId) => {
            setFocusedMapLocationId(locationId)
            setActivePage('map')
          }}
        />
      )}
      {activePage === 'map' && (
        <Map
          key={focusedMapLocationId || 'map'}
          user={user}
          locations={locations}
          locationsStatus={locationsStatus}
          locationsError={locationsError}
          onRequestLogin={() => setLoginOpen(true)}
          focusedLocationId={focusedMapLocationId}
        />
      )}
      {user && (
        <Chat
          user={user}
          locations={locations}
          locationsStatus={locationsStatus}
          locationsError={locationsError}
          hidden={activePage !== 'chat'}
        />
      )}
      {loginOpen && <Login onClose={() => setLoginOpen(false)} />}
    </div>
  )
}

export default App
