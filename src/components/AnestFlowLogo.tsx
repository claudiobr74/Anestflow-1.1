import React from "react";

interface AnestFlowLogoProps {
  className?: string;
  showText?: boolean;
  height?: number | string;
}

export default function AnestFlowLogo({ className = "", height = 36 }: AnestFlowLogoProps) {
  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      {/* 
        O usuário solicitou o uso do arquivo original da logo. 
        Certifique-se de que o arquivo "logo.png" (ou o nome correto) 
        esteja na pasta "public" do projeto.
      */}
      <img 
        src="/logo.png" 
        alt="AnestFlow Logo" 
        style={{ height }} 
        className="w-auto object-contain"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

