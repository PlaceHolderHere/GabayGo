import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInAnonymously, signOut } from 'firebase/auth'
import { collection, onSnapshot } from 'firebase/firestore'
import { auth, db, demoMode } from './firebase'
import './App.css'
import Map from './Components/Map'
import Navbar from './Components/Navbar'
import Updates from './Pages/Updates'
import Marketplace from './Pages/Marketplace'
import Home from './Pages/Home'
import Login from './Pages/Login'
import Chat from './Pages/Chat'

function App() {
  const [user, setUser] = useState(null)
  const [demoAuthError, setDemoAuthError] = useState(() => (
    demoMode && !auth ? 'Firebase is not configured. Add the Firebase environment variables and restart the app.' : ''
  ))
  const [loginOpen, setLoginOpen] = useState(false)
  const [activePage, setActivePage] = useState('map')
  const [locations, setLocations] = useState([])
  const [locationsStatus, setLocationsStatus] = useState(db ? 'loading' : 'unavailable')
  const [locationsError, setLocationsError] = useState('')
  const [schedules, setSchedules] = useState([])
  const [schedulesStatus, setSchedulesStatus] = useState(db ? 'loading' : 'unavailable')
  const [schedulesError, setSchedulesError] = useState('')
  const [marketplaceListings, setMarketplaceListings] = useState([])
  const [marketplaceListingsStatus, setMarketplaceListingsStatus] = useState(db ? 'loading' : 'unavailable')
  const [marketplaceListingsError, setMarketplaceListingsError] = useState('')
  const [focusedMapLocation, setFocusedMapLocation] = useState(null)
  const [hazardNoticeDismissed, setHazardNoticeDismissed] = useState(false)
  const activeUrgentNotices = locations
    .filter((location) => ['Hazard', 'Evacuation', 'Relief'].includes(location.category))
    .sort((first, second) => {
      const firstTime = first.updatedAt?.toMillis?.() || first.createdAt?.toMillis?.() || 0
      const secondTime = second.updatedAt?.toMillis?.() || second.createdAt?.toMillis?.() || 0
      return secondTime - firstTime
    })

  useEffect(() => {
    if (!auth) return undefined

    return onAuthStateChanged(auth, (nextUser) => {
      if (!nextUser && demoMode) {
        signInAnonymously(auth).catch((signInError) => {
          setUser(null)
          if (signInError.code === 'auth/operation-not-allowed') {
            setDemoAuthError('Anonymous sign-in is disabled. Enable Authentication > Sign-in method > Anonymous in your Firebase project.')
          } else if (signInError.code === 'auth/unauthorized-domain') {
            setDemoAuthError('This domain is not authorized. Add localhost or your Netlify domain under Firebase Authentication > Settings > Authorized domains.')
          } else {
            setDemoAuthError(`Firebase anonymous sign-in failed (${signInError.code || 'unknown error'}). Check the Anonymous provider, authorized domains, and network access.`)
          }
        })
        return
      }
      setUser(nextUser)
      if (nextUser) setDemoAuthError('')
      if (!nextUser) setActivePage('map')
    }, (authError) => {
      setUser(null)
      setActivePage('map')
      if (demoMode) setDemoAuthError(`Firebase authentication failed (${authError.code || 'unknown error'}).`)
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

  useEffect(() => {
    if (!db) return undefined

    return onSnapshot(collection(db, 'Schedules'), (snapshot) => {
      setSchedules(snapshot.docs.map((scheduleDoc) => ({
        id: scheduleDoc.id,
        ...scheduleDoc.data(),
        category: 'Schedule',
      })))
      setSchedulesStatus('ready')
      setSchedulesError('')
    }, () => {
      setSchedulesStatus('error')
      setSchedulesError('Schedules could not be loaded. Check Firestore rules and try again.')
    })
  }, [])

  return (
    <div className="app-shell">
      <Navbar
        user={user}
        demoMode={demoMode}
        activePage={activePage}
        onNavigate={setActivePage}
        onLogin={() => setLoginOpen(true)}
        onSignOut={() => signOut(auth)}
      />
      {demoAuthError && (
        <aside className="demo-auth-error" role="alert">
          <strong>Demo access could not start.</strong> {demoAuthError}
        </aside>
      )}
      {activePage === 'home' && (
        <Home
          user={user}
          locations={locations}
          locationsStatus={locationsStatus}
          onNavigate={setActivePage}
          onRequestLogin={() => setLoginOpen(true)}
        />
      )}
      {activeUrgentNotices.length > 0 && !hazardNoticeDismissed && (
        <aside className="hazard-notice" aria-label="Urgent community notices" role="status">
          <header className="hazard-notice-header">
            <div>
              <p className="hazard-notice-eyebrow">Community safety</p>
              <h2>{activeUrgentNotices.length === 1
                ? `${activeUrgentNotices[0].category} notice`
                : `${activeUrgentNotices.length} urgent notices`}</h2>
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
            {activeUrgentNotices.slice(0, 3).map((notice) => (
              <li key={notice.id}>
                <button
                  className="hazard-notice-item"
                  type="button"
                  onClick={() => {
                    setFocusedMapLocation({ id: notice.id })
                    setActivePage('map')
                  }}
                >
                  <strong>{notice.category}: {notice.name}</strong>
                  <span>{notice.description || 'No additional details provided.'}</span>
                  {notice.category === 'Hazard' && <small>Coverage radius: {notice.hazardRadius || 500}m</small>}
                </button>
              </li>
            ))}
          </ul>
          {activeUrgentNotices.length > 3 && (
            <p className="hazard-notice-more">And {activeUrgentNotices.length - 3} more. Open the map for all urgent notices.</p>
          )}
        </aside>
      )}
      {activePage === 'updates' && (
        <Updates
          key={user?.uid || 'signed-out'}
          user={user}
          locations={locations}
          locationsStatus={locationsStatus}
          locationsError={locationsError}
          schedules={schedules}
          schedulesStatus={schedulesStatus}
          schedulesError={schedulesError}
        />
      )}
      {activePage === 'marketplace' && (
        <Marketplace
          user={user}
          locations={locations}
          marketplaceListings={marketplaceListings}
          locationsStatus={locationsStatus}
          marketplaceListingsStatus={marketplaceListingsStatus}
          marketplaceListingsError={marketplaceListingsError}
          demoMode={demoMode}
          onRequestLogin={() => setLoginOpen(true)}
          onShowLocation={(location) => {
            setFocusedMapLocation(location)
            setActivePage('map')
          }}
        />
      )}
      {activePage === 'map' && (
        <Map
          key={focusedMapLocation?.id || (focusedMapLocation ? `custom-${focusedMapLocation.lat}-${focusedMapLocation.lng}` : 'map')}
          user={user}
          locations={locations}
          locationsStatus={locationsStatus}
          locationsError={locationsError}
          onRequestLogin={() => setLoginOpen(true)}
          focusedMapLocation={focusedMapLocation}
          demoMode={demoMode}
        />
      )}
      <Chat
        locations={locations}
        locationsStatus={locationsStatus}
        locationsError={locationsError}
        hidden={activePage !== 'chat'}
      />
      {loginOpen && <Login onClose={() => setLoginOpen(false)} />}
    </div>
  )
}

export default App
