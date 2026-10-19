import { Home, Map, Bell, Calendar as CalendarIcon, Store, Bot, LogOut, User, ShieldCheck } from 'lucide-react'
import logo from '../assets/Logo.svg'
import './Sidebar.css'
import { LocalizedContent } from '../i18n'

export default function Sidebar({ user, demoMode, activePage, onNavigate, onLogin, onSignOut }) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'map', label: 'Map', icon: Map },
    { id: 'updates', label: 'Updates', icon: Bell },
    { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
    { id: 'marketplace', label: 'Marketplace', icon: Store },
    { id: 'chat', label: 'Ask AI', icon: Bot },
  ]

  const userDisplayName = user?.displayName || user?.email || (user?.isAnonymous && demoMode ? 'Demo admin' : 'User')

  return (
    <LocalizedContent>
    <aside className="site-sidebar" aria-label="Main sidebar navigation">
      <div className="sidebar-top">
        <button
          className="sidebar-brand-btn"
          type="button"
          onClick={() => onNavigate('home')}
          aria-label="GabayGo home"
        >
          <img className="sidebar-brand-logo" src={logo} alt="GabayGo" />
        </button>
      </div>

      <nav className="sidebar-nav-list" aria-label="Main navigation">
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = activePage === id
          return (
            <button
              key={id}
              className={`sidebar-nav-item${isActive ? ' sidebar-nav-item--active' : ''}`}
              type="button"
              onClick={() => onNavigate(id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={label}
            >
              <span className="sidebar-active-indicator" aria-hidden="true" />
              <Icon className="sidebar-icon" size={22} strokeWidth={isActive ? 2.3 : 1.9} />
              <span className="sidebar-tooltip" role="tooltip">{label}</span>
            </button>
          )
        })}
      </nav>

      <div className="sidebar-bottom">
        <button
          className={`sidebar-nav-item sidebar-user-badge${activePage === 'profile' ? ' sidebar-nav-item--active' : ''}`}
          type="button"
          onClick={() => {
            onNavigate('profile')
            if (!user) onLogin()
          }}
          aria-label={user ? `Profile for ${userDisplayName}` : 'Log in to view your profile'}
          aria-current={activePage === 'profile' ? 'page' : undefined}
        >
          {user?.isAnonymous && demoMode ? (
            <ShieldCheck size={20} className="sidebar-icon sidebar-icon--demo" />
          ) : (
            <User size={20} className="sidebar-icon" />
          )}
          <span className="sidebar-tooltip" role="tooltip">{user ? 'Profile' : 'Profile · Log in'}</span>
        </button>
        {user && (
          <button
            className="sidebar-nav-item sidebar-auth-btn"
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
          >
            <LogOut size={20} className="sidebar-icon" />
            <span className="sidebar-tooltip" role="tooltip">Sign out</span>
          </button>
        )}
      </div>
    </aside>
    </LocalizedContent>
  )
}
