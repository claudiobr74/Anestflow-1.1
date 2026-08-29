const fs = require('fs');

let content = fs.readFileSync('src/components/IntraoperativeTab.tsx', 'utf8');

// Ensure HandHelping is imported
if (!content.includes('HandHelping')) {
  content = content.replace('import { Syringe,', 'import { Syringe, HandHelping,');
}

// 1. In CLINICAL_TABS
// Support: <Wind -> <HandHelping
content = content.replace(
  '{ id: "support", label: "Suporte", icon: <Wind className="w-4 h-4" /> }',
  '{ id: "support", label: "Suporte", icon: <HandHelping className="w-4 h-4" /> }'
);

// Gases: <FlaskConical -> <Wind
content = content.replace(
  '{ id: "gases", label: "Gases", icon: <FlaskConical className="w-4 h-4" /> }',
  '{ id: "gases", label: "Gases", icon: <Wind className="w-4 h-4" /> }'
);

// 2. In renderSupport
content = content.replace(
  "renderCollapsedSquare('support', <Sliders className=\"w-6 h-6\" />",
  "renderCollapsedSquare('support', <HandHelping className=\"w-6 h-6\" />"
);

content = content.replace(
  "<Sliders className={`w-5 h-5 ${isDark ? \"text-teal-400\" : \"text-teal-600\"}`} />",
  "<HandHelping className={`w-5 h-5 ${isDark ? \"text-teal-400\" : \"text-teal-600\"}`} />"
);

fs.writeFileSync('src/components/IntraoperativeTab.tsx', content, 'utf8');
