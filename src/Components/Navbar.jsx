import logo from '../assets/Logo.svg'
import './Navbar.css'

export default function Navbar({ user, demoMode, activePage, onNavigate, onLogin, onSignOut }) {

  return (
    <header className="site-nav">
      <div className="site-nav-left">
        <button
          className="site-brand"
          type="button"
          onClick={() => onNavigate('home')}
          aria-label="GabayGo home"
          aria-current={activePage === 'home' ? 'page' : undefined}
        >
          <img className="site-brand-logo" src={logo} alt="" />
          <span className="site-brand-name">GabayGo</span>
        </button>
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
            className={`nav-map-link${activePage === 'marketplace' ? ' nav-map-link--active' : ''}`}
            type="button"
            onClick={() => onNavigate('marketplace')}
            aria-current={activePage === 'marketplace' ? 'page' : undefined}
          >
            <span className="nav-marketplace-full">Marketplace</span>
            <span className="nav-marketplace-short">Market</span>
          </button>
          <button
            className={`nav-map-link${activePage === 'chat' ? ' nav-map-link--active' : ''}`}
            type="button"
            onClick={() => onNavigate('chat')}
            aria-current={activePage === 'chat' ? 'page' : undefined}
          >
            Ask AI
          </button>
        </nav>
      </div>
      <div className="site-nav-account">
        {user && demoMode && user.isAnonymous ? (
          <span className="nav-user-name">Demo admin</span>
        ) : user ? (
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