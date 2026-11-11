import { Router } from 'express';
import { sendATH, getWalletStats, lookupAddress, requestClaim, getClaimStatus } from '../controllers/wallet';
import { getVault, putVault, deleteVault, getVaultPepper } from '../controllers/walletVault';
import { auth } from '../middlewares/auth';
import { vaultRateLimit } from '../middlewares/rateLimit';

const router = Router();

// ─── Custodial AetherChain wallet ───────────────────────────────────────────
router.get('/stats', auth, getWalletStats);
router.post('/send', auth, sendATH);
router.post('/lookup', auth, lookupAddress);
router.post('/claim', auth, requestClaim);
router.get('/claim-status', auth, getClaimStatus);

// ─── Non-custodial Web3 vault (opaque ciphertext only) ──────────────────────
// Rate-limited because the pepper is what stops a stolen envelope from being
// brute-forced offline; an attacker who can pull peppers at will defeats that.
router.get('/vault/pepper', auth, vaultRateLimit, getVaultPepper);
router.get('/vault', auth, vaultRateLimit, getVault);
router.put('/vault', auth, vaultRateLimit, putVault);
router.delete('/vault', auth, vaultRateLimit, deleteVault);

export default router;
