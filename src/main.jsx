import React from 'react';
import { createRoot } from 'react-dom/client';
import '../tempPage/styles.css';

function App() {
  return <main className="workspace"><h1 className="page-title">Планировщик учебных задач</h1><p className="page-intro">Основа приложения готова.</p></main>;
}
createRoot(document.getElementById('root')).render(<App />);
