import { useNavigate } from 'react-router-dom'
import { getMonsterImageUrl } from '../services/api'

function MonsterCard({ monster }) {
  const navigate  = useNavigate()
  const imageUrl  = getMonsterImageUrl(monster.name)

  return (
    <div
      className="monster-card"
      onClick={() => navigate(`/monster/${encodeURIComponent(monster.name)}`)}
    >
      <div className="monster-card-image">
        <img
          src={imageUrl}
          alt={monster.name}
          onError={e => { e.target.style.display = 'none' }}
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