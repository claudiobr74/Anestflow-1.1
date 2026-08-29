import fs from 'fs';
let code = fs.readFileSync('src/components/IntraoperativeTab.tsx', 'utf8');

const hookCode = `  useEffect(() => {
    const handleExpandPanel = (e) => {
      const panelId = e.detail;
      setManuallyExpanded(prev => {
        if (!prev[panelId]) {
           return { ...prev, [panelId]: true };
        }
        return prev;
      });
    };
    window.addEventListener('expandPanel', handleExpandPanel);
    return () => window.removeEventListener('expandPanel', handleExpandPanel);
  }, []);`;

code = code.replace('  // States for editing drug summary lists and continuous infusions', hookCode + '\n\n  // States for editing drug summary lists and continuous infusions');

fs.writeFileSync('src/components/IntraoperativeTab.tsx', code);
