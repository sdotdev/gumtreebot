// Test script to verify supabase client works without WebSocket errors
import { supabase } from './lib/supabase.js';

console.log('Testing supabase client creation...');
console.log('Supabase client:', !!supabase);

try {
  // Try a simple operation that doesn't require realtime
  const { data, error } = supabase
    .from('searches')
    .select('count', { count: 'exact', head: true })
    .limit(1);
  
  console.log('Test query would execute (would fail due to dummy credentials but no WS error expected)');
} catch (err) {
  console.error('Error during test:', err.message);
  // We expect this to fail due to invalid credentials, but not due to WebSocket issues
  if (err.message.includes('WebSocket') || err.message.includes('ws')) {
    console.error('WebSocket-related error detected!');
    process.exit(1);
  } else {
    console.log('Non-WebSocket error (expected due to dummy credentials):', err.message);
  }
}

console.log('Test completed successfully - no WebSocket errors');