import { useEffect, useState } from 'react'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '../firebase'
import './Login.css'

export default function Login({ onClose }) {
	const [error, setError] = useState('')
	const [isSigningIn, setIsSigningIn] = useState(false)

	useEffect(() => {
		const handleKeyDown = (event) => {
			if (event.key === 'Escape') onClose()
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [onClose])

	const handleGoogleSignIn = async () => {
		if (!auth || isSigningIn) return

		setError('')
		setIsSigningIn(true)

		try {
			await signInWithPopup(auth, new GoogleAuthProvider())
			onClose()
		} catch (signInError) {
			if (signInError.code === 'auth/popup-closed-by-user') {
				setError('Sign-in was cancelled. You can keep browsing as a guest.')
			} else if (signInError.code === 'auth/cancelled-popup-request') {
				setError('A sign-in window was cancelled. Please try again.')
			} else {
				setError('Google sign-in could not be completed. Please try again.')
			}
		} finally {
			setIsSigningIn(false)
		}
	}

	return (
		<div className="login-backdrop" onClick={onClose}>
			<section
				className="login-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="login-title"
				onClick={(event) => event.stopPropagation()}
			>
				<button className="login-close" type="button" onClick={onClose} aria-label="Close sign-in">
					×
				</button>
				<span className="login-mark" aria-hidden="true">g</span>
				<p className="login-eyebrow">Welcome to GabayGo</p>
				<h2 id="login-title">Stay connected to your community.</h2>
				<p className="login-intro">Sign in to share useful places and help neighbors stay informed.</p>

				<button
					className="google-sign-in"
					type="button"
					onClick={handleGoogleSignIn}
					disabled={!auth || isSigningIn}
				>
					<span className="google-mark" aria-hidden="true">G</span>
					<span>{isSigningIn ? 'Connecting to Google…' : 'Continue with Google'}</span>
					<span aria-hidden="true">↗</span>
				</button>

				{!auth && (
					<p className="login-message" role="status">
						Add your Firebase project values to <code>.env</code> and enable Google in Firebase Authentication.
					</p>
				)}
				{error && <p className="login-message" role="status">{error}</p>}
				<p className="login-terms">You can browse the map without signing in.</p>
			</section>
		</div>
	)
}
