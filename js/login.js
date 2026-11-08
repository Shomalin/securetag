import { login, register } from './store.js';
import { $, showBanner } from './ui.js';

let creatingAccount = false;

// Switch between "Log in" and "Create account"
$('switch').onclick = event => {
  event.preventDefault();
  creatingAccount = !creatingAccount;

  $('title').textContent  = creatingAccount ? 'Create account' : 'Log in';
  $('submit').textContent = creatingAccount ? 'Create account' : 'Log in';
  $('switch').textContent = creatingAccount ? 'Have an account? Log in' : 'New here? Create an account';
  $('name').hidden = $('nameLabel').hidden = !creatingAccount;
};

$('submit').onclick = async () => {
  const email = $('email').value.trim();
  const password = $('password').value;

  try {
    if (creatingAccount) await register($('name').value.trim(), email, password);
    else await login(email, password);
    location.href = 'dashboard.html';
  } catch (error) {
    showBanner($('error'), error.message);
  }
};
