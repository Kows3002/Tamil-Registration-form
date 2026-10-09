import { useEffect, useState } from 'react'
import { api } from './api'
import directory from '../../backend/src/config/communities.json'

const communityDirectory = directory.map(([tamil, english], index) => ({
  tamil, name: `${english} Community`, number: index + 1,
  slug: `${english.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '').slice(0, 50)}-community`,
}))

export default function CommunitySelector({ slug, onSelect, disabled }) {
  const [available, setAvailable] = useState(null)
  useEffect(() => {
    const controller = new AbortController()
    api('/communities/public', { signal: controller.signal }).then(setAvailable).catch(() => {})
    return () => controller.abort()
  }, [])
  const choices = [...communityDirectory, ...(available || []).filter(item => !communityDirectory.some(entry => entry.slug === item.slug))]
  if (!choices.some(item => item.slug === slug)) choices.push({ slug, name: slug === 'krishnan-community' ? 'Krishnan Community' : slug.replaceAll('-', ' ') })
  const selected = choices.find(item => item.slug === slug)
  return <section className="community-picker" aria-label="Community selection">
    <div className="community-picker-title"><small>COMMUNITY / சமூகம்</small><strong aria-live="polite">{selected.name}</strong><span>Family information register</span></div>
    <div className="community-picker-controls">
      <label htmlFor="public-community">Select community<select id="public-community" value={slug} disabled={disabled} onChange={event => onSelect(event.target.value)}>
        {choices.map(item => <option key={item.slug} value={item.slug} disabled={available !== null && !available.some(entry => entry.slug === item.slug)}>{item.number ? `${item.number}. ` : ''}{item.tamil ? `${item.tamil} — ` : ''}{item.name.replace(/ Community$/, '')}{available !== null && !available.some(entry => entry.slug === item.slug) ? ' (unavailable)' : ''}</option>)}
      </select></label>
    </div>
  </section>
}
