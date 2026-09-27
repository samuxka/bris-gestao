import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, Wallet, Calendar, Users, Package, LogOut, Moon, Sun, PaperBag, Ticket, ChevronLeft, ChevronRight } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Caixa from './pages/Caixa';
import Calendario from './pages/Calendario';
import Clientes from './pages/Clientes';
import ClienteDetail from './pages/ClienteDetail';
import Estoque from './pages/Estoque';
import Produtos from './pages/Produtos';
import Cupons from './pages/Cupons';
import Login from './pages/Login';
import { useAuth } from './context/AuthContext';

const Sidebar = ({ onLogout, isDarkMode, onToggleTheme, isCollapsed, onToggleCollapse }: { onLogout: () => void, isDarkMode: boolean, onToggleTheme: () => void, isCollapsed: boolean, onToggleCollapse: () => void }) => (
  <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
    <div className="sidebar-header" style={{ position: 'relative' }}>
      {!isCollapsed && <img src="/logo.png" alt="Bris" className="sidebar-logo logo-img" />}
      <button 
        onClick={onToggleCollapse} 
        style={{
          position: 'absolute', right: '-12px', top: '50%', transform: 'translateY(-50%)',
          background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '50%',
          width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10
        }}
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </div>
    <nav className="nav-links" style={{ flex: 1 }}>
      <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
        <LayoutDashboard size={20} style={{ minWidth: '20px' }} />
        <span>Dashboard</span>
      </NavLink>
      <NavLink to="/caixa" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Wallet size={20} style={{ minWidth: '20px' }} />
        <span>Caixa</span>
      </NavLink>
      <NavLink to="/calendario" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Calendar size={20} style={{ minWidth: '20px' }} />
        <span>Calendário</span>
      </NavLink>
      <NavLink to="/clientes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Users size={20} style={{ minWidth: '20px' }} />
        <span>Clientes</span>
      </NavLink>
      <NavLink to="/estoque" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Package size={20} style={{ minWidth: '20px' }} />
        <span>Estoque</span>
      </NavLink>
      <NavLink to="/produtos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <PaperBag size={20} style={{ minWidth: '20px' }} />
        <span>Produtos</span>
      </NavLink>
      <NavLink to="/cupons" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Ticket size={20} style={{ minWidth: '20px' }} />
        <span>Cupons</span>
      </NavLink>
    </nav>
    <div style={{ padding: '0 12px', marginTop: 'auto', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <button onClick={onToggleTheme} className="nav-item" style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)' }} title={isDarkMode ? 'Tema Claro' : 'Tema Escuro'}>
        {isDarkMode ? <Sun size={20} style={{ minWidth: '20px' }} /> : <Moon size={20} style={{ minWidth: '20px' }} />}
        <span>{isDarkMode ? 'Tema Claro' : 'Tema Escuro'}</span>
      </button>
      <button onClick={onLogout} className="nav-item" style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--danger-color)' }} title="Sair">
        <LogOut size={20} style={{ minWidth: '20px' }} />
        <span>Sair</span>
      </button>
    </div>
  </aside>
);

function App() {
  const { user, isLoading, signOut } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    localStorage.setItem('sidebar_collapsed', newState.toString());
  };

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
        <Sidebar 
          onLogout={signOut} 
          isDarkMode={isDarkMode} 
          onToggleTheme={() => setIsDarkMode(!isDarkMode)} 
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/caixa/*" element={<Caixa />} />
            <Route path="/calendario" element={<Calendario />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/clientes/:id" element={<ClienteDetail />} />
            <Route path="/estoque" element={<Estoque />} />
            <Route path="/produtos" element={<Produtos />} />
            <Route path="/cupons" element={<Cupons />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
