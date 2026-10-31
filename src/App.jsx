import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Simulation from './pages/Simulation';
import Dashboard from './pages/Dashboard';
import CaseDetail from './pages/CaseDetail';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-bggray">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Simulation />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/case/:id" element={<CaseDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}