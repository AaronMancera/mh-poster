import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMonsterImageUrl } from '../services/api'

function MonsterCard({ monster }) {
  const navigate    = useNavigate()
  const imageUrl    = getMonsterImageUrl(monster.name)
  const fallbackUrl = getMonsterImageUrl('unknown_monster')
  const [src, setSrc] = useState(fallbackUrl)  // empieza con el fallback

  return (
    <div
      className="monster-card"
      onClick={() => navigate(`/monster/${encodeURIComponent(monster.name)}`)}
    >
      <div className="monster-card-image">
        <img
          src={src}
          alt={monster.name}
          loading="lazy"
          decoding="async"
          onLoad={() => {
            // Cuando el fallback termina de cargar, pide la imagen real
            if (src === fallbackUrl) setSrc(imageUrl)
          }}
          onError={() => {
            // Si la imagen real falla, vuelve al fallback sin bucle
            if (src !== fallbackUrl) setSrc(fallbackUrl)
          }}
        />
      </div>
      <div className="monster-card-info">
        <h3>{monster.name}</h3>
        <span className="monster-species">{monster.species}</span>
      </div>
    </div>
  )
}

export default MonsterCard