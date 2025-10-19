'use client'

import React from 'react'
import Image from 'next/image'
import './PrintLayout.css'

const PrintLayout = ({ 
  type = 'receipt', // 'receipt' or 'invoice'
  title = 'RECEIPT',
  companyName = 'MultiPOS Store',
  companyAddress = 'Shop no 42 unit no 2 latifabad near musarrat banquet Hyderabad',
  companyPhone = '03111100355',
  companyEmail = 'info@multipos.com',
  receiptNumber,
  date,
  time,
  cashierName,
  customerName = 'Walk-in Customer',
  items = [],
  subtotal = 0,
  tax = 0,
  total = 0,
  paymentMethod = 'Cash',
  paymentAmount = null,
  creditAmount = null,
  paymentStatus = 'COMPLETED',
  outstandingCleared = null,
  discount = 0,
  change = 0,
  notes = '',
  footerMessage = 'Thank you for your business!',
  showLogo = true,
  width = 300, // Receipt width in pixels
  layout = 'thermal', // 'thermal' or 'color'
  orientation = 'portrait', // 'portrait' or 'landscape'
  fontSize = '12px'
}) => {
  const [logoError, setLogoError] = React.useState(false)
  const formatCurrency = (amount) => {
    const num = Number(amount)
    return isNaN(num) ? '0.00' : num.toFixed(2)
  }

  // Determine container styles based on layout
  const containerStyles = layout === 'thermal' ? {
    width: '100%',
    maxWidth: '100%',
    fontFamily: 'monospace',
    fontSize: '11px',
    lineHeight: '1.1',
    color: '#000',
    backgroundColor: '#fff',
    padding: '4px 0 4px 16px',
    margin: '0 0 0 auto',
    boxSizing: 'border-box',
    fontWeight: 'bold'
  } : {
    width: `${width}px`,
    maxWidth: `${width}px`,
    fontFamily: 'Arial, sans-serif',
    fontSize: fontSize,
    lineHeight: '1.6',
    color: '#000',
    backgroundColor: '#fff',
    padding: '30px',
    margin: '0 auto',
    boxSizing: 'border-box',
    textAlign: 'left',
    border: '2px solid #1976d2',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(25, 118, 210, 0.15)',
    fontWeight: 'bold'
  }

  return (
    <div
      className={`receipt-container ${layout}-layout`}
      style={containerStyles}
    >
      {/* Header */}
      <div style={{ 
        textAlign: layout === 'thermal' ? 'center' : 'left', 
        marginBottom: layout === 'thermal' ? '8px' : '16px' 
      }}>
        <div style={{ marginBottom: layout === 'thermal' ? '4px' : '8px' }}>
          {!logoError ? (
            <Image 
              src="/petzonelogo.png" 
              alt="PetZone" 
              width={layout === 'thermal' ? 100 : 150}
              height={layout === 'thermal' ? 70 : 105}
              style={{ 
                filter: layout === 'thermal' ? 'grayscale(100%)' : 'none',
                display: 'block',
                margin: '0 auto',
                width: layout === 'thermal' ? '100px' : '150px',
                minHeight: layout === 'thermal' ? '50px' : '75px',
                maxWidth: '100%',
                height: 'auto'
              }}
              onError={() => {
                setLogoError(true)
              }}
              onLoad={() => {
                setLogoError(false)
              }}
              priority
            />
          ) : (
            <div 
              style={{ 
                fontWeight: 'bold', 
                marginBottom: '4px', 
                fontSize: layout === 'thermal' ? '14px' : '18px',
                textAlign: 'center',
                backgroundColor: layout === 'thermal' ? 'transparent' : '#2E7D32',
                color: layout === 'thermal' ? '#000' : '#fff',
                padding: layout === 'thermal' ? '0' : '4px 8px',
                borderRadius: layout === 'thermal' ? '0' : '4px',
                border: layout === 'thermal' ? '1px solid #000' : 'none',
                minHeight: layout === 'thermal' ? '50px' : '75px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {companyName || 'PETZONE'}
            </div>
          )}
        </div>
        <div style={{ 
          fontSize: layout === 'thermal' ? '9px' : '13px', 
          marginBottom: '3px', 
          lineHeight: '1.2',
          color: '#000',
          fontWeight: 'bold'
        }}>
          {companyAddress}
        </div>
        <div style={{ 
          fontSize: layout === 'thermal' ? '9px' : '13px', 
          marginBottom: '3px', 
          lineHeight: '1.2',
          color: '#000',
          fontWeight: 'bold'
        }}>
          Tel: {companyPhone}
        </div>
        <div style={{ 
          fontSize: layout === 'thermal' ? '9px' : '13px', 
          marginBottom: '8px', 
          lineHeight: '1.2',
          color: '#000',
          fontWeight: 'bold'
        }}>
          Email: {companyEmail}
        </div>
        <div style={{ 
          borderTop: layout === 'thermal' ? '2px solid #000' : '3px solid #000', 
          margin: layout === 'thermal' ? '4px 0' : '12px 0' 
        }} />
        <div style={{ 
          fontWeight: 'bold', 
          textTransform: 'uppercase', 
          fontSize: layout === 'thermal' ? '12px' : '18px',
          color: '#000',
          textAlign: 'center',
          marginBottom: layout === 'thermal' ? '4px' : '8px'
        }}>
          {title}
        </div>
      </div>

      {/* Receipt Info */}
      <div style={{ 
        marginBottom: layout === 'thermal' ? '8px' : '16px',
        backgroundColor: layout === 'color' ? '#f5f5f5' : 'transparent',
        padding: layout === 'color' ? '12px' : '0',
        borderRadius: layout === 'color' ? '8px' : '0'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span style={{ 
            fontSize: layout === 'thermal' ? '10px' : '13px',
            fontWeight: 'bold',
            color: '#000'
          }}>Receipt #:</span>
          <span style={{ 
            fontWeight: 'bold', 
            fontSize: layout === 'thermal' ? '10px' : '13px',
            color: '#000'
          }}>
            {receiptNumber || 'N/A'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span style={{ 
            fontSize: layout === 'thermal' ? '10px' : '13px',
            fontWeight: 'bold',
            color: '#000'
          }}>Date:</span>
          <span style={{ 
            fontSize: layout === 'thermal' ? '10px' : '13px',
            color: '#000',
            fontWeight: 'bold'
          }}>{date}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span style={{ 
            fontSize: layout === 'thermal' ? '10px' : '13px',
            fontWeight: 'bold',
            color: '#000'
          }}>Time:</span>
          <span style={{ 
            fontSize: layout === 'thermal' ? '10px' : '13px',
            color: '#000',
            fontWeight: 'bold'
          }}>{time}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span style={{ 
            fontSize: layout === 'thermal' ? '10px' : '13px',
            fontWeight: 'bold',
            color: '#000'
          }}>Cashier:</span>
          <span style={{ 
            fontSize: layout === 'thermal' ? '10px' : '13px',
            color: '#000',
            fontWeight: 'bold'
          }}>{cashierName || 'N/A'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span style={{ 
            fontSize: layout === 'thermal' ? '10px' : '13px',
            fontWeight: 'bold',
            color: '#000'
          }}>Customer:</span>
          <span style={{ 
            fontSize: layout === 'thermal' ? '10px' : '13px',
            color: '#000',
            fontWeight: 'bold'
          }}>{customerName}</span>
        </div>
      </div>

      <div style={{ 
        borderTop: layout === 'thermal' ? '2px solid #000' : '3px solid #000', 
        margin: layout === 'thermal' ? '4px 0' : '12px 0' 
      }} />

      {/* Items */}
      <div style={{ marginBottom: layout === 'thermal' ? '8px' : '16px' }}>
        <div style={{ 
          display: 'flex', 
          marginBottom: '6px', 
          fontWeight: 'bold',
          backgroundColor: layout === 'color' ? '#1976d2' : 'transparent',
          color: layout === 'color' ? '#fff' : '#000',
          padding: layout === 'color' ? '8px 4px' : '0',
          borderRadius: layout === 'color' ? '4px' : '0'
        }}>
          <div style={{ 
            flex: 2, 
            fontSize: layout === 'thermal' ? '10px' : '13px',
            fontWeight: 'bold'
          }}>Item</div>
          <div style={{ 
            width: '40px', 
            textAlign: 'center', 
            fontSize: layout === 'thermal' ? '10px' : '13px',
            fontWeight: 'bold'
          }}>Qty</div>
          <div style={{ 
            width: '60px', 
            textAlign: 'right', 
            fontSize: layout === 'thermal' ? '10px' : '13px',
            fontWeight: 'bold'
          }}>Price</div>
          <div style={{ 
            width: '60px', 
            textAlign: 'right', 
            fontSize: layout === 'thermal' ? '10px' : '13px',
            fontWeight: 'bold'
          }}>Total</div>
        </div>
        <div style={{ 
          borderTop: layout === 'thermal' ? '2px solid #000' : '2px solid #000', 
          marginBottom: '6px' 
        }} />
        
        {items.map((item, index) => (
          <div key={index} style={{ 
            marginBottom: '6px',
            backgroundColor: layout === 'color' && index % 2 === 0 ? '#f9f9f9' : 'transparent',
            padding: layout === 'color' ? '8px 4px' : '0',
            borderRadius: layout === 'color' ? '4px' : '0'
          }}>
            <div style={{ 
              fontWeight: 'bold', 
              marginBottom: '2px', 
              fontSize: layout === 'thermal' ? '10px' : '13px',
              color: '#000'
            }}>
              {item.name}
            </div>
            {item.sku && (
              <div style={{ 
                fontSize: layout === 'thermal' ? '9px' : '11px', 
                color: '#000',
                marginBottom: '4px',
                fontWeight: 'bold'
              }}>
                SKU: {item.sku}
              </div>
            )}
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
                {item.quantity}
              </div>
              <div style={{ 
                width: '60px', 
                textAlign: 'right', 
                fontSize: layout === 'thermal' ? '10px' : '12px',
                color: '#000',
                fontWeight: 'bold'
              }}>
                {formatCurrency(item.unitPrice || item.price || 0)}
              </div>
              <div style={{ 
                width: '60px', 
                textAlign: 'right', 
                fontWeight: 'bold', 
                fontSize: layout === 'thermal' ? '10px' : '12px',
                color: '#000'
              }}>
                {formatCurrency((item.unitPrice || item.price || 0) * item.quantity)}
              </div>
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
                  Discount: -{formatCurrency(item.discount)}
                </div>
                <div style={{ 
                  width: '60px', 
                  textAlign: 'right', 
                  fontWeight: 'bold', 
                  fontSize: layout === 'thermal' ? '10px' : '12px',
                  color: '#d32f2f'
                }}>
                  {formatCurrency(((item.unitPrice || item.price || 0) * item.quantity) - (item.discount || 0))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ 
        borderTop: layout === 'thermal' ? '2px solid #000' : '3px solid #000', 
        margin: layout === 'thermal' ? '4px 0' : '12px 0' 
      }} />

      {/* Totals */}
      <div style={{ 
        marginBottom: layout === 'thermal' ? '8px' : '16px',
        backgroundColor: layout === 'color' ? '#f0f8ff' : 'transparent',
        padding: layout === 'color' ? '12px' : '0',
        borderRadius: layout === 'color' ? '8px' : '0',
        border: layout === 'color' ? '1px solid #1976d2' : 'none'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ 
            fontSize: layout === 'thermal' ? '10px' : '13px',
            fontWeight: 'bold',
            color: '#000'
          }}>Subtotal:</span>
          <span style={{ 
            fontSize: layout === 'thermal' ? '10px' : '13px',
            color: '#000',
            fontWeight: 'bold'
          }}>{formatCurrency(subtotal)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ 
            fontSize: layout === 'thermal' ? '10px' : '13px',
            fontWeight: 'bold',
            color: '#000'
          }}>Tax:</span>
          <span style={{ 
            fontSize: layout === 'thermal' ? '10px' : '13px',
            color: '#000',
            fontWeight: 'bold'
          }}>{formatCurrency(tax)}</span>
        </div>
        
        {/* Show discount if applicable */}
        {discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ 
              fontSize: layout === 'thermal' ? '10px' : '13px',
              fontWeight: 'bold',
              color: '#d32f2f'
            }}>Discount:</span>
            <span style={{ 
              fontSize: layout === 'thermal' ? '10px' : '13px',
              color: '#d32f2f',
              fontWeight: 'bold'
            }}>-{formatCurrency(discount)}</span>
          </div>
        )}
        <div style={{ 
          borderTop: layout === 'thermal' ? '2px solid #000' : '3px solid #000', 
          margin: '8px 0' 
        }} />
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginBottom: '8px',
          padding: layout === 'color' ? '8px 0' : '0'
        }}>
          <span style={{ 
            fontWeight: 'bold', 
            fontSize: layout === 'thermal' ? '12px' : '16px',
            color: '#000'
          }}>
            TOTAL:
          </span>
          <span style={{ 
            fontWeight: 'bold', 
            fontSize: layout === 'thermal' ? '12px' : '16px',
            color: '#000'
          }}>
            {formatCurrency(total)}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ 
            fontSize: layout === 'thermal' ? '10px' : '13px',
            fontWeight: 'bold',
            color: '#000'
          }}>Payment Method:</span>
          <span style={{ 
            fontSize: layout === 'thermal' ? '10px' : '13px',
            color: '#000',
            fontWeight: 'bold'
          }}>{paymentMethod}</span>
        </div>
        
        {/* Show payment amount (what customer is paying now) */}
        {paymentAmount !== null && paymentAmount !== undefined && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ 
              fontSize: layout === 'thermal' ? '10px' : '13px',
              fontWeight: 'bold',
              color: '#000'
            }}>Payment Amount:</span>
            <span style={{ 
              fontSize: layout === 'thermal' ? '10px' : '13px',
              color: '#000',
              fontWeight: 'bold'
            }}>{formatCurrency(paymentAmount)}</span>
          </div>
        )}
        
        {/* Show credit amount if there's a remaining balance */}
        {creditAmount !== null && creditAmount !== undefined && creditAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ 
              fontSize: layout === 'thermal' ? '10px' : '13px',
              fontWeight: 'bold',
              color: '#000'
            }}>Credit Amount:</span>
            <span style={{ 
              fontSize: layout === 'thermal' ? '10px' : '13px',
              color: '#000',
              fontWeight: 'bold'
            }}>{formatCurrency(creditAmount)}</span>
          </div>
        )}
        
        {/* Show outstanding payments cleared if applicable */}
        {outstandingCleared !== null && outstandingCleared !== undefined && outstandingCleared > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ 
              fontSize: layout === 'thermal' ? '10px' : '13px',
              fontWeight: 'bold',
              color: '#2E7D32'
            }}>Outstanding Cleared:</span>
            <span style={{ 
              fontSize: layout === 'thermal' ? '10px' : '13px',
              color: '#2E7D32',
              fontWeight: 'bold'
            }}>{formatCurrency(outstandingCleared)}</span>
          </div>
        )}
        
        {/* Payment status removed - not needed on receipt */}
        {change > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ 
              fontSize: layout === 'thermal' ? '10px' : '13px',
              fontWeight: 'bold',
              color: '#000'
            }}>Change:</span>
            <span style={{ 
              fontSize: layout === 'thermal' ? '10px' : '13px',
              color: '#000',
              fontWeight: 'bold'
            }}>{formatCurrency(change)}</span>
          </div>
        )}
      </div>

      {/* Notes */}
      {notes && (
        <>
          <div style={{ 
            borderTop: layout === 'thermal' ? '2px solid #000' : '2px solid #000', 
            margin: layout === 'thermal' ? '4px 0' : '8px 0' 
          }} />
          <div style={{ 
            marginBottom: layout === 'thermal' ? '8px' : '12px',
            backgroundColor: layout === 'color' ? '#fff3cd' : 'transparent',
            padding: layout === 'color' ? '8px' : '0',
            borderRadius: layout === 'color' ? '4px' : '0',
            border: layout === 'color' ? '1px solid #ffc107' : 'none'
          }}>
            <div style={{ 
              fontWeight: 'bold', 
              marginBottom: '4px', 
              fontSize: layout === 'thermal' ? '10px' : '12px',
              color: '#000'
            }}>
              Notes:
            </div>
            <div style={{ 
              fontSize: layout === 'thermal' ? '9px' : '11px',
              color: '#000',
              fontWeight: 'bold'
            }}>
              {notes}
            </div>
          </div>
        </>
      )}

      {/* Return Policy */}
      <div style={{ 
        textAlign: 'center', 
        marginTop: layout === 'thermal' ? '8px' : '16px',
        backgroundColor: layout === 'color' ? '#fff3cd' : 'transparent',
        padding: layout === 'color' ? '8px' : '0',
        borderRadius: layout === 'color' ? '4px' : '0',
        border: layout === 'color' ? '1px solid #ffc107' : 'none'
      }}>
        <div style={{ 
          borderTop: layout === 'thermal' ? '2px solid #000' : '2px solid #000', 
          marginBottom: '6px' 
        }} />
        <div style={{ 
          fontSize: layout === 'thermal' ? '9px' : '11px', 
          marginBottom: '4px',
          color: '#000',
          fontWeight: 'bold'
        }}>
          (Please return or exchange within 3 days)
        </div>
      </div>

      {/* Footer */}
      <div style={{ 
        textAlign: 'center', 
        marginTop: layout === 'thermal' ? '8px' : '16px',
        backgroundColor: layout === 'color' ? '#f8f9fa' : 'transparent',
        padding: layout === 'color' ? '12px' : '0',
        borderRadius: layout === 'color' ? '8px' : '0',
        border: layout === 'color' ? '1px solid #dee2e6' : 'none'
      }}>
        <div style={{ 
          borderTop: layout === 'thermal' ? '2px solid #000' : '2px solid #000', 
          marginBottom: '6px' 
        }} />
        <div style={{ 
          fontSize: layout === 'thermal' ? '9px' : '11px', 
          marginBottom: '4px',
          color: '#000',
          fontWeight: 'bold'
        }}>
          {footerMessage}
        </div>
        <div style={{ 
          borderTop: layout === 'thermal' ? '2px solid #000' : '2px solid #000', 
          margin: '6px 0' 
        }} />
        <div style={{ 
          fontSize: layout === 'thermal' ? '10px' : '12px', 
          color: '#000', 
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: '2px',
          letterSpacing: '0.5px'
        }}>
          Powered by Tychora
        </div>
        <div style={{ 
          fontSize: layout === 'thermal' ? '9px' : '11px', 
          color: '#000', 
          display: 'block',
          fontWeight: 'bold',
          textAlign: 'center',
          letterSpacing: '0.3px'
        }}>
          www.tychora.com
        </div>
      </div>
    </div>
  )
}

export default PrintLayout