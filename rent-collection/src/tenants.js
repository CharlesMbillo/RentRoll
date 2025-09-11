import { supabase } from './supabaseClient';

export async function getTenants() {
  return supabase.from('tenants').select('*');
}

export async function addTenant(tenant) {
  return supabase.from('tenants').insert([tenant]);
}

export async function updateTenant(id, updates) {
  return supabase.from('tenants').update(updates).eq('id', id);
}

export async function deleteTenant(id) {
  return supabase.from('tenants').delete().eq('id', id);
}
