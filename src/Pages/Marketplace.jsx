import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import './Marketplace.css'

const listingCategories = ['Food', 'Produce', 'Retail', 'Crafts', 'Services', 'Other']
const emptyForm = {
  title: '',
  category: listingCategories[0],
  price: '',
  locationId: '',
  hours: '',
  offering: '',
  contactMethod: '',
}

function formatCreatedDate(timestamp) {
  if (!timestamp) return ''
  const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString()
}

function getUsername(user) {
  return user?.displayName || user?.email?.split('@')[0] || 'Community member'
}

function getMemberLabel(name, userId, currentUser) {
  return name || (currentUser?.uid === userId ? getUsername(currentUser) : `Member ${userId?.slice(0, 6) || ''}`)
}

export default function Marketplace({
  user,
  locations,
  marketplaceListings,
  locationsStatus,
  marketplaceListingsStatus,
  marketplaceListingsError,
  onRequestLogin,
  onShowLocation,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [locationFilter, setLocationFilter] = useState('All')
  const [formData, setFormData] = useState(emptyForm)
  const [editingListingId, setEditingListingId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('')
  const [deleteFeedback, setDeleteFeedback] = useState({ listingId: null, status: '', error: '' })
  const [activeTab, setActiveTab] = useState('listings')
  const [adminCheck, setAdminCheck] = useState({ uid: null, status: 'checking' })
  const [buyerOrderSnapshot, setBuyerOrderSnapshot] = useState({ uid: null, orders: [] })
  const [sellerOrderSnapshot, setSellerOrderSnapshot] = useState({ uid: null, orders: [] })
  const [ordersErrorState, setOrdersErrorState] = useState({ uid: null, error: '' })
  const [orderAction, setOrderAction] = useState({ orderId: null, status: '', error: '' })
  const adminStatus = !db ? 'unavailable' : !user ? 'signed-out' : adminCheck.uid === user.uid ? adminCheck.status : 'checking'
  const ordersError = ordersErrorState.uid === user?.uid ? ordersErrorState.error : ''

  useEffect(() => {
    if (!db || !user) return undefined
    return onSnapshot(doc(db, 'admin', user.uid), (adminDoc) => {
      setAdminCheck({ uid: user.uid, status: adminDoc.exists() && adminDoc.data().enabled === true ? 'admin' : 'not-admin' })
    }, () => setAdminCheck({ uid: user.uid, status: 'error' }))
  }, [user])

  useEffect(() => {
    if (!db || !user) return undefined

    const toOrders = (snapshot) => snapshot.docs.map((orderDoc) => ({ id: orderDoc.id, ...orderDoc.data() }))
    const buyerUnsubscribe = onSnapshot(query(collection(db, 'MarketplaceOrders'), where('buyerId', '==', user.uid)), (snapshot) => {
      setBuyerOrderSnapshot({ uid: user.uid, orders: toOrders(snapshot) })
      setOrdersErrorState({ uid: user.uid, error: '' })
    }, () => setOrdersErrorState({ uid: user.uid, error: 'Orders could not be loaded. Check Firestore rules and try again.' }))
    const sellerUnsubscribe = onSnapshot(query(collection(db, 'MarketplaceOrders'), where('sellerId', '==', user.uid)), (snapshot) => {
      setSellerOrderSnapshot({ uid: user.uid, orders: toOrders(snapshot) })
      setOrdersErrorState({ uid: user.uid, error: '' })
    }, () => setOrdersErrorState({ uid: user.uid, error: 'Orders could not be loaded. Check Firestore rules and try again.' }))

    return () => {
      buyerUnsubscribe()
      sellerUnsubscribe()
    }
  }, [user])

  const orders = useMemo(() => {
    const buyerOrders = buyerOrderSnapshot.uid === user?.uid ? buyerOrderSnapshot.orders : []
    const sellerOrders = sellerOrderSnapshot.uid === user?.uid ? sellerOrderSnapshot.orders : []
    const uniqueOrders = new Map([...buyerOrders, ...sellerOrders].map((order) => [order.id, order]))
    return [...uniqueOrders.values()].sort((first, second) => (second.createdAt?.toMillis?.() || 0) - (first.createdAt?.toMillis?.() || 0))
  }, [buyerOrderSnapshot, sellerOrderSnapshot, user?.uid])

  const marketplaceLocations = locations.filter((location) => location.category === 'Marketplace')
  const locationById = useMemo(
    () => new Map(marketplaceLocations.map((location) => [location.id, location])),
    [marketplaceLocations],
  )
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase()
  const visibleListings = marketplaceListings
    .filter((listing) => {
      if (listing.active === false && listing.createdBy !== user?.uid && adminStatus !== 'admin') return false
      const location = locationById.get(listing.locationId)
      if (!location) return false
      const matchesCategory = categoryFilter === 'All' || listing.category === categoryFilter
      const matchesLocation = locationFilter === 'All' || listing.locationId === locationFilter
      const searchableText = `${listing.title} ${listing.category} ${listing.price} ${listing.offering} ${listing.hours} ${listing.contactMethod} ${location.name}`.toLocaleLowerCase()
      return matchesCategory && matchesLocation && (!normalizedSearch || searchableText.includes(normalizedSearch))
    })
    .sort((first, second) => {
      const firstTime = first.createdAt?.toMillis?.() || 0
      const secondTime = second.createdAt?.toMillis?.() || 0
      return secondTime - firstTime
    })
  const isFormValid = Boolean(
    db
    && user
    && locationsStatus === 'ready'
    && marketplaceLocations.some((location) => location.id === formData.locationId)
    && formData.title.trim()
    && formData.price.trim()
    && formData.hours.trim()
    && formData.offering.trim()
    && formData.contactMethod.trim(),
  )

  const handleInputChange = (event) => {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
    setSaveSuccess(false)
    setSaveSuccessMessage('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!db || !user || isSaving || !marketplaceLocations.some((location) => location.id === formData.locationId)) return

    setIsSaving(true)
    setSaveError('')
    setSaveSuccess(false)

    try {
      const listingData = {
        title: formData.title.trim(),
        category: formData.category,
        price: formData.price.trim(),
        locationId: formData.locationId,
        hours: formData.hours.trim(),
        offering: formData.offering.trim(),
        contactMethod: formData.contactMethod.trim(),
      }
      if (editingListingId) {
        await updateDoc(doc(db, 'MarketplaceListings', editingListingId), {
          ...listingData,
          approvalStatus: 'underReview',
          reviewedAt: null,
          reviewedBy: null,
        })
      } else {
        await addDoc(collection(db, 'MarketplaceListings'), {
          ...listingData,
          createdBy: user.uid,
          createdByName: getUsername(user),
          createdAt: serverTimestamp(),
          approvalStatus: 'underReview',
          active: true,
        })
      }
      setSaveSuccessMessage(editingListingId ? 'Listing updated and sent for admin review.' : 'Listing published.')
      setFormData(emptyForm)
      setEditingListingId(null)
      setSaveSuccess(true)
    } catch {
      setSaveError(`Listing could not be ${editingListingId ? 'updated' : 'saved'}. Check that Firestore rules are published and try again.`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditListing = (listing) => {
    setEditingListingId(listing.id)
    setFormData({
      title: listing.title || '',
      category: listing.category || listingCategories[0],
      price: listing.price || '',
      locationId: listing.locationId || '',
      hours: listing.hours || '',
      offering: listing.offering || '',
      contactMethod: listing.contactMethod || '',
    })
    setSaveError('')
    setSaveSuccess(false)
    setSaveSuccessMessage('')
  }

  const handleCancelEdit = () => {
    setEditingListingId(null)
    setFormData(emptyForm)
    setSaveError('')
    setSaveSuccess(false)
    setSaveSuccessMessage('')
  }

  const handleDeleteListing = async (listing) => {
    if (!db || !user || listing.createdBy !== user.uid || deleteFeedback.status === 'deleting') return
    if (!window.confirm(`Delete "${listing.title}"? This cannot be undone.`)) return

    setDeleteFeedback({ listingId: listing.id, status: 'deleting', error: '' })
    try {
      await deleteDoc(doc(db, 'MarketplaceListings', listing.id))
      setDeleteFeedback({ listingId: null, status: '', error: '' })
    } catch {
      setDeleteFeedback({
        listingId: listing.id,
        status: 'error',
        error: 'This listing could not be deleted. Check that Firestore rules are published and try again.',
      })
    }
  }

  const handleReviewListing = async (listing, approvalStatus) => {
    if (!db || adminStatus !== 'admin') return
    setOrderAction({ orderId: listing.id, status: 'reviewing', error: '' })
    try {
      await updateDoc(doc(db, 'MarketplaceListings', listing.id), {
        approvalStatus,
        reviewedAt: serverTimestamp(),
        reviewedBy: user.uid,
      })
      setOrderAction({ orderId: null, status: '', error: '' })
    } catch {
      setOrderAction({ orderId: listing.id, status: '', error: 'Listing status could not be updated. Check admin access and Firestore rules.' })
    }
  }

  const handleDelist = async (listing) => {
    if (!db || !user || listing.createdBy !== user.uid) return
    setOrderAction({ orderId: listing.id, status: 'delisting', error: '' })
    try {
      await updateDoc(doc(db, 'MarketplaceListings', listing.id), { active: false })
      setOrderAction({ orderId: null, status: '', error: '' })
    } catch {
      setOrderAction({ orderId: listing.id, status: '', error: 'Listing could not be de-listed. Check Firestore rules and try again.' })
    }
  }

  const handleRelist = async (listing) => {
    if (!db || !user || listing.createdBy !== user.uid || listing.active !== false) return
    setOrderAction({ orderId: listing.id, status: 'relisting', error: '' })
    try {
      await updateDoc(doc(db, 'MarketplaceListings', listing.id), { active: true })
      setOrderAction({ orderId: null, status: '', error: '' })
    } catch {
      setOrderAction({ orderId: listing.id, status: '', error: 'Listing could not be re-listed. Check that it is approved and Firestore rules are published.' })
    }
  }

  const handlePlaceOrder = async (listing) => {
    if (!db || !user || user.uid === listing.createdBy || listing.approvalStatus !== 'approved' || listing.active === false) return
    setOrderAction({ orderId: listing.id, status: 'ordering', error: '' })
    try {
      await addDoc(collection(db, 'MarketplaceOrders'), {
        listingId: listing.id,
        listingTitle: listing.title,
        price: listing.price,
        buyerId: user.uid,
        buyerName: getUsername(user),
        sellerId: listing.createdBy,
        sellerName: getMemberLabel(listing.createdByName, listing.createdBy, user),
        status: 'pending',
        createdAt: serverTimestamp(),
      })
      setOrderAction({ orderId: listing.id, status: 'ordered', error: '' })
    } catch {
      setOrderAction({ orderId: listing.id, status: '', error: 'Order could not be placed. Check that Firestore rules are published and try again.' })
    }
  }

  const handleUpdateOrder = async (order, status) => {
    if (!db || !user || order.sellerId !== user.uid || order.status !== 'pending') return
    setOrderAction({ orderId: order.id, status: 'updating', error: '' })
    try {
      await updateDoc(doc(db, 'MarketplaceOrders', order.id), { status, respondedAt: serverTimestamp() })
      setOrderAction({ orderId: null, status: '', error: '' })
    } catch {
      setOrderAction({ orderId: order.id, status: '', error: 'Order status could not be updated. Check Firestore rules and try again.' })
    }
  }

  const handleDeleteOrder = async (order) => {
    if (!db || !user || order.buyerId !== user.uid || !['pending', 'rejected'].includes(order.status)) return
    setOrderAction({ orderId: order.id, status: 'deleting', error: '' })
    try {
      await deleteDoc(doc(db, 'MarketplaceOrders', order.id))
      setOrderAction({ orderId: null, status: '', error: '' })
    } catch {
      setOrderAction({ orderId: order.id, status: '', error: 'Order could not be deleted. Check Firestore rules and try again.' })
    }
  }

  return (
    <main className="marketplace-page">
      <header className="marketplace-header">
        <div>
          <p className="marketplace-eyebrow">GabayGo community</p>
          <h1>Marketplace</h1>
          <p>Local goods and services connected to community market locations.</p>
        </div>
      </header>

      <div className="marketplace-layout">
        <aside className="marketplace-compose" aria-labelledby="marketplace-form-title">
          {user ? (
            <form onSubmit={handleSubmit}>
              <h2 id="marketplace-form-title">{editingListingId ? 'Edit listing' : 'Create a listing'}</h2>
              <label>
                Listing title
                <input
                  name="title"
                  type="text"
                  value={formData.title}
                  onChange={handleInputChange}
                  maxLength="100"
                  required
                  placeholder="e.g. Fresh vegetables"
                />
              </label>
              <label>
                Category
                <select name="category" value={formData.category} onChange={handleInputChange}>
                  {listingCategories.map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>
              <label>
                Marketplace location
                <select
                  name="locationId"
                  value={formData.locationId}
                  onChange={handleInputChange}
                  required
                  disabled={locationsStatus !== 'ready' || marketplaceLocations.length === 0}
                >
                  <option value="">Choose a Marketplace location</option>
                  {marketplaceLocations.map((location) => (
                    <option value={location.id} key={location.id}>{location.name}</option>
                  ))}
                </select>
              </label>
              {locationsStatus === 'ready' && marketplaceLocations.length === 0 && (
                <p className="marketplace-form-note">There are no Marketplace locations yet. An admin must add one to the map before listings can be posted.</p>
              )}
              <label>
                Price
                <input
                  name="price"
                  type="text"
                  value={formData.price}
                  onChange={handleInputChange}
                  maxLength="100"
                  required
                  placeholder="e.g. ₱150, Free, or negotiable"
                />
              </label>
              <label>
                Hours
                <input
                  name="hours"
                  type="text"
                  value={formData.hours}
                  onChange={handleInputChange}
                  maxLength="200"
                  required
                  placeholder="e.g. Daily, 8 AM–5 PM"
                />
              </label>
              <label>
                Goods or services
                <textarea
                  name="offering"
                  value={formData.offering}
                  onChange={handleInputChange}
                  rows="4"
                  maxLength="1000"
                  required
                  placeholder="Describe what you offer"
                />
              </label>
              <label>
                Contact method
                <input
                  name="contactMethod"
                  type="text"
                  value={formData.contactMethod}
                  onChange={handleInputChange}
                  maxLength="300"
                  required
                  placeholder="Phone, email, or social account"
                />
              </label>
              <p className="marketplace-form-note">Contact details are visible to anyone who can view the marketplace.</p>
              <button type="submit" disabled={isSaving || !isFormValid}>
                {isSaving ? (editingListingId ? 'Saving changes…' : 'Publishing…') : editingListingId ? 'Save changes' : 'Publish listing'}
              </button>
              {editingListingId && <button className="marketplace-form-cancel" type="button" onClick={handleCancelEdit} disabled={isSaving}>Cancel edit</button>}
              {saveError && <p className="marketplace-feedback marketplace-feedback--error" role="alert">{saveError}</p>}
              {saveSuccess && <p className="marketplace-feedback" role="status">{saveSuccessMessage}</p>}
            </form>
          ) : (
            <div className="marketplace-sign-in">
              <h2 id="marketplace-form-title">Create a listing</h2>
              <p>Sign in to share goods or services with the community.</p>
              <button type="button" onClick={onRequestLogin}>Log in to continue</button>
            </div>
          )}
        </aside>

        <section className="marketplace-results" aria-labelledby="marketplace-results-title">
          <div className="marketplace-tabs" role="tablist" aria-label="Marketplace sections">
            <button type="button" role="tab" aria-selected={activeTab === 'listings'} onClick={() => setActiveTab('listings')}>
              Listings
            </button>
            <button type="button" role="tab" aria-selected={activeTab === 'orders'} onClick={() => setActiveTab('orders')}>
              Orders <span>{orders.length}</span>
            </button>
          </div>
          {activeTab === 'listings' ? <>
          <header className="marketplace-results-header">
            <div>
              <h2 id="marketplace-results-title">Community listings</h2>
              <p>{visibleListings.length} of {marketplaceListings.length} listings</p>
            </div>
          </header>

          <div className="marketplace-filters" aria-label="Search and filter marketplace listings">
            <label>
              Search listings
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Name, goods, or services"
              />
            </label>
            <label>
              Category
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option>All</option>
                {listingCategories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label>
              Marketplace location
              <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
                <option value="All">All locations</option>
                {marketplaceLocations.map((location) => (
                  <option value={location.id} key={location.id}>{location.name}</option>
                ))}
              </select>
            </label>
          </div>

          {marketplaceListingsStatus === 'loading' && <p className="marketplace-empty" role="status">Loading listings…</p>}
          {marketplaceListingsStatus === 'unavailable' && <p className="marketplace-empty">Connect Firebase to browse marketplace listings.</p>}
          {marketplaceListingsStatus === 'error' && <p className="marketplace-empty marketplace-empty--error" role="alert">{marketplaceListingsError}</p>}
          {locationsStatus === 'error' && <p className="marketplace-empty marketplace-empty--error" role="alert">Marketplace locations could not be loaded.</p>}
          {marketplaceListingsStatus === 'ready' && visibleListings.length === 0 && (
            <p className="marketplace-empty" role="status">
              {marketplaceListings.length === 0 ? 'No listings yet.' : 'No listings match these filters.'}
            </p>
          )}
          {marketplaceListingsStatus === 'ready' && visibleListings.length > 0 && (
            <ul className="marketplace-listing-grid">
              {visibleListings.map((listing) => {
                const location = locationById.get(listing.locationId)
                return (
                  <li className="marketplace-listing" key={listing.id}>
                    <div className="marketplace-listing-heading">
                      <span className="marketplace-listing-category">{listing.category}</span>
                      {formatCreatedDate(listing.createdAt) && <time>{formatCreatedDate(listing.createdAt)}</time>}
                    </div>
                    <span className={`marketplace-status marketplace-status--${listing.approvalStatus || 'underReview'}`}>
                      {listing.approvalStatus === 'approved' ? 'Approved' : listing.approvalStatus === 'denied' ? 'Denied' : 'Under review'}
                    </span>
                    {listing.active === false && <span className="marketplace-status marketplace-status--inactive">De-listed</span>}
                    <h3>{listing.title}</h3>
                    <p className="marketplace-listing-author">Listed by {getMemberLabel(listing.createdByName, listing.createdBy, user)}</p>
                    <p className="marketplace-listing-offering">{listing.offering}</p>
                    <dl>
                      <div>
                        <dt>Price</dt>
                        <dd>{listing.price || 'Not specified'}</dd>
                      </div>
                      <div>
                        <dt>Marketplace location</dt>
                        <dd>
                          <button
                            className="marketplace-location-link"
                            type="button"
                            onClick={() => onShowLocation(location.id)}
                            aria-label={`Show ${location.name} on map`}
                          >
                            {location.name} <span aria-hidden="true">↗</span>
                          </button>
                        </dd>
                      </div>
                      <div>
                        <dt>Hours</dt>
                        <dd>{listing.hours}</dd>
                      </div>
                      <div>
                        <dt>Contact</dt>
                        <dd>{listing.contactMethod}</dd>
                      </div>
                    </dl>
                    {user?.uid === listing.createdBy && (
                      <div className="marketplace-listing-owner-actions">
                        <div className="marketplace-listing-button-group">
                        <button className="marketplace-secondary-button" type="button" onClick={() => handleEditListing(listing)}>
                          Edit listing
                        </button>
                        {listing.active !== false ? <button
                          className="marketplace-secondary-button"
                          type="button"
                          onClick={() => handleDelist(listing)}
                          disabled={orderAction.status === 'delisting'}
                        >
                          {orderAction.orderId === listing.id && orderAction.status === 'delisting' ? 'De-listing…' : 'De-list listing'}
                        </button> : <button
                          className="marketplace-secondary-button"
                          type="button"
                          onClick={() => handleRelist(listing)}
                          disabled={orderAction.status === 'relisting'}
                        >
                          {orderAction.orderId === listing.id && orderAction.status === 'relisting' ? 'Re-listing…' : 'Re-list listing'}
                        </button>}
                        <button
                          className="marketplace-delete-button"
                          type="button"
                          onClick={() => handleDeleteListing(listing)}
                          disabled={deleteFeedback.status === 'deleting'}
                        >
                          {deleteFeedback.listingId === listing.id && deleteFeedback.status === 'deleting'
                            ? 'Deleting…'
                            : 'Delete listing'}
                        </button>
                          </div>
                        {deleteFeedback.listingId === listing.id && deleteFeedback.error && (
                          <p className="marketplace-feedback marketplace-feedback--error" role="alert">
                            {deleteFeedback.error}
                          </p>
                        )}
                        {orderAction.orderId === listing.id && orderAction.error && <p className="marketplace-feedback marketplace-feedback--error" role="alert">{orderAction.error}</p>}
                      </div>
                    )}
                    {adminStatus === 'admin' && (
                      <div className="marketplace-listing-owner-actions">
                        <div className="marketplace-listing-button-group">
                          <button className="marketplace-secondary-button" type="button" onClick={() => handleReviewListing(listing, 'approved')} disabled={orderAction.status === 'reviewing'}>Approve</button>
                          <button className="marketplace-delete-button" type="button" onClick={() => handleReviewListing(listing, 'denied')} disabled={orderAction.status === 'reviewing'}>Deny</button>
                        </div>
                        {orderAction.orderId === listing.id && orderAction.error && <p className="marketplace-feedback marketplace-feedback--error" role="alert">{orderAction.error}</p>}
                      </div>
                    )}
                    {listing.approvalStatus === 'approved' && listing.active !== false && user?.uid !== listing.createdBy && (
                      <div className="marketplace-listing-owner-actions">
                        <button className="marketplace-secondary-button" type="button" onClick={() => handlePlaceOrder(listing)} disabled={!user || orderAction.status === 'ordering'}>
                          {orderAction.orderId === listing.id && orderAction.status === 'ordering' ? 'Placing order…' : 'Place an order'}
                        </button>
                        {!user && <p className="marketplace-form-note"><button className="marketplace-location-link" type="button" onClick={onRequestLogin}>Log in</button> to place an order.</p>}
                        {orderAction.orderId === listing.id && orderAction.status === 'ordered' && <p className="marketplace-feedback" role="status">Order placed. Track it in Orders.</p>}
                        {orderAction.orderId === listing.id && orderAction.error && <p className="marketplace-feedback marketplace-feedback--error" role="alert">{orderAction.error}</p>}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          </> : <section className="marketplace-orders" aria-label="Your marketplace orders">
            <header className="marketplace-results-header">
              <div><h2>Orders</h2><p>Orders you placed and requests sellers sent to you.</p></div>
            </header>
            {!user && <p className="marketplace-empty">Sign in to view your orders.</p>}
            {ordersError && <p className="marketplace-empty marketplace-empty--error" role="alert">{ordersError}</p>}
            {user && !ordersError && orders.length === 0 && <p className="marketplace-empty">No orders yet.</p>}
            <ul className="marketplace-order-list">
              {orders.map((order) => {
                const isSeller = order.sellerId === user?.uid
                const canRespond = isSeller && order.status === 'pending'
                const canDelete = order.buyerId === user?.uid && ['pending', 'rejected'].includes(order.status)
                return <li className="marketplace-order" key={order.id}>
                  <div className="marketplace-order-heading">
                    <h3>{order.listingTitle}</h3>
                    <span className={`marketplace-status marketplace-status--${order.status}`}>{order.status}</span>
                  </div>
                  <p>{isSeller ? 'Buyer request' : 'Your order'} · {order.price}</p>
                  <p>{isSeller ? 'Buyer' : 'Seller'}: {getMemberLabel(isSeller ? order.buyerName : order.sellerName, isSeller ? order.buyerId : order.sellerId, user)}</p>
                  {formatCreatedDate(order.createdAt) && <time>{formatCreatedDate(order.createdAt)}</time>}
                  <div className="marketplace-order-actions">
                    {canRespond && <>
                      <button className="marketplace-secondary-button" type="button" onClick={() => handleUpdateOrder(order, 'accepted')} disabled={orderAction.orderId === order.id}>Accept</button>
                      <button className="marketplace-delete-button" type="button" onClick={() => handleUpdateOrder(order, 'rejected')} disabled={orderAction.orderId === order.id}>Reject</button>
                    </>}
                    {canDelete && <button className="marketplace-delete-button" type="button" onClick={() => handleDeleteOrder(order)} disabled={orderAction.orderId === order.id}>Delete order</button>}
                    {orderAction.orderId === order.id && orderAction.error && <p className="marketplace-feedback marketplace-feedback--error" role="alert">{orderAction.error}</p>}
                  </div>
                </li>
              })}
            </ul>
          </section>}
        </section>
      </div>
    </main>
  )
}
