import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInAnonymously, signOut } from 'firebase/auth'
import { collection, onSnapshot } from 'firebase/firestore'
import { auth, db, demoMode } from './firebase'
import './App.css'
import Map from './Components/Map'
import Sidebar from './Components/Sidebar'
import Updates from './Pages/Updates'
import Calendar from './Pages/Calendar'
import Marketplace from './Pages/Marketplace'
import Home from './Pages/Home'
import Login from './Pages/Login'
import Chat from './Pages/Chat'
import UrgentNotifications from './Components/UrgentNotifications'
import { listenForForegroundMessages } from './notifications'

function App() {
  const [user, setUser] = useState(null)
  const [demoAuthError, setDemoAuthError] = useState(() => (
    demoMode && !auth ? 'Firebase is not configured. Add the Firebase environment variables and restart the app.' : ''
  ))
  const [loginOpen, setLoginOpen] = useState(false)
  const [activePage, setActivePage] = useState('home')
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
    let active = true
    let unsubscribe = () => {}
    listenForForegroundMessages().then((stopListening) => {
      if (active) unsubscribe = stopListening
      else stopListening()
    }).catch(() => {})
    return () => {
      active = false
      unsubscribe()
    }
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
      <Sidebar
        user={user}
        demoMode={demoMode}
        activePage={activePage}
        onNavigate={setActivePage}
        onLogin={() => setLoginOpen(true)}
        onSignOut={() => signOut(auth)}
      />
      <main className="app-main">
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
      {activePage === 'calendar' && (
        <Calendar
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
          onNavigate={setActivePage}
        />
      )}
      <Chat
        locations={locations}
        locationsStatus={locationsStatus}
        locationsError={locationsError}
        hidden={activePage !== 'chat'}
      />
      </main>
      <UrgentNotifications
        locations={locations}
        locationsStatus={locationsStatus}
        locationsError={locationsError}
        onNavigate={setActivePage}
        onSelectLocation={(location) => {
          setFocusedMapLocation(location)
          setActivePage('map')
        }}
      />
      {loginOpen && <Login onClose={() => setLoginOpen(false)} />}
    </div>
  )
}

export default App
