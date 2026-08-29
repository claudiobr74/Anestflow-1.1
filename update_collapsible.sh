#!/bin/bash

# We will use awk to apply the changes
awk '
BEGIN { skip = 0; }
/<div className=\"flex items-center gap-2 mb-1\">/ {
  print;
  print "                    <button";
  print "                      onClick={() => setIsDrugListExpanded(!isDrugListExpanded)}";
  print "                      className={`flex items-center gap-2 hover:opacity-80 transition-opacity`}";
  print "                      title=\"Trocar Fármaco (Abrir lista)\"";
  print "                    >";
  print "                      <h4 className={`text-xl font-black tracking-tight ${isDark ? \"text-zinc-100\" : \"text-slate-800\"}`}>";
  print "                        {selectedDrug.name}";
  print "                      </h4>";
  print "                      {isDrugListExpanded ? <ChevronUp className=\"w-5 h-5 text-rose-500\" /> : <ChevronDown className=\"w-5 h-5 text-rose-500\" />}";
  print "                    </button>";
  skip = 1;
  next;
}
/<h4 className={`text-xl font-black tracking-tight \${isDark \? \"text-zinc-100\" : \"text-slate-800\"}`}>/ && skip == 1 { next; }
/{selectedDrug.name}/ && skip == 1 { next; }
/<\/h4>/ && skip == 1 { skip = 0; next; }

/{\/\* Search & Filters \*\/}/ {
  print "            {isDrugListExpanded && (";
  print "              <div className=\"space-y-3 animate-in fade-in slide-in-from-top-2 duration-200 mt-2 border-t pt-4 ${isDark ? \\\"border-zinc-800\\\" : \\\"border-slate-100\\\"}\">";
  print $0;
  next;
}

/onClick={() => {/ {
  if (in_drug_btn == 1) {
    print $0;
    print "                          setIsDrugListExpanded(false);";
    next;
  }
}
/<button/ {
  if (in_grid == 1) {
    in_drug_btn = 1;
  }
  print $0;
  next;
}
/<\/button>/ {
  in_drug_btn = 0;
  print $0;
  next;
}

/{\/\* Grid of Drugs \*\/}/ {
  in_grid = 1;
  print $0;
  next;
}

/<\/div>/ {
  if (in_grid == 1 && match($0, /^            <\/div>/)) {
    # We are matching the closing div of the grid section, which is followed by </div> for the outer block.
    # Wait, lets just match the exact lines
  }
}

{ print $0; }
' src/components/IntraoperativeTab.tsx > tmp.tsx
