import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInAnonymously, signOut } from 'firebase/auth'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { auth, db, demoMode } from './firebase'
import './App.css'
import MapPage from './Components/Map'
import Sidebar from './Components/Sidebar'
import Updates from './Pages/Updates'
import Calendar from './Pages/Calendar'
import Marketplace from './Pages/Marketplace'
import Home from './Pages/Home'
import Login from './Pages/Login'
import UserProfile from './Pages/UserProfile'
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
  const [locationsLoadState, setLocationsLoadState] = useState({
    key: null,
    status: db ? 'loading' : 'unavailable',
    error: '',
  })
  const [adminCheck, setAdminCheck] = useState({ uid: null, status: 'checking' })
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
    if (!db || !user?.uid || (demoMode && user.isAnonymous)) return undefined

    return onSnapshot(doc(db, 'admin', user.uid), (adminDoc) => {
      setAdminCheck({
        uid: user.uid,
        status: adminDoc.exists() && adminDoc.data().enabled === true ? 'admin' : 'not-admin',
      })
    }, () => {
      setAdminCheck({ uid: user.uid, status: 'error' })
    })
  }, [user?.uid, user?.isAnonymous])

  const isDemoAdmin = demoMode && user?.isAnonymous === true
  const isAdmin = isDemoAdmin || (adminCheck.uid === user?.uid && adminCheck.status === 'admin')
  const locationsSourceKey = `${user?.uid ?? 'signed-out'}:${isAdmin ? 'admin' : 'member'}`
  const hasCurrentLocationsLoad = locationsLoadState.key === locationsSourceKey
  const locationsStatus = hasCurrentLocationsLoad
    ? locationsLoadState.status
    : db ? 'loading' : 'unavailable'
  const locationsError = hasCurrentLocationsLoad ? locationsLoadState.error : ''

  useEffect(() => {
    if (!db) return undefined

    const sourceData = new Map()
    const receivedSources = new Set()
    const failedSources = new Set()
    const sources = [
      {
        id: 'locations',
        query: query(collection(db, 'Locations'), where('category', '!=', 'Community engagement')),
      },
      {
        id: 'approved-engagement',
        query: query(
          collection(db, 'Locations'),
          where('category', '==', 'Community engagement'),
          where('engagementStatus', '==', 'approved'),
        ),
      },
    ]

    if (user?.uid) {
      sources.push({
        id: 'own-engagement',
        query: query(
          collection(db, 'Locations'),
          where('category', '==', 'Community engagement'),
          where('createdBy', '==', user.uid),
        ),
      })
    }
    if (isAdmin) {
      sources.push({
        id: 'all-engagement',
        query: query(collection(db, 'Locations'), where('category', '==', 'Community engagement')),
      })
    }

    const unsubscribes = sources.map(({ id, query: locationsQuery }) => onSnapshot(locationsQuery, (snapshot) => {
      sourceData.set(id, snapshot.docs.map((locationDoc) => ({ id: locationDoc.id, ...locationDoc.data() })))
      receivedSources.add(id)
      const combinedLocations = new Map()
      sourceData.forEach((items) => items.forEach((location) => {
        if (Number.isFinite(location.lat) && Number.isFinite(location.lng)) {
          combinedLocations.set(location.id, location)
        }
      }))
      setLocations([...combinedLocations.values()])
      if (receivedSources.size === sources.length) {
        setLocationsLoadState({
          key: locationsSourceKey,
          status: failedSources.size > 0 ? 'error' : 'ready',
          error: failedSources.size > 0
            ? 'Locations could not be loaded. Check the Firestore database and its read rules.'
            : '',
        })
      }
    }, () => {
      failedSources.add(id)
      receivedSources.add(id)
      if (receivedSources.size === sources.length) {
        setLocationsLoadState({
          key: locationsSourceKey,
          status: 'error',
          error: 'Locations could not be loaded. Check the Firestore database and its read rules.',
        })
      }
    }))

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
  }, [user?.uid, isAdmin, locationsSourceKey])

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

  const publicLocations = locations.filter((location) => (
    location.category !== 'Community engagement' || location.engagementStatus === 'approved'
  ))

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
          locations={publicLocations}
          locationsStatus={locationsStatus}
          onNavigate={setActivePage}
          onRequestLogin={() => setLoginOpen(true)}
        />
      )}
      {activePage === 'profile' && (
        <UserProfile
          key={user?.uid || 'signed-out'}
          user={user}
          demoMode={demoMode}
          onRequestLogin={() => setLoginOpen(true)}
        />
      )}
      {activePage === 'updates' && (
        <Updates
          key={user?.uid || 'signed-out'}
          user={user}
          locations={publicLocations}
          locationsStatus={locationsStatus}
          locationsError={locationsError}
          schedules={schedules}
          schedulesStatus={schedulesStatus}
          schedulesError={schedulesError}
          onNavigate={setActivePage}
          onRequestLogin={() => setLoginOpen(true)}
        />
      )}
      {activePage === 'calendar' && (
        <Calendar
          key={user?.uid || 'signed-out'}
          user={user}
          locations={publicLocations}
          locationsStatus={locationsStatus}
          locationsError={locationsError}
          schedules={schedules}
          schedulesStatus={schedulesStatus}
          schedulesError={schedulesError}
          onNavigate={setActivePage}
          onRequestLogin={() => setLoginOpen(true)}
        />
      )}
      {activePage === 'marketplace' && (
        <Marketplace
          user={user}
          locations={publicLocations}
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
        <MapPage
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
        locations={publicLocations}
        locationsStatus={locationsStatus}
        locationsError={locationsError}
        hidden={activePage !== 'chat'}
      />
      </main>
      <UrgentNotifications
        locations={publicLocations}
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
