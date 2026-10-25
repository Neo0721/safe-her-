import type { Metadata } from 'next'
import { SharedViewer } from './viewer'

export const metadata: Metadata = {
  title: 'Shared with you | SafeHer',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <SharedViewer token={token} />
}
