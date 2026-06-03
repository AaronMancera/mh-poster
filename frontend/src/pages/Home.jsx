import { useState, useEffect, useRef } from 'react'
import { getMonsters } from '../services/api'
import MonsterCard from '../components/MonsterCard'

const PAGE_SIZE = 20

function Home() {
  const [monsters, setMonsters] = useState([])
  const [search,   setSearch]   = useState('')
  const [offset,   setOffset]   = useState(0)
  const [hasMore,  setHasMore]  = useState(true)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const searchTimer = useRef(null)

  // Función de fetch directa — sin useCallback
  async function fetchPage(currentOffset, currentSearch, reset) {
    if (loading) return
    setLoading(true)
    try {
      const params = { limit: PAGE_SIZE, offset: currentOffset }
      if (currentSearch) params.search = currentSearch

      const data = await getMonsters(params)

      setMonsters(prev => reset ? data.monsters : [...prev, ...data.monsters])
      setHasMore(data.hasMore)
      setOffset(currentOffset + PAGE_SIZE)
    } catch {
      setError('No se puede conectar con la API. ¿Está corriendo el servidor?')
    } finally {
      setLoading(false)
    }
  }

  // Carga inicial
  useEffect(() => {
    fetchPage(0, '', true)
  }, [])

  // Buscador con debounce
  useEffect(() => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      fetchPage(0, search, true)
    }, 400)
    return () => clearTimeout(searchTimer.current)
  }, [search])

  if (error) return <div className="status error">{error}</div>

  return (
    <div className="home">
      <div className="search-section">
        <span className="search-title">Catálogo de monstruos</span>
        <div className="search-row">
          <div className="search-input-wrapper">
            <span className="search-icon">⚔</span>
            <input
              type="text"
              placeholder="Buscar por nombre o especie..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <span className="results-count">{monsters.length} cargados</span>
        </div>
      </div>
      <div className="divider" />

      <div className="monster-grid">
        {monsters.map(monster => (
          <MonsterCard key={monster.name} monster={monster} />
        ))}
        {monsters.length === 0 && !loading && (
          <p className="status">No se encontraron monstruos</p>
        )}
      </div>

      {loading && <p className="status">Cargando...</p>}

      {hasMore && !loading && (
        <div className="load-more-wrapper">
          <button
            className="load-more-btn"
            onClick={() => fetchPage(offset, search, false)}
          >
            Cargar más
          </button>
        </div>
      )}

      {!hasMore && monsters.length > 0 && (
        <p className="end-message">— {monsters.length} monstruos cargados —</p>
      )}
    </div>
  )
}

export default Home