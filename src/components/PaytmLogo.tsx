import React from 'react';

interface PaytmLogoProps {
  className?: string;
  isInsideDarkBg?: boolean;
}

export const PaytmLogo: React.FC<PaytmLogoProps> = ({ className = 'h-5 w-5', isInsideDarkBg = false }) => {
  return (
    <div 
      className={`relative aspect-square rounded-[22%] overflow-hidden flex items-center justify-center select-none ${
        isInsideDarkBg ? 'border border-slate-700/50' : 'border border-slate-200/80'
      } ${className}`}
      style={{
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* Split background */}
      <div className="absolute top-0 left-0 right-0 h-[50%] bg-[#00baf2]" />
      <div className="absolute bottom-0 left-0 right-0 h-[50%] bg-[#002e7e]" />
      
      {/* White circle containing the Paytm wordmark */}
      <div className="absolute w-[76%] h-[76%] rounded-full bg-white flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.1),_inset_0_1px_1px_rgba(255,255,255,1)]">
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/e/e1/Paytm_Logo.svg"
          alt="Paytm"
          className="w-[84%] h-[84%] object-contain"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
};
