const res = await fetch('http://localhost/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'adminCarto', password: 'AdminCarto2026!Secure' })
});
const data = await res.json();
console.log('STATUS:', res.status);
console.log('RESPONSE:', data);
