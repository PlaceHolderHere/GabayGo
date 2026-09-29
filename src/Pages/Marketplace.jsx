import { useMemo, useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
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
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  const marketplaceLocations = locations.filter((location) => location.category === 'Marketplace')
  const locationById = useMemo(
    () => new Map(marketplaceLocations.map((location) => [location.id, location])),
    [marketplaceLocations],
  )
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase()
  const visibleListings = marketplaceListings
    .filter((listing) => {
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
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!db || !user || isSaving || !marketplaceLocations.some((location) => location.id === formData.locationId)) return

    setIsSaving(true)
    setSaveError('')
    setSaveSuccess(false)

    try {
      await addDoc(collection(db, 'MarketplaceListings'), {
        title: formData.title.trim(),
        category: formData.category,
        price: formData.price.trim(),
        locationId: formData.locationId,
        hours: formData.hours.trim(),
        offering: formData.offering.trim(),
        contactMethod: formData.contactMethod.trim(),
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      })
      setFormData(emptyForm)
      setSaveSuccess(true)
    } catch {
      setSaveError('Listing could not be saved. Check that Firestore rules are published and try again.')
    } finally {
      setIsSaving(false)
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
              <h2 id="marketplace-form-title">Create a listing</h2>
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
                {isSaving ? 'Publishing…' : 'Publish listing'}
              </button>
              {saveError && <p className="marketplace-feedback marketplace-feedback--error" role="alert">{saveError}</p>}
              {saveSuccess && <p className="marketplace-feedback" role="status">Listing published.</p>}
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
                    <h3>{listing.title}</h3>
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
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
