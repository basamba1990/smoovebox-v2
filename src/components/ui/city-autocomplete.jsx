import * as React from "react"
import { MapPin, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// Debounce function
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = React.useState(value)

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export function CityAutocomplete({ 
  value, 
  onChange, 
  onCoordinatesChange,
  placeholder = "Ex: Paris, France",
  className,
  disabled,
  required
}) {
  const [open, setOpen] = React.useState(false)
  const [suggestions, setSuggestions] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(null)
  const inputRef = React.useRef(null)
  
  const debouncedValue = useDebounce(value, 500) // Wait 500ms after user stops typing

  // Fetch city suggestions from Nominatim
  const fetchSuggestions = React.useCallback(async (query) => {
    if (!query || query.length < 3) {
      setSuggestions([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Use Nominatim API (free, no API key needed)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1&accept-language=fr`,
        {
          headers: {
            'User-Agent': 'SpotBulle/1.0' // Required by Nominatim
          }
        }
      )

      if (!response.ok) {
        throw new Error('Erreur lors de la recherche')
      }

      const data = await response.json()
      setSuggestions(data)
    } catch (err) {
      console.error('Erreur geocoding:', err)
      setError('Impossible de charger les suggestions')
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch coordinates when city is selected
  const fetchCoordinates = React.useCallback(async (cityName) => {
    if (!cityName || cityName.length < 3) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=1&addressdetails=1&accept-language=fr`,
        {
          headers: {
            'User-Agent': 'SpotBulle/1.0'
          }
        }
      )

      if (!response.ok) {
        throw new Error('Erreur lors de la géolocalisation')
      }

      const data = await response.json()
      
      if (data && data.length > 0) {
        const result = data[0]
        const lat = parseFloat(result.lat)
        const lon = parseFloat(result.lon)
        
        // Update coordinates
        if (onCoordinatesChange) {
          onCoordinatesChange({ latitude: lat, longitude: lon })
        }
      }
    } catch (err) {
      console.error('Erreur géolocalisation:', err)
      setError('Impossible de récupérer les coordonnées')
    } finally {
      setLoading(false)
    }
  }, [onCoordinatesChange])

  // Fetch suggestions when debounced value changes
  React.useEffect(() => {
    if (debouncedValue && open) {
      fetchSuggestions(debouncedValue)
    } else {
      setSuggestions([])
    }
  }, [debouncedValue, open, fetchSuggestions])

  const handleInputChange = (e) => {
    const newValue = e.target.value
    onChange?.(newValue)
    setOpen(true)
    setError(null)
  }

  const handleSelectCity = (suggestion) => {
    const displayName = suggestion.display_name || suggestion.name || ''
    onChange?.(displayName)
    setOpen(false)
    setSuggestions([])
    
    // Fetch coordinates for selected city
    if (suggestion.lat && suggestion.lon) {
      const lat = parseFloat(suggestion.lat)
      const lon = parseFloat(suggestion.lon)
      if (onCoordinatesChange) {
        onCoordinatesChange({ latitude: lat, longitude: lon })
      }
    } else {
      fetchCoordinates(displayName)
    }
  }

  const formatCityName = (suggestion) => {
    const parts = []
    if (suggestion.name) parts.push(suggestion.name)
    if (suggestion.address) {
      if (suggestion.address.city) parts.push(suggestion.address.city)
      else if (suggestion.address.town) parts.push(suggestion.address.town)
      else if (suggestion.address.village) parts.push(suggestion.address.village)
      
      if (suggestion.address.country) parts.push(suggestion.address.country)
    }
    return parts.length > 0 ? parts.join(', ') : suggestion.display_name || ''
  }

  return (
    <div className="relative">
      <Popover open={open && suggestions.length > 0} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              ref={inputRef}
              type="text"
              value={value || ''}
              onChange={handleInputChange}
              onFocus={() => {
                if (value && value.length >= 3) {
                  setOpen(true)
                  fetchSuggestions(value)
                }
              }}
              placeholder={placeholder}
              disabled={disabled}
              required={required}
              className={cn("pr-10", className)}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              ) : (
                <MapPin className="h-4 w-4 text-slate-400" />
              )}
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[var(--radix-popover-trigger-width)] p-0" 
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="max-h-[200px] overflow-y-auto">
            {suggestions.length > 0 ? (
              <div className="py-1">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSelectCity(suggestion)}
                    className="w-full text-left px-4 py-2 text-sm text-slate-100 hover:bg-slate-800 focus:bg-slate-800 focus:outline-none transition-colors"
                  >
                    <div className="font-medium">{formatCityName(suggestion)}</div>
                    {suggestion.display_name && suggestion.display_name !== formatCityName(suggestion) && (
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        {suggestion.display_name}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : error ? (
              <div className="px-4 py-2 text-sm text-red-400">{error}</div>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

