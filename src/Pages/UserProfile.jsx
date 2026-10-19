import { useCallback, useEffect, useRef, useState } from 'react'
import { doc, onSnapshot, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import CommunityParticipationForms from '../Components/CommunityParticipationForms'
import MyCommunityEngagementSignups from '../Components/MyCommunityEngagementSignups'
import './UserProfile.css'
import { isSupportedLanguage } from '../language'
import { LocalizedContent, PreservedContent } from '../i18n'

const languages = [
  { value: 'english', label: 'English' },
  { value: 'filipino', label: 'Filipino' },
  { value: 'bisaya', label: 'Cebuano (Bisaya)' },
]

const defaultProfile = {
  status: 'loading',
  exists: false,
  isAdmin: false,
  updateTopics: [],
  language: 'english',
}

export default function UserProfile({ user, demoMode, language, onLanguageChange, onRequestLogin }) {
  const userId = user?.uid
  const isAnonymous = user?.isAnonymous
  const [profile, setProfile] = useState(() => ({
    ...defaultProfile,
    language,
    status: !db ? 'unavailable' : user ? 'loading' : 'signed-out',
  }))
  const [adminState, setAdminState] = useState(() => ({
    uid: user?.uid || null,
    status: !db ? 'unavailable' : !user ? 'signed-out' : demoMode && user.isAnonymous ? 'admin' : 'checking',
  }))
  const [profileError, setProfileError] = useState('')
  const [saveStatus, setSaveStatus] = useState('ready')
  const [languageSaveStatus, setLanguageSaveStatus] = useState('idle')
  const initializationAttempted = useRef(false)

  useEffect(() => {
    if (!db || !userId) return undefined

    let hasProfile = false
    const unsubscribeProfile = onSnapshot(doc(db, 'UserProfiles', userId), (snapshot) => {
      hasProfile = snapshot.exists()
      const data = snapshot.data()
      setProfile((current) => ({
        ...current,
        status: 'ready',
        exists: snapshot.exists(),
        isAdmin: data?.isAdmin === true,
        updateTopics: Array.isArray(data?.updateTopics) ? data.updateTopics : [],
        language: isSupportedLanguage(data?.language) ? data.language : current.language,
      }))
      if (snapshot.exists() && isSupportedLanguage(data?.language)) onLanguageChange(data.language)
      setProfileError('')
    }, () => {
      setProfile((current) => ({ ...current, status: 'error' }))
      setProfileError('Your profile could not be loaded. Check Firestore rules and try again.')
    })

    const unsubscribeLegacyPreferences = onSnapshot(doc(db, 'UpdatePreferences', userId), (snapshot) => {
      if (!hasProfile && snapshot.exists()) {
        const topics = snapshot.data().topics
        setProfile((current) => ({ ...current, updateTopics: Array.isArray(topics) ? topics : [] }))
      }
    }, () => {
      setProfileError('Saved update preferences could not be loaded. They will be kept unchanged until you save new preferences.')
    })

    let unsubscribeAdmin = () => {}
    if (!(demoMode && isAnonymous)) {
      unsubscribeAdmin = onSnapshot(doc(db, 'admin', userId), (snapshot) => {
        setAdminState({
          uid: userId,
          status: snapshot.exists() && snapshot.data().enabled === true ? 'admin' : 'not-admin',
        })
      }, () => {
        setAdminState({ uid: userId, status: 'error' })
      })
    }

    return () => {
      unsubscribeProfile()
      unsubscribeLegacyPreferences()
      unsubscribeAdmin()
    }
  }, [userId, demoMode, isAnonymous, onLanguageChange])

  const isAdmin = (demoMode && isAnonymous === true)
    || (adminState.uid === userId && adminState.status === 'admin')
  const roleStatus = !db
    ? 'unavailable'
    : !userId
      ? 'signed-out'
    : adminState.uid === userId ? adminState.status : 'checking'

  useEffect(() => {
    if (!db || !userId || profile.status !== 'ready' || profile.exists
      || !['admin', 'not-admin'].includes(roleStatus) || initializationAttempted.current) return

    initializationAttempted.current = true
    runTransaction(db, async (transaction) => {
      const profileRef = doc(db, 'UserProfiles', userId)
      const existingProfile = await transaction.get(profileRef)
      if (existingProfile.exists()) return

      const legacyPreferences = await transaction.get(doc(db, 'UpdatePreferences', userId))
      const legacyTopics = legacyPreferences.exists() ? legacyPreferences.data().topics : []
      transaction.set(profileRef, {
        userId,
        isAdmin,
        updateTopics: Array.isArray(legacyTopics) ? legacyTopics : [],
        language,
        updatedAt: serverTimestamp(),
      })
    }).catch(() => {
      setProfileError('Your profile record could not be initialized. Check Firestore rules and try again.')
    })
  }, [userId, profile.status, profile.exists, language, roleStatus, isAdmin])

  useEffect(() => {
    if (!db || !userId || profile.status !== 'ready' || !profile.exists
      || !['admin', 'not-admin'].includes(roleStatus) || profile.isAdmin === isAdmin) return

    runTransaction(db, async (transaction) => {
      const profileRef = doc(db, 'UserProfiles', userId)
      const existingProfile = await transaction.get(profileRef)
      if (!existingProfile.exists() || existingProfile.data().isAdmin === isAdmin) return
      transaction.update(profileRef, {
        isAdmin,
        updatedAt: serverTimestamp(),
      })
    }).catch(() => {
      setProfileError('The admin status saved in your profile could not be refreshed.')
    })
  }, [userId, profile.status, profile.exists, profile.isAdmin, roleStatus, isAdmin])

  const saveProfile = useCallback(async (updates) => {
    if (!db || !user || profile.status !== 'ready' || !['admin', 'not-admin'].includes(roleStatus)) {
      throw new Error('Profile settings are not ready to save.')
    }
    if (saveStatus === 'saving') throw new Error('A profile update is already being saved.')

    setSaveStatus('saving')
    try {
      await setDoc(doc(db, 'UserProfiles', user.uid), {
        userId: user.uid,
        isAdmin,
        updateTopics: updates.updateTopics ?? profile.updateTopics,
        language: updates.language ?? language,
        updatedAt: serverTimestamp(),
      }, { merge: true })
      setSaveStatus('ready')
      setProfileError('')
    } catch (error) {
      setSaveStatus('error')
      throw error
    }
  }, [user, profile.status, profile.updateTopics, roleStatus, saveStatus, isAdmin, language])

  useEffect(() => {
    if (languageSaveStatus !== 'pending' || language === profile.language
      || profile.status !== 'ready' || !['admin', 'not-admin'].includes(roleStatus)
      || saveStatus === 'saving') return undefined

    const timeoutId = setTimeout(async () => {
      setLanguageSaveStatus('saving')
      try {
        await saveProfile({ language })
        setLanguageSaveStatus('saved')
      } catch {
        setLanguageSaveStatus('error')
      }
    }, 3000)

    return () => clearTimeout(timeoutId)
  }, [languageSaveStatus, language, profile.language, profile.status, roleStatus, saveStatus, saveProfile])

  if (!user) {
    return (
      <LocalizedContent>
      <main className="user-profile-page">
        <section className="user-profile-card user-profile-signed-out">
          <p className="user-profile-eyebrow">Your account</p>
          <h1>Your profile</h1>
          <p>Sign in to set your language and community participation preferences.</p>
          <button type="button" onClick={onRequestLogin}>Log in</button>
        </section>
      </main>
      </LocalizedContent>
    )
  }

  return (
    <LocalizedContent>
    <main className="user-profile-page">
      <div className="user-profile-content">
        <header className="user-profile-heading">
          <p className="user-profile-eyebrow">Your account</p>
          <h1>Your profile</h1>
          <p>Manage your community interests and app preferences.</p>
        </header>

        <section className="user-profile-card" aria-labelledby="user-profile-account-title">
          <div className="user-profile-account">
            <div className="user-profile-avatar" aria-hidden="true">
              {(user.displayName || user.email || 'U').charAt(0).toLocaleUpperCase()}
            </div>
            <div>
              <h2 id="user-profile-account-title">
                {user.displayName ? <PreservedContent>{user.displayName}</PreservedContent> : 'Community member'}
              </h2>
              {user.email && <p><PreservedContent>{user.email}</PreservedContent></p>}
            </div>
            <span className={`user-profile-role${isAdmin ? ' user-profile-role--admin' : ''}`} role="status">
              {roleStatus === 'checking' ? 'Checking role…' : roleStatus === 'error' ? 'Role unavailable' : isAdmin ? 'Admin' : 'Community member'}
            </span>
          </div>

          <section className="user-profile-language" aria-labelledby="user-profile-language-title">
            <div className="user-profile-language-control">
              <div className="user-profile-language-field">
                <label htmlFor="user-profile-language">Preferred language</label>
                <select
                  id="user-profile-language"
                  value={language}
                  onChange={(event) => {
                    const selectedLanguage = event.target.value
                    onLanguageChange(selectedLanguage)
                    setLanguageSaveStatus(selectedLanguage === profile.language ? 'idle' : 'pending')
                    setProfileError('')
                  }}
                  disabled={profile.status !== 'ready' || !['admin', 'not-admin'].includes(roleStatus) || saveStatus === 'saving'}
                >
                  {languages.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>
          {profileError && <p className="user-profile-feedback" role="alert">{profileError}</p>}
          {profile.status === 'loading' && <p className="user-profile-feedback" role="status">Loading your profile…</p>}
          {profile.status === 'error' && <p className="user-profile-feedback" role="alert">Profile settings are unavailable.</p>}
          {profile.status === 'unavailable' && <p className="user-profile-feedback" role="alert">Firestore is not configured. Profile settings cannot be saved.</p>}
          {roleStatus === 'error' && <p className="user-profile-feedback" role="alert">Your admin role could not be verified. Profile changes are disabled.</p>}
          {saveStatus === 'error' && languageSaveStatus !== 'error' && <p className="user-profile-feedback" role="alert">The profile could not be saved.</p>}
        </section>

        {profile.status === 'ready' && (
          <CommunityParticipationForms
            user={user}
            onRequestLogin={onRequestLogin}
            selectedUpdateTopics={profile.updateTopics}
            onUpdateTopicsChange={(updateTopics) => setProfile((current) => ({ ...current, updateTopics }))}
            onSavePreferences={() => saveProfile({ updateTopics: profile.updateTopics })}
            profileStatus={profile.status !== 'ready'
              ? profile.status
              : ['admin', 'not-admin'].includes(roleStatus) ? 'ready' : roleStatus}
            isSavingProfile={saveStatus === 'saving'}
          />
        )}
        {profile.status === 'ready' && <MyCommunityEngagementSignups user={user} />}
      </div>
    </main>
    </LocalizedContent>
  )
}
