import { lazy } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ProfessionalStarMap from '../components/ProfessionalStarMap'
import { majorRoutes } from '../data/majorRoutes'
import { domains } from '../data/learning'
import './learning.css'

const InterestRoute = lazy(() => import('./Learning').then(module => ({ default: module.InterestRoute })))

export default function Explore() {
  const { domainId } = useParams()
  if (domainId && !majorRoutes.some(route => route.id === domainId)) {
    return <InterestRoute domainId={domainId} />
  }
  return (
    <div className="learn-screen" data-view="map">
      <ProfessionalStarMap routeId={domainId} />
      <details className="interest-routes">
        <summary>按兴趣探索 <span>{domains.length} 个方向</span></summary>
        <div>{domains.map(domain => <Link key={domain.id} to={`/explore/${domain.id}`}>
          {domain.shortTitle}<ArrowUpRight size={15} aria-hidden="true" />
        </Link>)}</div>
      </details>
    </div>
  )
}
