import re

with open("src/components/IntraoperativeTab.tsx", "r") as f:
    content = f.read()

start_marker = "{/* CONTINUOUS INFUSION PUMPS CONTROL (NÍVEL 1) */}"
end_marker = "{/* GASES MEDICINAIS E ANESTÉSICOS INALATÓRIOS CONTROL (NÍVEL 1) */}"

if start_marker in content and end_marker in content:
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker)
    
    replacement = """{/* CONTINUOUS INFUSION PUMPS CONTROL (NÍVEL 1) */}
        <ContinuousInfusionsPanel 
          isDark={isDark}
          borderClass={borderClass}
          cardClass={cardClass}
          continuousInfusions={continuousInfusions}
          newInfusion={newInfusion}
          setNewInfusion={setNewInfusion}
          handleStartInfusion={handleStartInfusion}
          handleUpdateInfusionStatus={handleUpdateInfusionStatus}
          handleRemoveInfusion={handleRemoveInfusion}
          patientWeight={document.patient.weight}
        />

        """
    new_content = content[:start_idx] + replacement + content[end_idx:]
    with open("src/components/IntraoperativeTab.tsx", "w") as f:
        f.write(new_content)
    print("Patched successfully.")
else:
    print("Markers not found.")

