import React from "react";

interface AnestFlowLogoProps {
  className?: string;
  showText?: boolean;
  height?: number | string;
  imgClassName?: string;
}

export default function AnestFlowLogo({
  className = "",
  height = 36,
  imgClassName
}: AnestFlowLogoProps) {
  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      <img
        src="/logo.png"
        alt="AnestFlow"
        style={imgClassName ? undefined : { height }}
        className={`w-auto object-contain object-left ${imgClassName ?? ""}`}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
