import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getMonster, getMonsterImageUrl } from '../services/api'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

function MonsterDetail() {
  const { name }                    = useParams()
  const navigate                    = useNavigate()
  const [monster,    setMonster]    = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [game,       setGame]       = useState('')
  const [format,     setFormat]     = useState('png')
  const [generating, setGenerating] = useState(false)
  const [genError,   setGenError]   = useState(null)

  useEffect(() => {
    getMonster(decodeURIComponent(name))
      .then(setMonster)
      .catch(() => setError('Monstruo no encontrado'))
      .finally(() => setLoading(false))
  }, [name])

  const handleGenerate = async () => {
    setGenerating(true)
    setGenError(null)

    try {
      const response = await axios.post(
        `${API_BASE}/posters/generate`,
        { monster: decodeURIComponent(name), game: game || null, format },
        { responseType: 'blob', timeout: 60000 }  // 60s — el script puede tardar
      )

      // Crear URL temporal del blob y lanzar descarga automática
      const url      = URL.createObjectURL(response.data)
      const link     = document.createElement('a')
      const safeName = decodeURIComponent(name).toLowerCase().replace(/\s+/g, '_').replace(/'/g, '')
      const gameTag  = game ? `_${game.toLowerCase().replace(/\s+/g, '_')}` : ''
      link.href      = url
      link.download  = `${safeName}${gameTag}.${format}`
      link.click()

      // Liberar memoria
      setTimeout(() => URL.revokeObjectURL(url), 5000)

    } catch (err) {
      setGenError(
        err.response?.data?.error || 'Error al generar el póster. ¿Está corriendo la API?'
      )
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <div className="status">Cargando...</div>
  if (error)   return <div className="status error">{error}</div>

  return (
    <div className="monster-detail">
      <button className="back-btn" onClick={() => navigate(-1)}>← Volver</button>

      <div className="detail-layout">

        <div className="detail-image">
          <img
            src={getMonsterImageUrl(monster.name)}
            alt={monster.name}
            onError={e => { e.target.style.display = 'none' }}
          />
        </div>

        <div className="detail-info">
          <h1>{monster.name}</h1>
          <p className="detail-species">{monster.species}</p>

          {monster.elements?.length > 0 && (
            <p><strong>Elementos:</strong> {monster.elements.join(', ')}</p>
          )}
          {monster.weaknesses?.length > 0 && (
            <p><strong>Debilidades:</strong> {monster.weaknesses.join(', ')}</p>
          )}
          {monster.games?.length > 0 && (
            <p><strong>Aparece en:</strong> {monster.games.join(', ')}</p>
          )}

          <div className="poster-form">
            <h2>Generar póster</h2>

            <label>Juego (opcional)</label>
            <select value={game} onChange={e => setGame(e.target.value)}>
              <option value="">Sin juego</option>
              {monster.games?.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>

            <label>Formato</label>
            <div className="format-selector">
              {['png', 'pdf'].map(f => (
                <button
                  key={f}
                  className={format === f ? 'active' : ''}
                  onClick={() => setFormat(f)}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>

            {genError && <p className="gen-error">{genError}</p>}

            <button
              className="generate-btn"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? '⏳ Generando...' : '🎨 Generar póster'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MonsterDetail