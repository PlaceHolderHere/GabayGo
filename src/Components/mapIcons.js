import L from 'leaflet'
import locationImage from '../assets/Location.svg'
import outageImage from '../assets/Outage.svg'
import serviceImage from '../assets/Service.svg'
import marketplaceImage from '../assets/Marketplace.svg'
import reportImage from '../assets/Report.svg'
import temporaryLocationImage from '../assets/TemporaryLocation.svg'

const CustomIcon = L.Icon.extend({
  options: {
    iconSize: [40, 40],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  },
})

export const defaultIcon = new CustomIcon({ iconUrl: locationImage })
export const temporaryLocationIcon = new CustomIcon({ iconUrl: temporaryLocationImage })

export const categoryIcons = {
  Location: defaultIcon,
  Outage: new CustomIcon({ iconUrl: outageImage }),
  Service: new CustomIcon({ iconUrl: serviceImage }),
  Marketplace: new CustomIcon({ iconUrl: marketplaceImage }),
  Report: new CustomIcon({ iconUrl: reportImage }),
}