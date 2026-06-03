import { useState, useEffect } from 'react'
import { getMonsters } from '../services/api'
import MonsterCard from '../components/MonsterCard'

function Home() {
  const [monsters, setMonsters] = useState([])
  const [filtered, setFiltered] = useState([])
  const [search,   setSearch]   = useState('')
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    getMonsters()
      .then(data => {
        setMonsters(data.monsters)
        setFiltered(data.monsters)
      })
      .catch(() => setError('No se puede conectar con la API. ¿Está corriendo el servidor?'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(
      monsters.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.species?.toLowerCase().includes(q)
      )
    )
  }, [search, monsters])

  if (loading) return <div className="status">Cargando monstruos...</div>
  if (error)   return <div className="status error">{error}</div>

  return (
    <div className="home">
      <div className="search-bar">
        <input
          type="text"
          placeholder="Buscar monstruo o especie..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="results-count">{filtered.length} monstruos</span>
      </div>
      <div className="monster-grid">
        {filtered.map(monster => (
          <MonsterCard key={monster.name} monster={monster} />
        ))}
      </div>
    </div>
  )
}

export default Home