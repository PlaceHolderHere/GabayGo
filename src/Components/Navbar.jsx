import './Navbar.css'

export default function Navbar({ user, onLogin, onSignOut }) {
  return (
    <header className="site-nav">
      <div className="site-nav-left">
        <a className="site-brand" href="/" aria-label="GabayGo home">
          <span className="site-brand-mark" aria-hidden="true">g</span>
          <span>GabayGo</span>
        </a>
        <nav className="site-nav-links" aria-label="Main navigation">
          <a className="nav-map-link" href="#map">Map</a>
        </nav>
      </div>
      <div className="site-nav-account">
        {user ? (
          <>
            <span className="nav-user-name">{user.displayName || user.email}</span>
            <button className="nav-auth-button" onClick={onSignOut} type="button">
              Sign out
            </button>
          </>
        ) : (
          <button className="nav-auth-button" onClick={onLogin} type="button">
            Log in
          </button>
        )}
      </div>
    </header>
  )
}