import { login, register } from './store.js';
const $ = id => document.getElementById(id);
let signup = false;
$('swap').onclick = e => {
  e.preventDefault(); signup = !signup;
  $('title').textContent = signup ? 'Create account' : 'Log in';
  $('go').textContent = signup ? 'Create account' : 'Log in';
  $('swap').textContent = signup ? 'Have an account? Log in' : 'New here? Create an account';
  $('name').hidden = $('nl').hidden = !signup;
};
$('go').onclick = async () => {
  try {
    if (signup) await register($('name').value.trim(), $('email').value.trim(), $('pw').value);
    else await login($('email').value.trim(), $('pw').value);
    location.href = 'dashboard.html';
  } catch (e) { $('err').textContent = e.message; $('err').hidden = false; }
};
