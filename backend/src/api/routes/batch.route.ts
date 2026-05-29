import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';

const router = Router();

// POST /api/batches/certify
router.post('/certify', async (req: Request, res: Response) => {
  try {
    const { batchId } = req.body;
    
    // Generate actual batch ID if none provided
    const displayBatchId = batchId || `BCH-${Date.now().toString().slice(-6)}`;
    
    // Create the public verification URL
    const verificationUrl = `https://ecosortha.build/verify/${displayBatchId}`;
    
    // Generate QR code data URL (Base64 image) securely on the backend
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    // In a real implementation you would also save this URL/status in Supabase here:
    // await supabase.from('batches').update({ qr_code_url: verificationUrl, status: 'CERTIFIED' }).eq('id', batchId);
    
    res.json({
      success: true,
      data: {
        batchId: displayBatchId,
        verificationUrl,
        qrCodeDataUrl,
        certifiedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('QR Generation Error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate cryptographic QR code' });
  }
});

export default router;