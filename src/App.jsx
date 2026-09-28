import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './firebase'
import './App.css'
import Map from './Components/Map'
import Navbar from './Components/Navbar'
import Login from './Pages/Login'

function App() {
  const [user, setUser] = useState(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [locations, setLocations] = useState([])

  useEffect(() => {
    if (!auth) return undefined

    return onAuthStateChanged(auth, setUser, () => setUser(null))
  }, [])

  return (
    <div className="app-shell">
      <Navbar
        user={user}
        locations={locations}
        onLogin={() => setLoginOpen(true)}
        onSignOut={() => signOut(auth)}
      />
      <Map
        user={user}
        onRequestLogin={() => setLoginOpen(true)}
        onLocationsChange={setLocations}
      />
      {loginOpen && <Login onClose={() => setLoginOpen(false)} />}
    </div>
  )
}

export default App
