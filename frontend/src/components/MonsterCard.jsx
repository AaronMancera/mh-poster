import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMonsterImageUrl } from '../services/api'

function MonsterCard({ monster }) {
  const navigate    = useNavigate()
  const fallbackUrl = getMonsterImageUrl('unknown_monster')
  const [src, setSrc] = useState(fallbackUrl)

  useEffect(() => {
    const realUrl = getMonsterImageUrl(monster.name)
    const img     = new Image()

    img.onload  = () => setSrc(realUrl)   // solo cambia el src cuando ya está lista
    img.onerror = () => {}                // ya mostramos el fallback, no hacemos nada

    img.src = realUrl

    // Cleanup — evita que el callback dispare si el componente se desmonta
    return () => {
      img.onload  = null
      img.onerror = null
    }
  }, [monster.name])

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