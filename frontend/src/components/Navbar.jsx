import { Link } from 'react-router-dom'

function Navbar() {
  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        MH Poster Generator
      </Link>
    </nav>
  )
}

export default Navbar