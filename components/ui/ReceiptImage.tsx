import React, { useEffect, useState } from 'react';
import { receiptsDb } from '../../storage/receiptsDb';
import { Icons } from './Icons';

interface ReceiptImageProps {
  receiptId?: string;
  receiptUrl?: string; // Legacy or Cloud URL
  className?: string;
  alt?: string;
}

export const ReceiptImage: React.FC<ReceiptImageProps> = ({ receiptId, receiptUrl, className, alt }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    
    const load = async () => {
      if (receiptUrl && !receiptUrl.startsWith('data:')) {
         if (active) setSrc(receiptUrl);
         return;
      }
      if (!receiptId) return;

      if (active) setLoading(true);
      try {
        const blob = await receiptsDb.getReceipt(receiptId);
        if (blob && active) {
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
        }
      } catch (e) {
        console.error("Failed to load receipt image", e);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => { 
        active = false;
        if (objectUrl) {
           URL.revokeObjectURL(objectUrl);
        }
    };
  }, [receiptId, receiptUrl]);

  if (loading) {
    return <div className={`${className} bg-slate-100 dark:bg-slate-800 flex items-center justify-center`}><Icons.Repeat className="animate-spin text-slate-400"/></div>;
  }

  if (!src) {
    return <div className={`${className} bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400`}><Icons.Image className="w-6 h-6"/></div>;
  }

  return <img src={src} className={className} alt={alt || "Comprovante"} loading="lazy" />;
};