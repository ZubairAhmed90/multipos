const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');
const categoryController = require('../controllers/inventoryCategoryController');

const categoryValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Category name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE'])
    .withMessage('Status must be ACTIVE or INACTIVE')
];

// Everyone (authenticated) can list categories; only admin can manage
router.get('/', auth, categoryController.listCategories);
router.post('/', auth, requireAdmin, categoryValidation, categoryController.createCategory);
router.put('/:id', auth, requireAdmin, categoryValidation, categoryController.updateCategory);
router.delete('/:id', auth, requireAdmin, categoryController.deleteCategory);

module.exports = router;

