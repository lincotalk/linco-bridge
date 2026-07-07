function safeUrlForLog(value) {
  try {
    const url = new URL(value);
    url.searchParams.delete('token');
    url.searchParams.delete('appSecret');
    return url.toString();
  } catch {
    return '(invalid url)';
  }
}

module.exports = {
  safeUrlForLog,
};
