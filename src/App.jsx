import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { collection, onSnapshot } from 'firebase/firestore'
import { auth, db } from './firebase'
import './App.css'
import Map from './Components/Map'
import Navbar from './Components/Navbar'
import Updates from './Pages/Updates'
import Login from './Pages/Login'
import Chat from './Pages/Chat'

function App() {
  const [user, setUser] = useState(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [activePage, setActivePage] = useState('map')
  const [locations, setLocations] = useState([])
  const [locationsStatus, setLocationsStatus] = useState(db ? 'loading' : 'unavailable')
  const [locationsError, setLocationsError] = useState('')

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

  return (
    <div className="app-shell">
      <Navbar
        user={user}
        activePage={activePage}
        onNavigate={setActivePage}
        onLogin={() => setLoginOpen(true)}
        onSignOut={() => signOut(auth)}
      />
      {activePage === 'updates' && (
        <Updates locations={locations} locationsStatus={locationsStatus} locationsError={locationsError} />
      )}
      {activePage === 'map' && (
        <Map
          user={user}
          locations={locations}
          locationsStatus={locationsStatus}
          locationsError={locationsError}
          onRequestLogin={() => setLoginOpen(true)}
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
