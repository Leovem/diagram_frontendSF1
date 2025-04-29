import { Routes, Route } from 'react-router-dom';
import Home from './User/Home';
import Login from './User/Login';
import Register from './User/Register';
import Dashboard from './User/Dashboard';
import PrivateRoute from './routes/PrivateRoute'; //
import MyCanvas from './figma/MyEditor';
import ManageRoles from './Manage/ManageRoles';
import UserManagement from './Manage/UserManagement';
import AssignRole from './Manage/AssignRole';
import AdminDashboard from './Manage/AdminDashboard';
import DiagramViewer from './Diagram/DiagramViewer';
function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
         
        }
        
      />
      {/* Agrupar rutas admin con layout */}
      <Route element={<AdminDashboard />}>
        <Route path="/users" element={<UserManagement />} />
        <Route path="/Roles" element={<ManageRoles />} />
        <Route path="/assign_role" element={<AssignRole />} />
      </Route>
      <Route path="/room/:roomName" element={<MyCanvas />} />
    </Routes>
  );
}

export default App;