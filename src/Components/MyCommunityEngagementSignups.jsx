import { useEffect, useState } from 'react'
import { collection, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import './CommunityEngagementActions.css'
import { LocalizedContent, PreservedContent } from '../i18n'

export default function MyCommunityEngagementSignups({ user }) {
  const [signups, setSignups] = useState({ userId: null, status: 'loading', items: [], error: '' })
  const [cancellingId, setCancellingId] = useState(null)
  const currentSignups = !db || !user?.uid
    ? { status: 'unavailable', items: [], error: '' }
    : signups.userId === user.uid ? signups : { status: 'loading', items: [], error: '' }

  useEffect(() => {
    if (!db || !user?.uid) return undefined

    return onSnapshot(
      query(collection(db, 'CommunityEngagementSignups'), where('userId', '==', user.uid)),
      (snapshot) => setSignups({
        userId: user.uid,
        status: 'ready',
        items: snapshot.docs.map((signupDoc) => ({ id: signupDoc.id, ...signupDoc.data() })),
        error: '',
      }),
      () => setSignups({
        userId: user.uid,
        status: 'error',
        items: [],
        error: 'Your activity signups could not be loaded. Check Firestore rules and try again.',
      }),
    )
  }, [user?.uid])

  const cancelSignup = async (signup) => {
    if (!db || cancellingId) return
    setCancellingId(signup.id)
    try {
      await deleteDoc(doc(db, 'CommunityEngagementSignups', signup.id))
      setSignups((current) => ({
        ...current,
        items: current.items.filter((item) => item.id !== signup.id),
      }))
    } catch {
      setSignups((current) => ({
        ...current,
        error: 'Your volunteer signup could not be cancelled. Check Firestore rules and try again.',
      }))
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <LocalizedContent>
    <section className="community-engagement-signups" aria-labelledby="my-engagement-signups-title">
      <header>
        <h2 id="my-engagement-signups-title">My community engagement signups</h2>
        <p>Activities you have volunteered for.</p>
      </header>
      {currentSignups.status === 'loading' && <p role="status">Loading your signups…</p>}
      {currentSignups.error && <p role="alert">{currentSignups.error}</p>}
      {currentSignups.status === 'ready' && currentSignups.items.length === 0 && <p>You have not signed up for any activities yet.</p>}
      {currentSignups.items.map((signup) => (
        <article className="community-engagement-my-signup" key={signup.id}>
          <div>
            <h3><PreservedContent>{signup.markerName}</PreservedContent></h3>
            <p>Volunteering as {signup.methods.join(', ')}</p>
          </div>
          <button type="button" onClick={() => cancelSignup(signup)} disabled={cancellingId !== null}>
            {cancellingId === signup.id ? 'Cancelling…' : 'Cancel signup'}
          </button>
        </article>
      ))}
    </section>
    </LocalizedContent>
  )
}
