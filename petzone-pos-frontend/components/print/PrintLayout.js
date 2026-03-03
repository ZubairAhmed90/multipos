'use client'

import React from 'react'
import Image from 'next/image'
import './PrintLayout.css'

function safeNumber(v) {
  return v == null || isNaN(Number(v)) ? 0 : Number(v)
}

function formatCurrency(v) {
  const n = safeNumber(v)
  try {
    // Always round to whole number (no decimals)
    const rounded = Math.round(n)
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(rounded)
  } catch (e) {
    return String(Math.round(n))
  }
}

export default function PrintLayout({
  type = 'receipt',
  title = 'RECEIPT',
  companyName = 'Petzone Store',
  companySlogan = '',
  companyAddress = '',
  companyPhone = '',
  companyEmail = '',
  logoUrl = '/petzonelogo.png',
  receiptNumber,
  date,
  time,
  cashierName,
  branchName = '',
  warehouseName = '',
  customerName = 'Walk-in Customer',
  customerPhone = '',
  customerAddress = '',
  customerCity = '',
  shippingName = '',
  shippingAddress = '',
  shippingCity = '',
  items = [],
  subtotal = 0,
  tax = 0,
  total = 0,
  paymentMethod = 'Cash',
  paymentAmount = 0,
  creditAmount = 0,
  remainingBalance = null,
  oldBalance = 0,
  outstandingCleared = 0,
  discount = 0,
  change = 0,
  shippingHandling = 0,
  notes = '',
  footerMessage = 'Thank you for your business!',
  showLogo = true,
  width = 300,
  layout = 'thermal',
  orientation = 'portrait',
  fontSize = '12px',
  invoiceTotal = null,
  paymentLabel = 'Payment',
  showSignature = false
}) {

  const [logoError, setLogoError] = React.useState(false)

  const effectiveLogoUrl = React.useMemo(() => {
    if (!logoUrl) return '/petzonelogo.png'
    if (typeof logoUrl === 'string' && (logoUrl.startsWith('http://') || logoUrl.startsWith('https://') || logoUrl.startsWith('data:'))) return logoUrl
    return logoUrl
  }, [logoUrl])

  React.useEffect(() => setLogoError(false), [effectiveLogoUrl])

  const nSubtotal = safeNumber(subtotal)
  const nTax = safeNumber(tax)
  // Accept multiple discount field names to avoid missing discounts on receipts
  const nDiscount = safeNumber(
    discount != null ? discount : (typeof discountAmount !== 'undefined' ? discountAmount : (typeof totalDiscount !== 'undefined' ? totalDiscount : 0))
  )
  const nOld = safeNumber(oldBalance)
  const nPayment = safeNumber(paymentAmount)
  const nCredit = safeNumber(creditAmount)

  const computedInvoiceTotal = invoiceTotal != null ? safeNumber(invoiceTotal) : (nSubtotal + nTax - nDiscount)
  
  // Calculate TOTAL as Invoice Total + Old Balance
  const displayedTotal = computedInvoiceTotal + nOld
  
  // Fixed calculation for remaining balance: (Old Balance + Invoice Total) - Payment Amount
  const computedRemaining = remainingBalance != null ? safeNumber(remainingBalance) : 
    Math.max(0, (nOld + computedInvoiceTotal) - nPayment)
  
  // Show remaining balance if there's an old balance OR if remaining > 0
  // Also show if old balance exists and payment is less than total
  const shouldShowRemaining = computedRemaining > 0 || nOld !== 0

  // Always show Old Balance line (branch and warehouse), even if zero
  const showOldBalance = true

  // For warehouse type, use landscape orientation
  const isWarehouse = type === 'warehouse'
  const effectiveOrientation = isWarehouse ? 'landscape' : orientation
  
  const containerStyles = layout === 'thermal' ? {
    width: '100%',
    maxWidth: '100%',
    fontFamily: 'monospace',
    fontSize: '11px',
    lineHeight: '1.1',
    color: '#000',
    backgroundColor: '#fff',
    padding: '8px 18px 8px 16px',
    margin: '0 0 0 auto',
    boxSizing: 'border-box'
  } : {
    width: '100%',
    maxWidth: '1400px',
    fontFamily: 'Arial, sans-serif',
    fontSize: fontSize,
    lineHeight: isWarehouse ? '1.1' : '1.2',
    color: '#000',
    backgroundColor: '#fff',
    padding: isWarehouse ? '10px 16px' : '16px 24px',
    margin: '0 auto',
    boxSizing: 'border-box'
  }

  // ✅ INVOICE-STYLE LAYOUT FOR COLOR PRINTER
  if (layout === 'color') {
    const nShipping = safeNumber(shippingHandling)
    const finalTotal = computedInvoiceTotal + nOld + nShipping
    
    // For warehouse type, use landscape orientation
    const isWarehouse = type === 'warehouse'
    const effectiveOrientation = isWarehouse ? 'landscape' : orientation
    
    // Compact spacing for warehouse so it doesn't stretch vertically
    const compactSpacing = true
    
    return (
      <div className={`receipt-container ${layout}-layout`} style={containerStyles}>
        <div style={{ maxWidth: '1350px', margin: '0 auto', width: '100%' }}>
        {/* Header Section - Logo + Company Info Left, Invoice Info Right */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: compactSpacing ? '12px' : '24px', alignItems: 'flex-start', gap: '18px' }}>
          
          {/* Left: Logo first, then Company Information below */}
          <div style={{ flex: 1 }}>
            {/* Logo at the top of left column */}
            {logoUrl && (
              <div style={{ marginBottom: compactSpacing ? '6px' : '10px' }}>
                <img
                  src={logoUrl}
                  alt={companyName}
                  style={{ maxHeight: '70px', maxWidth: '160px', objectFit: 'contain', display: 'block' }}
                  onError={(e) => {
                    e.target.style.display = 'none'
                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'block'
                  }}
                />
                {/* Fallback company name text shown only if logo fails */}
                <div style={{ fontWeight: 'bold', fontSize: compactSpacing ? '20px' : '24px', color: '#000', display: 'none' }}>
                  {companyName || 'Your Company Name'}
                </div>
              </div>
            )}
            {/* Company name text (shown when no logoUrl provided) */}
            {!logoUrl && (
              <div style={{ fontWeight: 'bold', fontSize: compactSpacing ? '20px' : '24px', marginBottom: compactSpacing ? '2px' : '4px', color: '#000' }}>
                {companyName || 'Your Company Name'}
              </div>
            )}
            {companySlogan && (
              <div style={{ fontSize: '11px', fontStyle: 'italic', color: '#666', marginBottom: compactSpacing ? '4px' : '12px' }}>
                {companySlogan}
              </div>
            )}
            {companyAddress && (
              <div style={{ fontSize: compactSpacing ? '11px' : '13px', marginBottom: compactSpacing ? '1px' : '3px', lineHeight: '1.3' }}>{companyAddress}</div>
            )}
            {companyPhone && (
              <div style={{ fontSize: compactSpacing ? '11px' : '13px', marginBottom: compactSpacing ? '1px' : '3px', lineHeight: '1.3' }}>Phone: {companyPhone}</div>
            )}
            {companyEmail && (
              <div style={{ fontSize: compactSpacing ? '11px' : '13px', marginBottom: compactSpacing ? '1px' : '3px', lineHeight: '1.3' }}>Email: {companyEmail}</div>
            )}
          </div>
          
          {/* Right: Invoice Details only (logo removed from here) */}
          <div style={{ textAlign: 'right', flex: 1 }}>
            <div style={{ fontWeight: 'bold', fontSize: compactSpacing ? '20px' : '24px', marginBottom: compactSpacing ? '2px' : '4px', color: '#000' }}>
              {isWarehouse ? 'WAREHOUSE INVOICE' : 'INVOICE'}
            </div>
            <div style={{ fontSize: compactSpacing ? '11px' : '12px', marginBottom: compactSpacing ? '2px' : '4px' }}>
              <strong>INVOICE #{receiptNumber || '[100]'}</strong>
            </div>
            <div style={{ fontSize: compactSpacing ? '11px' : '12px', marginBottom: compactSpacing ? '2px' : '4px' }}>
              <strong>DATE: {date || 'NOVEMBER 18, 2025'}</strong>
            </div>
            {time && (
              <div style={{ fontSize: compactSpacing ? '10px' : '11px', color: '#666' }}>Time: {time}</div>
            )}
            {cashierName && (
              <div style={{ fontSize: compactSpacing ? '10px' : '11px', color: '#666', marginTop: compactSpacing ? '2px' : '4px' }}>Cashier: {cashierName}</div>
            )}
          </div>
        </div>

        {/* Billing and Shipping Information */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: compactSpacing ? '12px' : '24px', gap: '18px' }}>
          {/* Left: Billing TO */}
          <div style={{ flex: 1, marginRight: compactSpacing ? '10px' : '20px' }}>
            <div style={{ fontWeight: 'bold', fontSize: compactSpacing ? '10px' : '12px', marginBottom: compactSpacing ? '4px' : '8px' }}>TO:</div>
            <div style={{ fontSize: compactSpacing ? '11px' : '13px', marginBottom: compactSpacing ? '1px' : '3px', lineHeight: '1.3' }}>{customerName || '[Name]'}</div>
            {customerAddress && (
              <div style={{ fontSize: compactSpacing ? '11px' : '13px', marginBottom: compactSpacing ? '1px' : '3px', lineHeight: '1.3' }}>{customerAddress}</div>
            )}
            {customerCity && (
              <div style={{ fontSize: compactSpacing ? '11px' : '13px', marginBottom: compactSpacing ? '1px' : '3px', lineHeight: '1.3' }}>{customerCity}</div>
            )}
            {customerPhone && (
              <div style={{ fontSize: compactSpacing ? '11px' : '13px', marginBottom: compactSpacing ? '1px' : '3px', lineHeight: '1.3' }}>Phone: {customerPhone}</div>
            )}
          </div>
          
          {/* Right: SHIP TO - Hidden for all color prints */}
        </div>

        {/* Items Table */}
        <div style={{ marginBottom: compactSpacing ? '18px' : '30px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ccc', fontSize: compactSpacing ? '11px' : '12px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ border: '1px solid #ccc', padding: compactSpacing ? '4px 8px' : '5px 10px', textAlign: 'left', fontWeight: 'bold', fontSize: compactSpacing ? '11px' : '12px', width: '46%' }}>DESCRIPTION</th>
                <th style={{ border: '1px solid #ccc', padding: compactSpacing ? '4px 8px' : '5px 10px', textAlign: 'center', fontWeight: 'bold', fontSize: compactSpacing ? '11px' : '12px', width: '14%' }}>QTY</th>
                <th style={{ border: '1px solid #ccc', padding: compactSpacing ? '4px 8px' : '5px 10px', textAlign: 'right', fontWeight: 'bold', fontSize: compactSpacing ? '11px' : '12px', width: '20%' }}>UNIT PRICE</th>
                <th style={{ border: '1px solid #ccc', padding: compactSpacing ? '4px 8px' : '5px 10px', textAlign: 'right', fontWeight: 'bold', fontSize: compactSpacing ? '11px' : '12px', width: '20%' }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {items && items.length ? items.map((item, index) => {
                const qty = Number.isFinite(item.quantity) ? item.quantity : 0
                
                // Use the normalized values from normalizeCartItemForPrint directly
                let unitPriceValue = Number.isFinite(item.unitPrice) ? item.unitPrice : 
                                    (Number.isFinite(item.price) ? item.price : 0)
                
                let totalValue = Number.isFinite(item.total) ? item.total : 
                                (Number.isFinite(item.total_price) ? item.total_price : 0)
                
                // If values are still 0 or missing, try to calculate
                if ((!Number.isFinite(unitPriceValue) || unitPriceValue === 0) && qty > 0) {
                  if (Number.isFinite(totalValue) && totalValue !== 0) {
                    const discountAmount = safeNumber(item.discount || 0)
                    unitPriceValue = (totalValue + discountAmount) / qty
                  } else {
                    unitPriceValue = Number.isFinite(item.price) ? item.price :
                                    (Number.isFinite(item.sellingPrice) ? item.sellingPrice :
                                    (Number.isFinite(item.customPrice) ? item.customPrice : 0))
                  }
                }
                
                // If total is still 0 or missing, calculate from unitPrice
                if ((!Number.isFinite(totalValue) || totalValue === 0) && Number.isFinite(unitPriceValue) && unitPriceValue !== 0 && qty > 0) {
                  const discountAmount = safeNumber(item.discount || 0)
                  totalValue = (unitPriceValue * qty) - discountAmount
                }
                
                if (!Number.isFinite(unitPriceValue)) unitPriceValue = 0
                if (!Number.isFinite(totalValue)) totalValue = 0
                
                return (
                  <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                    <td style={{ border: '1px solid #ccc', padding: compactSpacing ? '3px 8px' : '4px 10px', fontSize: compactSpacing ? '11px' : '12px' }}>
                      <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                      {item.discount > 0 && (
                        <div style={{ fontSize: compactSpacing ? '11px' : '12px', color: '#d32f2f' }}>Discount: -{formatCurrency(item.discount)}</div>
                      )}
                    </td>
                    <td style={{ border: '1px solid #ccc', padding: compactSpacing ? '3px 8px' : '4px 10px', textAlign: 'center', fontSize: compactSpacing ? '11px' : '12px' }}>{formatCurrency(qty)}</td>
                    <td style={{ border: '1px solid #ccc', padding: compactSpacing ? '3px 8px' : '4px 10px', textAlign: 'right', fontSize: compactSpacing ? '11px' : '12px' }}>{formatCurrency(unitPriceValue)}</td>
                    <td style={{ border: '1px solid #ccc', padding: compactSpacing ? '3px 8px' : '4px 10px', textAlign: 'right', fontSize: compactSpacing ? '11px' : '12px', fontWeight: 'bold' }}>{formatCurrency(totalValue)}</td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan="4" style={{ border: '1px solid #ddd', padding: compactSpacing ? '10px' : '20px', textAlign: 'center', color: '#999' }}>No items</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Section - Right Aligned */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: compactSpacing ? '26px' : '46px' }}>
          <div style={{
            width: '70%',
            maxWidth: isWarehouse ? '900px' : '820px',
            minWidth: compactSpacing ? '450px' : '520px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: compactSpacing ? '4px' : '8px', fontSize: compactSpacing ? '11px' : '13px' }}>
              <span style={{ fontWeight: 'bold' }}>SUBTOTAL</span>
              <span style={{ fontWeight: 'bold' }}>{formatCurrency(nSubtotal)}</span>
            </div>
            {nDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: compactSpacing ? '4px' : '8px', fontSize: compactSpacing ? '11px' : '13px', color: '#d32f2f' }}>
                <span style={{ fontWeight: 'bold' }}>DISCOUNT</span>
                <span style={{ fontWeight: 'bold' }}>-{formatCurrency(nDiscount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: compactSpacing ? '4px' : '8px', fontSize: compactSpacing ? '11px' : '13px' }}>
              <span style={{ fontWeight: 'bold' }}>SALES TAX</span>
              <span style={{ fontWeight: 'bold' }}>{formatCurrency(nTax)}</span>
            </div>
            {nShipping > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: compactSpacing ? '4px' : '8px', fontSize: compactSpacing ? '11px' : '13px' }}>
                <span style={{ fontWeight: 'bold' }}>SHIPPING & HANDLING</span>
                <span style={{ fontWeight: 'bold' }}>{formatCurrency(nShipping)}</span>
              </div>
            )}
            {/* Always show OLD BALANCE for all invoices (branch + warehouse) */}
            {showOldBalance && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: compactSpacing ? '4px' : '8px', fontSize: compactSpacing ? '11px' : '13px' }}>
                <span style={{ fontWeight: 'bold' }}>OLD BALANCE</span>
                <span style={{ fontWeight: 'bold' }}>{formatCurrency(nOld)}</span>
              </div>
            )}
            <div style={{ borderTop: '2px solid #000', marginTop: compactSpacing ? '10px' : '16px', marginBottom: compactSpacing ? '10px' : '14px', paddingTop: compactSpacing ? '10px' : '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: compactSpacing ? '13px' : '15px', fontWeight: 'bold' }}>
                <span>TOTAL DUE</span>
                <span>{formatCurrency(finalTotal)}</span>
              </div>
            </div>
            
            {/* Payment Details */}
            <div style={{ marginTop: compactSpacing ? '14px' : '24px', paddingTop: compactSpacing ? '12px' : '20px', borderTop: '1px dashed #000' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: compactSpacing ? '6px' : '10px', fontSize: compactSpacing ? '10px' : '12px' }}>
                <span>Payment Method:</span>
                <span style={{ fontWeight: 'bold' }}>{paymentMethod}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: compactSpacing ? '6px' : '10px', fontSize: compactSpacing ? '10px' : '12px' }}>
                <span>Payment Amount:</span>
                <span style={{ fontWeight: 'bold' }}>{formatCurrency(nPayment)}</span>
              </div>
              {(nCredit > 0 || paymentMethod === 'FULLY_CREDIT') && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: compactSpacing ? '6px' : '10px', fontSize: compactSpacing ? '10px' : '12px' }}>
                  <span>Credit Amount:</span>
                  <span style={{ fontWeight: 'bold' }}>{formatCurrency(nCredit || finalTotal)}</span>
                </div>
              )}
              {shouldShowRemaining && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: compactSpacing ? '6px' : '10px', fontSize: compactSpacing ? '10px' : '12px' }}>
                  <span>Remaining Balance:</span>
                  <span style={{ fontWeight: 'bold' }}>{formatCurrency(computedRemaining)}</span>
                </div>
              )}
              {change > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: compactSpacing ? '6px' : '10px', fontSize: compactSpacing ? '10px' : '12px', color: 'green' }}>
                  <span>Change:</span>
                  <span style={{ fontWeight: 'bold' }}>{formatCurrency(change)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notes Section */}
        {notes && (
          <div style={{ marginBottom: compactSpacing ? '8px' : '24px', padding: compactSpacing ? '6px' : '12px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: compactSpacing ? '2px' : '4px', fontSize: compactSpacing ? '11px' : '13px' }}>Notes:</div>
            <div style={{ fontSize: compactSpacing ? '10px' : '12px' }}>{notes}</div>
          </div>
        )}

        {/* Signature Section - Always show for warehouse invoices */}
        {(showSignature || isWarehouse) && (
          <div style={{ marginTop: compactSpacing ? '28px' : '52px', display: 'flex', justifyContent: 'space-between', gap: compactSpacing ? '18px' : '28px' }}>
            {isWarehouse ? (
              <>
                <div style={{ width: '48%', borderTop: '1px solid #000', paddingTop: compactSpacing ? '6px' : '10px' }}>
                  <div style={{ fontSize: compactSpacing ? '11px' : '13px', fontWeight: 'bold', marginBottom: compactSpacing ? '3px' : '5px' }}>Received By:</div>
                  <div style={{ fontSize: compactSpacing ? '10px' : '12px', color: '#666', minHeight: compactSpacing ? '42px' : '54px' }}>________________________________</div>
                </div>
                <div style={{ width: '48%', borderTop: '1px solid #000', paddingTop: compactSpacing ? '6px' : '10px' }}>
                  <div style={{ fontSize: compactSpacing ? '11px' : '13px', fontWeight: 'bold', marginBottom: compactSpacing ? '3px' : '5px' }}>Signature:</div>
                  <div style={{ fontSize: compactSpacing ? '10px' : '12px', color: '#666', minHeight: compactSpacing ? '42px' : '54px' }}>________________________________</div>
                </div>
              </>
            ) : (
              <>
            <div style={{ width: '48%', borderTop: '1px solid #000', paddingTop: compactSpacing ? '6px' : '10px' }}>
              <div style={{ fontSize: compactSpacing ? '11px' : '13px', fontWeight: 'bold', marginBottom: compactSpacing ? '3px' : '5px' }}>Customer Signature</div>
              <div style={{ fontSize: compactSpacing ? '10px' : '12px', color: '#666', minHeight: compactSpacing ? '36px' : '48px' }}></div>
            </div>
            <div style={{ width: '48%', borderTop: '1px solid #000', paddingTop: compactSpacing ? '6px' : '10px' }}>
              <div style={{ fontSize: compactSpacing ? '11px' : '13px', fontWeight: 'bold', marginBottom: compactSpacing ? '3px' : '5px' }}>Authorized Signature</div>
              <div style={{ fontSize: compactSpacing ? '10px' : '12px', color: '#666', minHeight: compactSpacing ? '36px' : '48px' }}></div>
            </div>
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: compactSpacing ? '16px' : '32px', paddingTop: compactSpacing ? '8px' : '16px', borderTop: '2px solid #000' }}>
          <div style={{ fontSize: compactSpacing ? '9px' : '11px', marginBottom: compactSpacing ? '2px' : '4px', fontWeight: 'bold' }}>{footerMessage}</div>
          <div style={{ fontSize: compactSpacing ? '8px' : '10px', color: '#666' }}>Powered by Tychora | www.tychora.com</div>
        </div>

        </div>
      </div>
    )
  }

  // ✅ THERMAL PRINTER LAYOUT (Original - unchanged)
  return (
    <div className={`receipt-container ${layout}-layout`} style={containerStyles}>
      <div style={{ textAlign: layout === 'thermal' ? 'center' : 'left', marginBottom: layout === 'thermal' ? '8px' : '16px' }}>
        <div style={{ marginBottom: layout === 'thermal' ? '4px' : '8px' }}>
          {!logoError && showLogo ? (
            <Image
              src={effectiveLogoUrl}
              alt={companyName || 'Company Logo'}
              width={layout === 'thermal' ? 100 : 150}
              height={layout === 'thermal' ? 70 : 105}
              style={{ display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto' }}
              onError={() => setLogoError(true)}
              onLoad={() => setLogoError(false)}
              priority
            />
          ) : (
            <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: layout === 'thermal' ? '14px' : '18px', textAlign: 'center' }}>{companyName || ' '}</div>
          )}
        </div>
        {companyAddress && <div style={{ fontSize: layout === 'thermal' ? '9px' : '13px', marginBottom: '3px', lineHeight: '1.2' }}>{companyAddress}</div>}
        {companyPhone && <div style={{ fontSize: layout === 'thermal' ? '9px' : '13px', marginBottom: '3px', lineHeight: '1.2' }}>Tel: {companyPhone}</div>}
        {companyEmail && <div style={{ fontSize: layout === 'thermal' ? '9px' : '13px', marginBottom: '8px', lineHeight: '1.2' }}>Email: {companyEmail}</div>}
        <div style={{ borderTop: layout === 'thermal' ? '2px solid #000' : '3px solid #000', margin: layout === 'thermal' ? '4px 0' : '12px 0' }} />
        <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: layout === 'thermal' ? '12px' : '18px', color: '#000', textAlign: 'center', marginBottom: layout === 'thermal' ? '4px' : '8px' }}>{title}</div>
      </div>

      <div style={{ marginBottom: layout === 'thermal' ? '8px' : '16px', backgroundColor: layout === 'color' ? '#f5f5f5' : 'transparent', padding: layout === 'color' ? '12px' : '0', borderRadius: layout === 'color' ? '8px' : '0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold' }}>Receipt #:</span>
          <span style={{ fontWeight: 'bold', fontSize: layout === 'thermal' ? '10px' : '13px' }}>{receiptNumber || 'N/A'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold' }}>Date:</span>
          <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px' }}>{date}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold' }}>Time:</span>
          <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px' }}>{time}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold' }}>Cashier:</span>
          <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px' }}>{cashierName || 'N/A'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold' }}>Customer:</span>
          <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px' }}>{customerName}</span>
        </div>
      </div>

      <div style={{ borderTop: layout === 'thermal' ? '2px solid #000' : '3px solid #000', margin: layout === 'thermal' ? '4px 0' : '12px 0' }} />

      <div style={{ marginBottom: layout === 'thermal' ? '8px' : '16px' }}>
        <div style={{ display: 'flex', marginBottom: '6px', fontWeight: 'bold', backgroundColor: layout === 'color' ? '#1976d2' : 'transparent', color: layout === 'color' ? '#fff' : '#000', padding: layout === 'color' ? '8px 4px' : '0', borderRadius: layout === 'color' ? '4px' : '0' }}>
          <div style={{ flex: 2, fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold' }}>Item</div>
          <div style={{ width: '40px', textAlign: 'center', fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold' }}>Qty</div>
          <div style={{ width: '60px', textAlign: 'right', fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold' }}>Price</div>
          <div style={{ width: '60px', textAlign: 'right', fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold' }}>Total</div>
        </div>
        <div style={{ borderTop: layout === 'thermal' ? '2px solid #000' : '2px solid #000', marginBottom: '6px' }} />

        {items && items.length ? items.map((item, index) => (
          <div key={index} style={{ marginBottom: '6px', backgroundColor: layout === 'color' && index % 2 === 0 ? '#f9f9f9' : 'transparent', padding: layout === 'color' ? '8px 4px' : '0', borderRadius: layout === 'color' ? '4px' : '0' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: layout === 'thermal' ? '10px' : '13px', color: '#000' }}>{item.name}</div>
            <div style={{ display: 'flex', marginTop: '2px' }}>
              <div style={{ 
                flex: 2, 
                fontSize: layout === 'thermal' ? '10px' : '12px',
                color: '#000'
              }}></div>
              <div style={{ 
                width: '40px', 
                textAlign: 'center', 
                fontSize: layout === 'thermal' ? '10px' : '12px',
                color: '#000',
                fontWeight: 'bold'
              }}>
                {formatCurrency(item.quantity)}
              </div>
              {(() => {
                const qty = Number.isFinite(item.quantity) ? item.quantity : 0
                const unitPriceValue = Number.isFinite(item.unitPrice) && item.unitPrice !== 0
                  ? item.unitPrice
                  : Number.isFinite(item.price) && item.price !== 0
                    ? item.price
                    : Number.isFinite(item.selling_price) && item.selling_price !== 0
                      ? item.selling_price
                      : Number.isFinite(item.catalog_price) && item.catalog_price !== 0
                        ? item.catalog_price
                    : 0
                const totalValue = Number.isFinite(item.total) && item.total !== 0
                  ? item.total
                  : Number.isFinite(item.total_price) && item.total_price !== 0
                    ? item.total_price
                    : Number.isFinite(item.subtotal) && item.subtotal !== 0
                      ? item.subtotal
                  : ((unitPriceValue * qty) - (item.discount || 0))
                const formattedUnit = formatCurrency(unitPriceValue)
                const formattedTotal = formatCurrency(totalValue)
                return (
                  <>
                    <div style={{ 
                      width: '60px', 
                      textAlign: 'right', 
                      fontSize: layout === 'thermal' ? '10px' : '12px',
                      color: '#000',
                      fontWeight: 'bold'
                    }}>
                      {formattedUnit}
                    </div>
                    <div style={{ 
                      width: '60px', 
                      textAlign: 'right', 
                      fontWeight: 'bold', 
                      fontSize: layout === 'thermal' ? '10px' : '12px',
                      color: '#000'
                    }}>
                      {formattedTotal}
                    </div>
                  </>
                )
              })()}
            </div>
            
            {/* Show item discount if applicable */}
            {item.discount > 0 && (
              <div style={{ 
                display: 'flex', 
                marginTop: '2px',
                justifyContent: 'flex-end'
              }}>
                <div style={{ 
                  fontSize: layout === 'thermal' ? '9px' : '11px',
                  color: '#d32f2f',
                  fontWeight: 'bold',
                  marginRight: '60px'
                }}>
                  -{formatCurrency(item.discount)}
                </div>
              </div>
            )}
          </div>
        )) : (
          <div style={{ textAlign: 'center', padding: 8 }}>No items</div>
        )}
      </div>

      <div style={{ borderTop: layout === 'thermal' ? '2px solid #000' : '3px solid #000', margin: layout === 'thermal' ? '4px 0' : '12px 0' }} />

      <div style={{ marginBottom: layout === 'thermal' ? '8px' : '16px', backgroundColor: layout === 'color' ? '#f0f8ff' : 'transparent', padding: layout === 'color' ? '12px' : '0', borderRadius: layout === 'color' ? '8px' : '0', border: layout === 'color' ? '1px solid #1976d2' : 'none' }}>
        {/* Subtotal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold' }}>Subtotal:</span>
          <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold' }}>{formatCurrency(nSubtotal)}</span>
        </div>

        {/* Discount - NOW SHOWS BEFORE TAX */}
        {nDiscount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold', color: '#d32f2f' }}>Discount:</span>
            <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold', color: '#d32f2f' }}>-{formatCurrency(nDiscount)}</span>
          </div>
        )}

        {/* Tax */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold' }}>Tax:</span>
          <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold' }}>{formatCurrency(nTax)}</span>
        </div>

        {/* Invoice Total */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', marginTop: '4px', borderBottom: '1px dashed #000', paddingBottom: '4px' }}>
          <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold' }}>Invoice Total:</span>
          <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold' }}>{formatCurrency(computedInvoiceTotal)}</span>
        </div>

        {/* Old Balance - NOW SHOWS BEFORE TOTAL (always) */}
        {showOldBalance && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', marginTop: '4px' }}>
            <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold' }}>Old Balance:</span>
            <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold' }}>{formatCurrency(nOld)}</span>
          </div>
        )}

        {/* TOTAL */}
        <div style={{ marginTop: 10, borderTop: '2px solid #000', paddingTop: 6, fontSize: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}>
            <div>TOTAL</div>
            <div>{formatCurrency(displayedTotal)}</div>
          </div>
        </div>

        {/* PAYMENT DETAILS SECTION - ALWAYS SHOW PAYMENT METHOD */}
        <div style={{ marginTop: '8px', borderTop: '1px dashed #000', paddingTop: '6px' }}>
          {/* Payment Method - ALWAYS SHOW */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold' }}>Payment Method:</span>
            <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold' }}>{paymentMethod}</span>
          </div>

          {/* Payment Amount - ALWAYS SHOW */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold' }}>Payment Amount:</span>
            <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold' }}>{formatCurrency(nPayment)}</span>
          </div>

          {/* Credit Amount - Show if applicable (partial payment or fully credit) */}
          {(nCredit > 0 || paymentMethod === 'FULLY_CREDIT') && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold' }}>Credit Amount:</span>
              <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold' }}>{formatCurrency(nCredit || displayedTotal)}</span>
            </div>
          )}

          {/* Remaining Balance - Show when there's an old balance or remaining > 0 */}
          {shouldShowRemaining && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontWeight: 700 }}>
              <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold' }}>Remaining Balance:</span>
              <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold' }}>{formatCurrency(computedRemaining)}</span>
            </div>
          )}

          {/* Change - Show when overpaid */}
          {change > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontWeight: 700 }}>
              <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold', color: 'green' }}>Change:</span>
              <span style={{ fontSize: layout === 'thermal' ? '10px' : '13px', fontWeight: 'bold', color: 'green' }}>{formatCurrency(change)}</span>
            </div>
          )}
        </div>
      </div>

      {notes && (
        <>
          <div style={{ borderTop: '2px solid #000', margin: '4px 0' }} />
          <div style={{ marginBottom: '8px', backgroundColor: layout === 'color' ? '#fff3cd' : 'transparent', padding: layout === 'color' ? '8px' : '0', borderRadius: layout === 'color' ? '4px' : '0' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Notes:</div>
            <div style={{ fontSize: layout === 'thermal' ? '9px' : '11px', fontWeight: 'bold' }}>{notes}</div>
          </div>
        </>
      )}

      <div style={{ textAlign: 'center', marginTop: layout === 'thermal' ? '8px' : '16px' }}>
        <div style={{ borderTop: '2px solid #000', marginBottom: '6px' }} />
        <div style={{ fontSize: layout === 'thermal' ? '9px' : '11px', marginBottom: '4px', fontWeight: 'bold' }}>{footerMessage}</div>
        <div style={{ fontSize: layout === 'thermal' ? '10px' : '12px', color: '#000', fontWeight: 'bold', textAlign: 'center', marginBottom: '2px' }}>Powered by Tychora</div>
        <div style={{ fontSize: layout === 'thermal' ? '9px' : '11px', color: '#000', textAlign: 'center' }}>www.tychora.com</div>
      </div>
    </div>
  )
}