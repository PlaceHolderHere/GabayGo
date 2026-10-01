import L from 'leaflet'
import gardenImage from '../assets/Garden.svg'
import eventImage from '../assets/Event.svg'
import evacuationImage from '../assets/Evacuation.svg'
import reliefImage from '../assets/Relief.svg'
import locationImage from '../assets/Location.svg'
import outageImage from '../assets/Outage.svg'
import serviceImage from '../assets/Service.svg'
import marketplaceImage from '../assets/Marketplace.svg'
import reportImage from '../assets/Report.svg'
import warningImage from '../assets/Warning.svg'
import temporaryLocationImage from '../assets/TemporaryLocation.svg'

const CustomIcon = L.Icon.extend({
  options: {
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [1, -34],
  },
})

export const defaultIcon = new CustomIcon({ iconUrl: locationImage })
export const temporaryLocationIcon = new CustomIcon({ iconUrl: temporaryLocationImage })

const HazardIcon = new L.icon({
    iconUrl: warningImage,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

export const categoryIcons = {
  Location: defaultIcon,
  Outage: new CustomIcon({ iconUrl: outageImage }),
  Service: new CustomIcon({ iconUrl: serviceImage }),
  Marketplace: new CustomIcon({ iconUrl: marketplaceImage }),
  Garden: new CustomIcon({ iconUrl: gardenImage }),
  Event: new CustomIcon({ iconUrl: eventImage }),
  Schedule: defaultIcon,
  Report: new CustomIcon({ iconUrl: reportImage }),
  Hazard: HazardIcon,
  Evacuation: new CustomIcon({ iconUrl: evacuationImage }),
  Relief: new CustomIcon({ iconUrl: reliefImage }),
}