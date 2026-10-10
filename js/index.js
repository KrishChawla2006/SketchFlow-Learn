// Offer to resume if a board was already saved in this browser
try {
  if (localStorage.getItem('whiteboard-project-v1')) {
    document.getElementById('resume').style.display = 'inline-flex';
    document.getElementById('start').textContent = 'Start a new board \u2192';
    document.getElementById('start').addEventListener('click', e => {
      e.preventDefault();
      if (confirm('Start a new board? Your saved board stays until you draw something new.')) {
        location.href = 'whiteboard.html?new=1';
      }
    });
  }
} catch (err) {}
