#!/bin/bash

# We will use awk to extract the <IntraoperativeDrugsPanel ... /> block and create renderDrugs function

sed -i 's/const isGasesExpanded = expandedMainPanels\['\''gases'\''\] ?? false;//' src/components/IntraoperativeTab.tsx
