import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import './CategoryDropdown.css'

export default function CategoryDropdown({
  id,
  categories = [],
  selectedCategories = [],
  onChange,
  label = 'Categories',
  placeholder = 'Categories',
  ariaLabelledBy,
  disabled = false,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const toggleCategory = (category) => {
    if (selectedCategories.includes(category)) {
      onChange(selectedCategories.filter((item) => item !== category))
    } else {
      onChange([...selectedCategories, category])
    }
  }

  const handleSelectAll = (event) => {
    event.stopPropagation()
    onChange([...categories])
  }

  const handleClear = (event) => {
    event.stopPropagation()
    onChange([])
  }

  const getDisplayText = () => {
    if (selectedCategories.length === 0 && placeholder) {
      return placeholder
    }
    return label || 'Categories'
  }

  const allSelected = categories.length > 0 && selectedCategories.length === categories.length

  return (
    <div
      className={`category-dropdown ${className} ${isOpen ? 'category-dropdown--open' : ''} ${disabled ? 'category-dropdown--disabled' : ''}`}
      ref={dropdownRef}
    >
      <button
        id={id}
        type="button"
        className="category-dropdown-trigger"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-labelledby={ariaLabelledBy}
      >
        <span className="category-dropdown-text">{getDisplayText()}</span>
        <div className="category-dropdown-trigger-right">
          {selectedCategories.length > 0 && (
            <span className="category-dropdown-count-badge" aria-label={`${selectedCategories.length} selected`}>
              {selectedCategories.length}
            </span>
          )}
          <ChevronDown
            className={`category-dropdown-chevron ${isOpen ? 'category-dropdown-chevron--open' : ''}`}
            size={16}
            aria-hidden="true"
          />
        </div>
      </button>

      {isOpen && (
        <div className="category-dropdown-menu" role="listbox" aria-multiselectable="true">
          <div className="category-dropdown-actions">
            <span className="category-dropdown-action-summary">
              {selectedCategories.length > 0 ? `${selectedCategories.length} of ${categories.length} selected` : ''}
            </span>
            <div className="category-dropdown-action-buttons">
              {!allSelected && (
                <button
                  type="button"
                  className="category-dropdown-action-btn"
                  onClick={handleSelectAll}
                >
                  Select all
                </button>
              )}
              <button
                type="button"
                className="category-dropdown-action-btn category-dropdown-action-btn--clear"
                onClick={handleClear}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="category-dropdown-options">
            {categories.map((category) => {
              const isChecked = selectedCategories.includes(category)
              return (
                <label
                  key={category}
                  className={`category-dropdown-option ${isChecked ? 'category-dropdown-option--checked' : ''}`}
                  role="option"
                  aria-selected={isChecked}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleCategory(category)}
                  />
                  <span className="category-dropdown-option-label">{category}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
