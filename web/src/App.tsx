import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, Wallet, Calendar, Users, Package, LogOut, Moon, Sun, PaperBag } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Caixa from './pages/Caixa';
import Calendario from './pages/Calendario';
import Clientes from './pages/Clientes';
import Estoque from './pages/Estoque';
import Produtos from './pages/Produtos';
import Login from './pages/Login';
import { useAuth } from './context/AuthContext';

const Sidebar = ({ onLogout, isDarkMode, onToggleTheme }: { onLogout: () => void, isDarkMode: boolean, onToggleTheme: () => void }) => (
  <aside className="sidebar">
    <div className="sidebar-header">
      <img src="/logo.png" alt="Bris" className="sidebar-logo logo-img" />
    </div>
    <nav className="nav-links" style={{ flex: 1 }}>
      <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
        <LayoutDashboard size={20} />
        Dashboard
      </NavLink>
      <NavLink to="/caixa" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Wallet size={20} />
        Caixa
      </NavLink>
      <NavLink to="/calendario" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Calendar size={20} />
        Calendário
      </NavLink>
      <NavLink to="/clientes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Users size={20} />
        Clientes
      </NavLink>
      <NavLink to="/estoque" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Package size={20} />
        Estoque
      </NavLink>
      <NavLink to="/produtos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <PaperBag size={20} />
        Produtos
      </NavLink>
    </nav>
    <div style={{ padding: '0 12px', marginTop: 'auto', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <button onClick={onToggleTheme} className="nav-item" style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)' }}>
        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        {isDarkMode ? 'Tema Claro' : 'Tema Escuro'}
      </button>
      <button onClick={onLogout} className="nav-item" style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--danger-color)' }}>
        <LogOut size={20} />
        Sair
      </button>
    </div>
  </aside>
  );

function App() {
  const { user, isLoading, signOut } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  if (isLoading) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}>Carregando...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Router>
      <div className="app-container">
        <Sidebar onLogout={signOut} isDarkMode={isDarkMode} onToggleTheme={() => setIsDarkMode(!isDarkMode)} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/caixa/*" element={<Caixa />} />
            <Route path="/calendario" element={<Calendario />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/estoque" element={<Estoque />} />
            <Route path="/produtos" element={<Produtos />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
