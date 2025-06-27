// Simple JavaScript for WTTP test site
console.log("WTTP site loaded successfully!");

document.addEventListener('DOMContentLoaded', function() {
    const h1 = document.querySelector('h1');
    if (h1) {
        h1.style.animation = 'fadeIn 2s ease-in';
    }
});

// CSS animation will be added inline since we're testing uploads
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
`;
document.head.appendChild(style); 