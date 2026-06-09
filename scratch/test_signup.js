require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: SUPABASE_URL or SUPABASE_ANON_KEY is missing in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSignUp() {
  console.log('Testing signup against:', supabaseUrl);
  const testEmail = `test_auth_user_${Date.now()}@gmail.com`;
  const testPassword = 'Password123!';

  const { data, error } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        name: 'Test User'
      }
    }
  });

  if (error) {
    console.error('\n❌ SIGNUP FAILED WITH ERROR:');
    console.error(JSON.stringify(error, null, 2));
  } else {
    console.log('\n✅ SIGNUP SUCCESSFUL!');
    console.log('User Data:', data.user);
  }
}

testSignUp();
