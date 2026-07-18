const API = window.GEO_NARRATOR_CONFIG?.apiBase || '/api';
const state = { mode: 'login', token: localStorage.getItem('geoNarratorToken'), user: JSON.parse(localStorage.getItem('geoNarratorUser') || 'null') };
const $ = (id) => document.getElementById(id);

const placeThemes = {
  'india gate': { title: 'India Gate', subtitle: 'New Delhi, India' },
  'eiffel tower': { title: 'Eiffel Tower', subtitle: 'Paris, France' },
  'taj mahal': { title: 'Taj Mahal', subtitle: 'Agra, India' },
  'statue of liberty': { title: 'Statue of Liberty', subtitle: 'New York City, USA' },
  'colosseum': { title: 'Colosseum', subtitle: 'Rome, Italy' },
  'great wall': { title: 'Great Wall', subtitle: 'Beijing, China' },
  'machu picchu': { title: 'Machu Picchu', subtitle: 'Cusco, Peru' },
  'sydney opera house': { title: 'Sydney Opera House', subtitle: 'Sydney, Australia' },
};

function showDashboard() {
  $('authView').classList.add('hidden');
  $('dashboardView').classList.remove('hidden');
  $('welcomeName').textContent = state.user?.name || 'Explorer';
  updatePlaceVisual($('poiName').value);
}

function showAuth() {
  $('dashboardView').classList.add('hidden');
  $('authView').classList.remove('hidden');
}

function setMode() {
  const signup = state.mode === 'signup';
  $('authEyebrow').textContent = signup ? 'BEGIN YOUR WALK' : 'WELCOME BACK';
  $('authTitle').innerHTML = signup ? 'Start seeing<br />places differently.' : 'Continue your<br />walk.';
  $('authCopy').textContent = signup ? 'Create your guide, then let every landmark speak for itself.' : 'Sign in to pick up your personal audio guide wherever you left off.';
  $('authToggle').innerHTML = signup ? 'Already have an account? Sign in <span>→</span>' : 'New here? Create an account <span>→</span>';
}

function normalizePlaceName(value) {
  return String(value || '').trim().toLowerCase();
}

function formatPlaceTitle(placeName) {
  const normalized = String(placeName || '').trim().replace(/\s+/g, ' ');
  return normalized
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim() || 'Unknown place';
}

let placeImageTimer;

async function fetchPlaceImage(poiName) {
  if (!poiName || !poiName.trim()) return null;
  try {
    const data = await api('/image', { poiName: poiName.trim() });
    return data.imageUrl;
  } catch (error) {
    console.error('Place image fetch failed:', error.message);
    return null;
  }
}

function applyPlaceImage(imageUrl, placeTitle, placeSubtitle) {
  const heroImage = document.querySelector('.photo-panel img');
  const dashboardImage = document.querySelector('.place-card img');

  [heroImage, dashboardImage].forEach((img) => {
    if (img && imageUrl) {
      img.src = imageUrl;
      img.alt = `${placeTitle} in ${placeSubtitle}`;
    }
  });
}

function schedulePlaceImageUpdate(placeName, placeTitle, placeSubtitle) {
  clearTimeout(placeImageTimer);
  if (!placeName || !placeName.trim()) return;

  placeImageTimer = setTimeout(async () => {
    const imageUrl = await fetchPlaceImage(placeName);
    if (imageUrl) applyPlaceImage(imageUrl, placeTitle, placeSubtitle);
  }, 700);
}

function updatePlaceVisual(placeName = $('poiName').value) {
  const key = normalizePlaceName(placeName);
  const theme = placeThemes[key];
  const placeTitle = theme?.title || formatPlaceTitle(placeName);
  const placeSubtitle = theme?.subtitle || 'A place worth hearing about';

  const overlayHeading = document.querySelector('.place-overlay h2');
  const overlayText = document.querySelector('.place-overlay p');
  const authCaption = document.querySelector('.photo-caption span');
  const authText = document.querySelector('.photo-caption p');

  if (overlayHeading) overlayHeading.textContent = placeTitle;
  if (overlayText) overlayText.textContent = placeSubtitle;
  if (authCaption) authCaption.textContent = `01 — ${placeTitle.toUpperCase()}`;
  if (authText) authText.textContent = `Every place has a story worth hearing about ${placeTitle}.`;

  schedulePlaceImageUpdate(placeName, placeTitle, placeSubtitle);
}

async function googleResponse(response) {
  $('authStatus').textContent = 'Signing you in…';
  try {
    const res = await fetch(`${API}/auth/google`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: response.credential }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not sign in');
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('geoNarratorToken', data.token);
    localStorage.setItem('geoNarratorUser', JSON.stringify(data.user));
    showDashboard();
  } catch (error) {
    $('authStatus').textContent = error.message;
  }
}

function renderGoogleButton() {
  $('googleButton').replaceChildren();
  const clientId = window.GEO_NARRATOR_CONFIG?.googleClientId;
  if (!clientId) {
    $('authStatus').textContent = 'Add GOOGLE_CLIENT_ID to the backend .env to enable Google Sign-In.';
    return;
  }
  if (!window.google?.accounts?.id) return setTimeout(renderGoogleButton, 100);
  google.accounts.id.initialize({ client_id: clientId, callback: googleResponse });
  google.accounts.id.renderButton($('googleButton'), { theme: 'outline', size: 'large', width: 300, text: state.mode === 'signup' ? 'signup_with' : 'signin_with' });
}

async function api(path, body) {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.token}` }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function buildNarrationPayload() {
  return { poiName: $('poiName').value.trim(), voice: $('voice').value };
}

function buildAskPayload(question) {
  return { question: question.trim() };
}

async function submitAsk(questionText = $('question').value.trim()) {
  const question = questionText.trim();
  if (!question) return;

  const button = $('askButton');
  button.disabled = true;

  try {
    const data = await api('/ask', buildAskPayload(question));
    $('answerText').textContent = data.answer;
    $('answerCard').classList.remove('hidden');
    speechSynthesis?.speak(new SpeechSynthesisUtterance(data.answer));
  } catch (error) {
    $('answerText').textContent = error.message;
    $('answerCard').classList.remove('hidden');
  } finally {
    button.disabled = false;
  }
}

$('authToggle').addEventListener('click', () => { state.mode = state.mode === 'login' ? 'signup' : 'login'; $('authStatus').textContent = ''; setMode(); renderGoogleButton(); });
$('logoutButton').addEventListener('click', () => { localStorage.removeItem('geoNarratorToken'); localStorage.removeItem('geoNarratorUser'); state.token = null; state.user = null; showAuth(); });
$('poiName').addEventListener('input', () => updatePlaceVisual($('poiName').value));
$('narrateButton').addEventListener('click', async () => {
  const button = $('narrateButton');
  button.disabled = true;
  button.textContent = 'Creating your narration…';
  try {
    const data = await api('/narration', buildNarrationPayload());
    $('narrationText').textContent = data.narration;
    speechSynthesis?.speak(new SpeechSynthesisUtterance(data.narration));
  } catch (error) {
    $('narrationText').textContent = error.message;
  } finally {
    button.disabled = false;
    button.innerHTML = 'Generate narration <span>↗</span>';
  }
});
$('askButton').addEventListener('click', () => submitAsk());
$('micButton').addEventListener('click', () => {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    $('question').placeholder = 'Speech recognition is not supported in this browser.';
    return;
  }

  const recognition = new Recognition();
  recognition.lang = 'en-IN';
  recognition.interimResults = false;
  $('micButton').classList.add('listening');

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results).map((result) => result[0].transcript).join(' ').trim();
    if (transcript) {
      $('question').value = transcript;
      submitAsk(transcript);
    }
  };
  recognition.onend = () => $('micButton').classList.remove('listening');
  recognition.onerror = () => $('micButton').classList.remove('listening');
  recognition.start();
});

setMode();
state.token && state.user ? showDashboard() : (showAuth(), renderGoogleButton());
