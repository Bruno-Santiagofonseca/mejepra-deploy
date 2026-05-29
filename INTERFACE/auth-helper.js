(function() {
  var TOKEN_KEY = 'centro360_token';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(t) {
    if (t) { localStorage.setItem(TOKEN_KEY, t); }
    else { localStorage.removeItem(TOKEN_KEY); }
  }

  var path = window.location.pathname.replace(/\\/g, '/');
  var isLoginPage = path.endsWith('/login.html') || path.endsWith('/login');

  var token = getToken();
  if (!isLoginPage && !token) {
    window.location.replace('/login.html');
    return;
  }

  if (isLoginPage && token) {
    window.location.replace('/index.html');
    return;
  }

  if (!token) return;

  var origFetch = window.fetch;
  window.fetch = function(url, opts) {
    opts = opts || {};
    if (typeof url === 'string' && (url.startsWith('/api/') || url.startsWith('api/'))) {
      opts.headers = opts.headers || {};
      opts.headers['Authorization'] = 'Bearer ' + token;
    }
    return origFetch.call(this, url, opts);
  };
})();
