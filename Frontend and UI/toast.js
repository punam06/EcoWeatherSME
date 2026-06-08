// toast.js
(function() {
  const containerId = 'clima-toast-container';

  function initContainer() {
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      Object.assign(container.style, {
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        zIndex: 999999
      });
      document.body.appendChild(container);
    }
    return container;
  }

  window.showToast = function(message, type = 'info', duration = 4000) {
    const container = initContainer();
    const toast = document.createElement('div');
    
    let bg = '#1E293B';
    let border = '#334155';
    let icon = 'ℹ️';

    if (type === 'success' || message.toLowerCase().includes('success')) {
      bg = 'rgba(6, 95, 70, 0.9)';
      border = '#10B981';
      icon = '✅';
    } else if (type === 'error' || message.toLowerCase().includes('fail') || message.toLowerCase().includes('error')) {
      bg = 'rgba(127, 29, 29, 0.9)';
      border = '#EF4444';
      icon = '❌';
    } else if (type === 'warning' || message.toLowerCase().includes('caution')) {
      bg = 'rgba(120, 53, 15, 0.9)';
      border = '#F59E0B';
      icon = '⚠️';
    }

    Object.assign(toast.style, {
      background: bg,
      backdropFilter: 'blur(8px)',
      border: `1px solid ${border}`,
      color: '#F8FAFC',
      padding: '12px 20px',
      borderRadius: '8px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
      fontFamily: '"Inter", sans-serif',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      minWidth: '280px',
      opacity: '0',
      transform: 'translateY(20px)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: 'pointer'
    });

    toast.innerHTML = `<span style="font-size: 18px">${icon}</span> <span>${message}</span>`;
    
    toast.onclick = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 300);
    };

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
      });
    });

    // Auto dismiss
    setTimeout(() => {
      if (document.body.contains(toast)) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => {
          if (document.body.contains(toast)) {
            toast.remove();
          }
        }, 300);
      }
    }, duration);
  };
})();
