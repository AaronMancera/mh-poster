import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import MonsterDetail from './pages/MonsterDetail'

function App() {
  return (
    <div className="app">
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/"                  element={<Home />} />
          <Route path="/monster/:name"     element={<MonsterDetail />} />
        </Routes>
      </main>
    </div>
  )
}

export default App