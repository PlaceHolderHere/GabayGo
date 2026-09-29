import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { collection, onSnapshot } from 'firebase/firestore'
import { auth, db } from './firebase'
import './App.css'
import Map from './Components/Map'
import Navbar from './Components/Navbar'
import Updates from './Pages/Updates'
import Login from './Pages/Login'

function App() {
  const [user, setUser] = useState(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [activePage, setActivePage] = useState('map')
  const [locations, setLocations] = useState([])
  const [locationsStatus, setLocationsStatus] = useState(db ? 'loading' : 'unavailable')
  const [locationsError, setLocationsError] = useState('')

  useEffect(() => {
    if (!auth) return undefined

    return onAuthStateChanged(auth, setUser, () => setUser(null))
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
      {activePage === 'updates' ? (
        <Updates locations={locations} locationsStatus={locationsStatus} locationsError={locationsError} />
      ) : (
        <Map
          user={user}
          locations={locations}
          locationsStatus={locationsStatus}
          locationsError={locationsError}
          onRequestLogin={() => setLoginOpen(true)}
        />
      )}
      {loginOpen && <Login onClose={() => setLoginOpen(false)} />}
    </div>
  )
}

export default App
