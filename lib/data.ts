// Static educational content only. No user, contact or location data lives here.
export type SafetyTip = {
  id: string
  title: string
  description: string
  category: string
  image: string
}

export const safetyTips: SafetyTip[] = [
  {
    id: 't1',
    title: 'Travel safely at night',
    description:
      'Plan your route in advance, stay on busy streets, and keep someone informed of your arrival time.',
    category: 'Travel',
    image: '/tip-night-travel.png',
  },
  {
    id: 't2',
    title: 'Share your trip',
    description:
      'Enable live location sharing with a trusted contact whenever you ride alone or take an unfamiliar route.',
    category: 'Tracking',
    image: '/tip-share-trip.png',
  },
  {
    id: 't3',
    title: 'Keep contacts updated',
    description:
      'Review your emergency contacts monthly so alerts always reach the people who can help fastest.',
    category: 'Preparation',
    image: '/tip-contacts.png',
  },
  {
    id: 't4',
    title: 'Stay in well-lit areas',
    description:
      'Choose well-lit, populated paths after dark and avoid shortcuts through isolated spaces.',
    category: 'Awareness',
    image: '/tip-well-lit.png',
  },
  {
    id: 't5',
    title: 'Enable GPS always',
    description:
      'Keep location services on so SafeHer can share accurate coordinates the moment an emergency begins.',
    category: 'Setup',
    image: '/tip-gps.png',
  },
]
