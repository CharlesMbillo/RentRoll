import React, { useEffect, useState } from 'react';
import { getTenants, addTenant, updateTenant, deleteTenant } from './tenants';
import { signUp, signIn, signOut } from './auth';

function App() {
  const [tenants, setTenants] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newTenant, setNewTenant] = useState({ name: '', room: '' });

  useEffect(() => {
    getTenants().then(({ data }) => setTenants(data || []));
  }, []);

  const handleSignUp = async () => {
    await signUp(email, password);
  };

  const handleSignIn = async () => {
    await signIn(email, password);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleAddTenant = async () => {
    await addTenant(newTenant);
    const { data } = await getTenants();
    setTenants(data || []);
  };

  return (
    <div>
      <h1>Rent Collection - Supabase Demo</h1>
      <div>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
        <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password" />
        <button onClick={handleSignUp}>Sign Up</button>
        <button onClick={handleSignIn}>Sign In</button>
        <button onClick={handleSignOut}>Sign Out</button>
      </div>
      <div>
        <h2>Tenants</h2>
        <ul>
          {tenants.map(t => (
            <li key={t.id}>{t.name} - Room {t.room}</li>
          ))}
        </ul>
        <input value={newTenant.name} onChange={e => setNewTenant({ ...newTenant, name: e.target.value })} placeholder="Tenant Name" />
        <input value={newTenant.room} onChange={e => setNewTenant({ ...newTenant, room: e.target.value })} placeholder="Room" />
        <button onClick={handleAddTenant}>Add Tenant</button>
      </div>
    </div>
  );
}

export default App;
