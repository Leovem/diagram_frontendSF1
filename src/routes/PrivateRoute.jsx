import { Navigate } from 'react-router-dom';
import  jwt_decode  from 'jwt-decode';

const PrivateRoute = ({ children,allowedRoles }) => {
  const token = localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  try {
    // Decodificar el token
    const decoded = jwt_decode(token);
    console.log(decoded);
    //Opcional: Verificar si el rol está permitido
    if (allowedRoles && !allowedRoles.includes(decoded.role)) {
      // Si el rol del usuario no está en los roles permitidos, redirigir
      return <Navigate to="/dashboard" replace />;
    }

    return children; // Todo bien, muestra la ruta protegida
  } catch (error) {
    console.error('Error al decodificar el token', error);
    return <Navigate to="/login" replace />;
  }
};


// import { Navigate } from 'react-router-dom';

// const PrivateRoute = ({ children }) => {
//   const token = localStorage.getItem('token');

//   // Si no hay token, redirige al login
//   if (!token) {
//     return <Navigate to="/login" replace />;
//   }

//   return children; // Si hay token, muestra la ruta protegida
// };

// export default PrivateRoute;

export default PrivateRoute;