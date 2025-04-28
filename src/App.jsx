import { Routes, Route } from 'react-router-dom';
import Home from './User/Home';
import Login from './User/Login';
import Register from './User/Register';
import Dashboard from './User/Dashboard';
import PrivateRoute from './routes/PrivateRoute'; //
import MyCanvas from './figma/MyEditor';
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
      <Route path="/room/:roomName" element={<MyCanvas />} />
    </Routes>
  );
}

export default App;