import { Navigate, Route, Routes } from 'react-router-dom';
import Game from './components/Game';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Game />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
