import { Router } from 'express';
import multer from 'multer';
import { MedicineController } from '../controllers/medicine.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// Public medicine catalogue search
router.get('/', MedicineController.listMedicines);
router.get('/:id', MedicineController.getMedicineById);

// Admin-only management
router.post('/', authenticateToken, requireRole('admin'), MedicineController.createMedicine);
router.put('/:id', authenticateToken, requireRole('admin'), MedicineController.updateMedicine);
router.patch('/:id/status', authenticateToken, requireRole('admin'), MedicineController.toggleMedicineStatus);
router.post('/import-csv', authenticateToken, requireRole('admin'), upload.single('file'), MedicineController.importMedicinesCsv);

export default router;
