import { useEffect, useState } from 'react'
import { collection, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import './CommunityEngagementActions.css'

export default function CommunityEngagementActions({
  location,
  user,
  isAdmin = false,
  onRequestLogin,
  onNavigate,
}) {
  const [signup, setSignup] = useState({ key: null, status: 'loading', data: null })
  const [signups, setSignups] = useState({ key: null, status: 'loading', items: [], error: '' })
  const [actionState, setActionState] = useState({ status: 'idle', message: '' })

  const signupId = user ? `${location.id}_${user.uid}` : null
  const signupStatus = !db || !signupId
    ? 'signed-out'
    : signup.key === signupId ? signup.status : 'loading'
  const signupData = signup.key === signupId ? signup.data : null
  const adminSignups = !db || !isAdmin
    ? { status: 'idle', items: [], error: '' }
    : signups.key === location.id ? signups : { status: 'loading', items: [], error: '' }

  useEffect(() => {
    if (!db || !signupId) return undefined

    return onSnapshot(doc(db, 'CommunityEngagementSignups', signupId), (snapshot) => {
      setSignup({ key: signupId, status: 'ready', data: snapshot.exists() ? snapshot.data() : null })
    }, () => {
      setSignup({ key: signupId, status: 'error', data: null })
    })
  }, [signupId])

  useEffect(() => {
    if (!db || !isAdmin) return undefined

    return onSnapshot(
      query(collection(db, 'CommunityEngagementSignups'), where('markerId', '==', location.id)),
      (snapshot) => setSignups({
        key: location.id,
        status: 'ready',
        items: snapshot.docs.map((signupDoc) => ({ id: signupDoc.id, ...signupDoc.data() })),
        error: '',
      }),
      () => setSignups({
        key: location.id,
        status: 'error',
        items: [],
        error: 'Volunteer signups could not be loaded. Check your admin access and Firestore rules.',
      }),
    )
  }, [isAdmin, location.id])

  const handleVolunteer = async () => {
    if (!user) {
      onRequestLogin?.()
      return
    }
    if (!db || signupStatus === 'error' || actionState.status === 'saving') return

    setActionState({ status: 'saving', message: '' })
    try {
      const volunteerSnapshot = await getDoc(doc(db, 'VolunteerSignups', user.uid))
      if (!volunteerSnapshot.exists()) {
        setActionState({
          status: 'profile-needed',
          message: 'Complete your volunteer contact information and choose volunteer methods on your Profile first.',
        })
        return
      }

      const volunteer = volunteerSnapshot.data()
      if (!volunteer.contact?.trim() || !Array.isArray(volunteer.methods) || volunteer.methods.length === 0) {
        setActionState({
          status: 'profile-needed',
          message: 'Add your contact information and select at least one volunteer method on your Profile first.',
        })
        return
      }

      await setDoc(doc(db, 'CommunityEngagementSignups', signupId), {
        markerId: location.id,
        markerName: location.name,
        userId: user.uid,
        name: volunteer.name,
        contact: volunteer.contact,
        methods: volunteer.methods,
        notes: volunteer.notes || '',
        createdAt: serverTimestamp(),
      })
      setActionState({ status: 'idle', message: 'You are signed up to volunteer for this activity.' })
    } catch {
      setActionState({
        status: 'error',
        message: 'Your volunteer signup could not be saved. Check your volunteer profile and Firestore rules.',
      })
    }
  }

  const handleCancelSignup = async () => {
    if (!db || !signupId || actionState.status === 'saving') return
    setActionState({ status: 'saving', message: '' })
    try {
      await deleteDoc(doc(db, 'CommunityEngagementSignups', signupId))
      setActionState({ status: 'idle', message: 'Your volunteer signup was cancelled.' })
    } catch {
      setActionState({ status: 'error', message: 'Your volunteer signup could not be cancelled. Try again.' })
    }
  }

  return (
    <section className="community-engagement-actions" aria-label="Volunteer for this activity">
      <h3>Volunteer for this activity</h3>
      {signupData ? (
        <>
          <p>You are signed up using the volunteer details on your profile.</p>
          <button type="button" onClick={handleCancelSignup} disabled={actionState.status === 'saving'}>
            {actionState.status === 'saving' ? 'Updating…' : 'Cancel signup'}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={handleVolunteer}
          disabled={signupStatus === 'loading' || signupStatus === 'error' || actionState.status === 'saving'}
        >
          {actionState.status === 'saving' ? 'Signing up…' : user ? 'Volunteer' : 'Log in to volunteer'}
        </button>
      )}
      {actionState.message && (
        <p className="community-engagement-message" role={actionState.status === 'error' ? 'alert' : 'status'}>
          {actionState.message}
        </p>
      )}
      {actionState.status === 'profile-needed' && (
        <button type="button" className="community-engagement-profile-link" onClick={() => onNavigate?.('profile')}>
          Go to Profile
        </button>
      )}
      {signupStatus === 'error' && <p className="community-engagement-message" role="alert">Your signup status could not be checked.</p>}

      {isAdmin && (
        <div className="community-engagement-admin-signups">
          <h4>Volunteer signups {adminSignups.status === 'ready' ? `(${adminSignups.items.length})` : ''}</h4>
          {adminSignups.status === 'loading' && <p>Loading signups…</p>}
          {adminSignups.error && <p role="alert">{adminSignups.error}</p>}
          {adminSignups.status === 'ready' && adminSignups.items.length === 0 && <p>No one has signed up yet.</p>}
          {adminSignups.items.map((item) => (
            <article className="community-engagement-signup" key={item.id}>
              <strong>{item.name}</strong>
              <span>{item.contact}</span>
              <span>{item.methods.join(', ')}</span>
              {item.notes && <span>{item.notes}</span>}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
