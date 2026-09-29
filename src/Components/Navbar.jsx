import logo from '../assets/Logo.svg'
import './Navbar.css'

export default function Navbar({ user, activePage, onNavigate, onLogin, onSignOut }) {

  return (
    <header className="site-nav">
      <div className="site-nav-left">
        <a className="site-brand" href="/" aria-label="GabayGo home">
          <img className="site-brand-logo" src={logo} alt="GabayGo" />
        </a>
        <nav className="site-nav-links" aria-label="Main navigation">
          <button
            className={`nav-map-link${activePage === 'map' ? ' nav-map-link--active' : ''}`}
            type="button"
            onClick={() => onNavigate('map')}
            aria-current={activePage === 'map' ? 'page' : undefined}
          >
            Map
          </button>
          <button
            className={`nav-map-link${activePage === 'updates' ? ' nav-map-link--active' : ''}`}
            type="button"
            onClick={() => onNavigate('updates')}
            aria-current={activePage === 'updates' ? 'page' : undefined}
          >
            Updates
          </button>
          <button
            className={`nav-map-link${activePage === 'chat' ? ' nav-map-link--active' : ''}`}
            type="button"
            onClick={() => user ? onNavigate('chat') : onLogin()}
            aria-current={user && activePage === 'chat' ? 'page' : undefined}
          >
            Ask AI
          </button>
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