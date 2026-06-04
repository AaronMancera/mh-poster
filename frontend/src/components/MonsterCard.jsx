import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMonsterImageUrl, preloadImage } from '../services/api'

function MonsterCard({ monster }) {
  const navigate    = useNavigate()
  const fallbackUrl = getMonsterImageUrl('unknown_monster')
  const [src, setSrc] = useState(fallbackUrl)

  useEffect(() => {
    const realUrl = getMonsterImageUrl(monster.name)
    preloadImage(realUrl)
      .then(() => setSrc(realUrl))
      .catch(() => {})
  }, [monster.name])

  return (
    <div
      className="monster-card"
      onClick={() => navigate(`/monster/${encodeURIComponent(monster.name)}`)}
    >
      <div className="monster-card-image">
        <img src={src} alt={monster.name} loading="lazy" decoding="async" />
      </div>
      <div className="monster-card-info">
        <h3>{monster.name}</h3>
        <span className="monster-species">{monster.species}</span>
      </div>
    </div>
  )
}

export default MonsterCard