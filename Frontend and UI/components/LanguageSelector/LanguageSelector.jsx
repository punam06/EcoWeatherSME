const { useState, useEffect, useRef } = React;

function LanguageSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState('en');
  const [supportedLangs, setSupportedLangs] = useState({});
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (window.EcoLang) {
      setCurrentLang(window.EcoLang.getCurrentLanguage());
      setSupportedLangs(window.EcoLang.getSupportedLanguages());
      
      const unsubscribe = window.EcoLang.onLanguageChange((newLang) => {
        setCurrentLang(newLang);
        showToast(`Language updated to ${window.EcoLang.getSupportedLanguages()[newLang] || newLang}`);
      });
      return unsubscribe;
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (code) => {
    if (window.EcoLang) {
      window.EcoLang.setLanguage(code);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-green-700 hover:bg-green-600 rounded-md shadow-sm transition-colors"
      >
        <span className="material-icons text-[18px]">language</span>
        <span className="uppercase">{currentLang}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-[#112211] ring-1 ring-black ring-opacity-5 z-50 overflow-hidden border border-green-800/50">
          <div className="py-1 max-h-60 overflow-y-auto custom-scrollbar">
            {Object.entries(supportedLangs).map(([code, name]) => (
              <button
                key={code}
                onClick={() => handleSelect(code)}
                className={`block w-full text-left px-4 py-2 text-sm transition-colors ${
                  currentLang === code 
                    ? 'bg-green-800 text-white font-bold' 
                    : 'text-gray-300 hover:bg-green-900/50 hover:text-white'
                }`}
              >
                <span className="inline-block w-8 text-gray-500 uppercase text-xs">{code}</span>
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

window.LanguageSelector = LanguageSelector;
