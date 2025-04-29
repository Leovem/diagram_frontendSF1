import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

const DashboardAdmin = () => {
  return (
    <div className="flex flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 p-4">
        <Outlet /> {/* Aquí se renderizarán las subrutas */}
      </main>
    </div>
  );
};

export default DashboardAdmin;