// Source-backed directory entries. These are reference information, not live alerts.
export const officialContacts = [
  {
    name: 'Bago Aplaya barangay public number',
    number: '298-2745',
    note: 'Listed in the Davao City barangay directory (2025). Call to confirm current office hours and services.',
    sourceUrl: 'https://www.davaocity.gov.ph/wp-content/uploads/2025/02/Updated-Barangay-Directory.pdf',
  },
  {
    name: 'Davao City Central 911',
    number: '911',
    note: 'City-listed number for medical emergencies.',
    sourceUrl: 'https://onlineservices.davaocity.gov.ph/page/235/?post_type=job_listing',
  },
  {
    name: 'City disaster operations center',
    number: '0927 604 5797',
    note: 'Globe calls and texts. The city also lists 0919 071 1111 for Smart.',
    sourceUrl: 'https://onlineservices.davaocity.gov.ph/page/235/?post_type=job_listing',
  },
  {
    name: 'Bureau of Fire Protection',
    number: '(082) 221 6658',
    note: 'Telephone listed by Davao City.',
    sourceUrl: 'https://onlineservices.davaocity.gov.ph/page/235/?post_type=job_listing',
  },
  {
    name: 'Davao City Water District',
    number: '244-6767',
    note: '24/7 call center for leaks and water quality concerns; check DCWD for current interruption notices.',
    sourceUrl: 'https://web.davao-water.gov.ph/assets/images/services/DCWD%20Electronic%20Billing%20Service%20Enrollment%20Form.pdf',
  },
]

export const officialServices = [
  {
    name: 'Davao City Health Office',
    description: 'City health services include consultations, immunization, prenatal care, dental care, and referrals. The city office is on Magallanes Street; ask which service is available nearest Bago Aplaya.',
    hours: '8:00 AM–5:00 PM (city page; confirm before visiting)',
    contact: '0926 686 1531 / 0999 938 0540',
    sourceUrl: 'https://davaocity.gov.ph/departments/social-services/city-health-office/',
    kind: 'health-social',
  },
  {
    name: 'City Social Welfare and Development Office',
    description: 'City programs include family, child, elderly, disability, and emergency assistance. Confirm requirements and district access with the office.',
    hours: '8:00 AM–5:00 PM (city page; confirm before visiting)',
    contact: '(082) 227-1617',
    sourceUrl: 'https://davaocity.gov.ph/departments/social-services/city-social-services-development-office/',
    kind: 'health-social',
  },
  {
    name: 'Davao City disaster office',
    description: 'Coordinates disaster response. City office in the Central 911 Compound, Sandawa, Matina.',
    hours: '8:00 AM–5:00 PM (city page; confirm before visiting)',
    contact: '082-295-2387',
    sourceUrl: 'https://davaocity.gov.ph/departments/social-services/cmo-disaster-council/',
  },
  {
    name: 'Davao City Reports',
    description: 'Official city portal for local concerns, including waste and traffic.',
    contact: '0917 131 2333',
    sourceUrl: 'https://onlineservices.davaocity.gov.ph/page/235/?post_type=job_listing',
    actionUrl: 'https://reports.davaocity.gov.ph/',
  },
]
