import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Simulation from './pages/Simulation';
import Dashboard from './pages/Dashboard';
import CaseDetail from './pages/CaseDetail';

export default function App() {
  return (
    <BrowserRouter>
      <div className="h-[100dvh] w-screen overflow-hidden flex flex-col bg-bggray text-slateText">
        <Navbar />
        <main className="flex-1 min-h-0 overflow-hidden relative">
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