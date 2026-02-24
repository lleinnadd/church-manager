(() => {
  try {
    const storedMode = localStorage.getItem('color-mode');
    const mode =
      storedMode === 'light' || storedMode === 'dark' || storedMode === 'system'
        ? storedMode
        : 'system';
    const shouldUseDark =
      mode === 'dark' ||
      (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    document.documentElement.classList.toggle('dark', shouldUseDark);
  } catch {}
})();
