import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import Layout from './components/Layout';
// Public entry pages stay eager so the first paint (landing / login) is instant.
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';

// Authenticated pages are code-split: heavy deps (Recharts, @dnd-kit) load only
// when their route is visited, keeping the initial bundle small. The Suspense
// boundary lives in Layout so the sidebar stays put while a chunk loads.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Reminders = lazy(() => import('./pages/Reminders'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Companies = lazy(() => import('./pages/Companies'));
const Contacts = lazy(() => import('./pages/Contacts'));
const Documents = lazy(() => import('./pages/Documents'));
const Activity = lazy(() => import('./pages/Activity'));
const Analysis = lazy(() => import('./pages/Analysis'));
const CoverLetter = lazy(() => import('./pages/CoverLetter'));
const Applications = lazy(() => import('./pages/Applications'));
const Interviews = lazy(() => import('./pages/Interviews'));
const EditorDocument = lazy(() => import('./pages/EditorDocument'));
const Editor = lazy(() => import('./pages/Editor'));

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/welcome" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/reminders" element={<Reminders />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/cover-letter" element={<CoverLetter />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/interviews" element={<Interviews />} />
          <Route path="/editor" element={<Editor />} />
          <Route path="/editor/:id" element={<EditorDocument />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
