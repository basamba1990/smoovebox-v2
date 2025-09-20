import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import './index.css';
import App from './App.jsx';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <SessionContextProvider supabaseClient={supabase}>
        <App />
      </SessionContextProvider>
    </BrowserRouter>
  </StrictMode>
);
