const express = require('express')
const router = express.Router()
const auth = require('../middleware/auth')
const { formatReceipt, formatReceiptJSON, formatReceiptPDF } = require('../utils/receiptFormatter')

// Format receipt for printing
router.post('/format', auth, async (req, res) => {
  try {
    const { sale, scopeType, scopeId } = req.body

    if (!sale) {
      return res.status(400).json({ error: 'Sale data is required' })
    }

    // Get scope details (branch or warehouse)
    let scopeDetails = {}
    if (scopeType === 'BRANCH') {
      const Branch = require('../models/Branch')
      const branch = await Branch.findById(scopeId)
      scopeDetails = {
        name: branch?.name || 'Branch',
        location: branch?.address || '',
        contact: branch?.phone || ''
      }
    } else if (scopeType === 'WAREHOUSE') {
      const Warehouse = require('../models/Warehouse')
      const warehouse = await Warehouse.findById(scopeId)
      scopeDetails = {
        name: warehouse?.name || 'Warehouse',
        location: warehouse?.address || '',
        contact: warehouse?.phone || ''
      }
    }

    // Format receipt as ESC/POS text
    const receiptText = await formatReceipt(sale, scopeDetails, scopeType)

    res.setHeader('Content-Type', 'text/plain')
    res.send(receiptText)
  } catch (error) {
    res.status(500).json({ error: 'Failed to format receipt' })
  }
})

// Format receipt as JSON
router.post('/format/json', auth, async (req, res) => {
  try {
    const { sale, scopeType, scopeId } = req.body

    if (!sale) {
      return res.status(400).json({ error: 'Sale data is required' })
    }

    // Get scope details
    let scopeDetails = {}
    if (scopeType === 'BRANCH') {
      const Branch = require('../models/Branch')
      const branch = await Branch.findById(scopeId)
      scopeDetails = {
        name: branch?.name || 'Branch',
        location: branch?.address || '',
        contact: branch?.phone || ''
      }
    } else if (scopeType === 'WAREHOUSE') {
      const Warehouse = require('../models/Warehouse')
      const warehouse = await Warehouse.findById(scopeId)
      scopeDetails = {
        name: warehouse?.name || 'Warehouse',
        location: warehouse?.address || '',
        contact: warehouse?.phone || ''
      }
    }

    const receiptJSON = await formatReceiptJSON(sale, scopeDetails, scopeType)
    res.json(JSON.parse(receiptJSON))
  } catch (error) {
    res.status(500).json({ error: 'Failed to format receipt JSON' })
  }
})

// Format receipt as PDF/HTML
router.post('/format/pdf', auth, async (req, res) => {
  try {
    const { sale, scopeType, scopeId } = req.body

    if (!sale) {
      return res.status(400).json({ error: 'Sale data is required' })
    }

    // Get scope details
    let scopeDetails = {}
    if (scopeType === 'BRANCH') {
      const Branch = require('../models/Branch')
      const branch = await Branch.findById(scopeId)
      scopeDetails = {
        name: branch?.name || 'Branch',
        location: branch?.address || '',
        contact: branch?.phone || ''
      }
    } else if (scopeType === 'WAREHOUSE') {
      const Warehouse = require('../models/Warehouse')
      const warehouse = await Warehouse.findById(scopeId)
      scopeDetails = {
        name: warehouse?.name || 'Warehouse',
        location: warehouse?.address || '',
        contact: warehouse?.phone || ''
      }
    }

    const receiptHTML = await formatReceiptPDF(sale, scopeDetails, scopeType)
    res.setHeader('Content-Type', 'text/html')
    res.send(receiptHTML)
  } catch (error) {
    res.status(500).json({ error: 'Failed to format receipt PDF' })
  }
})

module.exports = router





