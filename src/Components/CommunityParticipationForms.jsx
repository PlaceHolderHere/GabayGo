import { useEffect, useState } from 'react'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { disablePushNotifications, enablePushNotifications, getPushStatus } from '../notifications'
import './CommunityParticipationForms.css'

const updateTopics = ['Garbage collection', 'Outages', 'Services', 'Marketplace', 'Garden activities', 'Events', 'Schedules', 'Evacuation and relief', 'Community reports']
const volunteerOptions = ['Garbage collection and cleanups', 'Emergency response and evacuation', 'Relief distribution', 'Community services', 'Garden activities', 'Events and schedules', 'Other']

export default function CommunityParticipationForms({ user, onRequestLogin }) {
  const [selectedUpdateTopics, setSelectedUpdateTopics] = useState([])
  const [preferencesStatus, setPreferencesStatus] = useState(user && db ? 'loading' : 'idle')
  const [preferencesFeedback, setPreferencesFeedback] = useState('')
  const [volunteerForm, setVolunteerForm] = useState({ name: user?.displayName || '', contact: '', methods: [], notes: '', createdAt: null })
  const [volunteerStatus, setVolunteerStatus] = useState(user && db ? 'loading' : 'idle')
  const [volunteerFeedback, setVolunteerFeedback] = useState('')
  const [pushStatus, setPushStatus] = useState({ state: 'loading', message: '' })
  const [pushBusy, setPushBusy] = useState(false)

  useEffect(() => {
    let active = true
    getPushStatus(user?.uid ? { uid: user.uid } : null).then((status) => {
      if (active) setPushStatus(status)
    }).catch(() => {
      if (active) setPushStatus({ state: 'unsupported', message: 'Notification status could not be checked in this browser.' })
    })
    return () => { active = false }
  }, [user?.uid])

  useEffect(() => {
    if (!db || !user?.uid) return undefined

    const preferencesUnsubscribe = onSnapshot(doc(db, 'UpdatePreferences', user.uid), (snapshot) => {
      setSelectedUpdateTopics(snapshot.exists() ? snapshot.data().topics || [] : [])
      setPreferencesStatus('ready')
    }, () => {
      setPreferencesStatus('error')
      setPreferencesFeedback('Update preferences could not be loaded.')
    })
    const volunteerUnsubscribe = onSnapshot(doc(db, 'VolunteerSignups', user.uid), (snapshot) => {
      const signup = snapshot.exists() ? snapshot.data() : null
      setVolunteerForm({
        name: signup?.name || user.displayName || '',
        contact: signup?.contact || '',
        methods: signup?.methods || [],
        notes: signup?.notes || '',
        createdAt: signup?.createdAt || null,
      })
      setVolunteerStatus('ready')
    }, () => {
      setVolunteerStatus('error')
      setVolunteerFeedback('Volunteer information could not be loaded.')
    })

    return () => {
      preferencesUnsubscribe()
      volunteerUnsubscribe()
    }
  }, [user?.displayName, user?.uid])

  const handleSavePreferences = async (event) => {
    event.preventDefault()
    if (!db || !user || preferencesStatus === 'saving') return

    setPreferencesStatus('saving')
    setPreferencesFeedback('')
    try {
      await setDoc(doc(db, 'UpdatePreferences', user.uid), {
        userId: user.uid,
        topics: selectedUpdateTopics,
        updatedAt: serverTimestamp(),
      })
      setPreferencesStatus('ready')
      setPreferencesFeedback('Your update preferences are saved.')
    } catch {
      setPreferencesStatus('ready')
      setPreferencesFeedback('Preferences could not be saved. Check Firestore rules and try again.')
    }
  }

  const handleSaveVolunteerForm = async (event) => {
    event.preventDefault()
    if (!db || !user || volunteerStatus === 'saving' || volunteerForm.methods.length === 0) return

    setVolunteerStatus('saving')
    setVolunteerFeedback('')
    try {
      await setDoc(doc(db, 'VolunteerSignups', user.uid), {
        userId: user.uid,
        name: volunteerForm.name.trim(),
        contact: volunteerForm.contact.trim(),
        methods: volunteerForm.methods,
        notes: volunteerForm.notes.trim(),
        createdAt: volunteerForm.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true })
      setVolunteerStatus('ready')
      setVolunteerFeedback('Your volunteer information is saved.')
    } catch {
      setVolunteerStatus('ready')
      setVolunteerFeedback('Volunteer information could not be saved. Check Firestore rules and try again.')
    }
  }

  const handlePushToggle = async () => {
    if (!user || pushBusy) return
    setPushBusy(true)
    try {
      const status = pushStatus.state === 'enabled'
        ? await disablePushNotifications(user)
        : await enablePushNotifications(user)
      setPushStatus(status)
    } catch (error) {
      setPushStatus((current) => ({ ...current, message: error.message || 'Notification settings could not be updated.' }))
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <section className="updates-community-forms" aria-labelledby="updates-community-title">
      <header className="updates-community-header">
        <div>
          <p className="updates-eyebrow">Community participation</p>
          <h2 id="updates-community-title">Stay informed and get involved</h2>
        </div>
      </header>
      <div className="updates-community-grid">
        <form className="updates-community-form" onSubmit={handleSavePreferences}>
          <h3>Updates that matter to you</h3>
          <p>Select the topics you want to follow.</p>
          <fieldset disabled={!user || !db || preferencesStatus === 'saving' || preferencesStatus === 'loading'}>
            <legend>Update topics</legend>
            {updateTopics.map((topic) => (
              <label key={topic}>
                <input
                  type="checkbox"
                  checked={selectedUpdateTopics.includes(topic)}
                  onChange={(event) => setSelectedUpdateTopics((selected) => event.target.checked
                    ? [...selected, topic]
                    : selected.filter((item) => item !== topic))}
                />
                <span>{topic}</span>
              </label>
            ))}
          </fieldset>
          {!user && <p className="updates-form-note">Sign in to save your update preferences.</p>}
          {!user && <button className="updates-form-login" type="button" onClick={onRequestLogin}>Log in</button>}
          {preferencesFeedback && <p className="updates-form-feedback" role={preferencesStatus === 'error' ? 'alert' : 'status'}>{preferencesFeedback}</p>}
          <button className="updates-form-submit" type="submit" disabled={!user || !db || preferencesStatus === 'saving' || preferencesStatus === 'loading'}>
            {preferencesStatus === 'saving' ? 'Saving…' : 'Save update preferences'}
          </button>
          <div className="updates-push-settings">
            <h3>Event reminders</h3>
            <p>{pushStatus.message || 'Checking notification support…'}</p>
            {pushStatus.state === 'signed-out' && <button className="updates-form-login" type="button" onClick={onRequestLogin}>Log in</button>}
            {['ready', 'enabled'].includes(pushStatus.state) && (
              <button className="updates-form-submit" type="button" onClick={handlePushToggle} disabled={pushBusy}>
                {pushBusy ? 'Updating…' : pushStatus.state === 'enabled' ? 'Turn off reminders' : 'Turn on reminders'}
              </button>
            )}
          </div>
        </form>

        <form className="updates-community-form" onSubmit={handleSaveVolunteerForm}>
          <h3>Volunteer with the community</h3>
          <p>Your contact details are shared only with authorized community admins.</p>
          <label>
            Name
            <input
              type="text"
              maxLength="120"
              required
              value={volunteerForm.name}
              onChange={(event) => setVolunteerForm((current) => ({ ...current, name: event.target.value }))}
              disabled={!user || !db || volunteerStatus === 'saving' || volunteerStatus === 'loading'}
            />
          </label>
          <label>
            Contact information
            <input
              type="text"
              maxLength="300"
              required
              placeholder="Phone number or email"
              value={volunteerForm.contact}
              onChange={(event) => setVolunteerForm((current) => ({ ...current, contact: event.target.value }))}
              disabled={!user || !db || volunteerStatus === 'saving' || volunteerStatus === 'loading'}
            />
          </label>
          <fieldset disabled={!user || !db || volunteerStatus === 'saving' || volunteerStatus === 'loading'}>
            <legend>How would you like to help?</legend>
            {volunteerOptions.map((method) => (
              <label key={method}>
                <input
                  type="checkbox"
                  checked={volunteerForm.methods.includes(method)}
                  onChange={(event) => setVolunteerForm((current) => ({
                    ...current,
                    methods: event.target.checked
                      ? [...current.methods, method]
                      : current.methods.filter((item) => item !== method),
                  }))}
                />
                <span>{method}</span>
              </label>
            ))}
          </fieldset>
          <label>
            Availability or notes
            <textarea
              rows="3"
              maxLength="1000"
              value={volunteerForm.notes}
              onChange={(event) => setVolunteerForm((current) => ({ ...current, notes: event.target.value }))}
              disabled={!user || !db || volunteerStatus === 'saving' || volunteerStatus === 'loading'}
            />
          </label>
          {!user && <p className="updates-form-note">Sign in to share your volunteer details.</p>}
          {!user && <button className="updates-form-login" type="button" onClick={onRequestLogin}>Log in</button>}
          {volunteerFeedback && <p className="updates-form-feedback" role={volunteerStatus === 'error' ? 'alert' : 'status'}>{volunteerFeedback}</p>}
          <button className="updates-form-submit" type="submit" disabled={!user || !db || volunteerStatus === 'saving' || volunteerStatus === 'loading' || volunteerForm.methods.length === 0}>
            {volunteerStatus === 'saving' ? 'Saving…' : 'Save volunteer information'}
          </button>
        </form>
      </div>
    </section>
  )
}
